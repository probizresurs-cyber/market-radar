import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG = `https://api.telegram.org/bot${TOKEN}`;

// GET /api/telegram/connect → returns bot username + registers webhook
export async function GET(req: NextRequest) {
  try {
    const meRes = await fetch(`${TG}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) return NextResponse.json({ error: "Bot not found" }, { status: 500 });

    // Auto-register webhook using the request host
    const host = req.headers.get("host") ?? "";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const webhookUrl = `${proto}://${host}/api/telegram/webhook`;

    // Only set webhook on production (Vercel), not localhost
    if (!host.startsWith("localhost")) {
      await fetch(`${TG}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
      });
    }

    return NextResponse.json({ username: meData.result.username });
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

    const normalizedCode = code.trim().toUpperCase();

    // On localhost: use getUpdates polling (no webhook)
    // On production: webhook handles messages, but we still need chatId lookup via getUpdates
    await fetch(`${TG}/deleteWebhook?drop_pending_updates=false`);

    const res = await fetch(`${TG}/getUpdates?limit=100&allowed_updates=%5B%22message%22%5D`);
    const data = await res.json();

    // Re-register webhook after polling (only on production)
    const host = req.headers.get("host") ?? "";
    if (!host.startsWith("localhost")) {
      const webhookUrl = `https://${host}/api/telegram/webhook`;
      await fetch(`${TG}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
      });
    }

    if (!data.ok) {
      return NextResponse.json({ chatId: null, error: "getUpdates failed", detail: data });
    }

    const updates: { message?: { text?: string; chat?: { id: number; first_name?: string } } }[] = data.result ?? [];

    for (const upd of [...updates].reverse()) {
      const msgText = upd.message?.text?.trim().toUpperCase() ?? "";
      if (msgText === normalizedCode && upd.message?.chat?.id) {
        return NextResponse.json({ chatId: upd.message.chat.id, firstName: upd.message.chat.first_name ?? "" });
      }
    }

    return NextResponse.json({ chatId: null, updatesCount: updates.length, searched: normalizedCode });
  } catch (e) {
    return NextResponse.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
