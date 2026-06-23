// Доступ к продуктам по подпискам (Этап 2) + разбивка статистики по продуктам.
import { query } from "./db";
import type { ProductScope } from "./products";

export const PRODUCT_LIST: ProductScope[] = ["core", "seo-geo", "content-factory", "land-pres"];

export const PRODUCT_LABEL: Record<ProductScope, string> = {
  "core": "Аналитика",
  "seo-geo": "SEO + GEO",
  "content-factory": "Контент-завод",
  "land-pres": "Лендинги и презентации",
};

/** Есть ли у юзера активная подписка на продукт. */
export async function hasProductAccess(userId: string, product: ProductScope): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM product_subscriptions
       WHERE user_id = $1 AND product = $2 AND status IN ('active','trialing')
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
    [userId, product],
  );
  return rows.length > 0;
}

/**
 * К какому продукту относится AI-эндпоинт (для разбивки расхода/статистики
 * из ai_logs по продуктам). Порядок проверок важен: лендинги/презентации
 * ловим до общего generate-*.
 */
export function endpointProduct(endpoint: string): ProductScope {
  const e = (endpoint || "").toLowerCase();
  if (e.includes("landing") || e.includes("presentation")) return "land-pres";
  if (e.startsWith("seo") || e.startsWith("geo") || e.includes("keyword") || e.includes("paa") || e.includes("keyso")) return "seo-geo";
  if (
    e.startsWith("generate-") || e.startsWith("expand-") ||
    e.includes("tov") || e.includes("reel") || e.includes("stor") ||
    e.includes("carousel") || e.includes("post") || e.includes("content")
  ) return "content-factory";
  return "core";
}
