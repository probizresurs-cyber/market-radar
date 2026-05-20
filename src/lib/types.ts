export interface CategoryScore {
  name: string;
  weight: number;
  score: number;
  icon: string;
  delta: number;
}

/** Shape конкурента в spywordsDashboard.competitors/advCompetitors.
 *  Топ-N обогащены полями overview + topAds (через дополнительные API-вызовы). */
export interface SpywordsCompetitorShape {
  domain: string;
  commonKeywords: number;
  totalKeywords: number;
  uniqueKeywords?: number;
  competitionLevel?: number;
  overview?: {
    organicKeysTop10: number;
    organicKeysTop50: number;
    organicTraffic: number;
    adKeywords: number;
    uniqueAds: number;
    adTraffic: number;
    adBudget: number;
  };
  topAds?: Array<{ keyword: string; title?: string; description?: string; visibleUrl?: string; position?: number }>;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  text: string;
  effect: string;
  category: string;
  /** Impact 1-5 — насколько сильно повлияет на бизнес (заполняется через /api/prioritize-recommendations). */
  impact?: number;
  /** Effort 1-5 — сколько усилий требуется (1 = легко, 5 = тяжело). */
  effort?: number;
  /** Квадрант: "quick-win" (impact ≥4, effort ≤2), "big-bet" (high impact, high effort), "fill-in" (low impact, low effort), "avoid" (low impact, high effort). */
  effortImpactBucket?: "quick-win" | "big-bet" | "fill-in" | "avoid";
}

export interface Insight {
  type: "niche" | "action" | "battle" | "copy" | "seo" | "offer";
  title: string;
  text: string;
}

export interface SeoPosition {
  keyword: string;
  position: number;
  volume: number;
}

export interface KeysoDashboardData {
  // Органика
  traffic: number;          // vis — трафик с поиска в сутки
  visibility: number;       // topvis — рейтинг по видимости
  pagesInOrganic: number;   // pagesinindex — страниц в выдаче
  adKeys: number;           // adkeyscnt — запросов в контексте
  competitors: string[];    // concs[].name
  // Позиции (it1..it50)
  top1?: number;
  top3?: number;
  top5?: number;
  top10?: number;
  top50?: number;
  // Домен
  dr?: number;
  // Ссылки (из linksHistory)
  backlinks?: number;
  outboundLinks?: number;
  referringDomains?: number;
  outboundDomains?: number;
  ipLinks?: number;
  // ИИ-ответы Алисы
  aiMentions?: number;
}

export interface CopyImprovement {
  element: string;
  current: string;
  suggested: string;
  reason: string;
}

export interface KeywordGap {
  keyword: string;
  volume: number;
  difficulty: "low" | "medium" | "high";
  opportunity: string;
}

export interface OfferAnalysis {
  currentOffer: string;
  weaknesses: string[];
  differentiators: string[];
  suggestedOffer: string;
}

export interface PracticalAdvice {
  copyImprovements: CopyImprovement[];
  keywordGaps: KeywordGap[];
  offerAnalysis: OfferAnalysis;
  contentIdeas: string[];
  seoActions: string[];
}

export interface EeatScore {
  expertise: number;
  authority: number;
  trust: number;
  experience: number;
}

export interface AiPerception {
  knowledgePresence: "strong" | "moderate" | "weak" | "minimal";
  persona: string;
  sampleAnswer: string;
  associatedKeywords: string[];
  eeat: EeatScore;
  contentSignals: string[];
  improvementTips: string[];
}

export interface ScrapedData {
  url: string;
  title: string;
  metaDescription: string;
  metaKeywords: string;
  h1: string[];
  h2: string[];
  imageCount: number;
  imagesWithAlt: number;
  socialLinks: Record<string, string>;
  techStack: string[];
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasCanonical: boolean;
  hasViewport: boolean;
  hasSchemaMarkup: boolean;
  hasVacanciesLink: boolean;
  hasBlogOrCases: boolean;
  isHttps: boolean;
  jsHeavy: boolean;
  rawTextSample: string;
}

export interface AnalysisResult {
  analyzedAt?: string;
  company: {
    name: string;
    url: string;
    score: number;
    avgNiche: number;
    top10: number;
    categories: CategoryScore[];
    description?: string;
  };
  recommendations: Recommendation[];
  insights: Insight[];
  practicalAdvice: PracticalAdvice;
  seo: {
    title: string;
    metaDescription: string;
    keywords: string[];
    pageCount: number;
    domainAge: string;
    estimatedTraffic: string;
    positions: SeoPosition[];
    issues: string[];
    lighthouseScores?: {
      // Top-level поля = мобильная метрика (для обратной совместимости со
      // старыми анализами и кодом который уже это читает).
      performance: number;
      seo: number;
      accessibility: number;
      bestPractices?: number;
      // Core Web Vitals (mobile)
      lcp?: { value: number; display: string; score: number };   // Largest Contentful Paint
      fcp?: { value: number; display: string; score: number };   // First Contentful Paint
      cls?: { value: number; display: string; score: number };   // Cumulative Layout Shift
      tbt?: { value: number; display: string; score: number };   // Total Blocking Time
      si?:  { value: number; display: string; score: number };   // Speed Index
      tti?: { value: number; display: string; score: number };   // Time to Interactive
      // Десктоп — отдельный набор для табы «ПК» в UI. Опционально:
      // если PageSpeed для desktop не отработал, блок не показывается.
      desktop?: {
        performance: number;
        seo: number;
        accessibility: number;
        bestPractices?: number;
        lcp?: { value: number; display: string; score: number };
        fcp?: { value: number; display: string; score: number };
        cls?: { value: number; display: string; score: number };
        tbt?: { value: number; display: string; score: number };
        si?:  { value: number; display: string; score: number };
        tti?: { value: number; display: string; score: number };
      };
    };
    firstArchiveDate?: string;
    archiveAgeYears?: number;
    googlePositions?: SeoPosition[];
    keywordsSource?: "keyso" | "ai";
  };
  keysoDashboard?: {
    yandex?: KeysoDashboardData;
    google?: KeysoDashboardData;
  };
  /** SpyWords-аналитика — дополнительный слой к Keys.so:
   *  • объёмы органики и контекста, бюджет на рекламу
   *  • топ объявлений конкурента в Я.Директе / Google Ads
   *  • SEO-конкуренты по пересечению ключей
   *  Опциональное поле — есть только если SPYWORDS_LOGIN/TOKEN сконфигурирован. */
  spywordsDashboard?: {
    overview?: {
      yandex?: { organicKeysTop10: number; organicKeysTop50: number; organicTraffic: number; adKeywords: number; uniqueAds: number; avgAdPos: number; adTraffic: number; adBudget: number };
      google?: { organicKeysTop10: number; organicKeysTop50: number; organicTraffic: number; adKeywords: number; uniqueAds: number; avgAdPos: number; adTraffic: number; adBudget: number };
    };
    /** SEO-конкуренты (по органике). Топ-N обогащены метриками (overview + topAds). */
    competitors?: {
      yandex?: SpywordsCompetitorShape[];
      google?: SpywordsCompetitorShape[];
    };
    /** Рекламные конкуренты (по платной выдаче). */
    advCompetitors?: {
      yandex?: SpywordsCompetitorShape[];
      google?: SpywordsCompetitorShape[];
    };
    ads?: {
      yandex?: Array<{ keyword: string; title?: string; description?: string; visibleUrl?: string; position?: number }>;
      google?: Array<{ keyword: string; title?: string; description?: string; visibleUrl?: string; position?: number }>;
    };
    /** Топ страниц домена по органике с метриками. */
    topPages?: {
      yandex?: Array<{ url: string; title: string; top10Keys: number; top50Keys: number; lostKeys: number; trafficShare: number }>;
      google?: Array<{ url: string; title: string; top10Keys: number; top50Keys: number; lostKeys: number; trafficShare: number }>;
    };
    organic?: {
      yandex?: Array<{ keyword: string; position: number; volume: number; url?: string }>;
      google?: Array<{ keyword: string; position: number; volume: number; url?: string }>;
    };
  };
  techStack: {
    cms: string;
    analytics: string[];
    chat: string;
    hosting: string;
    other: string[];
  };
  social: {
    vk: { subscribers: number; posts30d: number; engagement: string; trend: string } | null;
    telegram: { subscribers: number; posts30d: number } | null;
    yandexRating: number;
    yandexReviews: number;
    gisRating: number;
    gisReviews: number;
  };
  hiring: {
    openVacancies: number;
    avgSalary: string;
    topRoles: string[];
    trend: "growing" | "stable" | "declining";
    salaryRange: string;
  };
  business: {
    employees: string;
    revenue: string;
    founded: string;
    legalForm: string;
    courtCases?: number;
    rusprofileUrl?: string;
  };
  governmentContracts?: {
    totalContracts: number;
    totalAmount: string;
    recentContracts: Array<{
      date: string;
      amount: string;
      customer: string;
      subject: string;
    }>;
  };
  nicheForecast: {
    trend: "growing" | "stable" | "declining";
    trendPercent: number;
    forecast: string;
    opportunities: string[];
    threats: string[];
    direction: string;
    timeframe: string;
  };
  aiPerception: AiPerception;
  // Score history collected by /api/cron/refresh-scores. Each entry is
  // an ISO timestamp + the overall score at that moment. The dashboard
  // chart only renders when we have at least 2 calendar months of data —
  // otherwise it shows a "Собираем данные" placeholder.
  scoreHistory?: Array<{ capturedAt: string; score: number }>;
}
