import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// GET — list all pricing items (with optional ?group=A filter)
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const group = url.searchParams.get("group");

  let rows;
  if (group) {
    rows = await query(
      "SELECT * FROM pricing_items WHERE price_group = $1 ORDER BY sort_order, created_at",
      [group]
    );
  } else {
    rows = await query("SELECT * FROM pricing_items ORDER BY price_group, sort_order, created_at");
  }

  return NextResponse.json({ ok: true, items: rows });
}

// POST — create or update pricing item
// Body: { id?, name, description?, price_group, type, price_amount, currency?, limits?, is_active?, sort_order? }
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const body = await req.json();
  const {
    id,
    name,
    description,
    price_group,
    type,
    price_amount,
    currency = "RUB",
    limits,
    is_active = true,
    sort_order = 0,
  } = body;

  if (!name || !price_group || !type) {
    return NextResponse.json({ ok: false, error: "name, price_group, type обязательны" }, { status: 400 });
  }

  if (id) {
    // Update
    await query(
      `UPDATE pricing_items
       SET name=$1, description=$2, price_group=$3, type=$4, price_amount=$5,
           currency=$6, limits=$7, is_active=$8, sort_order=$9
       WHERE id=$10`,
      [name, description || null, price_group, type, price_amount || 0, currency, limits ? JSON.stringify(limits) : null, is_active, sort_order, id]
    );
    return NextResponse.json({ ok: true, id });
  }

  // Create
  const newId = randomUUID();
  await query(
    `INSERT INTO pricing_items (id, name, description, price_group, type, price_amount, currency, limits, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [newId, name, description || null, price_group, type, price_amount || 0, currency, limits ? JSON.stringify(limits) : null, is_active, sort_order]
  );
  return NextResponse.json({ ok: true, id: newId });
}

// DELETE — delete pricing item by ?id=...
export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query("DELETE FROM pricing_items WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
