// Shared content types for blog articles and glossary terms.
// Keeping content as typed TS objects (rather than MDX) makes the
// renderer simpler, the build deterministic, and content
// editable straight from Git without extra tooling.

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; author?: string }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; title?: string; text: string; tone?: "info" | "warn" | "tip" }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "divider" };

export interface Article {
  slug: string;
  title: string;
  description: string;       // meta + card preview, 140–180 chars
  date: string;              // ISO YYYY-MM-DD
  readMinutes: number;
  category: ArticleCategory;
  tags: string[];
  author: string;            // human-readable name (E-E-A-T signal)
  cover?: string;            // path under /public, optional
  blocks: Block[];
}

export type ArticleCategory =
  | "GEO"
  | "SEO"
  | "Анализ"
  | "Контент"
  | "Продажи";

export interface GlossaryTerm {
  slug: string;
  term: string;
  short: string;             // 1-2 sentence canonical definition
  long: Block[];             // expanded explanation
  related?: string[];        // other term slugs
  category: GlossaryCategory;
  altNames?: string[];       // synonyms for search
}

export type GlossaryCategory =
  | "GEO/AI"
  | "SEO"
  | "Маркетинг"
  | "Аналитика"
  | "Продажи";
