import type { Article } from "../types";

import { article as geoOptimization2026 } from "./geo-optimization-2026";
import { article as llmsTxtGuide } from "./llms-txt-guide";
import { article as getIntoChatgptClaude } from "./get-into-chatgpt-claude";
import { article as competitorAnalysisStepByStep } from "./competitor-analysis-step-by-step";
import { article as b2bTargetAudience } from "./b2b-target-audience";

// Newest first
export const ARTICLES: Article[] = [
  b2bTargetAudience,
  competitorAnalysisStepByStep,
  getIntoChatgptClaude,
  llmsTxtGuide,
  geoOptimization2026,
].sort((a, b) => b.date.localeCompare(a.date));

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getArticlesByCategory(category: Article["category"]): Article[] {
  return ARTICLES.filter((a) => a.category === category);
}

export function getArticlesByTag(tag: string): Article[] {
  return ARTICLES.filter((a) => a.tags.includes(tag));
}

export function getRelatedArticles(article: Article, limit = 3): Article[] {
  // Same category > tag overlap > recency
  return ARTICLES.filter((a) => a.slug !== article.slug)
    .map((a) => {
      const sameCategory = a.category === article.category ? 10 : 0;
      const tagOverlap = a.tags.filter((t) => article.tags.includes(t)).length * 3;
      return { article: a, score: sameCategory + tagOverlap };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.article);
}

export function getAllCategories(): Array<{ category: Article["category"]; count: number }> {
  const map = new Map<Article["category"], number>();
  for (const a of ARTICLES) {
    map.set(a.category, (map.get(a.category) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAllTags(): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>();
  for (const a of ARTICLES) {
    for (const t of a.tags) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ru"));
}
