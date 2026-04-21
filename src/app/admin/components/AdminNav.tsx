import Link from "next/link";

const S = {
  nav: {
    display: "flex",
    gap: 4,
    background: "#1a1f2e",
    padding: "8px 32px 0",
    borderBottom: "1px solid #2d3748",
  } as React.CSSProperties,
  link: (active?: boolean) => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: active ? "#7c3aed" : "#64748b",
    textDecoration: "none",
    borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
    transition: "all 0.2s",
  } as React.CSSProperties),
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

export default function AdminNav({ current }: { current: string }) {
  return (
    <nav style={S.nav}>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} style={S.link(current === t.href)}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
