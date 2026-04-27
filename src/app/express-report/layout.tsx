import type { Metadata } from "next";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Экспресс-аудит сайта — MarketRadar",
  description:
    "Бесплатный экспресс-аудит вашего сайта за 2 минуты: общий Score, оценки по SEO, скорости, UX, доверию и контенту, ключевые инсайты и сравнение с конкурентами.",
  alternates: {
    canonical: `${SITE_URL}/express-report`,
  },
  // Dynamic report pages (with ?id=) should not be indexed individually
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/express-report`,
    siteName: "MarketRadar",
    title: "Бесплатный экспресс-аудит сайта — MarketRadar",
    description:
      "Введите URL — за 2 минуты получите Score вашего сайта, 5 категорий оценки, топ-инсайты и список конкурентов. Бесплатно в Telegram или за 1 ₽ на сайте (промокод START).",
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
      name: "Экспресс-аудит сайта",
      item: `${SITE_URL}/express-report`,
    },
  ],
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MarketRadar Экспресс-аудит",
  url: `${SITE_URL}/express-report`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Онлайн-инструмент для быстрого аудита сайта: анализ SEO, скорости загрузки, UX, доверия и качества контента. Результат за 2 минуты.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "RUB",
    description: "Бесплатно через Telegram-бот. За 1 ₽ на сайте по промокоду START.",
  },
};

export default function ExpressReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      {children}
    </>
  );
}
