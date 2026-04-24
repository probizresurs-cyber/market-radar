// Company writing-style learning types
// Users upload their own articles/documents so AI learns the company's style
// and reuses it when generating new posts, articles, and marketing content.

export interface CompanyStyleDoc {
  id: string;
  name: string;              // file name or user-provided title
  source: "upload" | "paste"; // where the text came from
  mimeType?: string;         // original file MIME type when known
  addedAt: string;           // ISO timestamp
  wordCount: number;         // derived on ingest
  preview: string;           // first ~400 characters for UI display
  fullText: string;          // full extracted plain-text
}

export interface CompanyStyleProfile {
  summary: string;                 // overall description of company voice (3-5 sentences)
  toneDescriptors: string[];       // 3-6 adjectives (e.g. "профессиональный", "тёплый")
  sentenceLength: "short" | "medium" | "long" | "mixed";
  vocabulary: {
    favoriteWords: string[];       // recurring signature words
    avoidWords: string[];          // words the company never uses
    terminology: string[];         // domain-specific terms
  };
  structurePatterns: string[];     // recurring structural moves ("начинает с вопроса", "использует подзаголовки")
  rhetoricalDevices: string[];     // metaphors / rhetorical patterns
  punctuationQuirks: string[];     // e.g. "часто использует тире", "избегает восклицательных"
  examplePhrases: string[];        // 5-10 real quotable phrases from the docs
  dosAndDonts: {
    dos: string[];                 // "пиши так"
    donts: string[];               // "не пиши так"
  };
  styleGuideText: string;          // ready-to-inject guideline block used in prompts
  generatedAt: string;
  basedOnDocIds: string[];         // which docs this profile was built from
}

export interface CompanyStyleState {
  docs: CompanyStyleDoc[];
  profile: CompanyStyleProfile | null;
  applyToGeneration: boolean;      // whether to auto-inject style into post/article routes
}
