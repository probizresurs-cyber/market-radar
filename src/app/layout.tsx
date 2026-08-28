import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Playfair_Display, Montserrat, Nunito, Merriweather } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { DeploymentRefresher } from "@/components/DeploymentRefresher";
import { FetchPatcher } from "@/components/FetchPatcher";
import { CookieConsent } from "@/components/CookieConsent";

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
        {/* Structured data JSON-LD — read by Google AI Overviews, Яндекс.Нейро, ChatGPT Search.
            В корневом лейауте живёт ТОЛЬКО Organization: она верна на любой странице.
            Схемы продукта (SoftwareApplication, FAQ, Offer) переехали на /pricing и
            /express-report — там, где эти цены и тарифы действительно на экране.
            Пока они висели тут, робот на агентском лендинге /new читал про подписки
            от 4 900 ₽/мес, которых на странице нет: ровно та ошибка, о которой сама
            страница и предупреждает. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
        <FetchPatcher />
        {children}
        {/* Куки-баннер обязателен: Метрика выше грузится на всех страницах */}
        <CookieConsent />
      </body>
    </html>
  );
}
