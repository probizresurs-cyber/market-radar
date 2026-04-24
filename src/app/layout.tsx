import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Playfair_Display, Montserrat, Nunito, Merriweather } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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
  description:
    "AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях. Продукт экосистемы Company24.pro",
  sameAs: [
    "https://t.me/company24pro",
    "https://t.me/market_radar1_bot",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["ru"],
    url: "https://t.me/market_radar1_bot",
  },
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
        {/* Structured data — SoftwareApplication + Organization (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
