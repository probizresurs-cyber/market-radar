/**
 * /legal/consent-pd — Согласие на обработку персональных данных (чекбокс при регистрации).
 */
import type { Metadata } from "next";
import { getVendorRequisites } from "@/lib/requisites";

export const metadata: Metadata = { title: "Согласие на обработку персональных данных · MarketRadar" };
export const dynamic = "force-static";
export const revalidate = 86400;

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "40px 20px 60px", color: "var(--foreground)", lineHeight: 1.65, fontSize: 14 };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "6px 0" };
const link: React.CSSProperties = { color: "var(--primary)" };

export default function ConsentPdPage() {
  const v = getVendorRequisites();
  const email = v.contact_email ?? "hello@marketradar24.ru";
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px", textAlign: "center" }}>Согласие на обработку персональных данных</h1>
      <p>Я, регистрируясь и пользуясь платформой MarketRadar на сайте <a href="https://company24.pro" style={link}>company24.pro</a>,
        свободно, своей волей и в своём интересе даю согласие оператору — {v.legal_name}, ИНН {v.inn}, адрес: {v.legal_address}
        (далее — «Оператор») — на обработку моих персональных данных на следующих условиях.</p>

      <p style={{ marginTop: 14 }}><strong>Перечень персональных данных:</strong> имя; адрес электронной почты; сведения о компании и нише;
        реквизиты (для ИП и юрлиц); идентификатор Telegram; иные данные, указанные мной в личном кабинете.</p>

      <p style={{ marginTop: 14 }}><strong>Цели обработки:</strong> регистрация и ведение учётной записи, предоставление доступа к функционалу
        платформы, оказание услуг согласно выбранному тарифу, выставление счетов и формирование закрывающих документов, техническая поддержка.</p>

      <p style={{ marginTop: 14 }}><strong>Перечень действий и способы обработки:</strong> сбор, запись, систематизация, накопление, хранение,
        уточнение, использование, передача (предоставление лицам, действующим по поручению Оператора), блокирование, удаление, уничтожение —
        с использованием средств автоматизации и без таковых.</p>

      <p style={{ marginTop: 14 }}><strong>Срок действия согласия:</strong> согласие действует до достижения целей обработки либо до его отзыва.
        Согласие может быть отозвано в любой момент путём направления заявления Оператору на e-mail{" "}
        <a href={`mailto:${email}`} style={link}>{email}</a>.</p>

      <p style={{ marginTop: 14 }}>Обработка осуществляется в соответствии с Федеральным законом № 152-ФЗ и{" "}
        <a href="/legal/privacy" style={link}>Политикой обработки персональных данных</a>.</p>

      <ul style={ul}><li>Подтверждаю, что ознакомлен(а) с указанной Политикой и права субъекта ПД мне понятны.</li></ul>

      <p style={{ marginTop: 24 }}><a href="/" style={{ ...link, fontWeight: 600 }}>← Вернуться на сайт</a></p>
    </main>
  );
}
