"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, FileText, Factory, Globe, LogOut } from "lucide-react";
import { PRODUCTS, type ProductScope } from "@/lib/products";

// Лаунчер продуктов экосистемы MarketRadar. Точка входа на платформу
// (/main, алиас /apps): единый экран выбора инструмента. Сессия общая —
// клик по продукту открывает его на том же аккаунте.

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Radar, FileText, Factory, Globe,
};

const DESC: Record<ProductScope, string> = {
  "core": "Анализ компании, конкурентов, ЦА, СММ, отзывы, AI-видимость, SWOT",
  "seo-geo": "Статьи под Яндекс/Google и нейропоиск, ключевые слова, семантика",
  "content-factory": "Посты, сторис, рилсы, карусели, контент-план и календарь",
  "land-pres": "Генерация лендингов и бренд-презентаций",
};

const ACCENT: Record<ProductScope, string> = {
  "core": "#22D3EE",
  "seo-geo": "#F5A623",
  "content-factory": "#EC4899",
  "land-pres": "#7C5CFC",
};

export default function AppsLauncher() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready">("checking");
  const [access, setAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (cancelled) return;
        if (j.ok && j.user) {
          setState("ready");
          // подтянем права на продукты (для бейджа «по подписке»)
          try {
            const pr = await fetch("/api/me/products", { credentials: "include" });
            const pj = await pr.json();
            if (!cancelled && pj.ok) setAccess(pj.access ?? {});
          } catch { /* ignore */ }
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) router.replace("/login"); // не авторизован — на вход
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (state === "checking") {
    return <div style={S.center}>Проверяем сессию…</div>;
  }

  return (
    <div style={S.page}>
      <div style={S.logo}>MARKETRADAR</div>
      <h1 style={S.title}>Выберите инструмент</h1>
      <p style={S.sub}>Все продукты работают на одном аккаунте — данные и профиль общие.</p>

      <div style={S.grid}>
        {PRODUCTS.map((p) => {
          const Icon = ICONS[p.icon] ?? Radar;
          const accent = ACCENT[p.id];
          const locked = access[p.id] === false;
          return (
            <button key={p.id} onClick={() => router.push(p.route)} style={S.card(accent)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div style={S.iconWrap(accent)}><Icon size={24} color={accent} /></div>
                {locked && <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", border: "1px solid #F5A62355", borderRadius: 20, padding: "3px 10px" }}>по подписке</span>}
              </div>
              <div style={S.cardTitle}>{p.label}</div>
              <div style={S.cardDesc}>{DESC[p.id]}</div>
              <div style={S.arrow(accent)}>{locked ? "Оформить →" : "Открыть →"}</div>
            </button>
          );
        })}
      </div>

      <div style={S.footer}>
        <a href="/admin" style={S.flink}>Админ-панель</a>
        <span style={{ color: "#2d3748" }}>·</span>
        <a href="/api/auth/logout" style={S.flink}><LogOut size={12} style={{ verticalAlign: "-2px" }} /> Выйти</a>
      </div>
    </div>
  );
}

const S = {
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E0E1A", color: "#9CA3B8", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 15 } as React.CSSProperties,
  page: { minHeight: "100vh", background: "#0E0E1A", color: "#E2E8F0", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" } as React.CSSProperties,
  logo: { fontSize: 13, fontWeight: 700, color: "#7C5CFC", letterSpacing: "0.18em", marginBottom: 14 } as React.CSSProperties,
  title: { fontSize: 34, fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px", textAlign: "center" } as React.CSSProperties,
  sub: { fontSize: 14, color: "#6B7088", margin: "0 0 44px", textAlign: "center" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, maxWidth: 880, width: "100%" } as React.CSSProperties,
  card: (a: string) => ({ background: "#17182B", border: `1px solid ${a}33`, borderRadius: 16, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", cursor: "pointer", color: "#E2E8F0", textAlign: "left", fontFamily: "inherit" }) as React.CSSProperties,
  iconWrap: (a: string) => ({ width: 48, height: 48, borderRadius: 12, background: `${a}1A`, display: "flex", alignItems: "center", justifyContent: "center" }) as React.CSSProperties,
  cardTitle: { fontSize: 19, fontWeight: 800, color: "#FFFFFF" } as React.CSSProperties,
  cardDesc: { fontSize: 13, color: "#9CA3B8", lineHeight: 1.5 } as React.CSSProperties,
  arrow: (a: string) => ({ marginTop: 6, fontSize: 12, fontWeight: 700, color: a, letterSpacing: "0.04em" }) as React.CSSProperties,
  footer: { marginTop: 48, display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#475569" } as React.CSSProperties,
  flink: { color: "#6B7088", textDecoration: "none" } as React.CSSProperties,
};
