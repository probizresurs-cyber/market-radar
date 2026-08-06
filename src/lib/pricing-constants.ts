/**
 * Единые цены продуктовой линейки MarketRadar.
 *
 * Зачем: одни и те же цифры дублировались в /pricing (page.tsx) и в текстах
 * Telegram-бота (/price в webhook) — при смене тарифа они разъезжались, и бот
 * обещал устаревшую цену. Меняем здесь — меняется везде.
 */

export const PRICES = {
  /** Бесплатный экспресс в Telegram-боте. */
  expressFree: 0,
  /** Экспресс-отчёт на сайте по промокоду START. */
  expressPaid: 1,
  /** Полный отчёт + 30 дней в платформе. */
  fullReport: 2900,
  /** Цена полного отчёта без скидки (зачёркнутая). */
  fullReportOriginal: 4900,
} as const;

export interface TierDiscount {
  key: "mini" | "basic" | "pro" | "agency";
  name: string;
  original: number;
  discounted: number;
  star?: boolean;
}

/** Скидка 50% на первый месяц любого тарифа после покупки полного отчёта. */
export const FIRST_MONTH_DISCOUNTS: TierDiscount[] = [
  { key: "mini", name: "MINI", original: 4900, discounted: 2450 },
  { key: "basic", name: "БАЗОВЫЙ", original: 9900, discounted: 4950 },
  { key: "pro", name: "PRO", original: 19900, discounted: 9950, star: true },
  { key: "agency", name: "AGENCY", original: 39900, discounted: 19950 },
];

export function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}
