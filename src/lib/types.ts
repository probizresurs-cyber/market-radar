export interface CategoryScore {
  name: string;
  weight: number;
  score: number;
  icon: string;
  delta: number;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  text: string;
  effect: string;
  category: string;
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
    lighthouseScores?: { performance: number; seo: number; accessibility: number };
    firstArchiveDate?: string;
    archiveAgeYears?: number;
    googlePositions?: SeoPosition[];
    keywordsSource?: "keyso" | "ai";
  };
  keysoDashboard?: {
    yandex?: KeysoDashboardData;
    google?: KeysoDashboardData;
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
}
