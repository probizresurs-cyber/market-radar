import type { Metadata } from "next";

/**
 * Метаданные /geo.
 *
 * Страница клиентская ("use client"), поэтому своих metadata у неё не было
 * вовсе: она наследовала title, description и — что хуже — canonical главной.
 * Для поисковика это делало её дублем главной, а в выдаче и при шаринге
 * ссылка выглядела как «MarketRadar — радар вашего бизнеса». На посадочную
 * платного кластера так нельзя.
 */
const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»).
  title: "Продвижение в нейросетях: как попасть в ответы ChatGPT, Алисы и Google",
  description:
    "Клиент спрашивает совета у нейросети и получает два-три имени. Разбираем, почему вашего нет в ответе, " +
    "и что с этим делать: техника сайта, контент под извлечение ответа, внешние упоминания, репутация.",
  alternates: { canonical: `${SITE_URL}/geo2` },
  /**
   * noindex намеренно: короткая версия по основному адресу и эта длинная
   * рассказывают об одном и том же, и для поисковика это дубль. Индексируется
   * короткая — она же адрес объявлений; длинная живёт для ручных отправок,
   * поэтому follow: ссылки с неё должны работать.
   */
  robots: { index: false, follow: true },

  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/geo2`,
    siteName: "MarketRadar",
    title: "Почему нейросети советуют не вас",
    description: "GEO-продвижение: попадание в ответы ChatGPT, Алисы, Google AI и Perplexity.",
  },
};

export default function Geo2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
