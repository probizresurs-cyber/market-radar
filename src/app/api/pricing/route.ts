import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// Public endpoint — no auth required
// Returns all active pricing items sorted by group and sort_order
export async function GET(req: Request) {
  await initDb();

  const url = new URL(req.url);
  const group = url.searchParams.get("group");
  const type = url.searchParams.get("type");

  const conditions: string[] = ["is_active = true"];
  const params: unknown[] = [];
  let idx = 1;

  if (group) { conditions.push(`price_group = $${idx++}`); params.push(group); }
  if (type) { conditions.push(`type = $${idx++}`); params.push(type); }

  const sql = `
    SELECT id, name, description, price_group, type, price_amount, currency, limits, sort_order
    FROM pricing_items
    WHERE ${conditions.join(" AND ")}
    ORDER BY price_group, sort_order, name
  `;

  const rows = await query(sql, params);
  return NextResponse.json({ ok: true, items: rows });
}
