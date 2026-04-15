// ─── SEO Articles — type definitions ─────────────────────────────────────────

export type SEOArticleType =
  | "informational"   // Что такое / Как работает
  | "how-to"          // Пошаговая инструкция
  | "listicle"        // Топ-N / Лучшие
  | "review"          // Обзор товара / сервиса
  | "comparison"      // A vs B
  | "case-study"      // Кейс
  | "faq"             // FAQ
  | "landing-article" // Продающая статья
  | "news"            // Новость / анонс
  | "expert-column";  // Экспертная колонка

export type SEOPlatform =
  | "website"    // Сайт / блог
  | "zen"        // Яндекс Дзен
  | "vc"         // vc.ru
  | "habr"       // Habr
  | "pikabu"     // Pikabu
  | "tenchat"    // TenChat
  | "teletype"   // Teletype.in
  | "medium"     // Medium
  | "dzen-pulse" // Дзен Пульс
  | "spark";     // Spark.ru

export interface SEOPlatformProfile {
  id: SEOPlatform;
  label: string;
  icon: string;
  maxChars: number;            // 0 = unlimited
  recommendedChars: [number, number]; // [min, max]
  supportsHtml: boolean;
  supportsImages: boolean;
  supportsEmbeds: boolean;
  formattingNote: string;
}

export const SEO_PLATFORMS: SEOPlatformProfile[] = [
  {
    id: "website", label: "Сайт / блог", icon: "🌐",
    maxChars: 0, recommendedChars: [1500, 8000],
    supportsHtml: true, supportsImages: true, supportsEmbeds: true,
    formattingNote: "Полная HTML-разметка, любая длина",
  },
  {
    id: "zen", label: "Яндекс Дзен", icon: "🟨",
    maxChars: 0, recommendedChars: [3000, 10000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: false,
    formattingNote: "Нет H1 — заголовок статьи = H1. Первые 300 символов без внешних ссылок",
  },
  {
    id: "vc", label: "vc.ru", icon: "📰",
    maxChars: 0, recommendedChars: [2000, 6000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: true,
    formattingNote: "Блочный редактор, нет raw HTML. Принято ≥ 2000 символов",
  },
  {
    id: "habr", label: "Habr", icon: "🟢",
    maxChars: 0, recommendedChars: [3000, 12000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: true,
    formattingNote: "Markdown + хабра-теги. Блоки кода, spoiler, cut",
  },
  {
    id: "pikabu", label: "Pikabu", icon: "🟠",
    maxChars: 10000, recommendedChars: [1000, 5000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: false,
    formattingNote: "До 10 000 символов, простой форматированный текст + изображения",
  },
  {
    id: "tenchat", label: "TenChat", icon: "💼",
    maxChars: 5000, recommendedChars: [800, 3000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: false,
    formattingNote: "До 5000 символов, хэштеги приветствуются. Нет внешних ссылок",
  },
  {
    id: "teletype", label: "Teletype.in", icon: "📝",
    maxChars: 0, recommendedChars: [1000, 5000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: false,
    formattingNote: "Минималистичная платформа — текст и изображения",
  },
  {
    id: "medium", label: "Medium", icon: "⭕",
    maxChars: 0, recommendedChars: [1500, 7000],
    supportsHtml: false, supportsImages: true, supportsEmbeds: true,
    formattingNote: "Английский / русский. Блочный редактор",
  },
];

export const SEO_ARTICLE_TYPES: { id: SEOArticleType; label: string; icon: string; desc: string }[] = [
  { id: "informational",   label: "Информационная",   icon: "📖", desc: "Что такое / Как работает / Всё о…" },
  { id: "how-to",          label: "Инструкция",        icon: "📋", desc: "Пошаговое руководство" },
  { id: "listicle",        label: "Listicle",           icon: "📌", desc: "Топ-N, Лучшие, Список полезностей" },
  { id: "review",          label: "Обзор",              icon: "🔍", desc: "Обзор продукта / сервиса / инструмента" },
  { id: "comparison",      label: "Сравнение",          icon: "⚖️", desc: "A vs B — сравнение альтернатив" },
  { id: "case-study",      label: "Кейс",               icon: "🏆", desc: "История успеха / разбор проекта" },
  { id: "faq",             label: "FAQ",                icon: "❓", desc: "Ответы на частые вопросы" },
  { id: "landing-article", label: "Продающая",          icon: "💰", desc: "Статья-лендинг, привязана к CTA" },
  { id: "news",            label: "Новость",            icon: "📢", desc: "Новость, анонс, пресс-релиз" },
  { id: "expert-column",   label: "Экспертная колонка", icon: "🧑‍💼", desc: "Мнение эксперта / авторская колонка" },
];

// ─── Keywords ─────────────────────────────────────────────────────────────────

export interface SEOKeyword {
  phrase: string;
  frequency: "high" | "medium" | "low";
  isLsi: boolean;       // семантически близкое / LSI
  usedInHeadings: boolean;
  usedInBody: boolean;
}

export interface SEOKeywordCluster {
  id: string;
  name: string;
  topic: string;
  keywords: SEOKeyword[];
  createdAt: string;
}

// ─── Article structure ────────────────────────────────────────────────────────

export interface SEOSection {
  id: string;
  order: number;
  heading: string;
  level: 2 | 3;
  contentBrief: string;    // what this section should cover
  wordTarget: number;
  generatedContent?: string;
  keywords: string[];
  status: "empty" | "generating" | "done";
}

export interface SEOArticleMeta {
  title: string;           // <title> tag, ≤ 60 chars
  metaDescription: string; // <meta description>, ≤ 160 chars
  ogTitle?: string;
  ogDescription?: string;
  slug?: string;
  focusKeyword: string;
}

export interface SEOArticleBrief {
  articleType: SEOArticleType;
  platform: SEOPlatform;
  topic: string;
  audience: string;
  wordCountTarget: number;
  focusKeyword: string;
  secondaryKeywords: string[];
  competitorUrls: string[];
  toneOfVoice: string[];
  callToAction: string;
  internalLinks: string[];
}

// ─── Full article ─────────────────────────────────────────────────────────────

export interface SEOArticle {
  id: string;
  generatedAt: string;
  updatedAt: string;
  brief: SEOArticleBrief;
  keywords: SEOKeyword[];
  outline: SEOSection[];
  meta: SEOArticleMeta;
  h1: string;
  intro: string;
  conclusion: string;
  fullText: string;
  readabilityScore?: number;
  seoScore?: number;
  wordCount: number;
  status: "draft" | "outline" | "generated" | "reviewed";
  exportedFormats: Array<"html" | "md" | "txt">;
}

// localStorage key: mr_seo_${userId}
export interface SEOArticlesState {
  articles: SEOArticle[];
  keywordClusters: SEOKeywordCluster[];
}
