/**
 * /legal/consent-marketing — Согласие на получение информационной и рекламной рассылки (необязательный чекбокс).
 */
import type { Metadata } from "next";
import { getVendorRequisites } from "@/lib/requisites";

export const metadata: Metadata = { title: "Согласие на рекламную рассылку · MarketRadar" };
export const dynamic = "force-static";
export const revalidate = 86400;

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "40px 20px 60px", color: "var(--foreground)", lineHeight: 1.65, fontSize: 14 };
const link: React.CSSProperties = { color: "var(--primary)" };

export default function ConsentMarketingPage() {
  const v = getVendorRequisites();
  const email = v.contact_email ?? "support@marketradar24.ru";
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px", textAlign: "center" }}>Согласие на получение информационной и рекламной рассылки</h1>
      <p>Я даю согласие оператору — {v.legal_name}, ИНН {v.inn} (далее — «Оператор») — на получение информационных, рекламных и маркетинговых
        сообщений о продуктах и услугах платформы MarketRadar по указанным мной контактам (электронная почта, телефон, мессенджеры).</p>
      <p style={{ marginTop: 14 }}>Согласие предоставляется добровольно и не является обязательным условием для регистрации и пользования платформой.
        Я могу отозвать его в любой момент, направив заявление на e-mail{" "}
        <a href={`mailto:${email}`} style={link}>{email}</a> или воспользовавшись ссылкой «отписаться» в самом сообщении.</p>
      <p style={{ marginTop: 14 }}>Рассылка осуществляется в соответствии с ФЗ «О рекламе» № 38-ФЗ и{" "}
        <a href="/legal/privacy" style={link}>Политикой обработки персональных данных</a>.</p>
      <p style={{ marginTop: 24 }}><a href="/" style={{ ...link, fontWeight: 600 }}>← Вернуться на сайт</a></p>
    </main>
  );
}
