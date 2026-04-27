import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY, getGlossaryByCategory } from "@/content/glossary";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Словарь терминов — MarketRadar",
  description:
    "Словарь маркетинговых, SEO и GEO-терминов: GEO, llms.txt, E-E-A-T, ICP, CJM, Battle Cards, Schema.org и другие. Короткие определения с расширенным разбором.",
  alternates: { canonical: `${SITE_URL}/glossary` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/glossary`,
    siteName: "MarketRadar",
    title: "Словарь терминов — MarketRadar",
    description:
      "Словарь маркетинговых, SEO и GEO-терминов с короткими определениями и расширенным разбором каждого понятия.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const T = {
  bg: "#0a0b0f",
  bgSurface: "rgba(255,255,255,0.03)",
  text: "#E5E7EB",
  textDim: "#9CA3AF",
  textBright: "#F9FAFB",
  border: "rgba(255,255,255,0.08)",
  accent: "#6366f1",
  accentDim: "#a5b4fc",
  cyan: "#22d3ee",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "MarketRadar", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Словарь", item: `${SITE_URL}/glossary` },
  ],
};

const definedTermSetSchema = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Словарь терминов MarketRadar",
  url: `${SITE_URL}/glossary`,
  description: "Словарь маркетинговых, SEO и GEO-терминов",
  hasDefinedTerm: GLOSSARY.map((t) => ({
    "@type": "DefinedTerm",
    "@id": `${SITE_URL}/glossary/${t.slug}`,
    name: t.term,
    description: t.short,
    url: `${SITE_URL}/glossary/${t.slug}`,
    inDefinedTermSet: `${SITE_URL}/glossary`,
    termCode: t.slug,
  })),
};

export default function GlossaryIndexPage() {
  const byCategory = getGlossaryByCategory();
  const categories = Object.keys(byCategory).sort();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetSchema) }}
      />

      {/* Top nav */}
      <nav
        style={{
          padding: "20px 32px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            color: T.textBright,
            fontSize: 18,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: -0.3,
          }}
        >
          MarketRadar
        </Link>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <Link href="/pricing" style={{ color: T.textDim, textDecoration: "none" }}>
            Тарифы
          </Link>
          <Link href="/blog" style={{ color: T.textDim, textDecoration: "none" }}>
            Блог
          </Link>
          <Link
            href="/glossary"
            style={{ color: T.textBright, textDecoration: "none", fontWeight: 600 }}
          >
            Словарь
          </Link>
          <Link href="/partners" style={{ color: T.textDim, textDecoration: "none" }}>
            Партнёрам
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "72px 32px 32px",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 2,
            color: T.cyan,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          Словарь
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(36px, 5vw, 56px)",
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: -1.2,
            color: T.textBright,
            maxWidth: 880,
          }}
        >
          Термины GEO, SEO, маркетинга и продаж — простыми словами
        </h1>
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 18,
            lineHeight: 1.6,
            color: T.textDim,
            maxWidth: 720,
          }}
        >
          Короткие определения с расширенным разбором по каждому понятию.
          {" "}
          {GLOSSARY.length} терминов и пополняется.
        </p>
      </header>

      {/* Category nav */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "16px 32px 32px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {categories.map((c) => (
          <a
            key={c}
            href={`#cat-${encodeURIComponent(c)}`}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              background: `${T.accent}15`,
              border: `1px solid ${T.accent}33`,
              color: T.accentDim,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {c} · {byCategory[c].length}
          </a>
        ))}
      </section>

      {/* Term grid by category */}
      {categories.map((c) => (
        <section
          key={c}
          id={`cat-${encodeURIComponent(c)}`}
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "32px 32px",
            scrollMarginTop: 80,
          }}
        >
          <h2
            style={{
              margin: "0 0 24px",
              fontSize: 22,
              fontWeight: 800,
              color: T.textBright,
              letterSpacing: -0.3,
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 12,
            }}
          >
            {c}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {byCategory[c].map((term) => (
              <Link
                key={term.slug}
                href={`/glossary/${term.slug}`}
                style={{
                  background: T.bgSurface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: 20,
                  textDecoration: "none",
                  color: T.text,
                  display: "block",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 17,
                    fontWeight: 700,
                    color: T.textBright,
                  }}
                >
                  {term.term}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: T.textDim,
                  }}
                >
                  {term.short}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <footer
        style={{
          padding: "32px",
          textAlign: "center",
          borderTop: `1px solid ${T.border}`,
          color: T.textDim,
          fontSize: 14,
          marginTop: 40,
        }}
      >
        MarketRadar · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
