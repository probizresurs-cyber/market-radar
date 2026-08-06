/**
 * Telegram-уведомления о смене цены.
 * Используется ручным /check эндпоинтом и cron'ом.
 */

import { sendTelegramToUser, escapeTgHtml } from "./tg-send";

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
  const isDrop = p.priceDiffPct < 0;
  const arrow = isDrop ? "📉" : "📈";
  const verb = isDrop ? "снижение" : "рост";
  const sign = p.priceDiffPct > 0 ? "+" : "";
  const cur = p.currency === "RUB" ? "₽" : p.currency === "USD" ? "$" : p.currency === "EUR" ? "€" : p.currency;

  const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

  const lines: string[] = [];
  lines.push(`${arrow} <b>Цена ${verb}а</b>`);
  lines.push("");
  lines.push(`<b>${escapeTgHtml(p.productName)}</b>`);
  if (p.competitorName) lines.push(`<i>${escapeTgHtml(p.competitorName)}</i>`);
  lines.push("");
  lines.push(`Было: ${fmt(p.oldPrice)} ${cur}`);
  lines.push(`Стало: <b>${fmt(p.newPrice)} ${cur}</b>`);
  lines.push(`Изменение: <b>${sign}${p.priceDiffPct.toFixed(1)}%</b>`);
  lines.push("");
  lines.push(`<a href="${escapeTgHtml(p.productUrl)}">Открыть товар</a>`);

  // Единый хелпер сам достанет chat_id юзера и залогирует ошибку Telegram.
  // preview оставляем включённым — карточка товара в превью полезна.
  const r = await sendTelegramToUser(p.userId, lines.join("\n"), { disableWebPagePreview: false });
  return r.ok;
}
