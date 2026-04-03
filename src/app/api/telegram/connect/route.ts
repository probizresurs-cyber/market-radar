import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG = `https://api.telegram.org/bot${TOKEN}`;

// GET /api/telegram/connect → returns bot username
export async function GET() {
  try {
    const res = await fetch(`${TG}/getMe`);
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: "Bot not found", detail: data }, { status: 500 });
    return NextResponse.json({ username: data.result.username });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reach Telegram", detail: String(e) }, { status: 500 });
  }
}

// POST /api/telegram/connect  { code: "MR-XXXXXX" }
// Scans last 100 updates for a message matching the code, returns chatId
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

    // First delete any existing webhook so getUpdates works
    await fetch(`${TG}/deleteWebhook`);

    const res = await fetch(`${TG}/getUpdates?limit=100&allowed_updates=%5B%22message%22%5D`);
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ chatId: null, error: "getUpdates failed", detail: data });
    }

    const updates: { message?: { text?: string; chat?: { id: number; first_name?: string } } }[] = data.result ?? [];
    const normalizedCode = code.trim().toUpperCase();

    for (const upd of [...updates].reverse()) {
      const msgText = upd.message?.text?.trim().toUpperCase() ?? "";
      if (msgText === normalizedCode && upd.message?.chat?.id) {
        return NextResponse.json({ chatId: upd.message.chat.id, firstName: upd.message.chat.first_name ?? "" });
      }
    }

    // Debug: return how many updates we saw
    return NextResponse.json({ chatId: null, updatesCount: updates.length, searched: normalizedCode });
  } catch (e) {
    return NextResponse.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
