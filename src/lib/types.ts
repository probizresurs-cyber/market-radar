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
  };
  recommendations: Recommendation[];
  insights: Insight[];
}
