/**
 * POST /api/analysis-request
 * Публичная форма заявки на полноценный анализ (кнопка «Хотите полноценный
 * анализ за 2 990 ₽?» на /kp и других интерактивных анализах).
 * Не требует авторизации. Сохраняет в analysis_requests.
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await initDb();
    let body: { company_name?: string; website?: string; contact?: string; source_path?: string } = {};
    try { body = await req.json(); } catch { /* пустое тело — провалимся на валидации ниже */ }

    const { company_name, website, contact, source_path } = body;

    if (!company_name?.trim() || !website?.trim() || !contact?.trim()) {
      return NextResponse.json({ ok: false, error: "Заполните название компании, сайт и контакт" }, { status: 400 });
    }

    const id = randomBytes(8).toString("hex");

    await query(
      `INSERT INTO analysis_requests (id, company_name, website, contact, source_path)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, company_name.trim().slice(0, 200), website.trim().slice(0, 300), contact.trim().slice(0, 300), source_path?.trim().slice(0, 200) || null]
    );

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[analysis-request]", err);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
