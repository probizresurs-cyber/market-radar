import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES, getAllCategories, getAllTags } from "@/content/blog";
import type { Article } from "@/content/types";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Блог MarketRadar — статьи о GEO, SEO и анализе бизнеса",
  description:
    "Экспертные статьи о GEO-оптимизации, видимости в нейросетях, SEO, анализе конкурентов и целевой аудитории. Практические гайды от команды MarketRadar.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/blog`,
    siteName: "MarketRadar",
    title: "Блог MarketRadar — статьи о GEO, SEO и анализе бизнеса",
    description:
      "Экспертные статьи о GEO, видимости в ChatGPT и Claude, SEO, анализе конкурентов. Практические гайды.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const T = {
  bg: "#0a0b0f",
  bgSurface: "rgba(255,255,255,0.03)",
  bgSurfaceHover: "rgba(255,255,255,0.06)",
  text: "#E5E7EB",
  textDim: "#9CA3AF",
  textBright: "#F9FAFB",
  border: "rgba(255,255,255,0.08)",
  accent: "#6366f1",
  accentDim: "#a5b4fc",
  cyan: "#22d3ee",
  magenta: "#D500F9",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "MarketRadar", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
  ],
};

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Блог MarketRadar",
  url: `${SITE_URL}/blog`,
  description:
    "Экспертные статьи о GEO-оптимизации, SEO, анализе конкурентов и целевой аудитории.",
  publisher: {
    "@type": "Organization",
    name: "MarketRadar",
    url: SITE_URL,
  },
  blogPost: ARTICLES.map((a) => ({
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    url: `${SITE_URL}/blog/${a.slug}`,
    author: { "@type": "Person", name: a.author },
  })),
};

const formatDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function BlogIndexPage() {
  const categories = getAllCategories();
  const tags = getAllTags().slice(0, 12);
  const featured = ARTICLES[0];
  const rest = ARTICLES.slice(1);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
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

      {/* Hero */}
      <header
        style={{
          maxWidth: 1200,
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
          Блог MarketRadar
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
          Экспертный разбор GEO, SEO и анализа бизнеса
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
          Практические гайды о видимости в нейросетях, технической оптимизации и
          стратегии роста. Никаких пустых текстов — только конкретные шаги.
        </p>
      </header>

      {/* Filters: categories + tags */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 32px 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {categories.map((c) => (
          <span
            key={c.category}
            style={{
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 999,
              background: T.bgSurface,
              border: `1px solid ${T.border}`,
              color: T.textDim,
            }}
          >
            {c.category} · {c.count}
          </span>
        ))}
      </section>

      {/* Featured article */}
      <section
        style={{
          maxWidth: 1200,
          margin: "16px auto 64px",
          padding: "0 32px",
        }}
      >
        <ArticleCard article={featured} featured />
      </section>

      {/* Article grid */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto 80px",
          padding: "0 32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 24,
        }}
      >
        {rest.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </section>

      {/* Tags cloud */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto 80px",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.5,
            color: T.textDim,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Популярные темы
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.map((t) => (
            <span
              key={t.tag}
              style={{
                fontSize: 13,
                padding: "6px 12px",
                borderRadius: 999,
                background: `${T.accent}15`,
                border: `1px solid ${T.accent}33`,
                color: T.accentDim,
              }}
            >
              #{t.tag} · {t.count}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px",
          textAlign: "center",
          borderTop: `1px solid ${T.border}`,
          color: T.textDim,
          fontSize: 14,
        }}
      >
        MarketRadar · {new Date().getFullYear()} ·{" "}
        <a href="https://t.me/market_radar1_bot" style={{ color: T.accentDim }}>
          @market_radar1_bot
        </a>
      </footer>
    </main>
  );
}

function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const card = {
    background: T.bgSurface,
    border: `1px solid ${T.border}`,
    borderRadius: featured ? 24 : 18,
    padding: featured ? 40 : 28,
    transition: "transform 0.15s, border-color 0.15s, background 0.15s",
    display: "block",
    textDecoration: "none",
    color: T.text,
  };

  return (
    <Link href={`/blog/${article.slug}`} style={card}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
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
          {formatDate(article.date)} · {article.readMinutes} мин
        </span>
      </div>

      <h2
        style={{
          margin: "0 0 12px",
          fontSize: featured ? "clamp(24px, 3.5vw, 36px)" : 22,
          lineHeight: 1.2,
          fontWeight: 800,
          color: T.textBright,
          letterSpacing: -0.5,
        }}
      >
        {article.title}
      </h2>

      <p
        style={{
          margin: 0,
          fontSize: featured ? 17 : 15,
          lineHeight: 1.6,
          color: T.textDim,
        }}
      >
        {article.description}
      </p>

      <div
        style={{
          marginTop: 20,
          fontSize: 13,
          color: T.cyan,
          fontWeight: 600,
        }}
      >
        Читать →
      </div>
    </Link>
  );
}
