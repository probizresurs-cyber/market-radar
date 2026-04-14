import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface UserRow { id: string; email: string; name: string | null; role: string; created_at: string; data_count?: string; }
interface DataRow { key: string; value: unknown; }

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (userId) {
      const users = await query<UserRow>("SELECT id, email, name, role, created_at FROM users WHERE id = $1", [userId]);
      const user = users[0];
      if (!user) return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });

      const dataRows = await query<DataRow>("SELECT key, value FROM user_data WHERE user_id = $1", [userId]);
      const data: Record<string, unknown> = {};
      for (const row of dataRows) data[row.key] = row.value;

      return NextResponse.json({ ok: true, user, data });
    }

    const users = await query<UserRow>(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
             COUNT(d.id) as data_count
      FROM users u
      LEFT JOIN user_data d ON d.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({
      ok: true,
      users: users.map(u => ({ ...u, dataCount: parseInt(u.data_count ?? "0") })),
    });
  } catch (e) {
    console.error("admin users error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) return NextResponse.json({ ok: false, error: "userId и role обязательны" }, { status: 400 });

    await query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin patch error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
