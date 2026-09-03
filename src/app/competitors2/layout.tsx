import type { Metadata } from "next";

/**
 * Метаданные /competitors — по тому же разбору, что и у /geo: страница
 * клиентская, своих metadata у неё нет, и без этого файла она наследует
 * title, description и canonical главной. Для поисковика — дубль главной,
 * в выдаче и при шаринге — «MarketRadar — радар вашего бизнеса». На
 * посадочную платного кластера так нельзя.
 */
const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  // Бренд дописывает шаблон корневого layout («%s · MarketRadar»),
  // поэтому в заголовке страницы его нет — иначе печатался бы дважды.
  title: "Анализ конкурентов: кто выше вас в поиске и почему",
  description:
    "Показываем поимённо, какие сайты забирают ваш спрос: по каким запросам они выше, " +
    "чего у них есть на страницах такого, чего нет у вас, и кого называют нейросети. " +
    "Бесплатно, без звонка. И честно — чего про конкурента узнать нельзя.",
  alternates: { canonical: `${SITE_URL}/competitors2` },
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
    url: `${SITE_URL}/competitors2`,
    siteName: "MarketRadar",
    title: "Кто забирает ваших клиентов",
    description: "Анализ конкурентов: кто стоит выше вас, по каким запросам и за счёт чего.",
  },
};

export default function Competitors2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
