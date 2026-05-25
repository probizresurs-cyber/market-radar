import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// One-time endpoint to create/promote an admin account.
// Protected by ADMIN_SETUP_SECRET env variable.
// Usage: POST /api/admin/create-admin
//        { "secret": "...", "email": "admin@example.com", "password": "...", "name": "Admin" }
// If user with this email already exists — upgrades role to admin.

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "ADMIN_SETUP_SECRET не задан" }, { status: 403 });
  }

  // КРИТИЧНО: разбираем body ДО проверки secret через try/catch — иначе
  // пустой body → 500 SyntaxError → лог-spam, и любой curl-нюхач может
  // отличить «есть ADMIN_SETUP_SECRET» от «нет» по форме ответа.
  let body: { secret?: string; email?: string; password?: string; name?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }
  const { secret: provided, email, password, name } = body;
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Неверный секрет" }, { status: 403 });
  }
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "email и password обязательны" }, { status: 400 });
  }

  await initDb();

  // Check if user exists
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.length > 0) {
    // Promote to admin
    await query("UPDATE users SET role = 'admin', name = COALESCE($1, name) WHERE email = $2", [name || null, email]);
    return NextResponse.json({ ok: true, message: "Существующий пользователь повышен до admin" });
  }

  // Create new admin user
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 10);
  await query(
    "INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, 'admin')",
    [id, email, hash, name || null]
  );

  return NextResponse.json({ ok: true, message: "Admin-аккаунт создан", id });
}
