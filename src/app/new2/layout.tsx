import type { Metadata } from "next";

/**
 * Метаданные /new2 — полной версии страницы диагностики.
 *
 * noindex стоит намеренно. Содержание /new2 включает в себя всё, что есть на
 * коротком /new, плюс маркетинговые разделы: для поисковика это дубль, и две
 * страницы начали бы конкурировать друг с другом за одни и те же запросы.
 * Индексируется короткая — она же адрес объявлений. Длинная остаётся живой
 * для ручных отправок и ссылок из переписки, поэтому follow, а не nofollow:
 * ссылки с неё должны работать.
 */
const SITE_URL = "https://marketradar24.ru";

export const metadata: Metadata = {
  title: "Диагностика сайта — подробно",
  description:
    "Развёрнутая версия страницы диагностики: где теряются заявки, чем поиск отличается от ответа нейросети, " +
    "что мы делаем и что получает клиент.",
  alternates: { canonical: `${SITE_URL}/new2` },
  robots: { index: false, follow: true },
};

export default function New2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
