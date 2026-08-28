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

/* Схемы продукта переехали сюда из корневого лейаута: раньше они висели на
   КАЖДОЙ странице сайта, включая агентский лендинг /new, где ни подписок,
   ни промокода START нет. Тут цены и тарифы действительно на экране. */
const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MarketRadar",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях: данные из 30+ источников и отчёт с планом роста.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "RUB",
    lowPrice: "2900",
    highPrice: "99900",
    offerCount: "6",
  },
  provider: {
    "@type": "Organization",
    name: "Company24.pro",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Что такое MarketRadar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MarketRadar — AI-платформа для российского рынка, которая автоматически анализирует компанию, её конкурентов, целевую аудиторию и видимость в нейросетях. За 3 минуты выдаёт полный отчёт с планом роста.",
      },
    },
    {
      "@type": "Question",
      name: "Что такое GEO-оптимизация?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "GEO (Generative Engine Optimization) — оптимизация сайта и контента под ответы нейросетей (ChatGPT, Claude, Gemini, Алиса, Яндекс.Нейро). Включает технические правки (schema.org, llms.txt), содержательные (структурированные ответы, факты с цитированием) и внешние сигналы (упоминания на авторитетных площадках).",
      },
    },
    {
      "@type": "Question",
      name: "Как попасть в ответы ChatGPT в 2026?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Нужны три типа сигналов: технические (schema.org JSON-LD, llms.txt, разрешения для GPTBot/Google-Extended в robots.txt), содержательные (экспертные статьи с фактами, FAQ-разметка, цитируемые источники), внешние (упоминания на Habr, VC.ru, в СМИ).",
      },
    },
    {
      "@type": "Question",
      name: "Сколько стоит MarketRadar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Бесплатный экспресс-отчёт в Telegram — 0 ₽. Экспресс на сайте по промокоду START — 1 ₽. Полный отчёт + 30 дней в платформе — 2 900 ₽ (вместо 4 900 ₽). Подписки от 4 900 ₽/мес со скидкой 50% на первый месяц.",
      },
    },
    {
      "@type": "Question",
      name: "Как быстро готов отчёт?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Экспресс-отчёт — 2 минуты. Полный отчёт — 3 минуты для базовой версии, до 5–10 минут с глубокой аналитикой ЦА и CJM.",
      },
    },
    {
      "@type": "Question",
      name: "Откуда берутся данные в отчёте?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Из 40+ официальных API и публичных источников: Keys.so, DaData, hh.ru, Яндекс.Карты, 2ГИС, Google Places, Руспрофайл, ChatGPT, Claude. Каждое утверждение помечается как ФАКТ (с источником), AI-ГИПОТЕЗА (требует проверки) или ОЦЕНКА (расчёт по среднему).",
      },
    },
    {
      "@type": "Question",
      name: "Что такое Battle Cards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Battle Cards — компактные карточки по каждому конкуренту: сильные стороны, слабые стороны, типовые возражения от их клиентов и готовые контр-аргументы для отдела продаж. Формат A4 на конкурента, готовый к печати.",
      },
    },
    {
      "@type": "Question",
      name: "Поддерживается ли работа с агентствами?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. Тариф AGENCY предусматривает до 30 пользователей и неограниченное количество анализируемых компаний. Дополнительно — партнёрская программа Интегратора с прогрессивной шкалой комиссии до 50%.",
      },
    },
    {
      "@type": "Question",
      name: "Что входит в партнёрскую программу?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Два уровня: Реферал (20% с каждой оплаты привлечённого клиента, клиент получает 10% скидку) и Интегратор (прогрессивная шкала: 1–5 клиентов — 25%, 6–15 — 30%, 16–30 — 40%, 31+ — 50%). Выплаты ежемесячно на карту или расчётный счёт.",
      },
    },
    {
      "@type": "Question",
      name: "Данные хранятся на серверах в России?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. Платформа работает на российском VPS в Москве. Все данные хранятся на территории РФ согласно ФЗ-152 о персональных данных. На тарифе Enterprise — on-premise развёртывание внутри инфраструктуры клиента.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
