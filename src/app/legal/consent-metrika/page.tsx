/**
 * /legal/consent-metrika — Согласие на обработку данных сервисом Яндекс.Метрика.
 */
import type { Metadata } from "next";
import { getVendorRequisites } from "@/lib/requisites";

export const metadata: Metadata = { title: "Согласие на использование Яндекс.Метрики · MarketRadar" };
export const dynamic = "force-static";
export const revalidate = 86400;

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "40px 20px 60px", color: "var(--foreground)", lineHeight: 1.65, fontSize: 14 };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "6px 0" };
const link: React.CSSProperties = { color: "var(--primary)" };

export default function ConsentMetrikaPage() {
  const v = getVendorRequisites();
  const email = v.contact_email ?? "hello@marketradar24.ru";
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px", textAlign: "center" }}>Согласие на обработку данных сервисом Яндекс.Метрика</h1>
      <p>Используя сайт <a href="https://company24.pro" style={link}>company24.pro</a> (платформа MarketRadar,
        Оператор — {v.legal_name}, ИНН {v.inn}), я даю согласие на обработку обезличенных данных о моём посещении сервисом
        веб-аналитики Яндекс.Метрика, предоставляемым ООО «Яндекс» (Россия, 119021, г. Москва, ул. Льва Толстого, д. 16).</p>

      <p style={{ marginTop: 14 }}><strong>Какие данные обрабатываются:</strong> обезличенные данные о посещении (cookie, IP-адрес в обезличенном
        виде, данные о браузере и устройстве, источник перехода, действия на страницах, в т.ч. с использованием технологии «Вебвизор»).</p>

      <p style={{ marginTop: 14 }}><strong>Цели:</strong> сбор статистики посещений и анализ поведения пользователей для улучшения работы Сайта.</p>

      <p style={{ marginTop: 14 }}>Обработка данных осуществляется в соответствии с{" "}
        <a href="https://yandex.ru/legal/confidential/" target="_blank" rel="noopener noreferrer" style={link}>Политикой конфиденциальности Яндекса</a>{" "}
        и условиями использования сервиса Яндекс.Метрика.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>Как отозвать согласие</h2>
      <ul style={ul}>
        <li>отключить cookie и сбор данных в настройках браузера либо установить{" "}
          <a href="https://yandex.ru/support/metrica/general/opt-out.html" target="_blank" rel="noopener noreferrer" style={link}>блокировщик Яндекс.Метрики</a>;</li>
        <li>направить обращение Оператору на e-mail <a href={`mailto:${email}`} style={link}>{email}</a>.</li>
      </ul>

      <p style={{ marginTop: 14 }}>Подробнее об использовании cookie — в <a href="/legal/cookie" style={link}>Политике обработки файлов cookie</a>.</p>

      <p style={{ marginTop: 24 }}><a href="/" style={{ ...link, fontWeight: 600 }}>← Вернуться на сайт</a></p>
    </main>
  );
}
