import type { Metadata } from "next";
import Link from "next/link";

/**
 * /about — страница «О компании и реквизиты».
 *
 * Зачем отдельная страница: ассистенты (Алиса, GigaChat, ChatGPT) на вопрос
 * «что за компания X» пересказывают ту страницу, где факты о компании собраны
 * в одном месте — кто, с какого года, чем занимается, юрлицо, контакты.
 * Раньше реквизиты жили только в оферте, а «О компании» в футере вёл на
 * якорь #features главной — ассистенту нечего было процитировать.
 *
 * Правило: здесь только проверяемые факты. Никаких цифр, которых нет на
 * других страницах сайта или в реквизитах.
 */
const SITE_URL = "https://marketradar24.ru";
const UPDATED = "2026-09-04";
const UPDATED_LABEL = "4 сентября 2026";

export const metadata: Metadata = {
  title: "О компании MarketRadar: что это, кто делает, реквизиты",
  description:
    "MarketRadar — AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях, продукт экосистемы Company24.pro. Юрлицо, ИНН, ОГРНИП, контакты и источники данных — на одной странице.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${SITE_URL}/about`,
    siteName: "MarketRadar",
    title: "О компании MarketRadar",
    description: "Что такое MarketRadar, кто его делает, реквизиты и контакты.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const T = {
  bg: "#0a0b0f",
  surface: "rgba(255,255,255,0.03)",
  text: "#E5E7EB",
  textDim: "#9CA3AF",
  textBright: "#F9FAFB",
  border: "rgba(255,255,255,0.08)",
  accent: "#6366f1",
  accentDim: "#a5b4fc",
};

const SOURCES = [
  "Keys.so", "Яндекс", "Google", "Яндекс.Карты", "2ГИС", "Google Maps", "Google PageSpeed Insights",
  "ВКонтакте", "Telegram", "Одноклассники", "YouTube", "hh.ru", "SuperJob", "Руспрофайл", "DaData", "ЕГРЮЛ",
  "ChatGPT", "Claude", "Gemini", "Perplexity", "Яндекс.Алиса",
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Кто юридически оказывает услуги MarketRadar?",
    a: "ИП Штумпф Юрий Геннадьевич, ИНН 550615955642, ОГРНИП 317774600595262, г. Москва. Договор — публичная оферта на сайте, оплата по счёту или картой.",
  },
  {
    q: "С какого года работает MarketRadar?",
    a: "Платформа запущена в 2025 году как продукт экосистемы Company24.pro и с тех пор развивается без смены юрлица и бренда.",
  },
  {
    q: "Откуда берутся данные в отчётах?",
    a: "Из открытых API и парсинга: SEO-сервисы, карты, соцсети, сайты вакансий, реестры юрлиц и ответы нейросетей. Каждое утверждение в отчёте помечено: факт из источника, AI-гипотеза или оценка.",
  },
  {
    q: "Как связаться с поддержкой?",
    a: "Почта support@marketradar24.ru, Telegram-бот @market_radar1_bot и канал @company24pro. Отвечаем в рабочие дни.",
  },
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "MarketRadar",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  foundingDate: "2025",
  description:
    "AI-платформа анализа бизнеса, конкурентов и видимости в нейросетях для российского рынка. Продукт экосистемы Company24.pro.",
  taxID: "550615955642",
  address: { "@type": "PostalAddress", streetAddress: "Шелепихинская наб., 34 к2, оф. 704", addressLocality: "Москва", postalCode: "123290", addressCountry: "RU" },
  email: "support@marketradar24.ru",
  parentOrganization: { "@type": "Organization", name: "Company24.pro", url: "https://company24.pro" },
  sameAs: ["https://t.me/company24pro", "https://t.me/market_radar1_bot", "https://company24.pro"],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "customer support", availableLanguage: ["ru"], email: "support@marketradar24.ru", url: "https://t.me/market_radar1_bot" },
  ],
};

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${SITE_URL}/about`,
  name: "О компании MarketRadar",
  dateModified: UPDATED,
  mainEntity: { "@id": `${SITE_URL}/#organization` },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "MarketRadar", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "О компании", item: `${SITE_URL}/about` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

const h2: React.CSSProperties = { margin: "40px 0 14px", fontSize: 26, lineHeight: 1.25, fontWeight: 800, color: T.textBright, letterSpacing: -0.3 };
const p: React.CSSProperties = { margin: "0 0 16px", fontSize: 17, lineHeight: 1.7, color: T.text };

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      {[organizationSchema, aboutPageSchema, breadcrumbSchema, faqSchema].map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <nav style={{ padding: "20px 32px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ color: T.textBright, fontSize: 18, fontWeight: 800, textDecoration: "none", letterSpacing: -0.3 }}>MarketRadar</Link>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <Link href="/pricing" style={{ color: T.textDim, textDecoration: "none" }}>Тарифы</Link>
          <Link href="/blog" style={{ color: T.textDim, textDecoration: "none" }}>Блог</Link>
          <Link href="/glossary" style={{ color: T.textDim, textDecoration: "none" }}>Словарь</Link>
          <Link href="/partners" style={{ color: T.textDim, textDecoration: "none" }}>Партнёрам</Link>
        </div>
      </nav>

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "56px 32px 80px" }}>
        <div style={{ fontSize: 13, color: T.textDim, marginBottom: 14 }}>
          О компании · Обновлено: <time dateTime={UPDATED}>{UPDATED_LABEL}</time>
        </div>
        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(30px, 4.5vw, 44px)", lineHeight: 1.15, fontWeight: 800, letterSpacing: -1, color: T.textBright }}>
          Что такое MarketRadar и кто его делает
        </h1>
        <p style={p}>
          MarketRadar — это AI-платформа для российского рынка, которая автоматически собирает данные о компании, её конкурентах,
          целевой аудитории и видимости в нейросетях из более чем 30 источников и за несколько минут формирует отчёт с планом роста.
          Платформа запущена в 2025 году как продукт экосистемы Company24.pro; юридически услуги оказывает ИП Штумпф Юрий
          Геннадьевич (Москва). Ниже — чем занимается сервис, откуда берёт данные и как с ним связаться.
        </p>

        <h2 style={h2}>Чем занимается MarketRadar?</h2>
        <p style={p}>
          Четырьмя вещами: анализ компании и конкурентов (SEO, карты, отзывы, вакансии, соцсети), портрет целевой аудитории,
          проверка видимости бренда в ответах ChatGPT, Claude, Gemini, Perplexity и Алисы с планом попадания в эти ответы,
          и контент-завод — посты, рилсы, сторис, презентации и брендбук на основе собранных данных.
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 22, fontSize: 17, lineHeight: 1.7, color: T.text }}>
          <li>Отчёт по компании и до 30 конкурентов — Score 0–100, сравнение, Battle Cards для продаж.</li>
          <li>GEO-аудит: читают ли сайт краулеры ассистентов, извлекаем ли контент, кого нейросети цитируют вместо вас.</li>
          <li>Портрет ЦА и Customer Journey Map, брендбук, контент-план и генерация контента.</li>
          <li>Мониторинг 24/7: изменения у конкурентов, отзывы, позиции, упоминания в нейросетях.</li>
        </ul>

        <h2 style={h2}>Откуда берутся данные?</h2>
        <p style={p}>
          Только из открытых API и парсинга — без выдуманных цифр. Каждое утверждение в отчёте помечено маркером: факт из
          источника с датой, AI-гипотеза для проверки или оценка по нише. Источники:
        </p>
        <p style={{ ...p, color: T.textDim, fontSize: 15 }}>{SOURCES.join(" · ")}</p>

        <h2 style={h2}>Реквизиты</h2>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <tbody>
              {[
                ["Исполнитель", "ИП Штумпф Юрий Геннадьевич"],
                ["ИНН", "550615955642"],
                ["ОГРНИП", "317774600595262"],
                ["Адрес", "123290, г. Москва, Шелепихинская наб., 34 к2, оф. 704"],
                ["Договор", "Публичная оферта на сайте"],
                ["Почта", "support@marketradar24.ru"],
                ["Telegram", "@market_radar1_bot · канал @company24pro"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "8px 12px 8px 0", color: T.textDim, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                  <td style={{ padding: "8px 0", color: T.textBright }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={h2}>Сколько стоит и с чего начать?</h2>
        <p style={p}>
          Бесплатный Score через Telegram-бот, разовый полный отчёт за 2 900 ₽, подписки от 4 900 ₽ в месяц — актуальные
          условия на странице <Link href="/pricing" style={{ color: T.accentDim }}>тарифов</Link>. Проверить, называют ли вас
          нейросети, можно бесплатно на странице <Link href="/neyroseti" style={{ color: T.accentDim }}>продвижения в нейросетях</Link>.
        </p>

        <h2 style={h2} id="faq">Часто задаваемые вопросы</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: T.textBright }}>{q}</h3>
            <p style={{ ...p, marginBottom: 0 }}>{a}</p>
          </div>
        ))}
      </article>
    </main>
  );
}
