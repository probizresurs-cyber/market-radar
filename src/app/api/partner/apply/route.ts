/**
 * POST /api/partner/apply
 * Публичная форма подачи заявки в партнёрскую программу.
 * Не требует авторизации. Сохраняет в partner_applications.
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json() as {
      name: string;
      email: string;
      phone?: string;
      company_name?: string;
      website?: string;
      type?: "referral" | "integrator";
      description?: string;
      client_price_amount?: number; // kopecks
    };

    const { name, email, phone, company_name, website, type = "referral", description, client_price_amount } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ ok: false, error: "Имя и email обязательны" }, { status: 400 });
    }

    // Простая проверка email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Некорректный email" }, { status: 400 });
    }

    const id = randomBytes(8).toString("hex");

    await query(
      `INSERT INTO partner_applications
         (id, name, email, phone, company_name, website, type, description, client_price_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        name.trim(),
        email.trim().toLowerCase(),
        phone?.trim() || null,
        company_name?.trim() || null,
        website?.trim() || null,
        type,
        description?.trim() || null,
        client_price_amount ?? null,
      ]
    );

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[partner/apply]", err);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
