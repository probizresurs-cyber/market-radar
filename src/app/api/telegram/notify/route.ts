/**
 * POST /api/telegram/notify { text: string }
 *
 * Отправка уведомления авторизованному юзеру в его подключённый Telegram чат.
 *
 * Раньше body содержал { chatId, text } и роут был открыт → любой
 * мог рассылать произвольный HTML/спам через нашего бота в любой
 * chatId (фишинг от имени MarketRadar + расход TG rate-limit).
 *
 * Фикс: chatId берём из БД сессионного юзера (users.telegram_chat_id),
 * а не из body. Если юзер не подключил TG — отдаём 400.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/tg-send";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "text обязателен" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ ok: false, error: "text слишком длинный (макс 4096)" }, { status: 400 });
  }

  // chatId строго из БД юзера, не из body
  try {
    await initDb();
  } catch { /* ignore */ }
  const rows = await query<{ telegram_chat_id: string | null }>(
    "SELECT telegram_chat_id FROM users WHERE id = $1",
    [session.userId],
  );
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: "Telegram не подключён. Привяжите бота в настройках." },
      { status: 400 },
    );
  }

  // Единый отправитель: проверка токена, TG_API_BASE-прокси, разбор ответа
  const sent = await sendTelegramMessage({ chatId, text });
  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, error: sent.error ?? "Не удалось отправить сообщение" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
