import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Playfair_Display, Montserrat, Nunito, Merriweather } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { DeploymentRefresher } from "@/components/DeploymentRefresher";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Presentation fonts — preloaded so slides render with real typography
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const SITE_URL = "https://marketradar24.ru";
const SITE_TITLE = "MarketRadar — радар вашего бизнеса, рынка и конкурентов";
const SITE_DESCRIPTION =
  "AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях. " +
  "Собираем данные из 30+ источников (Keys.so, Руспрофайл, Яндекс.Карты, 2ГИС, hh.ru, ChatGPT, Алиса) " +
  "и формируем отчёт с планом роста за 3 минуты.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · MarketRadar",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "анализ бизнеса",
    "анализ конкурентов",
    "AI-анализ",
    "анализ целевой аудитории",
    "SEO-аудит",
    "продвижение в нейросетях",
    "GEO-оптимизация",
    "как попасть в ChatGPT",
    "видимость в Claude",
    "видимость в Gemini",
    "продвижение в Perplexity",
    "Яндекс Алиса",
    "Яндекс Нейро",
    "Generative Engine Optimization",
    "MarketRadar",
    "battle cards",
    "customer journey map",
    "брендбук",
    "контент-план",
    "мониторинг конкурентов",
  ],
  authors: [{ name: "MarketRadar", url: SITE_URL }],
  creator: "Company24.pro",
  publisher: "MarketRadar",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: "MarketRadar",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "MarketRadar — AI-анализ бизнеса и конкурентов",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

// Structured data — read by Google AI Overviews, Яндекс.Нейро, ChatGPT Search
const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MarketRadar",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MarketRadar",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description:
    "AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях. Продукт экосистемы Company24.pro",
  foundingDate: "2025",
  areaServed: {
    "@type": "Country",
    name: "Россия",
  },
  knowsLanguage: "ru",
  parentOrganization: {
    "@type": "Organization",
    name: "Company24.pro",
    url: "https://company24.pro",
  },
  sameAs: [
    "https://t.me/company24pro",
    "https://t.me/market_radar1_bot",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["ru"],
      url: "https://t.me/market_radar1_bot",
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      availableLanguage: ["ru"],
      email: "support@marketradar24.ru",
    },
  ],
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

const softwareOfferSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MarketRadar — экспресс-отчёт",
  url: `${SITE_URL}/express-report`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Бесплатный экспресс-аудит сайта: общий Score, 5 категорий оценки (SEO, скорость, UX, доверие, контент), ключевые инсайты и сравнение с конкурентами за 2 минуты.",
  offers: [
    {
      "@type": "Offer",
      name: "Бесплатный экспресс в Telegram",
      price: "0",
      priceCurrency: "RUB",
      description: "Экспресс-отчёт через Telegram-бот @market_radar1_bot",
      url: "https://t.me/market_radar1_bot",
    },
    {
      "@type": "Offer",
      name: "Экспресс-отчёт на сайте",
      price: "1",
      priceCurrency: "RUB",
      description: "Экспресс-отчёт с сохранением на email и PDF, по промокоду START",
      url: `${SITE_URL}/express-report`,
    },
    {
      "@type": "Offer",
      name: "Полный отчёт + 30 дней в платформе",
      price: "2900",
      priceCurrency: "RUB",
      description: "Полный анализ: ЦА, CJM, брендбук, Battle Cards, мониторинг 24/7. Доступ на 30 дней.",
      url: `${SITE_URL}/pricing`,
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1B2E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${geistMono.variable} ${playfair.variable} ${montserrat.variable} ${nunito.variable} ${merriweather.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Yandex.Metrika counter — id 108999924 */}
        <Script id="yandex-metrika" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=108999924', 'ym');
          ym(108999924, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
        `}</Script>
        {/* Apply saved theme before paint to avoid FOUC */}
        <Script id="mr-theme-init" strategy="beforeInteractive">{`
          try {
            var t = localStorage.getItem('mr_theme');
            if (t === 'dark' || t === 'warm' || t === 'light') {
              document.documentElement.classList.remove('dark','warm');
              if (t !== 'light') document.documentElement.classList.add(t);
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              document.documentElement.classList.add('dark');
            }
          } catch(e) {}
        `}</Script>
        {/* Structured data JSON-LD — read by Google AI Overviews, Яндекс.Нейро, ChatGPT Search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareOfferSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Yandex.Metrika noscript fallback */}
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/108999924"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <DeploymentRefresher />
        {children}
      </body>
    </html>
  );
}
