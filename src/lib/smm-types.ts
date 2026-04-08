export type SMMPlatform = "vk" | "instagram" | "telegram" | "facebook" | "tiktok" | "youtube";

export interface SMMSocialLinks {
  vk?: string;
  instagram?: string;
  telegram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
}

export interface SMMPlatformStrategy {
  platform: SMMPlatform;
  platformLabel: string;          // "ВКонтакте"
  url?: string;                   // оригинальная ссылка
  audienceFit: string;            // насколько ЦА сидит здесь
  contentFormat: string;          // основные форматы (рилс, статьи, лайвы…)
  postingFrequency: string;       // как часто публиковать
  toneOfVoice: string;            // тон коммуникации именно здесь
  contentPillars: string[];       // 4-6 контент-столпов
  examplePosts: string[];         // 3 примера готовых постов / идей
  hashtagStrategy: string;        // стратегия хэштегов
  growthTactics: string[];        // 3-5 тактик роста
  metricsToTrack: string[];       // KPI
  warnings?: string[];            // что НЕ делать
}

export interface SMMBrandIdentity {
  archetype: string;              // архетип бренда (Творец, Бунтарь...)
  positioning: string;            // позиционирование 1-2 предложения
  uniqueValue: string;            // УТП
  toneOfVoice: string[];          // 3-5 характеристик голоса
  visualStyle: string;            // визуальный стиль
  brandKeywords: string[];        // ключевые слова бренда
}

export interface SMMContentStrategy {
  bigIdea: string;                // большая идея бренда
  contentMission: string;         // миссия контента
  audienceProblems: string[];     // боли ЦА которые решает контент
  storytellingAngles: string[];   // 4-6 сторителлинг-углов
  contentMatrix: Array<{          // матрица контента: типы и цели
    type: string;
    goal: string;
    share: string;                // % от общего объёма
  }>;
}

export interface SMMRealStats {
  vk?: { subscribers: number; posts30d: number; engagement: string; trend: string };
  telegram?: { subscribers: number; posts30d: number };
}

export interface SMMResult {
  generatedAt: string;
  companyName: string;
  companyUrl: string;

  brandIdentity: SMMBrandIdentity;
  contentStrategy: SMMContentStrategy;
  platformStrategies: SMMPlatformStrategy[];

  quickWins: string[];            // что сделать в первые 7 дней
  thirtyDayPlan: string[];        // план на 30 дней по неделям
  redFlags: string[];             // ошибки которые сейчас совершает компания
  inspirationAccounts: string[];  // примеры аккаунтов для вдохновения

  realStats?: SMMRealStats;       // реальные данные VK / Telegram (если удалось получить)
}
