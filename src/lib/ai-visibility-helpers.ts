/**
 * Общая логика AI-видимости, используемая и в AIVisibilityView (ручной запуск),
 * и в фоновом авто-запуске из AppShell (сразу после основного анализа компании).
 * Вынесено сюда, чтобы не дублировать подсчёт скора и угадывание ниши в двух местах.
 */
import type { AIMention, LLMName } from "@/lib/ai-visibility-types";

export const NICHE_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: "Медицина / Клиники",            keywords: ["стоматолог", "клиник", "медицин", "врач", "терапевт", "хирург", "имплант", "ортодонт"] },
  { label: "Маркетинговое агентство",       keywords: ["маркетинг", "агентств", "smm", "реклам", "брендинг", "pr-агентство"] },
  { label: "IT / SaaS / Разработка ПО",     keywords: ["saas", " it ", "it-", "разработк", "программирован", "софт", "приложен", "стартап"] },
  { label: "Юридические услуги",            keywords: ["юрист", "юридическ", "адвокат", "правов"] },
  { label: "Образование / Онлайн-курсы",    keywords: ["образован", "обучен", "курс", "школа", "репетитор", "edu", "edtech"] },
  { label: "Финансы / Бухгалтерия",         keywords: ["финанс", "бухгалтер", "аудит", "налог", "1c", "1с"] },
  { label: "Строительство / Ремонт",        keywords: ["строительств", "ремонт", "отделк", "монтаж", "стройка"] },
  { label: "Ресторан / Общепит",            keywords: ["ресторан", "кафе", "бар", "общепит", "кухн", "пиццер", "доставка еды"] },
  { label: "Интернет-магазин / E-commerce", keywords: ["интернет-магазин", "магазин", "ecommerce", "e-commerce", "маркетплейс", "ozon", "wildberries"] },
  { label: "Недвижимость",                  keywords: ["недвижим", "квартир", "новостро", "риелтор", "агентство недвижимости"] },
  { label: "Красота / Wellness",            keywords: ["красот", "салон", "spa", "wellness", "парикмахер", "косметол", "массаж"] },
  { label: "Логистика / Доставка",          keywords: ["логистик", "доставк", "перевозк", "транспортн", "склад"] },
];

export function guessNiche(...sources: Array<string | undefined>): string {
  const haystack = sources.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return "";
  for (const { label, keywords } of NICHE_KEYWORDS) {
    if (keywords.some(k => haystack.includes(k))) return label;
  }
  return "";
}

// Веса: российский YandexGPT важен для РФ-рынка; Claude и ChatGPT — глобальные.
// Perplexity исключён из аудита (Keys.so для Яндекс Нейро/Алисы покрывает русский AI-сегмент).
export const LLM_WEIGHTS: Record<LLMName, number> = {
  yandex:     0.32,
  claude:     0.27,
  chatgpt:    0.27,
  perplexity: 0,     // не используется — оставлено для совместимости старых отчётов
  gemini:     0.14,
};

export function calcScoreForLLM(mentions: AIMention[], llm: LLMName): number {
  const llmMentions = mentions.filter(m => m.llm === llm && !m.unavailable);
  if (!llmMentions.length) return -1; // -1 = нет данных (ключ не настроен)
  const mentioned = llmMentions.filter(m => m.mentioned);
  const mentionRate = mentioned.length / llmMentions.length;
  const avgPos = mentioned.length
    ? mentioned.reduce((s, m) => s + (m.position ?? 5), 0) / mentioned.length : 0;
  const posScore = avgPos > 0 ? Math.max(0, 1 - (avgPos - 1) / 10) : 0;
  const sentimentScore = mentioned.length
    ? mentioned.filter(m => m.sentiment === "positive").length / mentioned.length : 0;
  return Math.round(mentionRate * 70 + posScore * 20 + sentimentScore * 10);
}

export function calcTotalScore(mentions: AIMention[]): { total: number; byLlm: Record<LLMName, number> } {
  // Perplexity исключён из аудита (Yandex Neuro/Alice покрываются Keys.so отдельным блоком).
  const llms: LLMName[] = ["yandex", "claude", "chatgpt", "gemini"];
  const byLlm = {} as Record<LLMName, number>;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const llm of llms) {
    const score = calcScoreForLLM(mentions, llm);
    byLlm[llm] = score;
    if (score >= 0) { // только если данные есть
      weightedSum += score * LLM_WEIGHTS[llm];
      totalWeight += LLM_WEIGHTS[llm];
    }
  }
  return { total: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0, byLlm };
}

export function extractTopCompetitors(mentions: AIMention[]): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const m of mentions)
    for (const c of m.competitorsMentioned)
      counts[c] = (counts[c] ?? 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => ({ name, count }));
}
