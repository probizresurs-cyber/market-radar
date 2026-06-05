"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, ExternalLink, ArrowLeft } from "lucide-react";

const CA_TABS = [
  { href: "/admin/call-agent/users",    label: "Пользователи" },
  { href: "/admin/call-agent/tenants",  label: "Тенанты" },
  { href: "/admin/call-agent/pricing",  label: "Тарифы" },
  { href: "/admin/call-agent/payments", label: "Платежи" },
  { href: "/admin/call-agent/promos",   label: "Промокоды" },
  { href: "/admin/call-agent/referrals",label: "Рефералки" },
  { href: "/admin/call-agent/partners", label: "Партнёры" },
  { href: "/admin/call-agent/visits",   label: "Посещаемость" },
];

const ACCENT = "#0ea5e9";

const S = {
  wrapper: {
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,
  header: {
    background: "#1a1f2e",
    borderBottom: "1px solid #2d3748",
    padding: "0 32px",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  } as React.CSSProperties,
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    color: "#64748b",
    textDecoration: "none",
    fontWeight: 600,
    padding: "4px 0",
    transition: "color 0.15s",
  } as React.CSSProperties,
  divider: {
    width: 1,
    height: 20,
    background: "#2d3748",
  } as React.CSSProperties,
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 18,
    fontWeight: 800,
    color: ACCENT,
  } as React.CSSProperties,
  openBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    background: `${ACCENT}18`,
    border: `1px solid ${ACCENT}55`,
    borderRadius: 8,
    color: ACCENT,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 700,
  } as React.CSSProperties,
  nav: {
    display: "flex",
    gap: 4,
    background: "#1a1f2e",
    padding: "8px 32px 0",
    borderBottom: "1px solid #2d3748",
    overflowX: "auto" as const,
  } as React.CSSProperties,
  navLink: (active: boolean) => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: active ? ACCENT : "#64748b",
    textDecoration: "none",
    borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
    transition: "all 0.2s",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  }),
};

export default function CallAgentAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine active tab: exact match or prefix match for nested routes
  const activeHref = CA_TABS.find(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/")
  )?.href ?? "";

  return (
    <div style={S.wrapper}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <Link href="/admin" style={S.backLink}>
            <ArrowLeft size={13} /> MarketRadar Admin
          </Link>
          <div style={S.divider} />
          <div style={S.logo}>
            <Phone size={18} /> Call-Agent Admin
          </div>
        </div>
        <a
          href="/call-agent/dashboard"
          target="_blank"
          rel="noreferrer"
          style={S.openBtn}
        >
          Открыть Call-Agent <ExternalLink size={12} />
        </a>
      </header>

      <nav style={S.nav}>
        {CA_TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={S.navLink(activeHref === t.href)}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
