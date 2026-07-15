/**
 * POST /api/kp-track
 * Публичный fire-and-forget трекинг вовлечённости на страницах интерактивного
 * анализа (/kp, /kp-sozdavaya, /share/[id]): просмотр, до какого раздела
 * долистали, клики по ключевым кнопкам. Не требует авторизации, не блокирует
 * рендер — клиент не ждёт ответ. Видно в /admin/kp-analytics.
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const EVENT_TYPES = new Set(["view", "section", "click"]);

export async function POST(req: Request) {
  try {
    await initDb();
    let body: { path?: string; share_id?: string; session_id?: string; event_type?: string; label?: string } = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const { path, share_id, session_id, event_type, label } = body;
    if (!path?.trim() || !session_id?.trim() || !event_type || !EVENT_TYPES.has(event_type)) {
      // Трекинг не должен ломать страницу — тихо игнорируем некорректные события.
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const id = randomBytes(8).toString("hex");
    await query(
      `INSERT INTO kp_events (id, path, share_id, session_id, event_type, label)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, path.trim().slice(0, 200), share_id?.trim().slice(0, 100) || null, session_id.trim().slice(0, 100), event_type, label?.trim().slice(0, 120) || null]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kp-track]", err);
    // Тихо — трекинг не критичен, не показываем ошибку пользователю.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
