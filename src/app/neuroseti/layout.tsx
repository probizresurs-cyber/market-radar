import type { Metadata } from "next";
import { checkServiceSchema, checkFaqSchema } from "@/lib/check-schema";

/**
 * Метаданные основной посадочной.
 *
 * В описании нет слов «SEO» и «GEO»: описание видит живой человек в выдаче,
 * а «GEO» большинство читает как «геолокация» и думает про карты. Термины
 * остались только на длинной версии, где их объясняют.
 */
const SITE_URL = "https://marketradar24.ru";
// Маршрут в файловой системе латиницей: Next 16 падает с InvalidCharacterError
// при пререндере сегмента с кириллицей. Кириллический адрес отдаётся
// перезаписью в next.config, он же канонический — его видит человек.
const PATH = "/нейросети";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Продвижение в нейросетях и поисковиках",
  description:
    "Клиент спрашивает «кого посоветуете» у Яндекса или у нейросети и получает два-три имени. " +
    "Бесплатный замер покажет, находят ли вас в поиске и называют ли нейросети; дальше " +
    "оптимизация и продвижение — от 25 000 ₽ в месяц.",
  alternates: { canonical: SITE_URL + PATH },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL + PATH,
    siteName: "MarketRadar",
    title: "Продвижение в нейросетях и поисковиках",
    description: "Бесплатно проверим, находят ли вас в поиске и называют ли нейросети.",
  },
};

export default function NeuroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkFaqSchema) }} />
      {children}
    </>
  );
}
