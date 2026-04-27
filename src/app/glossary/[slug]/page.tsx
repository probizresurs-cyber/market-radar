import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GLOSSARY,
  getTermBySlug,
  getRelatedTerms,
} from "@/content/glossary";
import { BlockRenderer } from "@/components/BlockRenderer";

const SITE_URL = "https://marketradar24.ru";

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

export async function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return { title: "Термин не найден" };

  const title = `${term.term} — что это · Словарь MarketRadar`;
  return {
    title,
    description: term.short,
    alternates: { canonical: `${SITE_URL}/glossary/${term.slug}` },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      url: `${SITE_URL}/glossary/${term.slug}`,
      siteName: "MarketRadar",
      title,
      description: term.short,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function TermPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) notFound();

  const related = getRelatedTerms(term);

  const definedTermSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    description: term.short,
    url: `${SITE_URL}/glossary/${term.slug}`,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Словарь терминов MarketRadar",
      url: `${SITE_URL}/glossary`,
    },
    termCode: term.slug,
    inLanguage: "ru-RU",
    ...(term.altNames && term.altNames.length > 0 ? { alternateName: term.altNames } : {}),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "MarketRadar", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Словарь", item: `${SITE_URL}/glossary` },
      {
        "@type": "ListItem",
        position: 3,
        name: term.term,
        item: `${SITE_URL}/glossary/${term.slug}`,
      },
    ],
  };

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
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

      <header
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "56px 32px 16px",
        }}
      >
        <nav
          aria-label="breadcrumbs"
          style={{
            fontSize: 13,
            color: T.textDim,
            marginBottom: 18,
          }}
        >
          <Link href="/glossary" style={{ color: T.textDim, textDecoration: "none" }}>
            ← Словарь
          </Link>
          {" · "}
          <span>{term.category}</span>
        </nav>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(32px, 4.5vw, 48px)",
            lineHeight: 1.15,
            fontWeight: 800,
            letterSpacing: -1,
            color: T.textBright,
          }}
        >
          {term.term}
        </h1>

        {term.altNames && term.altNames.length > 1 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              color: T.textDim,
            }}
          >
            Также: {term.altNames.filter((n) => n !== term.term).join(", ")}
          </div>
        )}

        <p
          style={{
            margin: "20px 0 0",
            fontSize: 19,
            lineHeight: 1.55,
            color: T.text,
            background: T.bgSurface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.accent}`,
            padding: "16px 20px",
            borderRadius: "0 12px 12px 0",
          }}
        >
          {term.short}
        </p>
      </header>

      <article
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "24px 32px 64px",
        }}
      >
        <BlockRenderer blocks={term.long} />
      </article>

      {/* Related terms */}
      {related.length > 0 && (
        <section
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "32px 32px 80px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              color: T.cyan,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Связанные термины
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/glossary/${r.slug}`}
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
                  {r.term}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: T.textDim,
                  }}
                >
                  {r.short}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer
        style={{
          padding: "32px",
          textAlign: "center",
          borderTop: `1px solid ${T.border}`,
          color: T.textDim,
          fontSize: 14,
        }}
      >
        MarketRadar · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
