"use client";

/**
 * /express-report (T-14) — public express report page.
 *
 * Flow:
 *   1. Landing form submits URL → (future) /api/generate-express with URL
 *      → redirects here with ?id=<reportId>
 *   2. While the report is generating, we poll localStorage
 *      (key: `mr_express_<id>`) and animate the 5-stage progress bar.
 *   3. Once the report is ready — render Score, 5 categories, insights,
 *      competitor stats, findings, and the upgrade CTA to the full report
 *      (4900 → 2900 promo).
 *
 * For this first pass the backend endpoint is not wired; the page runs with
 * mocked data after a simulated 6s delay so stakeholders can review the UI.
 * The shape matches what /api/generate-express will later return.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, Check, Sparkles, ShieldCheck, Target, Users,
  Map, Palette, Swords, Radio, FileText, Gauge, Eye,
  Search, Star, MessagesSquare, TrendingUp, AlertTriangle,
} from "lucide-react";

// ── Types — mirror future /api/generate-express payload ──────────────────────
type CategoryKey = "seo" | "speed" | "ux" | "trust" | "content";

interface ExpressCategory { key: CategoryKey; name: string; score: number; hint: string; }
interface ExpressInsight { severity: "high" | "medium" | "low"; title: string; body: string; }
interface ExpressCompetitor { totalFound: number; avgMonthlyTraffic: number; missedKeys: number; }
interface ExpressFinding { label: string; value: string; }
interface ExpressReport {
  id: string;
  url: string;
  score: number;
  categories: ExpressCategory[];
  insights: ExpressInsight[];
  competitors: ExpressCompetitor;
  findings: ExpressFinding[];
  generatedAt: string;
}

// ── Generation stages, copy matches TZ T-14 ──────────────────────────────────
const STAGES = [
  "Анализирую SEO…",
  "Проверяю ChatGPT-видимость…",
  "Ищу конкурентов…",
  "Собираю отзывы…",
  "Проверяю видимость в нейросетях…",
] as const;

// ── Mock used until /api/generate-express lands ──────────────────────────────
function makeMockReport(id: string, url: string): ExpressReport {
  return {
    id, url,
    score: 39,
    categories: [
      { key: "seo", name: "SEO", score: 22, hint: "потеряно ≈180 ключей" },
      { key: "speed", name: "Скорость", score: 33, hint: "LCP 4.2s, CLS 0.18" },
      { key: "ux", name: "UX", score: 52, hint: "мобильные сценарии ок, desktop CTA слабый" },
      { key: "trust", name: "Доверие", score: 62, hint: "отзывы есть, но без ответов" },
      { key: "content", name: "Контент", score: 48, hint: "блог не обновлялся 4 мес" },
    ],
    insights: [
      { severity: "high", title: "Отсутствует структурированная разметка FAQ",
        body: "Без Schema.org FAQPage нейросети не видят ваши ответы. На 80% нишевых запросов выигрывают конкуренты, у которых разметка есть." },
      { severity: "high", title: "Нет упоминаний в ChatGPT/Perplexity по ключевым запросам",
        body: "При проверке 12 релевантных запросов ваш бренд появился 1 раз. Конкуренты — от 4 до 9 раз." },
      { severity: "medium", title: "Скорость загрузки на мобильных — 33/100",
        body: "LCP 4.2s при пороге Google 2.5s. Тяжёлые шрифты и большие изображения без lazy-load." },
      { severity: "medium", title: "14 упущенных высокочастотных ключей",
        body: "У 3 ближайших конкурентов они в ТОП-10. У вас — вне ТОП-100 или нет страниц вовсе." },
    ],
    competitors: { totalFound: 7, avgMonthlyTraffic: 280, missedKeys: 180 },
    findings: [
      { label: "Возраст домена", value: "4 года 7 мес" },
      { label: "Индексация Google", value: "218 страниц" },
      { label: "Активных соцсетей", value: "2 из 5" },
      { label: "Рейтинг Я.Карты", value: "4.3 · 28 отзывов" },
      { label: "Рейтинг 2GIS", value: "4.1 · 19 отзывов" },
      { label: "Последний пост в блоге", value: "128 дней назад" },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════

function ExpressReportInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "demo";
  const urlFromQuery = params.get("url") ?? "";

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mr_theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* ignore */ }
  }, []);

  const [analysisUrl, setAnalysisUrl] = useState(urlFromQuery);
  const [urlSubmitted, setUrlSubmitted] = useState(!!urlFromQuery);
  const [urlInput, setUrlInput] = useState(urlFromQuery);

  const [stage, setStage] = useState<number>(0); // 0..STAGES.length means "done"
  const [report, setReport] = useState<ExpressReport | null>(null);

  // Try to pick up a real report persisted by the landing form; fall back to mock.
  useEffect(() => {
    if (!urlSubmitted) return;
    if (typeof window === "undefined") return;
    let cancelled = false;

    const stored = (() => {
      try {
        const raw = localStorage.getItem(`mr_express_${id}`);
        return raw ? (JSON.parse(raw) as ExpressReport) : null;
      } catch { return null; }
    })();

    // Simulate the 5 generation stages (≈1.1s each) regardless of whether
    // the report is already in storage — it looks deliberate and reinforces
    // the "AI is working" narrative.
    const startedAt = Date.now();
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const nextStage = Math.min(STAGES.length, Math.floor(elapsed / 1100));
      setStage(nextStage);
      if (nextStage < STAGES.length) {
        setTimeout(tick, 220);
      } else {
        setReport(stored ?? makeMockReport(id, analysisUrl));
      }
    };
    tick();

    return () => { cancelled = true; };
  }, [id, urlSubmitted, analysisUrl]);

  const isDark = theme === "dark";
  const bg = isDark ? "#0a0b0f" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#0f172a";
  const muted = "#64748b";
  const card = isDark ? "#111318" : "#f8fafc";
  const border = isDark ? "#1e2433" : "#e2e8f0";
  const accent = "#6366f1";
  const neonCyan = "#4FC3F7";
  const neonMagenta = "#D500F9";
  const neonGreen = "#69FF47";

  const isLoading = report === null;

  // ───────────────────────────────────────────────────────────── helpers
  const scoreColor = (v: number) => (v >= 70 ? neonGreen : v >= 45 ? neonCyan : "#ff6b6b");

  const upgradePrice = 2900;
  const originalPrice = 4900;
  const discountPct = Math.round((1 - upgradePrice / originalPrice) * 100);

  const categoryIcons: Record<CategoryKey, typeof Search> = useMemo(() => ({
    seo: Search, speed: Gauge, ux: Eye, trust: ShieldCheck, content: FileText,
  }), []);

  return (
    <div style={{
      minHeight: "100vh", background: bg, color: fg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paddingBottom: 60,
    }}>
      {/* ─── NAV ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 20,
        background: isDark ? "rgba(10,11,15,0.85)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${border}`,
      }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 32px",
        }}>
          <Link href="/" style={{
            fontSize: 18, fontWeight: 700, textDecoration: "none", color: fg,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Radio size={20} color={neonCyan} />
            MarketRadar
          </Link>
          <div style={{ fontSize: 13, color: muted, fontFamily: "monospace" }}>
            отчёт #{id.slice(0, 8)}
          </div>
        </div>
      </nav>

      {!urlSubmitted ? (
        <section style={{ maxWidth: 680, margin: "80px auto", padding: "0 32px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
            Экспресс-анализ сайта
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 10px", lineHeight: 1.2 }}>
            Введите URL вашего сайта
          </h1>
          <p style={{ fontSize: 15, color: muted, margin: "0 0 32px", lineHeight: 1.6 }}>
            AI проанализирует SEO, скорость, конкурентов и видимость в нейросетях за 60 секунд
          </p>
          <div style={{ display: "flex", gap: 8, background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "8px 8px 8px 18px", boxShadow: `0 2px 20px ${accent}15`, alignItems: "center", marginBottom: 16 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) { setAnalysisUrl(urlInput.trim()); setUrlSubmitted(true); } }}
              placeholder="example.ru"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, color: fg, outline: "none", fontFamily: "inherit", padding: "8px 0" }}
              autoFocus
            />
            <button
              onClick={() => { if (urlInput.trim()) { setAnalysisUrl(urlInput.trim()); setUrlSubmitted(true); } }}
              disabled={!urlInput.trim()}
              style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 15, fontFamily: "inherit", cursor: urlInput.trim() ? "pointer" : "not-allowed", opacity: urlInput.trim() ? 1 : 0.6 }}
            >
              Анализировать →
            </button>
          </div>
        </section>
      ) : (
        <>
      {/* ─── HERO: URL + progress bar ────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 24px" }}>
        <div style={{ fontSize: 13, color: muted, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
          Экспресс-отчёт · AI-анализ
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.15 }}>
          {report?.url ?? analysisUrl}
        </h1>
        <div style={{ fontSize: 14, color: muted }}>
          {isLoading ? "Генерируем отчёт — обычно 30-60 секунд" :
            `Отчёт готов · ${new Date(report.generatedAt).toLocaleString("ru-RU")}`}
        </div>

        {/* Progress — visible until stage === STAGES.length */}
        {isLoading && (
          <div style={{ marginTop: 26, padding: 20, background: card, border: `1px solid ${border}`, borderRadius: 14 }}>
            <div style={{
              height: 6, borderRadius: 3, background: isDark ? "#1a1f2e" : "#e2e8f0", overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${(stage / STAGES.length) * 100}%`,
                background: `linear-gradient(90deg, ${neonCyan}, ${neonMagenta})`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {STAGES.map((label, i) => {
                const done = i < stage;
                const active = i === stage;
                return (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    fontSize: 13,
                    color: done ? neonGreen : active ? fg : muted,
                    opacity: i > stage ? 0.5 : 1,
                  }}>
                    {done
                      ? <Check size={16} color={neonGreen} />
                      : <div style={{
                          width: 14, height: 14, borderRadius: "50%",
                          border: `2px solid ${active ? neonCyan : muted}`,
                          borderTopColor: active ? "transparent" : muted,
                          animation: active ? "mr-spin 0.9s linear infinite" : "none",
                        }} />
                    }
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── REPORT CONTENT ──────────────────────────────────────────── */}
      {report && (
        <>
          {/* Score + categories row */}
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 32px 30px" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "stretch",
            }}>
              {/* Score card */}
              <div style={{
                background: card, border: `1px solid ${border}`, borderRadius: 16,
                padding: 24, display: "flex", flexDirection: "column", justifyContent: "center",
              }}>
                <div style={{ fontSize: 12, color: muted, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
                  Score
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 72, fontWeight: 800, color: scoreColor(report.score), lineHeight: 1 }}>
                    {report.score}
                  </span>
                  <span style={{ fontSize: 20, color: muted }}>/ 100</span>
                </div>
                <div style={{ fontSize: 13, color: muted, marginTop: 10, lineHeight: 1.5 }}>
                  Оценка бизнеса по 5 ключевым категориям. Ниже 45 — нужны изменения, выше 70 — конкурентно сильно.
                </div>
              </div>

              {/* Categories grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10,
              }}>
                {report.categories.map(c => {
                  const Icon = categoryIcons[c.key];
                  return (
                    <div key={c.key} style={{
                      background: card, border: `1px solid ${border}`, borderRadius: 14,
                      padding: "18px 14px", display: "flex", flexDirection: "column", gap: 6,
                    }}>
                      <Icon size={18} color={scoreColor(c.score)} />
                      <div style={{ fontSize: 12, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: scoreColor(c.score), lineHeight: 1 }}>
                        {c.score}
                      </div>
                      <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{c.hint}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Insights */}
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 32px 30px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={20} color={neonMagenta} /> Главные инсайты
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {report.insights.map((ins, i) => (
                <div key={i} style={{
                  background: card, border: `1px solid ${border}`, borderRadius: 14,
                  padding: "16px 18px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start",
                }}>
                  <div style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    textTransform: "uppercase", alignSelf: "start",
                    background: ins.severity === "high" ? "rgba(213,0,249,0.15)" :
                                ins.severity === "medium" ? "rgba(79,195,247,0.15)" : "rgba(100,116,139,0.15)",
                    color: ins.severity === "high" ? neonMagenta :
                           ins.severity === "medium" ? neonCyan : muted,
                  }}>
                    {ins.severity === "high" ? "критично" : ins.severity === "medium" ? "важно" : "инфо"}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{ins.title}</div>
                    <div style={{ fontSize: 13, color: muted, lineHeight: 1.55 }}>{ins.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Competitors + findings */}
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 32px 30px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 22 }}>
                <h3 style={{ fontSize: 16, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Swords size={18} color={neonCyan} /> Конкурентная среда
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { n: report.competitors.totalFound, l: "найдено" },
                    { n: `${report.competitors.avgMonthlyTraffic}k`, l: "средний трафик/мес" },
                    { n: report.competitors.missedKeys, l: "упущено ключей" },
                  ].map(k => (
                    <div key={k.l}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: fg }}>{k.n}</div>
                      <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>{k.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 22 }}>
                <h3 style={{ fontSize: 16, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={18} color={neonMagenta} /> Дополнительные находки
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {report.findings.map(f => (
                    <div key={f.label} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px dashed ${border}`, paddingBottom: 6 }}>
                      <span style={{ color: muted }}>{f.label}</span>
                      <span style={{ color: fg, fontWeight: 600 }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Upgrade CTA — this is where the funnel converts to 2900₽ */}
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 32px 0" }}>
            <div style={{
              position: "relative", overflow: "hidden",
              background: `linear-gradient(135deg, rgba(99,102,241,0.18), rgba(213,0,249,0.18))`,
              border: `1px solid rgba(99,102,241,0.45)`, borderRadius: 18,
              padding: "32px 36px",
            }}>
              <div style={{
                position: "absolute", top: 20, right: 24,
                padding: "6px 12px", borderRadius: 999,
                background: neonMagenta, color: "#0a0b0f",
                fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
              }}>
                −{discountPct}%
              </div>

              <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>
                Полный отчёт + 30 дней в платформе
              </h2>
              <div style={{ color: muted, fontSize: 14, marginBottom: 16 }}>
                Разблокируйте все 15+ готовых решений, портрет ЦА, CJM, брендбук и мониторинг 24/7.
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: fg }}>
                  {upgradePrice.toLocaleString("ru-RU")} ₽
                </span>
                <span style={{ fontSize: 22, color: muted, textDecoration: "line-through" }}>
                  {originalPrice.toLocaleString("ru-RU")} ₽
                </span>
                <span style={{ fontSize: 13, color: neonGreen, fontWeight: 700 }}>
                  экономия {(originalPrice - upgradePrice).toLocaleString("ru-RU")} ₽
                </span>
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "8px 20px", marginBottom: 22,
              }}>
                {[
                  { icon: Target, text: "Все 15+ решений рекомендаций" },
                  { icon: Users, text: "Портрет ЦА, персона, возражения" },
                  { icon: Map, text: "Customer Journey Map (7 этапов)" },
                  { icon: Palette, text: "Брендбук: цвета, шрифты, тон голоса" },
                  { icon: Swords, text: "Battle cards для отдела продаж" },
                  { icon: TrendingUp, text: "Мониторинг 24/7 + алерты" },
                ].map(b => {
                  const Icon = b.icon;
                  return (
                    <div key={b.text} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 10, color: fg }}>
                      <Icon size={16} color={neonCyan} /> {b.text}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={`/pricing?product=full&from=${encodeURIComponent(id)}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "14px 26px", borderRadius: 12,
                    background: accent, color: "#fff", textDecoration: "none",
                    fontWeight: 700, fontSize: 15,
                  }}>
                  Получить полный отчёт <ArrowRight size={18} />
                </Link>
                <Link href="/" style={{
                  padding: "14px 22px", borderRadius: 12,
                  border: `1px solid ${border}`, color: fg, textDecoration: "none",
                  fontWeight: 600, fontSize: 15,
                }}>
                  Вернуться на главную
                </Link>
              </div>
            </div>
          </section>

          {/* Social proof strip */}
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 32px" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}>
              {[
                { icon: Star, text: "Средний Score клиентов за 30 дней: +28" },
                { icon: MessagesSquare, text: "Интегрировано с ChatGPT, Perplexity, Gemini" },
                { icon: ShieldCheck, text: "Данные компании — только на вашем аккаунте" },
              ].map(it => {
                const Icon = it.icon;
                return (
                  <div key={it.text} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    fontSize: 13, color: muted,
                    padding: "10px 14px", background: card, border: `1px solid ${border}`, borderRadius: 10,
                  }}>
                    <Icon size={16} color={neonCyan} /> {it.text}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
        </>
      )}

      {/* FOOTER */}
      <footer style={{
        borderTop: `1px solid ${border}`, marginTop: 20,
        padding: "22px 32px", maxWidth: 1180, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, fontSize: 12, color: muted,
      }}>
        <div>© 2026 MarketRadar · marketradar24.ru</div>
        <div style={{ display: "flex", gap: 18 }}>
          <Link href="/" style={{ color: muted, textDecoration: "none" }}>Главная</Link>
          <Link href="/pricing" style={{ color: muted, textDecoration: "none" }}>Тарифы</Link>
          <Link href="/partners" style={{ color: muted, textDecoration: "none" }}>Партнёрам</Link>
        </div>
      </footer>

      {/* spinner keyframes */}
      <style>{`
        @keyframes mr-spin {
          from { transform: rotate(0deg); } to { transform: rotate(360deg); }
        }
      `}</style>

      {/* swallow setTheme unused warning under strict lint */}
      <span hidden aria-hidden>{isDark ? "" : ""}{typeof setTheme}</span>
    </div>
  );
}

export default function ExpressReportPage() {
  // useSearchParams must be wrapped in Suspense in Next 16 App Router.
  return (
    <Suspense fallback={null}>
      <ExpressReportInner />
    </Suspense>
  );
}
