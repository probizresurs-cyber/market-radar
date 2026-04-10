// Review analysis types

export interface Review {
  id: string;
  platform: string;        // yandex_maps | 2gis | otzovik | avito | google | manual
  author: string;
  rating: number;          // 1-5
  text: string;
  date: string;            // ISO date or human-readable
  reply?: string;          // ответ компании
}

export interface ReviewCollection {
  id: string;
  companyName: string;
  platform: string;
  reviews: Review[];
  collectedAt: string;
  source: "paste" | "screenshot" | "api";
}

export interface ReviewTopicSentiment {
  topic: string;           // e.g. "обслуживание", "цена", "качество"
  positive: number;        // count
  negative: number;
  neutral: number;
  keyQuotes: string[];     // 2-3 notable quotes
}

export interface ReviewAnalysis {
  id: string;
  companyName: string;
  totalReviews: number;
  avgRating: number;
  ratingDistribution: { [key: number]: number }; // 1-5 → count
  sentimentSummary: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topics: ReviewTopicSentiment[];
  strengths: string[];     // сильные стороны
  weaknesses: string[];    // слабые стороны
  recommendations: string[];
  responseTemplates: {
    type: "positive" | "negative" | "neutral";
    template: string;
  }[];
  summary: string;         // общий вердикт
  analyzedAt: string;
}
