export interface TADemographics {
  personaName: string;      // "Мария, 34"
  age: string;              // "28–42"
  genderRatio: string;      // "70% женщин"
  income: string;           // "50 000 – 120 000 ₽/мес"
  lifestyle: string;
}

export interface TAWorldview {
  hopesAndDreams: string;
  winsAndLosses: string;
  coreBeliefs: string;
  values: string[];
  identity: string;
  shortDescription: string;
}

export interface TAPastSolution {
  name: string;
  liked: string;
  disliked: string;
  quote: string;
}

export interface TAQuote {
  text: string;
  from: string;
}

export interface TADontWant {
  text: string;
  quote: string;
}

export interface TASegment {
  id: number;
  segmentName: string;
  isGolden: boolean;         // "золотой" сегмент
  goldenReason?: string;     // почему этот сегмент приоритетный
  demographics: TADemographics;
  worldview: TAWorldview;

  mainProblems: string[];
  topEmotions: string[];
  topFears: string[];
  fearRelationshipEffects: string[];
  painfulPhrases: TAQuote[];

  painSituations: string[];
  obstacles: string[];
  myths: string[];

  pastSolutions: TAPastSolution[];
  dontWantToDo: TADontWant[];

  magicTransformation: string;
  transformationImpact: string[];
  postTransformationQuotes: TAQuote[];

  marketSuccessConditions: string[];
  mustLetGo: string;
  whoBlamedForProblem: string[];
  topObjections: string[];
}

export type TAAudienceType = "b2c" | "b2b";

export interface TAResult {
  generatedAt: string;
  companyName: string;
  companyUrl: string;
  niche: string;
  summary: string;
  segments: TASegment[];
  /** Тип ЦА: B2C (конечные потребители) или B2B (юр. лица/ЛПР).
   * Поле добавлено позже — у старых анализов может отсутствовать (трактуем как b2c). */
  audienceType?: TAAudienceType;
}
