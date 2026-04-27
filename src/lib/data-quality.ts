// Helpers that classify the quality of a data point and produce
// human-friendly labels with proper markers (real / ai / estimate).
// Used by dashboard widgets and analytics views to avoid showing
// raw numbers without context — every fact is annotated.

export type DataQuality = "real" | "ai" | "estimate";

// ─── Revenue ─────────────────────────────────────────────────────────────────
//
// Revenue can come from three sources:
//   1. Rusprofile / DaData (real, точная цифра)
//   2. AI estimate (диапазон вроде "10-40 млн ₽/год")
//   3. Empty / placeholder
//
// We detect a range pattern in the string ("10-40", "10–40", "≈ 100")
// and downgrade it to estimate. Exact "100 млн ₽/год" stays real.

const RANGE_PATTERN = /\b\d+\s*[-–—]\s*\d+\b/;

export function classifyRevenue(
  raw: string | undefined | null,
): { value: string; quality: DataQuality } | null {
  if (!raw || raw === "—" || raw.trim() === "") return null;
  const value = raw.trim();
  // Range like "10-40 млн ₽" → estimate
  if (RANGE_PATTERN.test(value)) {
    return { value, quality: "estimate" };
  }
  // Has approx symbol → estimate
  if (/[~≈]/.test(value)) {
    return { value, quality: "estimate" };
  }
  // Exact number → real
  return { value, quality: "real" };
}

// ─── Market share ────────────────────────────────────────────────────────────
//
// Market share is computed from score-comparison (myScore vs avgCompScore *
// competitorsCount). Result of 0% is misleading — it almost always means
// "very small player" rather than "literally zero". Replace 0% with
// "<1%" and add a category label for context.

export type MarketSize = "micro" | "small" | "mid" | "leader";

export interface MarketShareInfo {
  display: string;          // "<1%", "3%", "12%"
  numeric: number;          // for charts
  category: MarketSize;
  categoryLabel: string;    // human-readable
  quality: DataQuality;     // always "estimate"
}

export function classifyMarketShare(
  myScore: number,
  avgCompScore: number,
  competitorsCount: number,
): MarketShareInfo {
  let raw = 0;
  if (myScore > 0 && competitorsCount > 0) {
    raw = Math.round(
      (myScore / (myScore + avgCompScore * competitorsCount)) * 100,
    );
  }
  let display: string;
  let numeric: number;
  if (raw < 1) {
    display = "<1%";
    numeric = 0.5;
  } else {
    display = `${raw}%`;
    numeric = raw;
  }
  let category: MarketSize;
  let categoryLabel: string;
  if (raw < 1) {
    category = "micro";
    categoryLabel = "Микро-игрок";
  } else if (raw < 5) {
    category = "small";
    categoryLabel = "Малый игрок";
  } else if (raw < 20) {
    category = "mid";
    categoryLabel = "Средний игрок";
  } else {
    category = "leader";
    categoryLabel = "Лидер ниши";
  }
  return {
    display,
    numeric,
    category,
    categoryLabel,
    quality: "estimate",
  };
}

// ─── Competitors counter ─────────────────────────────────────────────────────
//
// The TZ raises a friction point: dashboard shows "Конкуренты: 0" while the
// SEO block lists "Прямые конкуренты: 4" (those are AI-found names that
// haven't been added as full analyses yet). Single-source-of-truth:
// `tracked` = actually analysed competitors. `aiSuggested` = names found
// by AI/Keys.so but not yet in tracked list.

export interface CompetitorCounter {
  tracked: number;
  aiSuggested: number;
  display: string;          // "0 · 4 найдено AI" or "5"
  hint?: string;            // tooltip / sub-label
}

export function classifyCompetitorCounter(
  trackedCount: number,
  aiSuggestedNames: string[] | undefined,
): CompetitorCounter {
  const trackedSet = new Set<string>();
  // Tracked is just count — caller passes already-deduped value.
  const aiUnique = (aiSuggestedNames ?? [])
    .filter((n) => !trackedSet.has((n ?? "").toLowerCase()))
    .length;

  if (trackedCount === 0 && aiUnique > 0) {
    return {
      tracked: 0,
      aiSuggested: aiUnique,
      display: "0",
      hint: `${aiUnique} найдено AI — добавить в список`,
    };
  }
  if (trackedCount > 0 && aiUnique > trackedCount) {
    const extra = aiUnique - trackedCount;
    return {
      tracked: trackedCount,
      aiSuggested: aiUnique,
      display: String(trackedCount),
      hint: `+${extra} ещё найдено AI`,
    };
  }
  return {
    tracked: trackedCount,
    aiSuggested: aiUnique,
    display: String(trackedCount),
  };
}

// ─── Position chart history ──────────────────────────────────────────────────
//
// Trend chart was hard-coded to 6 months of synthetic data — looks
// ridiculous when domain is younger than the displayed range.
// We only show the chart when there is at least 2 months of real
// monitoring history.

export interface ChartHistoryStatus {
  hasEnoughHistory: boolean;
  monthsCollected: number;
  placeholder?: string;
}

export function classifyChartHistory(
  history: Array<{ score: number; capturedAt: string }> | undefined,
): ChartHistoryStatus {
  if (!history || history.length === 0) {
    return {
      hasEnoughHistory: false,
      monthsCollected: 0,
      placeholder: "Собираем данные. График появится через 4–6 недель мониторинга.",
    };
  }
  // Group by month
  const months = new Set(
    history.map((h) => h.capturedAt.slice(0, 7)),
  );
  if (months.size < 2) {
    return {
      hasEnoughHistory: false,
      monthsCollected: months.size,
      placeholder: `Собрано данных за ${months.size} мес. График появится после двух полных месяцев мониторинга.`,
    };
  }
  return {
    hasEnoughHistory: true,
    monthsCollected: months.size,
  };
}
