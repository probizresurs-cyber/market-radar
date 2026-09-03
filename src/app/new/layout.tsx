import type { Metadata } from "next";
import { checkServiceSchema, checkFaqSchema } from "@/lib/check-schema";

const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Продвижение в нейросетях и поисковиках",
  description:
    "Клиент спрашивает «кого посоветуете» у Яндекса или у нейросети и получает два-три имени. " +
    "Бесплатный замер покажет, на каком уровне ваш сайт по SEO и GEO сейчас; дальше оптимизация " +
    "и продвижение — от 25 000 ₽ в месяц.",
  alternates: { canonical: `${SITE_URL}/new` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/new`,
    siteName: "MarketRadar",
    title: "Продвижение в нейросетях и поисковиках",
    description: "Замер уровня сайта по SEO и GEO — бесплатно. Дальше оптимизация и продвижение.",
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
