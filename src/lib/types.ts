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
  type: "niche" | "action" | "battle";
  title: string;
  text: string;
}

export interface SeoPosition {
  keyword: string;
  position: number;
  volume: number;
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
  seo: {
    title: string;
    metaDescription: string;
    keywords: string[];
    pageCount: number;
    domainAge: string;
    estimatedTraffic: string;
    positions: SeoPosition[];
    issues: string[];
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
}
