import type { Metadata } from "next";

/**
 * Метаданные /competitors — короткой посадочной под рекламу.
 *
 * Страница клиентская, своих metadata у неё нет, и без этого файла она
 * наследует title, description и canonical главной: для поисковика — дубль
 * главной, в выдаче и при шаринге — «MarketRadar — радар вашего бизнеса».
 * На посадочную платного кластера так нельзя. Длинная версия (/competitors2)
 * закрыта от индексации, канонический адрес кластера — этот.
 */
const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Анализ конкурентов: кто выше вас в поиске и почему",
  description: "Показываем поимённо, какие сайты забирают ваш спрос: по каким запросам они выше и за счёт чего. Бесплатно, без звонка.",
  alternates: { canonical: `${SITE_URL}/competitors` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/competitors`,
    siteName: "MarketRadar",
    title: "Кто забирает ваших клиентов",
    description: "Анализ конкурентов: кто стоит выше вас, по каким запросам и за счёт чего.",
  },
};

export default function CompetitorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
