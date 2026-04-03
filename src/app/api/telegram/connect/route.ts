import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG = `https://api.telegram.org/bot${TOKEN}`;

// GET /api/telegram/connect → returns bot username
export async function GET() {
  try {
    const res = await fetch(`${TG}/getMe`);
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: "Bot not found" }, { status: 500 });
    return NextResponse.json({ username: data.result.username });
  } catch {
    return NextResponse.json({ error: "Failed to reach Telegram" }, { status: 500 });
  }
}

// POST /api/telegram/connect  { code: "MR-XXXXXX" }
// Scans last 100 updates for a message matching the code, returns chatId
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

    const res = await fetch(`${TG}/getUpdates?limit=100&allowed_updates=["message"]`);
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: "getUpdates failed" }, { status: 500 });

    const updates: { message?: { text?: string; chat?: { id: number; first_name?: string } } }[] = data.result ?? [];
    for (const upd of updates.reverse()) {
      if (upd.message?.text?.trim() === code && upd.message?.chat?.id) {
        return NextResponse.json({ chatId: upd.message.chat.id, firstName: upd.message.chat.first_name ?? "" });
      }
    }
    return NextResponse.json({ chatId: null });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
