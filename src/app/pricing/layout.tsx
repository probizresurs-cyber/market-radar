import type { Metadata } from "next";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Тарифы и продукты — MarketRadar",
  description:
    "Бесплатный экспресс в Telegram — 0 ₽. Экспресс на сайте по промокоду START — 1 ₽. Полный отчёт + 30 дней в платформе — 2 900 ₽. Подписки от 4 900 ₽/мес со скидкой 50% на первый месяц.",
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/pricing`,
    siteName: "MarketRadar",
    title: "Тарифы MarketRadar — от 0 ₽ до Enterprise",
    description:
      "Три уровня входа: бесплатный экспресс, экспресс за 1 ₽ (промокод START), полный отчёт за 2 900 ₽. Подписки MINI / Базовый / PRO / Agency — скидка 50% на первый месяц.",
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
      name: "Тарифы",
      item: `${SITE_URL}/pricing`,
    },
  ],
};

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Тарифы MarketRadar",
  description: "Тарифные планы платформы конкурентного анализа MarketRadar",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Offer",
        name: "Бесплатный экспресс в Telegram",
        price: "0",
        priceCurrency: "RUB",
        description: "Экспресс-аудит сайта через Telegram-бот за 2 минуты. Score, 5 категорий, ключевые инсайты.",
        url: "https://t.me/market_radar1_bot",
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Offer",
        name: "Экспресс-отчёт на сайте (промокод START)",
        price: "1",
        priceCurrency: "RUB",
        description: "Полный экспресс с сохранением на email и PDF. По промокоду START.",
        url: "https://marketradar24.ru/express-report",
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Offer",
        name: "Полный отчёт + 30 дней в платформе",
        price: "2900",
        priceCurrency: "RUB",
        description: "15 решений и рекомендаций, ЦА, CJM, брендбук, Battle Cards, мониторинг 24/7.",
        url: "https://marketradar24.ru/pricing",
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Offer",
        name: "Подписка MINI",
        price: "4900",
        priceCurrency: "RUB",
        description: "1 пользователь, 1 компания, базовый набор модулей. Первый месяц 2 450 ₽.",
        url: "https://marketradar24.ru/pricing",
      },
    },
    {
      "@type": "ListItem",
      position: 5,
      item: {
        "@type": "Offer",
        name: "Подписка PRO",
        price: "19900",
        priceCurrency: "RUB",
        description: "До 10 пользователей, 10 компаний, контент-завод, AI-видимость. Первый месяц 9 950 ₽.",
        url: "https://marketradar24.ru/pricing",
      },
    },
  ],
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      {children}
    </>
  );
}
