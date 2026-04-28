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
  recommendations?: AIRecommendation[];
  topCompetitors?: Array<{ name: string; count: number }>;
}

export interface LLMCheckResult {
  llm: LLMName;
  mentions: AIMention[];
  available: boolean;
}
