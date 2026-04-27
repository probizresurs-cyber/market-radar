import type { Metadata } from "next";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Партнёрская программа — MarketRadar",
  description:
    "Зарабатывайте до 50% комиссии, рекомендуя MarketRadar. Реферальная программа (20%) и интеграторская с прогрессивной шкалой (25–50%). Выплаты ежемесячно.",
  alternates: {
    canonical: `${SITE_URL}/partners`,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/partners`,
    siteName: "MarketRadar",
    title: "Партнёрская программа — MarketRadar",
    description:
      "Зарабатывайте до 50% комиссии с продаж MarketRadar. Реферальная и интеграторская программы. Прозрачная аналитика, ежемесячные выплаты.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "MarketRadar",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Партнёрская программа",
      item: `${SITE_URL}/partners`,
    },
  ],
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
