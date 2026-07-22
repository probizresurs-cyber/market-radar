/**
 * Цены апселл-продуктов КП-воронки (после пересборки сайта): полный анализ
 * и SEO/GEO-продвижение. Используются в TG-боте (kp-tg-funnel), в письме
 * approve-rebuild и на клиентской /site-ready — единственный источник, чтобы
 * цифры не разъезжались между каналами.
 *
 * TODO(pricing): цены-заглушки — согласовать с владельцем и синхронизировать
 * с тарифами на сайте.
 */
export const KP_UPSELL_PRICE: Record<"ru" | "de", { fullAnalysis: string; seoGeo: string }> = {
  ru: { fullAnalysis: "25 000 ₽", seoGeo: "от 15 000 ₽/мес" },
  de: { fullAnalysis: "990 €", seoGeo: "ab 590 €/Monat" },
};
