/**
 * /r/[slug] — публичная страница экспресс-отчёта (без авторизации).
 *
 * Дизайн соответствует лендингу marketradar24.ru:
 *   • Дарковый фон + неоновые акценты (cyan #4FC3F7 / magenta #D500F9 / green #69FF47)
 *   • Большие цифры (score 96px) и крупные заголовки
 *   • Анимированный radar-логотип MarketRadar в шапке
 *   • Минимальный blur (только 2 из 5 рекомендаций + последние конкуренты),
 *     остальное открыто чтобы зацепить
 *   • Отдельный мощный блок «Видимость в нейросетях» — главный продающий хук
 *
 * Server Component → отчёт сразу в HTML для шаринга в Telegram/VK.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { query, initDb } from "@/lib/db";
import type { LeadReport } from "@/lib/lead-types";
import { MarketRadarLogo } from "@/components/ui/MarketRadarLogo";
import {
  ChevronRight, Lock, AlertTriangle, TrendingUp, Sparkles, Target, Award,
  Bot, Zap, Eye, X,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface LeadWithReport {
  domain: string;
  company_name: string | null;
  niche: string | null;
  data: LeadReport;
  generated_at: string;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    await initDb();
    const rows = await query<{ domain: string; company_name: string | null; data: LeadReport }>(
      `SELECT l.domain, l.company_name, r.data
         FROM leads l
         JOIN LATERAL (
           SELECT data FROM lead_reports
            WHERE lead_id = l.id AND status = 'done'
            ORDER BY created_at DESC LIMIT 1
         ) r ON true
        WHERE l.slug = $1`,
      [slug],
    );
    if (!rows.length) return { title: "Отчёт не найден · MarketRadar24" };
    const { domain, company_name, data } = rows[0];
    const brand = data?.brandName || company_name || domain;
    const title = `Экспресс-аудит ${brand} · MarketRadar24`;
    const desc = data?.oneLineSummary ?? `Score ${data?.overallScore ?? "—"}/100, среднее по нише ${data?.nicheAverage ?? "—"}/100`;
    return { title, description: desc, openGraph: { title, description: desc } };
  } catch {
    return { title: "Экспресс-отчёт · MarketRadar24" };
  }
}

// ─── Палитра marketradar24 ─────────────────────────────────────────────────
const C = {
  bg: "#06070d",           // основной чёрный из лендинга
  bgAlt: "#0e1119",
  card: "#10172a",
  cardElev: "#162035",
  border: "#1e293b",
  borderBright: "#2d3748",
  fg: "#f1f5f9",
  fg2: "#cbd5e1",
  muted: "#64748b",
  // Brand accents (из лендинга и логотипа)
  primary: "#6366f1",       // accent
  cyan: "#4FC3F7",          // neonCyan
  cyanGlow: "#00D4FF",
  magenta: "#D500F9",       // neonMagenta
  green: "#69FF47",         // neonGreen
  red: "#FF5252",           // neonRed
  violet: "#9B59FF",
  orange: "#f59e0b",
};

const S = {
  page: { minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: "ui-sans-serif, system-ui, -apple-system" } as React.CSSProperties,
  bgGlow: {
    position: "fixed" as const, inset: 0, pointerEvents: "none" as const, zIndex: 0,
    background: `radial-gradient(circle at 20% 10%, ${C.cyan}11 0%, transparent 50%), radial-gradient(circle at 80% 90%, ${C.magenta}11 0%, transparent 50%)`,
  },
  container: { position: "relative" as const, zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" } as React.CSSProperties,
  // ─── Header
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36, paddingBottom: 20, borderBottom: `1px solid ${C.border}` } as React.CSSProperties,
  brand: { display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: C.fg } as React.CSSProperties,
  brandName: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.1 } as React.CSSProperties,
  brandSub: { fontSize: 11, color: C.muted, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" as const } as React.CSSProperties,
  headerCta: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.magenta})`, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13, boxShadow: `0 4px 16px ${C.primary}55` } as React.CSSProperties,
  // ─── Hero
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px 10px 14px", borderRadius: 999, background: `${C.green}15`, border: `1px solid ${C.green}40`, color: C.green, fontSize: 13, fontWeight: 700, marginBottom: 24, boxShadow: `0 0 20px ${C.green}20` } as React.CSSProperties,
  // Бейдж «AI-гипотеза» — на полях которые AI оценил без точных данных.
  // Прозрачно показывает что цифра не из реального замера, а из экспертной
  // догадки AI. Это про доверие — гораздо лучше потерять «вау» в моменте,
  // чем потом получить упрёк «вы всё выдумали».
  aiBadge: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: `${C.cyan}1a`, border: `1px solid ${C.cyan}55`, color: C.cyan, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, verticalAlign: "middle" as const } as React.CSSProperties,
  // Disclaimer сверху всего отчёта — единая плашка про автоматический аудит.
  disclaimer: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 18px", borderRadius: 10, background: `${C.cyan}0a`, border: `1px solid ${C.cyan}40`, marginBottom: 24, fontSize: 13, color: C.fg2, lineHeight: 1.6 } as React.CSSProperties,
  h1: { fontSize: 56, fontWeight: 900, marginBottom: 12, letterSpacing: -2, lineHeight: 1.05 } as React.CSSProperties,
  domainLine: { fontSize: 16, color: C.muted, marginBottom: 36, fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" } as React.CSSProperties,
  // ─── Score Hero
  scoreHero: { background: `linear-gradient(135deg, ${C.card} 0%, ${C.cardElev} 100%)`, border: `1px solid ${C.border}`, borderRadius: 24, padding: 44, marginBottom: 36, position: "relative" as const, overflow: "hidden" } as React.CSSProperties,
  scoreHeroGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 56, alignItems: "center" } as React.CSSProperties,
  scoreLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 800, marginBottom: 12 } as React.CSSProperties,
  scoreBig: (color: string) => ({ fontSize: 128, fontWeight: 900, color, lineHeight: 0.9, letterSpacing: -5, textShadow: `0 0 50px ${color}50` }),
  scoreSlash: { fontSize: 36, color: C.muted, fontWeight: 600, marginLeft: 8 } as React.CSSProperties,
  compareGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 16 } as React.CSSProperties,
  compareNum: (color: string) => ({ fontSize: 48, fontWeight: 800, color, lineHeight: 1, letterSpacing: -1.5, marginTop: 4 }),
  summary: { fontSize: 18, color: C.fg, lineHeight: 1.7, padding: "22px 0 0", borderTop: `1px solid ${C.border}`, marginTop: 28, fontWeight: 500 } as React.CSSProperties,
  // ─── Category cards — strict 3×2, mobile 2×3
  catGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 48 } as React.CSSProperties,
  catCard: (color: string) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 24px", position: "relative" as const, overflow: "hidden" as const, borderTop: `4px solid ${color}`, minHeight: 130, display: "flex", flexDirection: "column" as const, justifyContent: "space-between" as const }),
  catLabel: { fontSize: 12, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 } as React.CSSProperties,
  catScoreBig: (color: string) => ({ fontSize: 46, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1.5 }),
  catScoreOf: { fontSize: 16, color: C.muted, fontWeight: 600, marginLeft: 4 } as React.CSSProperties,
  // ─── Section titles
  sectionWrap: { marginBottom: 48 } as React.CSSProperties,
  sectionEyebrow: { fontSize: 12, color: C.muted, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 10 } as React.CSSProperties,
  sectionTitle: { fontSize: 32, fontWeight: 800, margin: "0 0 28px", display: "flex", alignItems: "center", gap: 14, letterSpacing: -0.7 } as React.CSSProperties,
  // ─── AI Visibility (главный хук)
  aiVisCard: (color: string) => ({ background: `linear-gradient(135deg, ${color}10 0%, ${C.card} 50%, ${C.card} 100%)`, border: `1px solid ${color}33`, borderRadius: 20, padding: 40, marginBottom: 16, boxShadow: `0 0 32px ${color}10` }),
  aiVisScore: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 40, alignItems: "center", marginBottom: 32 } as React.CSSProperties,
  aiVisBig: (color: string) => ({ fontSize: 96, fontWeight: 900, color, lineHeight: 0.9, letterSpacing: -3.5, textShadow: `0 0 40px ${color}50` }),
  aiVisStatus: (color: string) => ({ fontSize: 26, fontWeight: 800, color, marginBottom: 10 }),
  aiVisBlockers: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 22 } as React.CSSProperties,
  blockerCard: { background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" } as React.CSSProperties,
  queryGrid: { display: "grid", gap: 12, marginTop: 18 } as React.CSSProperties,
  queryRow: { background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const } as React.CSSProperties,
  // ─── Item cards (problems / opportunities / recs)
  problem: { background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.red}`, borderRadius: 14, padding: "22px 26px", marginBottom: 14 } as React.CSSProperties,
  opportunity: { background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.green}`, borderRadius: 14, padding: "22px 26px", marginBottom: 14, position: "relative" as const } as React.CSSProperties,
  rec: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 26px", marginBottom: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" } as React.CSSProperties,
  itemTitle: { fontSize: 19, fontWeight: 700, marginBottom: 10, letterSpacing: -0.2, lineHeight: 1.35 } as React.CSSProperties,
  itemDesc: { fontSize: 15, color: C.fg2, lineHeight: 1.7 } as React.CSSProperties,
  potentialBadge: (color: string) => ({ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 800, color, padding: "5px 12px", background: `${color}18`, borderRadius: 8, marginTop: 10 } as React.CSSProperties),
  moneyBadge: { display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700, color: C.orange, padding: "5px 12px", background: `${C.orange}18`, borderRadius: 8, marginTop: 10, marginLeft: 8 } as React.CSSProperties,
  // ─── Blur sections
  recBlur: { filter: "blur(7px)", userSelect: "none" as const, pointerEvents: "none" as const, opacity: 0.85 } as React.CSSProperties,
  blurOverlay: { position: "relative" as const },
  unlockBanner: { background: `linear-gradient(135deg, ${C.primary}, ${C.magenta})`, borderRadius: 18, padding: "28px 30px", margin: "20px 0", textAlign: "center" as const, color: "#fff", boxShadow: `0 8px 32px ${C.primary}40` } as React.CSSProperties,
  unlockTitle: { fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: -0.3 } as React.CSSProperties,
  unlockBody: { fontSize: 15, opacity: 0.95, marginBottom: 18, lineHeight: 1.55, maxWidth: 600, margin: "0 auto 18px" } as React.CSSProperties,
  unlockBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: C.primary, padding: "14px 28px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" } as React.CSSProperties,
  // ─── Final CTA
  finalCta: { background: `linear-gradient(135deg, ${C.card} 0%, ${C.cardElev} 100%)`, border: `2px solid ${C.primary}`, borderRadius: 20, padding: 44, marginTop: 44, textAlign: "center" as const, boxShadow: `0 12px 48px ${C.primary}20` } as React.CSSProperties,
  finalH: { fontSize: 32, fontWeight: 900, marginBottom: 14, letterSpacing: -0.7, lineHeight: 1.15 } as React.CSSProperties,
  finalSub: { fontSize: 16, color: C.fg2, marginBottom: 26, lineHeight: 1.6, maxWidth: 560, margin: "0 auto 26px" } as React.CSSProperties,
  finalBtn: { display: "inline-flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.magenta})`, color: "#fff", padding: "16px 36px", borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: "none", boxShadow: `0 8px 32px ${C.primary}55` } as React.CSSProperties,
  footer: { marginTop: 48, fontSize: 12, color: C.muted, textAlign: "center" as const, lineHeight: 1.6, paddingTop: 24, borderTop: `1px solid ${C.border}` } as React.CSSProperties,
};

function scoreColor(s: number): string {
  if (s >= 75) return C.green;
  if (s >= 55) return C.cyan;
  if (s >= 40) return C.orange;
  return C.red;
}

function aiStatusLabel(s: LeadReport["aiVisibility"]["status"]): { label: string; color: string; emoji: string } {
  switch (s) {
    case "strong":   return { label: "ВИДИМЫ", color: C.green, emoji: "🟢" };
    case "moderate": return { label: "ЧАСТИЧНО ВИДИМЫ", color: C.cyan, emoji: "🔵" };
    case "weak":     return { label: "СЛАБО ВИДИМЫ", color: C.orange, emoji: "🟡" };
    case "invisible":
    default:         return { label: "НЕВИДИМЫ", color: C.red, emoji: "🔴" };
  }
}

export default async function PublicReportPage({ params }: PageProps) {
  const { slug } = await params;

  await initDb();
  const rows = await query<LeadWithReport>(
    `SELECT l.domain, l.company_name, l.niche, r.data, r.generated_at
       FROM leads l
       JOIN LATERAL (
         SELECT data, generated_at FROM lead_reports
          WHERE lead_id = l.id AND status = 'done'
          ORDER BY created_at DESC LIMIT 1
       ) r ON true
      WHERE l.slug = $1`,
    [slug],
  );

  if (!rows.length) notFound();
  const { domain, company_name, data: report, generated_at } = rows[0];

  // Бренд: приоритет brandName из отчёта (берётся со страницы) → CSV → домен.
  const titleName = report.brandName || company_name || domain;
  const overallColor = scoreColor(report.overallScore);
  const lag = report.nicheAverage - report.overallScore;
  const dateStr = new Date(generated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  // Видимое vs blur — теперь больше открыто.
  const visibleRecs = report.recommendations.slice(0, 3);
  const hiddenRecs = report.recommendations.slice(3);
  const visibleCompetitors = report.competitors.slice(0, 2);
  const hiddenCompetitors = report.competitors.slice(2);
  // AI Visibility queries: 2 видны, остальные blurred
  const aiVis = report.aiVisibility;
  const visibleQueries = aiVis?.sampleQueries?.slice(0, 2) ?? [];
  const hiddenQueries = aiVis?.sampleQueries?.slice(2) ?? [];

  const aiStatus = aiStatusLabel(aiVis?.status ?? "invisible");
  const aiScore = aiVis?.score ?? 0;
  const aiColor = scoreColor(aiScore);

  return (
    <div style={S.page}>
      {/* Адаптивность через global CSS — стилевые объекты не умеют @media. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 760px) {
          .mr-cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .mr-ai-blockers { grid-template-columns: 1fr !important; }
          .mr-score-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .mr-ai-score-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .mr-h1 { font-size: 36px !important; }
          .mr-score-big { font-size: 88px !important; }
          .mr-ai-vis-big { font-size: 68px !important; }
          .mr-rec { grid-template-columns: 1fr !important; }
        }
      `}} />
      <div style={S.bgGlow} aria-hidden />
      <div style={S.container}>

        {/* ─── Header с лого ─── */}
        <header style={S.header}>
          <Link href="/" style={S.brand}>
            <MarketRadarLogo size={44} animated={false} />
            <div>
              <div style={S.brandName}>MarketRadar<span style={{ color: C.cyan }}>24</span></div>
              <div style={S.brandSub}>Конкурентная разведка</div>
            </div>
          </Link>
          <Link href="/register" style={S.headerCta}>
            Войти на платформу <ChevronRight size={14} />
          </Link>
        </header>

        {/* ─── Hero ─── */}
        <div style={S.heroBadge}>
          <Sparkles size={14} /> Экспресс-аудит сайта · {dateStr}
        </div>
        <h1 className="mr-h1" style={S.h1}>{titleName}</h1>
        <div style={S.domainLine}>{domain}</div>

        {/* Disclaimer: разделяем факты (со скрапа) и AI-гипотезы (оценки).
            Без этого юзер может принять score за реальный замер — это нечестно. */}
        <div style={S.disclaimer}>
          <Sparkles size={16} color={C.cyan} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <b style={{ color: C.fg }}>Как читать отчёт.</b>{" "}
            Технические факты (наличие H1, schema.org, llms.txt) — взяты со скрапа вашей страницы.
            Все оценки в баллах, прогнозы и сравнения с конкурентами — это <b style={{ color: C.cyan }}>AI-гипотеза</b> (помечена бейджем) и требует верификации.
            Полный анализ с реальными метриками — на платформе MarketRadar24.
          </div>
        </div>

        {/* ─── Score Hero ─── */}
        <div style={S.scoreHero}>
          <div className="mr-score-grid" style={S.scoreHeroGrid}>
            <div>
              <div style={S.scoreLabel}>Общий Score</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span className="mr-score-big" style={S.scoreBig(overallColor)}>{report.overallScore}</span>
                <span style={S.scoreSlash}>/100</span>
              </div>
            </div>
            <div>
              <div style={S.compareGrid}>
                <div>
                  <div style={{ ...S.scoreLabel, display: "flex", alignItems: "center", gap: 6 }}>
                    Среднее по нише
                    <span style={S.aiBadge}>✨ AI</span>
                  </div>
                  <div style={S.compareNum(C.fg)}>{report.nicheAverage}<span style={{ ...S.scoreSlash, fontSize: 18 }}>/100</span></div>
                </div>
                <div>
                  <div style={S.scoreLabel}>Отставание</div>
                  <div style={S.compareNum(lag > 0 ? C.red : C.green)}>
                    {lag > 0 ? `−${lag}` : `+${Math.abs(lag)}`}
                    <span style={{ ...S.scoreSlash, fontSize: 18 }}>баллов</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={S.summary}>{report.oneLineSummary}</div>
        </div>

        {/* ─── 6 категорий — строго 3×2 ─── */}
        <div className="mr-cat-grid" style={S.catGrid}>
          {([
            ["seo",          "SEO",          C.cyan],
            ["aiVisibility", "AI-нейросети", C.magenta],
            ["social",       "Соцсети",      C.cyan],
            ["content",      "Контент",      C.violet],
            ["hrBrand",      "HR-бренд",     C.orange],
            ["technical",    "Технологии",   C.green],
          ] as const).map(([key, label, color]) => {
            const score = (report.scores as Record<string, number>)[key] ?? 0;
            const col = scoreColor(score);
            void color;
            return (
              <div key={key} style={S.catCard(col)}>
                <div style={S.catLabel}>{label}</div>
                <div>
                  <span style={S.catScoreBig(col)}>{score}</span>
                  <span style={S.catScoreOf}>/100</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── AI Visibility — главный продающий блок ─── */}
        {aiVis && (
          <div style={S.sectionWrap}>
            <div style={S.sectionEyebrow}>⚡ ГЛАВНАЯ ВОЗМОЖНОСТЬ 2026</div>
            <h2 style={S.sectionTitle}>
              <Bot size={32} color={C.magenta} />
              Видимость в нейросетях
            </h2>
            <div style={S.aiVisCard(aiColor)}>
              <div className="mr-ai-score-grid" style={S.aiVisScore}>
                <div>
                  <div style={S.scoreLabel}>AI-видимость</div>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span className="mr-ai-vis-big" style={S.aiVisBig(aiColor)}>{aiScore}</span>
                    <span style={S.scoreSlash}>/100</span>
                  </div>
                </div>
                <div>
                  <div style={S.aiVisStatus(aiColor)}>{aiStatus.emoji} {aiStatus.label}</div>
                  <div style={{ fontSize: 15, color: C.fg2, lineHeight: 1.55 }}>
                    К концу 2026 года <b style={{ color: C.fg }}>до 40% B2B-решений</b> принимаются с участием ChatGPT, Claude, Yandex Neuro и GigaChat.
                    {aiScore < 30 && (
                      <> Ваши клиенты <b style={{ color: aiColor }}>не услышат о вас</b> через AI-ассистентов.</>
                    )}
                  </div>
                </div>
              </div>

              {/* Что блокирует попадание */}
              {aiVis.blockers && aiVis.blockers.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8, marginBottom: 12 }}>
                    Что мешает попадать в выдачу AI:
                  </div>
                  <div className="mr-ai-blockers" style={S.aiVisBlockers}>
                    {aiVis.blockers.map((b, i) => (
                      <div key={i} style={S.blockerCard}>
                        <X size={18} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.fg, marginBottom: 4 }}>{b.title}</div>
                          <div style={{ fontSize: 13, color: C.fg2, lineHeight: 1.55 }}>{b.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Примеры запросов */}
              {visibleQueries.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    Примерные запросы из ниши
                    <span style={S.aiBadge}>✨ AI</span>
                  </div>
                  <div style={S.queryGrid}>
                    {visibleQueries.map((q, i) => (
                      <div key={i} style={S.queryRow}>
                        <div style={{ fontSize: 14, color: C.fg, fontWeight: 600, flex: 1 }}>
                          «{q.query}»
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: q.youArePresent ? C.green : C.red }}>
                          {q.youArePresent ? "✓ упоминают" : "✗ не упоминают"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {hiddenQueries.length > 0 && (
                    <div style={S.blurOverlay}>
                      <div style={{ ...S.recBlur, ...S.queryGrid, marginTop: 10 }}>
                        {hiddenQueries.map((q, i) => (
                          <div key={i} style={S.queryRow}>
                            <div style={{ fontSize: 14, color: C.fg, fontWeight: 600, flex: 1 }}>«{q.query}»</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>✗ не упоминают</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ ...S.unlockBanner, padding: "20px 26px", marginTop: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                          <Lock size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />
                          Ещё {hiddenQueries.length} запросов в полном GEO-аудите
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 14 }}>
                          Платформа MarketRadar24 проверяет реальные упоминания вашего бренда в ChatGPT, Claude, YandexGPT, Gemini и Алисе/Нейро через Keys.so. Плюс готовый план — как туда попасть.
                        </div>
                        <Link href="/register" style={{ ...S.unlockBtn, padding: "10px 22px", fontSize: 13 }}>
                          Получить полный аудит <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Топ проблем ─── */}
        <div style={S.sectionWrap}>
          <div style={S.sectionEyebrow}>🩹 ЧТО БОЛИТ</div>
          <h2 style={S.sectionTitle}>
            <AlertTriangle size={28} color={C.red} />
            Что прямо сейчас теряете
          </h2>
          {report.topProblems.map((p, i) => (
            <div key={i} style={S.problem}>
              <div style={S.itemTitle}>{p.title}</div>
              <div style={S.itemDesc}>{p.description}</div>
            </div>
          ))}
        </div>

        {/* ─── Возможности ─── */}
        <div style={S.sectionWrap}>
          <div style={S.sectionEyebrow}>💰 ЧТО МОЖНО ОТЖАТЬ</div>
          <h2 style={S.sectionTitle}>
            <TrendingUp size={28} color={C.green} />
            Возможности роста
          </h2>
          {report.opportunities.map((o, i) => (
            <div key={i} style={S.opportunity}>
              <div style={S.itemTitle}>{o.title}</div>
              <div style={S.itemDesc}>{o.description}</div>
              <div>
                <span style={S.potentialBadge(C.green)}>
                  <TrendingUp size={13} /> {o.potential}
                </span>
                {/* moneyEstimate отключён — был источником галлюцинаций.
                    Если оставшиеся в БД старые отчёты содержат его — игнорируем. */}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Рекомендации ─── */}
        <div style={S.sectionWrap}>
          <div style={S.sectionEyebrow}>🎯 ПЛАН ДЕЙСТВИЙ</div>
          <h2 style={S.sectionTitle}>
            <Target size={28} color={C.cyan} />
            Рекомендации с приоритетом
          </h2>
          {visibleRecs.map((r, i) => (
            <div key={i} className="mr-rec" style={S.rec}>
              <div>
                <div style={S.itemTitle}>{r.title}</div>
                <div style={S.itemDesc}>{r.description}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: `${C.cyan}22`, color: C.cyan, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>impact: {r.impact}</span>
                <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: `${C.muted}22`, color: C.muted, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>effort: {r.effort}</span>
              </div>
            </div>
          ))}

          {hiddenRecs.length > 0 && (
            <div style={S.blurOverlay}>
              <div style={S.recBlur}>
                {hiddenRecs.map((r, i) => (
                  <div key={i} className="mr-rec" style={S.rec}>
                    <div>
                      <div style={S.itemTitle}>{r.title}</div>
                      <div style={S.itemDesc}>{r.description}</div>
                    </div>
                    <div />
                  </div>
                ))}
              </div>
              <div style={S.unlockBanner}>
                <div style={S.unlockTitle}>🔒 Ещё {hiddenRecs.length} {hiddenRecs.length === 1 ? "рекомендация" : "рекомендации"} в полном отчёте</div>
                <div style={S.unlockBody}>
                  В платформе — детальный план роста с 30+ пунктами, конкретными исполнителями, сроками и сметой. Плюс анализ конкурентов, ЦА, СММ-стратегия, AI-генерация контента. <b>7 дней бесплатно</b>.
                </div>
                <Link href="/register" style={S.unlockBtn}>
                  Получить полный план <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ─── Конкуренты ─── */}
        {(visibleCompetitors.length > 0 || hiddenCompetitors.length > 0) && (
        <div style={S.sectionWrap}>
          <div style={S.sectionEyebrow}>⚔️ КТО ОБХОДИТ</div>
          <h2 style={{ ...S.sectionTitle, display: "flex", alignItems: "center", gap: 12 }}>
            <Award size={28} color={C.orange} />
            Ваши конкуренты
            <span style={S.aiBadge}>✨ AI</span>
          </h2>
          {visibleCompetitors.map((c, i) => (
            <div key={i} style={{ ...S.problem, borderLeftColor: C.orange }}>
              <div style={S.itemTitle}>
                {c.name} <span style={{ fontSize: 13, color: C.muted, fontWeight: 500, fontFamily: "ui-monospace, monospace", marginLeft: 6 }}>{c.domain}</span>
              </div>
              <div style={S.itemDesc}>{c.advantage}</div>
            </div>
          ))}
          {hiddenCompetitors.length > 0 && (
            <div style={S.blurOverlay}>
              <div style={S.recBlur}>
                {hiddenCompetitors.map((c, i) => (
                  <div key={i} style={{ ...S.problem, borderLeftColor: C.orange }}>
                    <div style={S.itemTitle}>
                      {c.name} <span style={{ fontSize: 13, color: C.muted, fontWeight: 500, fontFamily: "ui-monospace, monospace", marginLeft: 6 }}>{c.domain}</span>
                    </div>
                    <div style={S.itemDesc}>{c.advantage}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.unlockBanner, background: `linear-gradient(135deg, ${C.orange}, ${C.red})` }}>
                <div style={S.unlockTitle}>
                  <Eye size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />
                  +{hiddenCompetitors.length} {hiddenCompetitors.length === 1 ? "конкурент" : "конкурентов"} в полном анализе
                </div>
                <div style={S.unlockBody}>
                  Полный разбор: SEO-позиции, цены, реклама, отзывы на картах, активность в соцсетях, HR-бренд каждого конкурента.
                </div>
                <Link href="/register" style={S.unlockBtn}>
                  Увидеть всех <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ─── Финальный CTA ─── */}
        <div style={S.finalCta}>
          <div style={{ marginBottom: 18 }}>
            <MarketRadarLogo size={56} animated={false} />
          </div>
          <div style={S.finalH}>
            Готовы превратить отставание в рост?
          </div>
          <div style={S.finalSub}>
            <b>MarketRadar24</b> — полный конкурентный анализ, портрет ЦА, СММ-стратегия, видимость в нейросетях, AI-генерация постов, рилсов и лендингов.
            <br />
            <b style={{ color: C.green }}>7 дней бесплатно</b>, без карты на старте.
          </div>
          <Link href="/register" style={S.finalBtn}>
            Начать бесплатно <ChevronRight size={20} />
          </Link>
          <div style={{ marginTop: 18, fontSize: 13, color: C.muted }}>
            Уже на платформе? <Link href="/" style={{ color: C.cyan, textDecoration: "none", fontWeight: 600 }}>Войти</Link>
          </div>
        </div>

        <div style={S.footer}>
          Отчёт сформирован автоматически на основе публичных данных сайта {domain} и AI-анализа.
          <br />
          Это короткая версия — полный анализ доступен на <Link href="/" style={{ color: C.cyan, textDecoration: "none" }}>marketradar24.ru</Link>
        </div>
      </div>
    </div>
  );
}
