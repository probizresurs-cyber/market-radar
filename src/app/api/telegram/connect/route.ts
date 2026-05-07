import { NextRequest, NextResponse } from "next/server";
import { getChatId } from "@/lib/tgStore";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const TG = `${TG_BASE}/bot${TOKEN}`;

// GET /api/telegram/connect → returns bot username
export async function GET() {
  try {
    const res = await fetch(`${TG}/getMe`);
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: "Bot not found" }, { status: 500 });
    return NextResponse.json({ username: data.result.username });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reach Telegram", detail: String(e) }, { status: 500 });
  }
}

// POST /api/telegram/connect  { code: "MR-XXXXXX" }
// Looks up chatId from in-memory store (populated by webhook)
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

    const chatId = getChatId(code.trim());
    if (chatId) {
      // Если юзер авторизован — сохраняем chatId в БД, чтобы серверные крон-задачи
      // (price alerts, мониторинг и т.п.) могли слать уведомления без участия клиента.
      try {
        const session = await getSessionUser();
        if (session) {
          await initDb();
          await query(
            `UPDATE users SET telegram_chat_id = $1 WHERE id = $2`,
            [chatId, session.userId],
          );
        }
      } catch { /* не критично — chatId всё равно вернётся клиенту */ }
      return NextResponse.json({ chatId });
    }
    return NextResponse.json({ chatId: null });
  } catch (e) {
    return NextResponse.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
