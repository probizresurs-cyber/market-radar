import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const TG = `${TG_BASE}/bot${TOKEN}`;

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const webhookUrl = `https://${host}/api/telegram/webhook`;

  const res = await fetch(`${TG}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await res.json();

  return NextResponse.json({ webhookUrl, result: data });
}
