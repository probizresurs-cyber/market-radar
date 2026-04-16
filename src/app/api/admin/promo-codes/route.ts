import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// GET — list promo codes
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const rows = await query(
    `SELECT pc.*, p.referral_code AS partner_code
     FROM promo_codes pc
     LEFT JOIN partners p ON p.id = pc.partner_id
     ORDER BY pc.created_at DESC`
  );

  return NextResponse.json({ ok: true, codes: rows });
}

// POST — create or update promo code
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const body = await req.json();
  const {
    id,
    code,
    discount_percent,
    discount_amount,
    valid_from,
    valid_to,
    max_uses,
    partner_id,
    is_active = true,
  } = body;

  if (!code) {
    return NextResponse.json({ ok: false, error: "code обязателен" }, { status: 400 });
  }

  if (id) {
    // Update
    await query(
      `UPDATE promo_codes
       SET code=$1, discount_percent=$2, discount_amount=$3, valid_from=$4, valid_to=$5,
           max_uses=$6, partner_id=$7, is_active=$8
       WHERE id=$9`,
      [code.toUpperCase(), discount_percent || null, discount_amount || null, valid_from || null, valid_to || null, max_uses || null, partner_id || null, is_active, id]
    );
    return NextResponse.json({ ok: true, id });
  }

  // Create
  const newId = randomUUID();
  await query(
    `INSERT INTO promo_codes (id, code, discount_percent, discount_amount, valid_from, valid_to, max_uses, partner_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [newId, code.toUpperCase(), discount_percent || null, discount_amount || null, valid_from || null, valid_to || null, max_uses || null, partner_id || null, is_active]
  );
  return NextResponse.json({ ok: true, id: newId });
}

// DELETE — delete promo code by ?id=...
export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query("DELETE FROM promo_codes WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
