import type { Metadata } from "next";
import { checkServiceSchema, checkFaqSchema } from "@/lib/check-schema";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Почему сайт не приносит заявки — бесплатная диагностика",
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

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkFaqSchema) }} />
      {children}
    </>
  );
}
