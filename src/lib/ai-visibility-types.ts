export type LLMName = "yandex" | "claude" | "chatgpt" | "perplexity" | "gemini";

export interface AIMention {
  llm: LLMName;
  query: string;
  mentioned: boolean;
  position: number | null;   // rank in list, null if not mentioned
  sentiment: "positive" | "neutral" | "negative" | null;
  fullResponse: string;
  competitorsMentioned: string[];
  /** true = ответ смоделирован Claude-симулятором; false = реальный API-вызов */
  isSimulated?: boolean;
  /** true = реальный API недоступен (ключ не настроен) — результат не засчитывается */
  unavailable?: boolean;
}

export interface SiteReadinessItem {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
  /** Категория для группировки в UI */
  category?: "ai-bots" | "structured-data" | "metadata" | "content" | "technical";
  /** Баллы которые даёт пройденная проверка (0-15) */
  weight?: number;
  /** Готовый сниппет для копирования (если применимо) */
  fixSnippet?: string;
}

export interface AIReadinessReport {
  /** Общий скор 0-100 */
  score: number;
  /** Скоры по категориям */
  byCategory: {
    "ai-bots": number;
    "structured-data": number;
    "metadata": number;
    "content": number;
    "technical": number;
  };
  /** Все проверки */
  items: SiteReadinessItem[];
  /** Сгенерированные снипеты на основе анализа сайта */
  snippets: {
    llmsTxt?: string;
    robotsTxt?: string;
    organizationSchema?: string;
    faqSchema?: string;
  };
}

export interface AIRecommendation {
  priority: "critical" | "important" | "recommended";
  title: string;
  description: string;
  howTo: string;
  impactScore: number;  // +N to visibility
  category: "schema" | "content" | "external" | "technical";
}

export interface AIVisibilityAudit {
  id: string;
  createdAt: string;
  completedAt?: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
  // Input
  brandName: string;
  websiteUrl: string;
  niche: string;
  region: string;
  queries: string[];
  // Output
  totalScore?: number;
  scoresByLlm?: Record<LLMName, number>;
  mentions?: AIMention[];
  siteReadiness?: SiteReadinessItem[];
  /** Расширенный отчёт со скором, категориями и сниппетами для копирования */
  readinessReport?: AIReadinessReport;
  recommendations?: AIRecommendation[];
  topCompetitors?: Array<{ name: string; count: number }>;
}

export interface LLMCheckResult {
  llm: LLMName;
  mentions: AIMention[];
  available: boolean;
}
