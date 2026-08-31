import type { Metadata } from "next";
import { checkServiceSchema, checkFaqSchema } from "@/lib/check-schema";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Бесплатная диагностика сайта — почему нет заявок | MarketRadar",
  description:
    "Три проверки по вашему сайту за минуту: видимость в Яндексе, скорость на телефоне, читаемость для нейросетей. " +
    "Полный разбор с находками, конкурентами и планом работ — бесплатно, без звонка.",
  alternates: { canonical: `${SITE_URL}/new` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/new`,
    siteName: "MarketRadar",
    title: "Почему ваш сайт не приносит заявки?",
    description: "Бесплатная диагностика: видимость в поиске, скорость, читаемость для нейросетей.",
  },
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkFaqSchema) }} />
      {children}
    </>
  );
}
