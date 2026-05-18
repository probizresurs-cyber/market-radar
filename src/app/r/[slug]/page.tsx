/**
 * /r/[slug] — публичная страница экспресс-отчёта (без авторизации).
 *
 * Кидаем эту ссылку владельцу сайта в email/мессенджер. Цель страницы —
 * показать, что мы провели аудит, найти болевые точки, и продать
 * полноценный анализ на marketradar24.ru.
 *
 * Структура:
 *   • Хедер: домен, общий Score, среднее по нише, фотограмма
 *   • Сравнение по 5 категориям (SEO / Соцсети / Контент / HR / Тех)
 *   • Топ-3 проблемы (видны полностью)
 *   • Топ-3 возможности (видны полностью)
 *   • 5 рекомендаций (первые 2 видимы, 3 размыты blur'ом)
 *   • Конкуренты (первый 1 видим, остальные blur)
 *   • 2 CTA-блока (после рекомендаций + в конце)
 *
 * Контент рендерится server-side через Server Component — отчёт сразу
 * включается в HTML, что важно для шаринга в Telegram / VK.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { query, initDb } from "@/lib/db";
import type { LeadReport } from "@/lib/lead-types";
import { ChevronRight, Lock, AlertTriangle, TrendingUp, Sparkles, Target, Award } from "lucide-react";

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

// Метаданные для шаринга — preview-картинка в TG/VK берёт title+description.
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
    if (!rows.length) return { title: "Отчёт не найден" };
    const { domain, company_name, data } = rows[0];
    const title = `Экспресс-аудит ${company_name ?? domain}`;
    const desc = data?.oneLineSummary ?? `Score ${data?.overallScore ?? "—"}/100, среднее по нише ${data?.nicheAverage ?? "—"}/100`;
    return { title, description: desc, openGraph: { title, description: desc } };
  } catch {
    return { title: "Экспресс-отчёт" };
  }
}

const C = {
  bg: "#0a0e1a",
  card: "#10172a",
  cardElev: "#162035",
  border: "#1e293b",
  fg: "#f1f5f9",
  fg2: "#cbd5e1",
  muted: "#64748b",
  primary: "#7c3aed",
  red: "#ef4444",
  green: "#22c55e",
  orange: "#f59e0b",
  cyan: "#06b6d4",
};

const S = {
  page: { minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: "ui-sans-serif, system-ui, -apple-system" } as React.CSSProperties,
  container: { maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" } as React.CSSProperties,
  brand: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 28 } as React.CSSProperties,
  h1: { fontSize: 32, fontWeight: 800, marginBottom: 6, letterSpacing: -0.5 } as React.CSSProperties,
  h1Sub: { fontSize: 15, color: C.muted, marginBottom: 28 } as React.CSSProperties,
  scoreCard: { background: `linear-gradient(135deg, ${C.card}, ${C.cardElev})`, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 28, display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" } as React.CSSProperties,
  scoreBig: (color: string) => ({ fontSize: 72, fontWeight: 800, color, lineHeight: 1, letterSpacing: -2 }),
  scoreLabel: { fontSize: 12, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 },
  compareGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  compareRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 14 } as React.CSSProperties,
  catGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 32 } as React.CSSProperties,
  catCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 } as React.CSSProperties,
  catLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 } as React.CSSProperties,
  catScore: (color: string) => ({ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }),
  sectionTitle: { fontSize: 20, fontWeight: 700, margin: "32px 0 16px", display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  problem: { background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: 10, padding: "14px 18px", marginBottom: 10 } as React.CSSProperties,
  opportunity: { background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: 10, padding: "14px 18px", marginBottom: 10 } as React.CSSProperties,
  itemTitle: { fontSize: 15, fontWeight: 700, marginBottom: 4 } as React.CSSProperties,
  itemDesc: { fontSize: 13, color: C.fg2, lineHeight: 1.55 } as React.CSSProperties,
  itemMeta: { fontSize: 12, color: C.green, fontWeight: 600, marginTop: 6 } as React.CSSProperties,
  rec: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 16 } as React.CSSProperties,
  recBlur: { filter: "blur(5px)", userSelect: "none" as const, pointerEvents: "none" as const, opacity: 0.85 } as React.CSSProperties,
  blurOverlay: { position: "relative" as const },
  unlockBanner: { background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`, borderRadius: 14, padding: 24, margin: "18px 0", textAlign: "center" as const, color: "#fff" } as React.CSSProperties,
  unlockTitle: { fontSize: 18, fontWeight: 800, marginBottom: 6 } as React.CSSProperties,
  unlockBody: { fontSize: 14, opacity: 0.95, marginBottom: 16, lineHeight: 1.55 } as React.CSSProperties,
  unlockBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: C.primary, padding: "12px 24px", borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" } as React.CSSProperties,
  finalCta: { background: `linear-gradient(135deg, ${C.card}, ${C.cardElev})`, border: `2px solid ${C.primary}`, borderRadius: 16, padding: 36, marginTop: 36, textAlign: "center" as const } as React.CSSProperties,
};

function scoreColor(s: number): string {
  if (s >= 75) return C.green;
  if (s >= 55) return C.cyan;
  if (s >= 40) return C.orange;
  return C.red;
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

  const titleName = company_name ?? domain;
  const overallColor = scoreColor(report.overallScore);
  const lag = report.nicheAverage - report.overallScore;
  const dateStr = new Date(generated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  // Видимое — первые N, остальное blurred.
  const visibleRecs = report.recommendations.slice(0, 2);
  const hiddenRecs = report.recommendations.slice(2);
  const visibleCompetitors = report.competitors.slice(0, 1);
  const hiddenCompetitors = report.competitors.slice(1);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <Link href="/" style={{ ...S.brand, textDecoration: "none" }}>
          <Sparkles size={18} /> MarketRadar24
        </Link>

        <h1 style={S.h1}>Экспресс-аудит {titleName}</h1>
        <div style={S.h1Sub}>{domain} · сформирован {dateStr}</div>

        <div style={S.scoreCard}>
          <div>
            <div style={S.scoreLabel}>Ваш score</div>
            <div style={S.scoreBig(overallColor)}>{report.overallScore}<span style={{ fontSize: 22, color: C.muted, fontWeight: 600 }}>/100</span></div>
          </div>
          <div>
            <div style={S.compareGrid}>
              <div>
                <div style={S.scoreLabel}>Среднее по нише</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.fg }}>{report.nicheAverage}/100</div>
              </div>
              <div>
                <div style={S.scoreLabel}>Отставание</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: lag > 0 ? C.red : C.green }}>{lag > 0 ? `−${lag}` : `+${Math.abs(lag)}`}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 14, color: C.fg2, lineHeight: 1.55 }}>
              {report.oneLineSummary}
            </div>
          </div>
        </div>

        <div style={S.catGrid}>
          {([
            ["seo", "SEO"],
            ["social", "Соцсети"],
            ["content", "Контент"],
            ["hrBrand", "HR-бренд"],
            ["technical", "Технологии"],
          ] as const).map(([key, label]) => (
            <div key={key} style={S.catCard}>
              <div style={S.catLabel}>{label}</div>
              <div style={S.catScore(scoreColor(report.scores[key]))}>{report.scores[key]}</div>
            </div>
          ))}
        </div>

        <h2 style={S.sectionTitle}><AlertTriangle size={20} color={C.red} /> Что прямо сейчас теряете</h2>
        {report.topProblems.map((p, i) => (
          <div key={i} style={S.problem}>
            <div style={S.itemTitle}>{p.title}</div>
            <div style={S.itemDesc}>{p.description}</div>
          </div>
        ))}

        <h2 style={S.sectionTitle}><TrendingUp size={20} color={C.green} /> Что можно отжать</h2>
        {report.opportunities.map((o, i) => (
          <div key={i} style={S.opportunity}>
            <div style={S.itemTitle}>{o.title}</div>
            <div style={S.itemDesc}>{o.description}</div>
            <div style={S.itemMeta}>↑ {o.potential}</div>
          </div>
        ))}

        <h2 style={S.sectionTitle}><Target size={20} color={C.cyan} /> Рекомендации с приоритетом</h2>
        {visibleRecs.map((r, i) => (
          <div key={i} style={S.rec}>
            <div>
              <div style={S.itemTitle}>{r.title}</div>
              <div style={S.itemDesc}>{r.description}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>impact: {r.impact}</span>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: `${C.muted}22`, color: C.muted, fontWeight: 700 }}>effort: {r.effort}</span>
            </div>
          </div>
        ))}

        {hiddenRecs.length > 0 && (
          <div style={S.blurOverlay}>
            <div style={S.recBlur}>
              {hiddenRecs.map((r, i) => (
                <div key={i} style={S.rec}>
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
                В платформе MarketRadar24 — детальный план роста с 30+ рекомендациями, конкретными исполнителями и сроками. Плюс анализ конкурентов, ЦА, СММ-стратегия, генерация контента — за 29 ₽ в месяц на пробном тарифе.
              </div>
              <Link href="/register" style={S.unlockBtn}>
                Получить полный отчёт <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        )}

        <h2 style={S.sectionTitle}><Award size={20} color={C.orange} /> Ваши конкуренты</h2>
        {visibleCompetitors.map((c, i) => (
          <div key={i} style={S.problem}>
            <div style={S.itemTitle}>{c.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>· {c.domain}</span></div>
            <div style={S.itemDesc}>{c.advantage}</div>
          </div>
        ))}
        {hiddenCompetitors.length > 0 && (
          <div style={S.blurOverlay}>
            <div style={S.recBlur}>
              {hiddenCompetitors.map((c, i) => (
                <div key={i} style={S.problem}>
                  <div style={S.itemTitle}>{c.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>· {c.domain}</span></div>
                  <div style={S.itemDesc}>{c.advantage}</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.unlockBanner, background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <div style={S.unlockTitle}>
                <Lock size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />
                + {hiddenCompetitors.length} {hiddenCompetitors.length === 1 ? "конкурент" : "конкурентов"} в полном анализе
              </div>
              <div style={S.unlockBody}>
                Полный список с разбором того, что у каждого конкурента работает лучше: SEO-позиции, отзывы на картах, активность в соцсетях, HR-бренд.
              </div>
              <Link href="/register" style={S.unlockBtn}>
                Увидеть всех <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        )}

        <div style={S.finalCta}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, color: C.fg }}>
            Готовы превратить отставание в рост?
          </div>
          <div style={{ fontSize: 15, color: C.fg2, marginBottom: 22, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 22px" }}>
            MarketRadar24 — это полный конкурентный анализ, портрет ЦА, СММ-стратегия, AI-генерация постов и план контента. <b style={{ color: C.fg }}>7 дней бесплатно</b>, без карты на старте.
          </div>
          <Link href="/register" style={{ ...S.unlockBtn, padding: "14px 32px", fontSize: 15 }}>
            Начать бесплатно <ChevronRight size={18} />
          </Link>
          <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>
            Уже на платформе? <Link href="/" style={{ color: C.primary, textDecoration: "none" }}>Войти</Link>
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 11, color: C.muted, textAlign: "center" }}>
          Отчёт сформирован автоматически на основе публичных данных сайта {domain} и AI-анализа.<br />
          Это короткая версия — полный анализ требует регистрации на marketradar24.ru
        </div>
      </div>
    </div>
  );
}
