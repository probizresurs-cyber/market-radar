import type { MetadataRoute } from "next";

/**
 * Sitemap for marketradar24.ru.
 *
 * Includes the public marketing pages (landing, pricing, partners,
 * express-report) and key in-page anchors for deep linking.
 * In-app routes (`/admin`, `/owner-dashboard`, `/partner/*`, `/share/*`)
 * live behind auth and are excluded.
 */
const SITE_URL = "https://marketradar24.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    // ── Public pages ────────────────────────────────────────────────────────
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
}
