/**
 * GEO-агент — типы.
 *
 * GEO (Generative Engine Optimization) — работа над тем, чтобы сайт
 * попадал в ответы ассистентов (ChatGPT, Алиса/Нейро, Perplexity, Gemini,
 * Claude, Copilot). В отличие от SEO, где единица — позиция страницы,
 * здесь единица — «процитировал ли ассистент нас как источник» и
 * «назвал ли он нас, когда клиент спросил кого посоветовать».
 *
 * Отчёт агента состоит из четырёх слоёв (см. run.ts):
 *   1. crawl      — что реально отдаёт сайт краулерам ассистентов;
 *   2. pages      — насколько каждая страница «извлекаема» (answer-first,
 *                   вопросы в H2, FAQ, таблицы, даты, автор, разметка);
 *   3. visibility — что отвечают ассистенты на вопросы клиентов и кого
 *                   они цитируют вместо нас (source-gap);
 *   4. plan       — приоритизированные действия + готовые артефакты
 *                   (llms.txt, robots-блок, JSON-LD, FAQ, answer-капсулы).
 */

export type GeoPillar =
  | "access"      // Доступность: robots, статусы, бот-щиты, SSR
  | "extract"     // Извлекаемость: структура, answer-first, FAQ, таблицы
  | "entity"      // Сущность и доверие: Organization, sameAs, автор, реквизиты
  | "freshness"   // Свежесть: даты, lastmod, «обновлено»
  | "external";   // Внешние сигналы: кого цитируют ассистенты, упоминания

export const GEO_PILLAR_LABELS: Record<GeoPillar, string> = {
  access: "Доступность для краулеров ассистентов",
  extract: "Извлекаемость ответа",
  entity: "Сущность и доверие",
  freshness: "Свежесть",
  external: "Внешние сигналы и цитируемость",
};

export type CheckStatus = "pass" | "warn" | "fail" | "na";

export interface GeoCheck {
  key: string;
  pillar: GeoPillar;
  label: string;
  status: CheckStatus;
  /** Вес в баллах (0–20). Сумма весов по опоре = 100 % опоры. */
  weight: number;
  /** Что именно нашли — человеческим языком, с цифрами. */
  detail: string;
  /** Как чинить — одно-два предложения. */
  fix?: string;
  /** Затронутые URL (для постраничных проверок). */
  urls?: string[];
  /** Готовый фрагмент кода / текста для вставки. */
  snippet?: string;
}

export interface FetchProbe {
  status: number;
  ok: boolean;
  bytes: number;
  ttfbMs: number;
  /** 200, но тело — заглушка бот-щита / JS-челлендж. */
  botStub: boolean;
  finalUrl: string;
  error?: string;
}

export interface JsonLdSummary {
  types: string[];
  organization?: {
    name?: string;
    url?: string;
    logo?: boolean;
    sameAs: string[];
    contact: boolean;
    address: boolean;
  };
  faqQuestions: number;
  article?: { datePublished?: string; dateModified?: string; author?: string };
  hasBreadcrumbs: boolean;
  hasWebSite: boolean;
  parseErrors: number;
}

export interface PageAudit {
  url: string;
  /** Откуда взяли URL: sitemap / llms.txt / главная / ссылка. */
  source: "home" | "sitemap" | "llms" | "link";
  browser: FetchProbe;
  /** Тот же URL под UA GPTBot — ловим клоакинг и бот-щиты. */
  aiBot?: FetchProbe;
  title: string;
  titleLen: number;
  description: string;
  descriptionLen: number;
  canonical: string;
  lang: string;
  noindex: boolean;
  h1: string[];
  h2: string[];
  h3: string[];
  /** Доля H2/H3, сформулированных как вопрос или запрос («как…», «что…», «сколько…»). */
  questionHeadingShare: number;
  /** Видимый текст без скриптов/стилей. */
  textChars: number;
  words: number;
  /** Отношение текста к HTML — маркер «страница живёт в JS». */
  textRatio: number;
  scriptBytes: number;
  /** Первый содержательный абзац после H1. */
  lede: string;
  ledeWords: number;
  /** Лид отвечает прямо: есть подлежащее-сущность и глагол-определение («X — это…», «X делает…»). */
  ledeIsAnswer: boolean;
  lists: number;
  tables: number;
  faqBlock: boolean;
  /** Цифры с единицами (%, ₽, млн, лет) в тексте. */
  factNumbers: number;
  /** Ссылки на внешние источники (не соцсети, не свой домен). */
  externalRefs: number;
  internalLinks: number;
  imagesTotal: number;
  imagesWithoutAlt: number;
  /** Видимые метки даты: «обновлено», time[datetime], dateModified. */
  visibleDate?: string;
  authorVisible: boolean;
  /** Реквизиты/контакты: ИНН, ОГРН, телефон, адрес, email. */
  entitySignals: string[];
  jsonLd: JsonLdSummary;
  og: { title: boolean; description: boolean; image: boolean };
  /** Итог по странице 0–100 (только извлекаемость + сущность + свежесть). */
  score: number;
  issues: string[];
}

export type BotRule = "allowed" | "blocked" | "no-rule";

export interface RobotsAudit {
  present: boolean;
  raw?: string;
  bots: Array<{ name: string; label: string; rule: BotRule }>;
  sitemaps: string[];
}

export interface LlmsTxtAudit {
  present: boolean;
  chars: number;
  hasTitle: boolean;
  hasSummary: boolean;
  links: number;
  /** Ссылки из llms.txt, которые не отдают 200 — ассистент пойдёт по ним и упрётся. */
  brokenLinks: string[];
  hasFull: boolean;
  /** Цифры/цены в llms.txt расходятся со страницами — ловим на уровне предупреждения. */
  notes: string[];
}

export interface SitemapAudit {
  present: boolean;
  urls: number;
  /** Доля URL с lastmod. */
  lastmodShare: number;
  /** Самая свежая lastmod. */
  newestLastmod?: string;
  /** Все lastmod одинаковые — значит ставятся «сейчас» при генерации, а не реальная дата. */
  lastmodUniform: boolean;
  /** Якорные ссылки (/#faq) в sitemap — мусор для краулера. */
  anchorUrls: number;
}

export interface SiteCrawl {
  origin: string;
  domain: string;
  brandName: string;
  robots: RobotsAudit;
  llms: LlmsTxtAudit;
  sitemap: SitemapAudit;
  pages: PageAudit[];
  /** Страницы с 4xx/5xx среди проверенных. */
  brokenPages: Array<{ url: string; status: number; source: PageAudit["source"] }>;
  /** Название организации расходится между страницами/разметкой. */
  entityNames: string[];
  durationMs: number;
}

// ── Видимость в ассистентах ────────────────────────────────────────────────

export type ProbeLLM = "chatgpt" | "chatgpt-search" | "perplexity" | "gemini" | "claude" | "yandex";

export const PROBE_LLM_LABELS: Record<ProbeLLM, string> = {
  "chatgpt": "ChatGPT (без поиска)",
  "chatgpt-search": "ChatGPT Search",
  "perplexity": "Perplexity",
  "gemini": "Gemini",
  "claude": "Claude",
  "yandex": "YandexGPT",
};

export type PromptIntent = "recommend" | "compare" | "howto" | "price" | "brand" | "define";

export interface GeoPrompt {
  text: string;
  intent: PromptIntent;
}

export interface ProbeAnswer {
  llm: ProbeLLM;
  prompt: string;
  intent: PromptIntent;
  answer: string;
  mentioned: boolean;
  /** Ассистент дал ссылку на наш домен как источник. */
  citedUs: boolean;
  /** Домены-источники, которые ассистент процитировал. */
  citations: string[];
  /** Бренды/компании, названные в ответе (эвристика). */
  brandsNamed: string[];
  unavailable?: boolean;
  error?: string;
}

export interface VisibilityReport {
  prompts: GeoPrompt[];
  answers: ProbeAnswer[];
  llmsChecked: ProbeLLM[];
  llmsUnavailable: ProbeLLM[];
  /** % ответов с упоминанием бренда (по доступным LLM). */
  mentionRate: number;
  /** % ответов с цитированием нашего домена (только LLM с источниками). */
  citationRate: number;
  byLlm: Record<string, { checked: number; mentioned: number; cited: number }>;
  /** Кого цитируют вместо нас: домен → сколько раз. Это и есть список площадок для размещения. */
  citedDomains: Array<{ domain: string; count: number; isUs: boolean }>;
  /** Кого называют вместо нас. */
  competitorsNamed: Array<{ name: string; count: number }>;
  /** Промпты, где нас не назвал никто, — сырьё для FAQ/answer-капсул. */
  unansweredPrompts: GeoPrompt[];
}

// ── План и артефакты ───────────────────────────────────────────────────────

export type Effort = "hour" | "day" | "week" | "ongoing";

export interface ActionItem {
  id: string;
  pillar: GeoPillar;
  priority: 1 | 2 | 3; // 1 = делать первым
  title: string;
  why: string;
  howTo: string;
  effort: Effort;
  /** Оценка влияния на скор — качественная, не обещание. */
  impact: "high" | "medium" | "low";
  urls?: string[];
  snippet?: string;
}

export interface FaqDraft {
  question: string;
  answer: string;
  /** Из какого промпта родился вопрос. */
  fromPrompt?: string;
}

export interface AnswerCapsule {
  url: string;
  /** Текущий лид страницы. */
  current: string;
  /** Предложенный первый абзац — прямой ответ 40–70 слов. */
  proposed: string;
  /** Предложенный H1, если текущий не называет предмет. */
  proposedH1?: string;
}

export interface GeoArtifacts {
  llmsTxt: string;
  robotsAiBlock: string;
  organizationJsonLd: string;
  faqJsonLd?: string;
  faq: FaqDraft[];
  capsules: AnswerCapsule[];
  /** Площадки для внешних размещений — из citedDomains, без нашего домена и без соцсетей. */
  placementTargets: Array<{ domain: string; count: number; kind: "media" | "review" | "ugc" | "directory" | "other" }>;
}

export interface GeoScore {
  total: number;
  pillars: Record<GeoPillar, number>;
}

export interface GeoReport {
  version: 1;
  createdAt: string;
  input: GeoAuditInput;
  crawl: SiteCrawl;
  checks: GeoCheck[];
  visibility?: VisibilityReport;
  score: GeoScore;
  plan: ActionItem[];
  artifacts: GeoArtifacts;
  /** Чего не проверили и почему (нет ключа, сайт не ответил) — честно, в отчёт. */
  limitations: string[];
}

export interface GeoAuditInput {
  websiteUrl: string;
  brandName?: string;
  niche?: string;
  region?: string;
  /** Известные конкуренты — чтобы считать share of voice против них. */
  competitors?: string[];
  /** Свои промпты; если пусто — сгенерируем. */
  prompts?: string[];
  /** Сколько страниц проверять (по умолчанию 12). */
  maxPages?: number;
  /** Какие ассистенты опрашивать; пусто = все, для которых есть ключ. */
  llms?: ProbeLLM[];
  /** Пропустить опрос ассистентов (быстрый технический аудит). */
  skipVisibility?: boolean;
  /** Пропустить генерацию текстов через Claude (артефакты только детерминированные). */
  skipLlmArtifacts?: boolean;
}

export type ProgressFn = (stage: string, detail?: string) => void;
