/**
 * Приоритизированный план: превращаем провалившиеся/предупреждающие проверки
 * в конкретные действия, отсортированные так, чтобы сначала чинить то, без
 * чего остальное не работает (доступность → извлекаемость → сущность →
 * свежесть → внешние сигналы) — порядок ровно как в исследовании (см.
 * docs/geo/01-research-techniques.md, §8: сводная таблица приоритетов).
 */
import type { ActionItem, Effort, GeoCheck, GeoPillar } from "./types";

const PILLAR_ORDER: GeoPillar[] = ["access", "extract", "entity", "freshness", "external"];

const EFFORT_BY_KEY: Record<string, Effort> = {
  home_reachable: "day", ai_bot_parity: "hour", broken_pages: "day",
  robots_search_bots: "hour", robots_answer_bots: "hour", ssr_content: "week",
  sitemap: "hour", bing_index: "hour",
  answer_lede: "week", question_headings: "week", faq_blocks: "day",
  structured_blocks: "week", facts: "week", sources: "week", comparison_pages: "week",
  org_schema: "hour", entity_consistency: "day", requisites: "day", author: "day",
  about_page: "day", title_uniqueness: "day", og_meta: "hour", jsonld_valid: "day",
  visible_dates: "day", sitemap_lastmod_real: "hour", recent_update: "ongoing", stale_year: "hour",
  profiles: "ongoing", mention_rate: "ongoing", citation_rate: "ongoing",
  competitor_dominance: "week", source_gap: "ongoing",
};

function impactFor(check: GeoCheck): ActionItem["impact"] {
  if (check.weight >= 20) return "high";
  if (check.weight >= 10) return "medium";
  return "low";
}

export function buildPlan(checks: GeoCheck[]): ActionItem[] {
  const actionable = checks.filter(c => c.status === "fail" || c.status === "warn");

  const scored = actionable.map(c => {
    const pillarRank = PILLAR_ORDER.indexOf(c.pillar);
    const severity = c.status === "fail" ? 2 : 1;
    // Сортировочный ключ: сначала опора (access раньше external), внутри — серьёзнее и тяжелее.
    const sortKey = pillarRank * 100 - severity * 10 - c.weight;
    return { c, sortKey };
  }).sort((a, b) => a.sortKey - b.sortKey);

  const total = scored.length;
  return scored.map(({ c }, i) => {
    const priority: ActionItem["priority"] = i < total / 3 ? 1 : i < (2 * total) / 3 ? 2 : 3;
    return {
      id: c.key,
      pillar: c.pillar,
      priority,
      title: c.label,
      why: c.detail,
      howTo: c.fix || "Смотрите деталь проверки — конкретный фикс не сформулирован, нужен ручной разбор.",
      effort: EFFORT_BY_KEY[c.key] ?? "week",
      impact: impactFor(c),
      urls: c.urls?.slice(0, 10),
      snippet: c.snippet,
    };
  });
}
