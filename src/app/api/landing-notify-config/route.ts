/**
 * GET/POST /api/landing-notify-config
 *
 * Конфигурация куда приходят заявки с лендингов конкретного юзера.
 * Один конфиг на юзера (один TG-чат / email / webhook ловит заявки
 * со ВСЕХ его лендингов).
 *
 * GET — текущий конфиг.
 * POST — обновить { telegramChatId?, email?, webhookUrl? }. Пустая
 *         строка = выключить канал.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

interface ConfigRow {
  telegram_chat_id: string | null;
  email: string | null;
  webhook_url: string | null;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const rows = await query<ConfigRow>(
    "SELECT telegram_chat_id, email, webhook_url FROM landing_notify_config WHERE user_id = $1",
    [session.userId],
  );

  const config = rows[0] ?? { telegram_chat_id: null, email: null, webhook_url: null };
  return NextResponse.json({
    ok: true,
    data: {
      telegramChatId: config.telegram_chat_id || "",
      email: config.email || "",
      webhookUrl: config.webhook_url || "",
    },
  });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let body: {
    telegramChatId?: string;
    email?: string;
    webhookUrl?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  // Лёгкая валидация: webhook_url должен быть HTTPS (HTTP даже не пускаем —
  // плохой практикой ходить на http из прод-сервера).
  const tg = (body.telegramChatId ?? "").trim() || null;
  const email = (body.email ?? "").trim() || null;
  const webhook = (body.webhookUrl ?? "").trim() || null;
  if (webhook && !webhook.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "Webhook URL должен быть HTTPS (плэйнтекст HTTP не поддерживается)" },
      { status: 400 },
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Неверный формат email" }, { status: 400 });
  }

  await query(
    `INSERT INTO landing_notify_config (user_id, telegram_chat_id, email, webhook_url, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       telegram_chat_id = EXCLUDED.telegram_chat_id,
       email = EXCLUDED.email,
       webhook_url = EXCLUDED.webhook_url,
       updated_at = NOW()`,
    [session.userId, tg, email, webhook],
  );

  return NextResponse.json({ ok: true });
}
