import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/blog";
import { GLOSSARY } from "@/content/glossary";

/**
 * Sitemap for marketradar24.ru.
 *
 * Includes the public marketing pages (landing, pricing, partners,
 * express-report), all blog articles, all glossary terms, and key
 * in-page anchors for deep linking. In-app routes (`/admin`,
 * `/owner-dashboard`, `/partner/*`, `/share/*`) live behind auth
 * and are excluded.
 */
const SITE_URL = "https://marketradar24.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/partners`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/express-report`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/glossary`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // ── Landing anchors ─────────────────────────────────────────────────────
    {
      url: `${SITE_URL}/#features`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/#geo`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/#pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/#how`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/#faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/#partner`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const articleEntries: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.date + "T00:00:00Z"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const glossaryEntries: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${SITE_URL}/glossary/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...articleEntries, ...glossaryEntries];
}
