import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticleBySlug, getRelatedArticles } from "@/content/blog";
import { BlockRenderer } from "@/components/BlockRenderer";
import type { Article, Block } from "@/content/types";

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
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Статья не найдена" };

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `${SITE_URL}/blog/${article.slug}` },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      url: `${SITE_URL}/blog/${article.slug}`,
      siteName: "MarketRadar",
      title: article.title,
      description: article.description,
      publishedTime: article.date,
      authors: [article.author],
      tags: article.tags,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

const formatDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// Build a TOC from H2 blocks
function getToc(blocks: Block[]) {
  return blocks
    .filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2")
    .map((b) => ({
      text: b.text,
      id: b.id ?? slugifyServer(b.text),
    }));
}

function slugifyServer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^а-яa-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(article, 3);
  const toc = getToc(article.blocks);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    url: `${SITE_URL}/blog/${article.slug}`,
    inLanguage: "ru-RU",
    author: {
      "@type": "Person",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "MarketRadar",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/og-image.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${article.slug}` },
    keywords: article.tags.join(", "),
    articleSection: article.category,
    wordCount: article.blocks.reduce((acc, b) => {
      if (b.type === "p" || b.type === "h2" || b.type === "h3" || b.type === "callout" || b.type === "quote") {
        return acc + (b.type === "callout" || b.type === "quote" ? b.text : (b as { text: string }).text).split(/\s+/).length;
      }
      if (b.type === "ul" || b.type === "ol") {
        return acc + b.items.join(" ").split(/\s+/).length;
      }
      return acc;
    }, 0),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "MarketRadar", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `${SITE_URL}/blog/${article.slug}`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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
          <Link href="/blog" style={{ color: T.textBright, textDecoration: "none", fontWeight: 600 }}>
            Блог
          </Link>
          <Link href="/glossary" style={{ color: T.textDim, textDecoration: "none" }}>
            Словарь
          </Link>
          <Link href="/partners" style={{ color: T.textDim, textDecoration: "none" }}>
            Партнёрам
          </Link>
        </div>
      </nav>

      {/* Article header */}
      <header
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "56px 32px 24px",
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
          <Link href="/blog" style={{ color: T.textDim, textDecoration: "none" }}>
            ← Все статьи
          </Link>
        </nav>

        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 999,
              background: `${T.accent}25`,
              border: `1px solid ${T.accent}50`,
              color: T.accentDim,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {article.category}
          </span>
          <span style={{ fontSize: 13, color: T.textDim }}>
            {formatDate(article.date)} · {article.readMinutes} мин чтения · {article.author}
          </span>
        </div>

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
          {article.title}
        </h1>

        <p
          style={{
            margin: "20px 0 0",
            fontSize: 19,
            lineHeight: 1.55,
            color: T.textDim,
          }}
        >
          {article.description}
        </p>
      </header>

      {/* TOC + body layout */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 32px 64px",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 40,
        }}
      >
        {toc.length >= 2 && (
          <aside
            style={{
              padding: "16px 20px",
              background: T.bgSurface,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              maxWidth: 760,
              margin: "16px auto 0",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                color: T.textDim,
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              В статье
            </div>
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {toc.map((t, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  <a
                    href={`#${t.id}`}
                    style={{
                      color: T.accentDim,
                      textDecoration: "none",
                    }}
                  >
                    {i + 1}. {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        )}

        <article
          style={{
            maxWidth: 760,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <BlockRenderer blocks={article.blocks} />

          <div
            style={{
              marginTop: 40,
              paddingTop: 24,
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {article.tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: `${T.accent}15`,
                  border: `1px solid ${T.accent}33`,
                  color: T.accentDim,
                  textDecoration: "none",
                }}
              >
                #{t}
              </Link>
            ))}
          </div>
        </article>
      </div>

      {/* Related articles */}
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
            Что ещё почитать
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {related.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                style={{
                  background: T.bgSurface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 16,
                  padding: 24,
                  textDecoration: "none",
                  color: T.text,
                  display: "block",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: T.accentDim,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  {a.category}
                </div>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    lineHeight: 1.3,
                    fontWeight: 700,
                    color: T.textBright,
                  }}
                >
                  {a.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: T.textDim,
                  }}
                >
                  {a.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto 80px",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${T.accent}15, ${T.cyan}15)`,
            border: `1px solid ${T.accent}33`,
            borderRadius: 24,
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 24,
              fontWeight: 800,
              color: T.textBright,
            }}
          >
            Проверьте свой сайт за 2 минуты
          </h3>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 16,
              lineHeight: 1.5,
              color: T.textDim,
            }}
          >
            Бесплатный экспресс-аудит: SEO, скорость, UX, AI-видимость, конкуренты.
          </p>
          <Link
            href="/express-report"
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${T.accent}, #8b5cf6)`,
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 28px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            Запустить аудит →
          </Link>
        </div>
      </section>

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
