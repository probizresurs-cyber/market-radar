// Rate-limits express-scans through the Telegram bot to 1 per chat per
// calendar month. Uses Postgres when DATABASE_URL is set; otherwise falls
// back to an in-memory map (process-local).
//
// Why per-month rather than per-day: lead-magnet scans are expensive
// (Claude tokens + parsing) and the goal is qualified entry into the funnel,
// not free unlimited audits. ТЗ §3.7 / §9.3 explicitly caps to 1/month.

import { query } from "./db";

const inMemory = new Map<number, string>(); // chatId → "YYYY-MM"

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-04"
}

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS tg_scans (
        chat_id BIGINT NOT NULL,
        month TEXT NOT NULL,
        scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        url TEXT,
        PRIMARY KEY (chat_id, month)
      )
    `);
    tableInitialized = true;
  } catch (err) {
    // DB not available — fall back to in-memory
    console.warn("[tg-scan-limiter] DB init failed, using in-memory:", err);
  }
}

export interface ScanQuotaResult {
  allowed: boolean;
  source: "db" | "memory";
  // ISO date when the next scan becomes available (start of next month)
  nextAllowedAt?: string;
}

export async function canScan(chatId: number): Promise<ScanQuotaResult> {
  await ensureTable();
  const month = currentMonth();

  if (tableInitialized) {
    try {
      const rows = await query<{ chat_id: string }>(
        `SELECT chat_id FROM tg_scans WHERE chat_id = $1 AND month = $2 LIMIT 1`,
        [chatId, month],
      );
      if (rows.length > 0) {
        return {
          allowed: false,
          source: "db",
          nextAllowedAt: nextMonthIso(),
        };
      }
      return { allowed: true, source: "db" };
    } catch (err) {
      console.warn("[tg-scan-limiter] DB read failed, using in-memory:", err);
    }
  }

  // In-memory fallback
  const last = inMemory.get(chatId);
  if (last === month) {
    return { allowed: false, source: "memory", nextAllowedAt: nextMonthIso() };
  }
  return { allowed: true, source: "memory" };
}

export async function recordScan(chatId: number, url?: string): Promise<void> {
  await ensureTable();
  const month = currentMonth();

  if (tableInitialized) {
    try {
      await query(
        `INSERT INTO tg_scans (chat_id, month, url) VALUES ($1, $2, $3)
         ON CONFLICT (chat_id, month) DO NOTHING`,
        [chatId, month, url ?? null],
      );
      return;
    } catch (err) {
      console.warn("[tg-scan-limiter] DB write failed:", err);
    }
  }

  inMemory.set(chatId, month);
}

function nextMonthIso(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function formatNextAllowed(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
