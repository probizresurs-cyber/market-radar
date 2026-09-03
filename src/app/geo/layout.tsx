import type { Metadata } from "next";

/**
 * Метаданные /geo — короткой посадочной под рекламу.
 *
 * Страница клиентская, своих metadata у неё нет, и без этого файла она
 * наследует title, description и canonical главной: для поисковика — дубль
 * главной, в выдаче и при шаринге — «MarketRadar — радар вашего бизнеса».
 * На посадочную платного кластера так нельзя. Длинная версия (/geo2)
 * закрыта от индексации, канонический адрес кластера — этот.
 */
const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Продвижение в нейросетях: как попасть в ответы ChatGPT, Алисы и Google",
  description: "Клиент спрашивает совета у нейросети и получает два-три имени. Бесплатно проверим, читают ли ваш сайт ассистенты и что мешает им вас назвать.",
  alternates: { canonical: `${SITE_URL}/geo` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/geo`,
    siteName: "MarketRadar",
    title: "Почему нейросети советуют не вас",
    description: "GEO-продвижение: попадание в ответы ChatGPT, Алисы, Google AI и Perplexity.",
  },
};

export default function GeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
