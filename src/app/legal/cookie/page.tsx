/**
 * /legal/cookie — Политика обработки файлов cookie платформы MarketRadar.
 */
import type { Metadata } from "next";
import { getVendorRequisites } from "@/lib/requisites";

export const metadata: Metadata = { title: "Политика обработки файлов cookie · MarketRadar" };
export const dynamic = "force-static";
export const revalidate = 86400;

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "40px 20px 60px", color: "var(--foreground)", lineHeight: 1.65, fontSize: 14 };
const H2: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8, color: "var(--foreground)" };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "6px 0" };
const link: React.CSSProperties = { color: "var(--primary)" };

export default function CookiePolicyPage() {
  const v = getVendorRequisites();
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px", textAlign: "center" }}>Политика обработки файлов cookie</h1>
      <p>Настоящая Политика описывает, как сайт <a href="https://company24.pro" style={link}>company24.pro</a> (платформа MarketRadar,
        Оператор — {v.legal_name}, ИНН {v.inn}) использует файлы cookie и аналогичные технологии.</p>

      <h2 style={H2}>Что такое cookie</h2>
      <p>Cookie — небольшие текстовые файлы, которые сохраняются в браузере при посещении сайта и позволяют распознавать устройство пользователя.</p>

      <h2 style={H2}>Какие cookie мы используем</h2>
      <ul style={ul}>
        <li><strong>Технические</strong> — необходимы для корректной работы сайта и личного кабинета (авторизация, сохранение сессии, настроек и темы оформления).</li>
        <li><strong>Аналитические</strong> — сбор обезличенной статистики посещений с помощью сервиса Яндекс.Метрика (ООО «Яндекс»),
          чтобы улучшать сайт. Метрика может использовать cookie и собирать данные о посещениях в обезличенном виде.</li>
      </ul>

      <h2 style={H2}>Управление cookie</h2>
      <p>Пользователь может в любой момент отключить или удалить cookie в настройках своего браузера. При отключении части cookie
        отдельные функции сайта (включая авторизацию в личном кабинете) могут работать некорректно.</p>

      <h2 style={H2}>Согласие</h2>
      <p>Продолжая пользоваться сайтом, пользователь соглашается на обработку cookie в соответствии с настоящей Политикой и{" "}
        <a href="/legal/privacy" style={link}>Политикой обработки персональных данных</a>.</p>

      <p style={{ marginTop: 24 }}><a href="/" style={{ ...link, fontWeight: 600 }}>← Вернуться на сайт</a></p>
    </main>
  );
}
