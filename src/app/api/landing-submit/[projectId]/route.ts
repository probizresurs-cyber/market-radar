/**
 * POST /api/landing-submit/[projectId]
 *
 * Endpoint, в который шлют форму с лендинга. По projectId находим
 * владельца, сохраняем submission в БД и роутим уведомление:
 *   - Telegram (если настроен chat_id)
 *   - Email (если настроен)
 *   - Webhook (если настроен)
 *
 * НЕ требует auth — это публичный endpoint, на который шлёт форма с
 * лендинга. Защита от спама:
 *   - rate-limit по IP (не больше 5 заявок/мин с одного IP)
 *   - honeypot field `__hp` — если заполнен, тихо игнорируем
 *   - max payload size 32 KB
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchWithTimeout, FAST_TIMEOUT_MS } from "@/lib/fetch-timeout";

export const runtime = "nodejs";
export const maxDuration = 30;

// In-memory rate-limit (хватит для PM2 single process).
// Key = ip; value = массив timestamp'ов последних submissions за минуту.
const submitLog = new Map<string, number[]>();
const MAX_PER_MINUTE = 5;
const MAX_PAYLOAD_BYTES = 32 * 1024;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const arr = (submitLog.get(ip) || []).filter(t => t > cutoff);
  if (arr.length >= MAX_PER_MINUTE) return false;
  arr.push(now);
  submitLog.set(ip, arr);
  return true;
}

interface NotifyConfig {
  telegram_chat_id: string | null;
  email: string | null;
  webhook_url: string | null;
}

async function notifyTelegram(chatId: string, projectId: string, payload: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  const lines = Object.entries(payload)
    .filter(([k]) => !k.startsWith("__") && !k.startsWith("utm_"))
    .map(([k, v]) => `<b>${k}:</b> ${String(v).slice(0, 500)}`)
    .join("\n");
  const text = `🎯 <b>Заявка с лендинга</b>\n<code>${projectId.slice(0, 12)}…</code>\n\n${lines}`;
  try {
    await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      },
      FAST_TIMEOUT_MS,
    );
  } catch (e) {
    console.warn("[landing-submit] TG notify failed:", e);
  }
}

async function notifyWebhook(url: string, projectId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...payload }),
    }, FAST_TIMEOUT_MS);
  } catch (e) {
    console.warn("[landing-submit] webhook failed:", e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;

  // Rate limit per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  // Payload size guard
  const raw = await req.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); }
  catch {
    // Если form-encoded — парсим тоже
    try {
      const params = new URLSearchParams(raw);
      payload = Object.fromEntries(params.entries());
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
  }

  // Honeypot: спам-боты часто заполняют все поля. Если заполнено
  // невидимое поле __hp — тихо игнорируем (статус 200, чтобы бот не повторял).
  if (payload.__hp) {
    return NextResponse.json({ ok: true });
  }

  // UTM-метки — выделяем в отдельный объект.
  const utm: Record<string, unknown> = {};
  const cleanPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith("utm_")) utm[k] = v;
    else if (!k.startsWith("__")) cleanPayload[k] = v;
  }

  // Найти владельца проекта
  const projects = await query<{ user_id: string }>(
    "SELECT user_id FROM landing_projects WHERE project_id = $1",
    [projectId],
  );
  if (projects.length === 0) {
    return NextResponse.json({ ok: false, error: "Лендинг не найден" }, { status: 404 });
  }
  const userId = projects[0].user_id;

  // Сохранить submission
  await query(
    `INSERT INTO landing_submissions
       (project_id, user_id, payload, ip_address, user_agent, referrer, utm)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      projectId,
      userId,
      JSON.stringify(cleanPayload),
      ip,
      req.headers.get("user-agent")?.slice(0, 500) || null,
      req.headers.get("referer")?.slice(0, 500) || null,
      Object.keys(utm).length > 0 ? JSON.stringify(utm) : null,
    ],
  );

  // Получить config уведомлений и отправить (асинхронно — не блокируем ответ).
  void (async () => {
    const config = await query<NotifyConfig>(
      "SELECT telegram_chat_id, email, webhook_url FROM landing_notify_config WHERE user_id = $1",
      [userId],
    );
    if (config.length === 0) return;
    const c = config[0];
    if (c.telegram_chat_id) await notifyTelegram(c.telegram_chat_id, projectId, cleanPayload);
    if (c.webhook_url) await notifyWebhook(c.webhook_url, projectId, cleanPayload);
    // Email — пока пропускаем (требует SMTP setup, у нас уже есть mailer.ts
    // но это для админ-задач; вынесем в follow-up).
  })();

  return NextResponse.json({ ok: true, message: "Заявка получена" });
}

// CORS для submit с любого домена (лендинги могут хоститься где угодно).
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
