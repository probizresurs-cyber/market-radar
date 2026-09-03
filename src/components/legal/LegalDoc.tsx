/**
 * Общая обвязка юридических страниц.
 *
 * Все пять документов (политика ПДн, политика cookie и три согласия) — это
 * присланные юристом тексты, перенесённые на сайт слово в слово. Меняются в
 * них только реквизиты и адрес сайта: документы писались для probizresurs.ru,
 * а действуют для marketradar24.ru.
 *
 * Компонент отвечает только за читаемость: колонка ограниченной ширины,
 * межстрочный интервал, единые заголовки и списки. Никакой логики и никаких
 * сокращений текста — юридический документ, в котором «сократили для
 * удобства», перестаёт быть документом.
 */
import type { ReactNode } from "react";

/** Реквизиты оператора — один источник для всех пяти документов. */
export const OPERATOR = {
  fullName: "Индивидуальный предприниматель Штумпф Юрий Геннадьевич",
  shortName: "ИП Штумпф Юрий Геннадьевич",
  inn: "550615955642",
  ogrn: "317774600595262",
  address: "123290, г. Москва, Шелепихинская наб., 34 к2, оф. 704",
  email: "hello@marketradar24.ru",
  site: "https://marketradar24.ru",
  siteShort: "marketradar24.ru",
} as const;

const wrap: React.CSSProperties = {
  maxWidth: 860, margin: "0 auto", padding: "44px 20px 72px",
  color: "var(--foreground)", lineHeight: 1.7, fontSize: 15,
};

export function LegalDoc({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main style={wrap}>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 10px" }}>{subtitle}</p>
      )}
      <h1 style={{ fontSize: 25, fontWeight: 800, lineHeight: 1.25, margin: "0 0 26px" }}>{title}</h1>
      {children}
      <p style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
        <a href="/" style={{ color: "var(--primary)", fontWeight: 600 }}>← Вернуться на сайт</a>
      </p>
    </main>
  );
}

/** Блок реквизитов оператора — печатается в шапке согласий и в конце политик. */
export function OperatorBlock({ heading = "Оператор" }: { heading?: string }) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px",
      margin: "0 0 26px", fontSize: 14.5, lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{heading}</div>
      {OPERATOR.shortName}<br />
      {OPERATOR.address}<br />
      ОГРНИП {OPERATOR.ogrn}, ИНН {OPERATOR.inn}<br />
      E-mail: <a href={`mailto:${OPERATOR.email}`} style={{ color: "var(--primary)" }}>{OPERATOR.email}</a>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 800, margin: "30px 0 12px", lineHeight: 1.3 }}>{children}</h2>;
}

export function P({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <p style={{ margin: "0 0 12px", ...style }}>{children}</p>;
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
      {items.map((it, i) => <li key={i} style={{ margin: "0 0 6px" }}>{it}</li>)}
    </ul>
  );
}

/** Определение из раздела «Перечень терминов и сокращений». */
export function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 190px) minmax(0, 1fr)", gap: "0 18px", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div>{children}</div>
    </div>
  );
}

export const legalLink: React.CSSProperties = { color: "var(--primary)" };
