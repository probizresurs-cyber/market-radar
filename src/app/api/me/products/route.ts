// Права доступа текущего юзера к продуктам — для гейтинга на клиенте.
//
// Логика рубильника: продукт доступен, если ВКЛЮЧЁН его фичефлаг (открыто всем)
// ИЛИ у юзера есть активная подписка на продукт. Выключив фичефлаг продукта в
// /admin/features, владелец переводит продукт в режим «только по подписке».
// core (Аналитика) — всегда доступен.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { hasProductAccess, PRODUCT_LIST } from "@/lib/product-access";
import { PRODUCT_BY_SCOPE, type ProductScope } from "@/lib/products";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  await initDb();

  // Какие фичефлаги включены (открытые продукты).
  const flagRows = await query<{ id: string; enabled: boolean }>(`SELECT id, enabled FROM features`);
  const flagOn = new Map(flagRows.map(r => [r.id, r.enabled]));

  const access: Record<string, boolean> = {};
  for (const product of PRODUCT_LIST) {
    if (product === "core") { access[product] = true; continue; }
    const flags = PRODUCT_BY_SCOPE[product as ProductScope].featureFlags;
    const openToAll = flags.some(f => flagOn.get(f) !== false); // нет записи флага = считаем включённым
    access[product] = openToAll || await hasProductAccess(session.userId, product as ProductScope);
  }

  return NextResponse.json({ ok: true, access });
}
