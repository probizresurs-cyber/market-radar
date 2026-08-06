import { NextRequest, NextResponse } from "next/server";
import { getChatId } from "@/lib/tgStore";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

// GET /api/telegram/connect → returns bot username
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не настроен" }, { status: 500 });
  }
  const base = process.env.TG_API_BASE ?? "https://api.telegram.org";
  try {
    const res = await fetch(`${base}/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: "Bot not found" }, { status: 500 });
    return NextResponse.json({ username: data.result.username });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reach Telegram", detail: String(e) }, { status: 500 });
  }
}

// POST /api/telegram/connect  { code: "MR-XXXXXX" }
// Ищет chatId в tg_connect_codes (записывается webhook'ом при получении кода).
// Сессия ОБЯЗАТЕЛЬНА: chatId всегда сохраняется в users.telegram_chat_id —
// без него серверные крон-задачи не знают, куда слать уведомления, а
// анонимный вызов позволял бы перебирать чужие коды.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

    const chatId = await getChatId(String(code).trim());
    if (chatId) {
      await initDb();
      await query(
        `UPDATE users SET telegram_chat_id = $1 WHERE id = $2`,
        [chatId, session.userId],
      );
      return NextResponse.json({ chatId });
    }
    return NextResponse.json({ chatId: null });
  } catch (e) {
    return NextResponse.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}

// DELETE /api/telegram/connect — отключить Telegram-уведомления.
// Раньше «Отключить» в настройках чистил только localStorage, а
// users.telegram_chat_id оставался — крон-агенты продолжали слать в
// «отключённый» чат.
export async function DELETE() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    await initDb();
    await query(`UPDATE users SET telegram_chat_id = NULL WHERE id = $1`, [session.userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
