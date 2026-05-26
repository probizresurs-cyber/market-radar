/**
 * POST /api/presentation-view-event
 *
 * Beacon-event от просмотрщика расшаренной презентации: сколько секунд
 * провёл на каждом слайде. Анонимно: только session_id (random) + IP hash.
 *
 * Body: { slug, sessionId, slideIndex, timeOnSlideMs }
 *
 * Не auth-protected — публичный shared-link могут смотреть кто угодно.
 * Защита от спама — rate-limit + max 200 events / session.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createHash } from "crypto";

export const runtime = "nodejs";

const sessionEventCount = new Map<string, number>();
const MAX_EVENTS_PER_SESSION = 200;

export async function POST(req: Request) {
  let body: { slug?: string; sessionId?: string; slideIndex?: number; timeOnSlideMs?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const slug = body.slug?.toString().slice(0, 32);
  const sessionId = body.sessionId?.toString().slice(0, 64);
  const slideIndex = Math.max(0, Math.floor(Number(body.slideIndex) || 0));
  const timeOnSlideMs = Math.max(0, Math.min(600_000, Math.floor(Number(body.timeOnSlideMs) || 0)));
  if (!slug || !sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  // Анти-спам: max 200 events на session.
  const count = (sessionEventCount.get(sessionId) ?? 0) + 1;
  if (count > MAX_EVENTS_PER_SESSION) {
    return NextResponse.json({ ok: false, error: "Too many events" }, { status: 429 });
  }
  sessionEventCount.set(sessionId, count);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  // Async insert — не блокируем beacon.
  void query(
    `INSERT INTO presentation_views (share_slug, session_id, slide_index, time_on_slide_ms, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [slug, sessionId, slideIndex, timeOnSlideMs, ipHash, req.headers.get("user-agent")?.slice(0, 300) || null],
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
