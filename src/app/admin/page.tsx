import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Zap, Phone, Radar, Target, LogOut, FileText, Factory, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

const S = {
  page: {
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  logo: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: "#f1f5f9",
    marginBottom: 8,
    textAlign: "center" as const,
  },
  sub: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 48,
    textAlign: "center" as const,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
    maxWidth: 680,
    width: "100%",
  },
  card: (accent: string) => ({
    background: "#1a1f2e",
    border: `1px solid ${accent}44`,
    borderRadius: 16,
    padding: "32px 28px",
    textDecoration: "none",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    transition: "border-color 0.2s, box-shadow 0.2s",
    cursor: "pointer",
    color: "#e2e8f0",
  }),
  cardIcon: (accent: string) => ({
    width: 48,
    height: 48,
    background: `${accent}22`,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: accent,
  }),
  cardTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  cardDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  },
  cardArrow: (accent: string) => ({
    marginTop: 8,
    fontSize: 12,
    fontWeight: 700,
    color: accent,
    letterSpacing: "0.04em",
  }),
  footer: {
    marginTop: 56,
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: 12,
    color: "#475569",
  },
  logoutBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "none",
    border: "1px solid #2d3748",
    color: "#64748b",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "none",
  } as React.CSSProperties,
};

export default async function AdminRoot() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div style={S.page}>
      <div style={S.logo}>Admin Portal</div>
      <h1 style={S.title}>Выберите платформу</h1>
      <p style={S.sub}>Управляйте пользователями, тарифами и аналитикой каждого продукта отдельно.</p>

      <div style={S.grid}>
        {/* MarketRadar */}
        <Link href="/admin/dashboard" style={S.card("#7c3aed")}>
          <div style={S.cardIcon("#7c3aed")}>
            <Zap size={22} />
          </div>
          <div style={S.cardTitle}>MarketRadar</div>
          <div style={S.cardDesc}>
            Маркетинговая платформа · пользователи, тарифы, платежи, лиды, партнёры, промокоды
          </div>
          <div style={S.cardArrow("#7c3aed")}>Открыть →</div>
        </Link>

        {/* Call-Agent */}
        <Link href="/admin/call-agent/users" style={S.card("#0ea5e9")}>
          <div style={S.cardIcon("#0ea5e9")}>
            <Phone size={22} />
          </div>
          <div style={S.cardTitle}>Call-Agent</div>
          <div style={S.cardDesc}>
            AI-анализ звонков · тенанты, звонки, тарифы, реф-ссылки, партнёры
          </div>
          <div style={S.cardArrow("#0ea5e9")}>Открыть →</div>
        </Link>

        {/* Парсер HH */}
        <Link href="/admin/parser" style={S.card("#22c55e")}>
          <div style={S.cardIcon("#22c55e")}>
            <Radar size={22} />
          </div>
          <div style={S.cardTitle}>Парсер</div>
          <div style={S.cardDesc}>
            Парсинг hh.ru · дашборд, запуск задач, расписания, таблицы лидов
          </div>
          <div style={S.cardArrow("#22c55e")}>Открыть →</div>
        </Link>

        {/* Лидген */}
        <Link href="/admin/leadgen" style={S.card("#f59e0b")}>
          <div style={S.cardIcon("#f59e0b")}>
            <Target size={22} />
          </div>
          <div style={S.cardTitle}>Лидген</div>
          <div style={S.cardDesc}>
            Лидогенерация · аккаунты, маршрутизация баз по аккаунтам, источники
          </div>
          <div style={S.cardArrow("#f59e0b")}>Открыть →</div>
        </Link>

        {/* Продукты экосистемы MarketRadar (раздельные подписки/тарифы/рефералы) */}
        <Link href="/admin/products/seo-geo" style={S.card("#22d3ee")}>
          <div style={S.cardIcon("#22d3ee")}><FileText size={22} /></div>
          <div style={S.cardTitle}>SEO + GEO</div>
          <div style={S.cardDesc}>Подписчики, тарифы, реф-ссылки и статистика продукта SEO+GEO</div>
          <div style={S.cardArrow("#22d3ee")}>Открыть →</div>
        </Link>

        <Link href="/admin/products/content-factory" style={S.card("#ec4899")}>
          <div style={S.cardIcon("#ec4899")}><Factory size={22} /></div>
          <div style={S.cardTitle}>Контент-завод</div>
          <div style={S.cardDesc}>Подписчики, тарифы, реф-ссылки и статистика контент-завода</div>
          <div style={S.cardArrow("#ec4899")}>Открыть →</div>
        </Link>

        <Link href="/admin/products/land-pres" style={S.card("#7c5cfc")}>
          <div style={S.cardIcon("#7c5cfc")}><Globe size={22} /></div>
          <div style={S.cardTitle}>Лендинги и презентации</div>
          <div style={S.cardDesc}>Подписчики, тарифы, реф-ссылки и статистика продукта</div>
          <div style={S.cardArrow("#7c5cfc")}>Открыть →</div>
        </Link>
      </div>

      <div style={S.footer}>
        <span>{user.email}</span>
        <span style={{ color: "#2d3748" }}>·</span>
        <Link href="/admin/logout" style={S.logoutBtn}>
          <LogOut size={12} /> Выйти
        </Link>
      </div>
    </div>
  );
}
