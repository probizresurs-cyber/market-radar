import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "MarketRadar — ИИ-анализ конкурентов",
  description: "SaaS-платформа для конкурентного анализа, контент-маркетинга и бренд-стратегии.",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
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
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
