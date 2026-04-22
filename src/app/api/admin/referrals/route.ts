import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// Short, memorable code like "PROMO30-50" → collision-safe via UNIQUE constraint.
function generateCode(name: string): string {
  const base = (name || "REF")
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, "")
    .slice(0, 6)
    .toUpperCase() || "REF";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${base}-${suffix}`;
}

// GET — list referral links
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const rows = await query(
    `SELECT id, code, name, trial_days, discount_pct, discount_months, tokens_limit,
            valid_to, max_uses, used_count, is_active, notes, created_at
     FROM referral_links
     ORDER BY created_at DESC`,
  );
  return NextResponse.json({ ok: true, links: rows });
}

// POST — create or update
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const body = await req.json();
  const {
    id,
    name,
    code: codeIn,
    trial_days = 30,
    discount_pct = 0,
    discount_months = 0,
    tokens_limit,
    valid_to,
    max_uses,
    notes,
    is_active = true,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "Название обязательно" }, { status: 400 });
  }

  const safeInt = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };
  const tDays = safeInt(trial_days, 0, 365, 30);
  const dPct = safeInt(discount_pct, 0, 100, 0);
  const dMonths = safeInt(discount_months, 0, 60, 0);
  const cap = max_uses == null || max_uses === "" ? null : safeInt(max_uses, 1, 1_000_000, 100);
  // tokens_limit is optional — null/empty means "use default TRIAL_TOKEN_LIMIT at signup".
  const tokLimit = tokens_limit == null || tokens_limit === ""
    ? null
    : safeInt(tokens_limit, 1, 100_000_000, 100_000);
  const vTo = valid_to ? new Date(String(valid_to)).toISOString() : null;

  if (id) {
    await query(
      `UPDATE referral_links
         SET name = $1, trial_days = $2, discount_pct = $3, discount_months = $4,
             tokens_limit = $5, valid_to = $6, max_uses = $7, is_active = $8, notes = $9
       WHERE id = $10`,
      [name.trim(), tDays, dPct, dMonths, tokLimit, vTo, cap, !!is_active, (notes as string | null) || null, id],
    );
    return NextResponse.json({ ok: true, id });
  }

  // Create — generate a unique code
  let code = (typeof codeIn === "string" && codeIn.trim())
    ? codeIn.trim().toUpperCase()
    : generateCode(name);
  // Retry a few times if code collides
  for (let i = 0; i < 5; i++) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM referral_links WHERE code = $1`,
      [code],
    );
    if (existing.length === 0) break;
    code = generateCode(name);
  }

  const newId = randomUUID();
  await query(
    `INSERT INTO referral_links
       (id, code, name, trial_days, discount_pct, discount_months, tokens_limit, valid_to, max_uses, is_active, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [newId, code, name.trim(), tDays, dPct, dMonths, tokLimit, vTo, cap, !!is_active, (notes as string | null) || null],
  );

  return NextResponse.json({ ok: true, id: newId, code });
}

// DELETE — remove referral link by ?id=...
export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query(`DELETE FROM referral_links WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
