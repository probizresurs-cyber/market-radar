/**
 * POST /api/analysis-request
 * Публичная форма заявки на полноценный анализ (кнопка «Хотите полноценный
 * анализ за 2 990 ₽?» на /kp и других интерактивных анализах).
 * Не требует авторизации. Сохраняет в analysis_requests.
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { randomBytes } from "crypto";
import { notifyKpManager } from "@/lib/kp-tg-funnel";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await initDb();
    let body: { company_name?: string; website?: string; contact?: string; source_path?: string; intent?: string } = {};
    try { body = await req.json(); } catch { /* пустое тело — провалимся на валидации ниже */ }

    const { company_name, website, contact, source_path } = body;
    // "seo-geo" — заявка на SEO/GEO-продвижение из КП-воронки (/site-ready).
    const intent = body.intent === "contact" ? "contact" : body.intent === "seo-geo" ? "seo-geo" : "full";

    if (!company_name?.trim() || !website?.trim() || !contact?.trim()) {
      return NextResponse.json({ ok: false, error: "Заполните название компании, сайт и контакт" }, { status: 400 });
    }

    const id = randomBytes(8).toString("hex");

    await query(
      `INSERT INTO analysis_requests (id, company_name, website, contact, source_path, intent)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, company_name.trim().slice(0, 200), website.trim().slice(0, 300), contact.trim().slice(0, 300), source_path?.trim().slice(0, 200) || null, intent]
    );

    // Горячий лид — менеджеру сразу в TG, а не когда он заглянет в админку.
    const intentLabel = intent === "seo-geo" ? "SEO/GEO-продвижение" : intent === "contact" ? "связаться" : "полный анализ";
    void notifyKpManager(
      `📨 <b>Новая заявка: ${intentLabel}</b>\n` +
      `Компания: ${company_name.trim().slice(0, 100)}\n` +
      `Сайт: ${website.trim().slice(0, 100)}\n` +
      `Контакт: ${contact.trim().slice(0, 100)}` +
      (source_path ? `\nОткуда: ${source_path.trim().slice(0, 100)}` : ""),
    );

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[analysis-request]", err);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
