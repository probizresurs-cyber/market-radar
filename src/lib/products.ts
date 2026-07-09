// Разнесение MarketRadar на отдельные продукты-страницы (Этап 1).
//
// Один монолит-shell (AppShell) рендерится на 4 маршрутах с разным `scope`.
// Этот файл — единственный источник правды о том, какие нав-итемы относятся
// к какому продукту, какой у продукта маршрут, дефолтный таб и фичефлаги
// для гейтинга/переключателя. Структура самой навигации остаётся в nav.ts.

import { NAV_SECTIONS, type NavSection } from "./nav";

export type ProductScope = "core" | "seo-geo" | "content-factory" | "land-pres";

export interface ProductDef {
  id: ProductScope;
  route: string;
  label: string;
  icon: string;            // lucide-имя (для переключателя)
  /** ID нав-итемов верхнего уровня, принадлежащих продукту. */
  navIds: string[];
  defaultNav: string;
  /** Фичефлаги: доступ к продукту, если включён хотя бы один. core — всегда. */
  featureFlags: string[];
}

export const PRODUCTS: ProductDef[] = [
  {
    id: "core",
    route: "/",
    label: "Аналитика",
    icon: "Radar",
    navIds: [], // core = всё, что не забрали другие продукты
    defaultNav: "new-analysis",
    featureFlags: [],
  },
  {
    id: "seo-geo",
    route: "/seo-geo",
    label: "SEO + GEO",
    icon: "FileText",
    navIds: ["seo-articles"],
    defaultNav: "seo-library",
    featureFlags: ["seo-articles"],
  },
  {
    id: "content-factory",
    route: "/content-factory",
    label: "Контент-завод",
    icon: "Factory",
    navIds: ["content-style", "content-factory"],
    defaultNav: "content-plan",
    featureFlags: ["content-factory"],
  },
  {
    id: "land-pres",
    route: "/land-pres",
    label: "Лендинги и презентации",
    icon: "Globe",
    navIds: ["landing-generator", "brand-presentation"],
    defaultNav: "landing-generator",
    featureFlags: ["landing-generator", "brand-presentation"],
  },
];

export const PRODUCT_BY_SCOPE: Record<ProductScope, ProductDef> =
  Object.fromEntries(PRODUCTS.map(p => [p.id, p])) as Record<ProductScope, ProductDef>;

// Все top-level navId, «забранные» не-core продуктами.
const CLAIMED_TOP_IDS = new Set<string>(
  PRODUCTS.filter(p => p.id !== "core").flatMap(p => p.navIds),
);

/** Нав-секции, отфильтрованные под конкретный продукт. */
export function scopedNavSections(scope: ProductScope): NavSection[] {
  const keep = (itemId: string): boolean => {
    if (scope === "core") return !CLAIMED_TOP_IDS.has(itemId);
    return PRODUCT_BY_SCOPE[scope].navIds.includes(itemId);
  };
  return NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(it => keep(it.id)) }))
    .filter(section => section.items.length > 0);
}

// Карта navId (включая детей) → продукт. Дети наследуют scope родителя.
const NAV_SCOPE_MAP: Record<string, ProductScope> = (() => {
  const map: Record<string, ProductScope> = {};
  const scopeOfTop = (topId: string): ProductScope => {
    const owner = PRODUCTS.find(p => p.id !== "core" && p.navIds.includes(topId));
    return owner ? owner.id : "core";
  };
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const sc = scopeOfTop(item.id);
      map[item.id] = sc;
      for (const child of item.children ?? []) map[child.id] = sc;
    }
  }
  return map;
})();

/** К какому продукту относится нав-итем (по id, включая детей). */
export function scopeForNav(navId: string): ProductScope {
  return NAV_SCOPE_MAP[navId] ?? "core";
}

export function defaultNavForScope(scope: ProductScope): string {
  return PRODUCT_BY_SCOPE[scope]?.defaultNav ?? "new-analysis";
}

/**
 * Прямой URL на нав-итем в его продукте — для сквозных ссылок между
 * продуктами (из анализа → контент/лендинг/презентация/SEO и обратно).
 * Сразу ведёт на нужный маршрут, без «прыжка» через core с редиректом.
 * Пустой navId → корень продукта.
 */
export function hrefForNav(navId: string): string {
  const route = PRODUCT_BY_SCOPE[scopeForNav(navId)].route;
  if (!navId) return route;
  // route="/" → "/?nav=X"; "/content-factory" → "/content-factory?nav=X"
  return `${route}?nav=${navId}`;
}

/** Входит ли нав-итем в указанный продукт. */
export function navInScope(navId: string, scope: ProductScope): boolean {
  return scopeForNav(navId) === scope;
}

/**
 * Продукты для переключателя: core всегда, остальные — если включён хотя бы
 * один их фичефлаг (Этап 1 — гейтинг по фичефлагу; Этап 2 — по подписке).
 */
export function productsForUser(featureOn: (id: string) => boolean): ProductDef[] {
  return PRODUCTS.filter(p => p.id === "core" || p.featureFlags.some(f => featureOn(f)));
}
