import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface DataRow { key: string; value: unknown; }

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key) {
      const rows = await query<DataRow>("SELECT value FROM user_data WHERE user_id = $1 AND key = $2", [session.userId, key]);
      return NextResponse.json({ ok: true, value: rows[0]?.value ?? null });
    }

    const rows = await query<DataRow>("SELECT key, value FROM user_data WHERE user_id = $1", [session.userId]);
    const data: Record<string, unknown> = {};
    for (const row of rows) data[row.key] = row.value;
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("data GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ ok: false, error: "key обязателен" }, { status: 400 });

    await query(
      `INSERT INTO user_data (id, user_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $4, updated_at = NOW()`,
      [randomUUID(), session.userId, key, JSON.stringify(value)]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("data POST error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ ok: false, error: "key обязателен" }, { status: 400 });

    await query("DELETE FROM user_data WHERE user_id = $1 AND key = $2", [session.userId, key]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("data DELETE error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
