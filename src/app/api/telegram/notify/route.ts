import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const TG = `${TG_BASE}/bot${TOKEN}`;

// POST /api/telegram/notify  { chatId: number, text: string }
export async function POST(req: NextRequest) {
  try {
    const { chatId, text } = await req.json();
    if (!chatId || !text) return NextResponse.json({ error: "chatId and text required" }, { status: 400 });

    const res = await fetch(`${TG}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: data.description ?? "Send failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
