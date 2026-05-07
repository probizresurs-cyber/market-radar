/**
 * Telegram-уведомления о смене цены.
 * Используется ручным /check эндпоинтом и cron'ом.
 */

import { query } from "./db";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";

interface AlertParams {
  userId: string;
  productName: string;
  productUrl: string;
  competitorName: string | null;
  oldPrice: number;
  newPrice: number;
  currency: string;
  priceDiffPct: number;
}

export async function sendPriceAlert(p: AlertParams): Promise<boolean> {
  if (!TOKEN) return false;

  // Достаём chat_id из БД
  const rows = await query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM users WHERE id = $1`,
    [p.userId],
  );
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) return false;

  const isDrop = p.priceDiffPct < 0;
  const arrow = isDrop ? "📉" : "📈";
  const verb = isDrop ? "снижение" : "рост";
  const sign = p.priceDiffPct > 0 ? "+" : "";
  const cur = p.currency === "RUB" ? "₽" : p.currency === "USD" ? "$" : p.currency === "EUR" ? "€" : p.currency;

  const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

  const lines: string[] = [];
  lines.push(`${arrow} <b>Цена ${verb}а</b>`);
  lines.push("");
  lines.push(`<b>${escapeHtml(p.productName)}</b>`);
  if (p.competitorName) lines.push(`<i>${escapeHtml(p.competitorName)}</i>`);
  lines.push("");
  lines.push(`Было: ${fmt(p.oldPrice)} ${cur}`);
  lines.push(`Стало: <b>${fmt(p.newPrice)} ${cur}</b>`);
  lines.push(`Изменение: <b>${sign}${p.priceDiffPct.toFixed(1)}%</b>`);
  lines.push("");
  lines.push(`<a href="${escapeHtml(p.productUrl)}">Открыть товар</a>`);

  try {
    const res = await fetch(`${TG_BASE}/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const j = await res.json();
    return !!j.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
