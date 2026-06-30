"use client";

/**
 * OwnerDashboardTv — полноэкранный ТВ-режим дашборда руководителя.
 *
 * Включается на /owner-dashboard?tv=1. Рассчитан на показ на офисном телевизоре,
 * где НЕТ возможности скроллить: контент разбит на слайды, каждый помещается ровно
 * в один экран (100vw×100vh), переключение — как презентация.
 *
 * Навигация (без мыши, под пульт ТВ):
 *   - автолистание ~14 сек, зациклено, плавный fade;
 *   - стрелки ←/→ (и Space) — листать вручную; ручное действие сбрасывает таймер;
 *   - точки-индикатор внизу (кликабельны);
 *   - Esc или крестик — выйти из ТВ-режима (вернуться на обычный дашборд).
 *
 * Тёмная тема самодостаточна (инлайн-стили) — не зависит от темы платформы.
 * Данные приходят пропом `data` (тот же DashboardData, что у PC-версии) — компонент
 * НИЧЕГО не грузит и не меняет (read-only). Реальные значения, без выдумок: если
 * секции нет данных — слайд просто не показывается.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { DashboardData } from "@/components/dashboard/OwnerDashboardContent";
import type { AnalysisResult } from "@/lib/types";

// ── Тёмная палитра табло (как у ТВ-дашборда колл-агента) ──
const C = {
  bg: "#0c0f1a",
  panel: "#161a2b",
  panelAlt: "#1d2238",
  border: "#272d44",
  text: "#eef1f8",
  textDim: "#9aa2bd",
  accent: "#7c70e0",
  good: "#22c55e",
  warn: "#eab308",
  bad: "#ef4444",
  neutral: "#8b93ad",
};

const SLIDE_MS = 14000;

/** Цвет балла 0–100: зелёный ≥70, жёлтый ≥40, красный ниже. */
function scoreColor(score: number): string {
  if (score >= 70) return C.good;
  if (score >= 40) return C.warn;
  return C.bad;
}

interface Threat {
  level: "critical" | "warning" | "opportunity";
  title: string;
  description: string;
}

/** Точная копия buildThreats из OwnerDashboardContent — чтобы ТВ показывал те же угрозы. */
function buildThreats(my: AnalysisResult | null, competitors: AnalysisResult[]): Threat[] {
  const threats: Threat[] = [];
  if (!my) return threats;
  competitors.filter((c) => c.company.score > my.company.score).slice(0, 2).forEach((c) => {
    threats.push({
      level: "critical",
      title: `${c.company.name} опережает по общему баллу`,
      description: `Балл ${c.company.score} против вашего ${my.company.score}. Проверьте в чём они сильнее.`,
    });
  });
  (my.nicheForecast?.threats ?? []).slice(0, 2).forEach((t) =>
    threats.push({ level: "warning", title: "Рыночная угроза", description: t }));
  (my.nicheForecast?.opportunities ?? []).slice(0, 3).forEach((o) =>
    threats.push({ level: "opportunity", title: "Возможность", description: o }));
  return threats.slice(0, 6);
}

interface Props {
  data: DashboardData;
  /** Куда вести крестик/Esc (обычный дашборд). По умолчанию /owner-dashboard. */
  exitHref?: string;
}

export function OwnerDashboardTv({ data, exitHref = "/owner-dashboard" }: Props) {
  const { company: my, competitors } = data;

  // ── Готовим данные слайдов (реальные значения) ──
  const myScore = my?.company.score ?? 0;
  const ahead = useMemo(
    () => competitors.filter((c) => c.company.score > myScore).length,
    [competitors, myScore],
  );
  const threats = useMemo(() => buildThreats(my, competitors), [my, competitors]);
  const activeThreats = threats.filter((t) => t.level !== "opportunity").length;

  // Рейтинг: моя компания + до 5 конкурентов, по убыванию балла
  const ranking = useMemo(() => {
    const rows: Array<{ name: string; score: number; mine: boolean }> = [];
    if (my) rows.push({ name: my.company.name, score: my.company.score, mine: true });
    competitors.slice(0, 6).forEach((c) => rows.push({ name: c.company.name, score: c.company.score, mine: false }));
    return rows.sort((a, b) => b.score - a.score);
  }, [my, competitors]);

  const recs = useMemo(() => (my?.recommendations ?? []).slice(0, 5), [my]);
  const insights = useMemo(() => (my?.insights ?? []).slice(0, 4), [my]);

  // ── Собираем список слайдов (пропускаем пустые секции) ──
  const slides = useMemo(() => {
    const list: Array<{ key: string; node: React.ReactNode }> = [];
    if (my) list.push({ key: "overview", node: <OverviewSlide my={my} competitors={competitors.length} ahead={ahead} activeThreats={activeThreats} /> });
    if (ranking.length > 1) list.push({ key: "ranking", node: <RankingSlide rows={ranking} /> });
    if (threats.length > 0) list.push({ key: "threats", node: <ThreatsSlide threats={threats} /> });
    if (recs.length > 0) list.push({ key: "recs", node: <RecsSlide recs={recs} /> });
    if (insights.length > 0) list.push({ key: "insights", node: <InsightsSlide insights={insights} /> });
    return list;
  }, [my, competitors.length, ahead, activeThreats, ranking, threats, recs, insights]);

  const slideCount = slides.length;
  const [slide, setSlide] = useState(0);
  const [tick, setTick] = useState(0); // сброс таймера при ручном переключении

  const go = useCallback((next: number) => {
    if (slideCount === 0) return;
    setSlide(((next % slideCount) + slideCount) % slideCount);
    setTick((t) => t + 1);
  }, [slideCount]);

  // Автолистание
  useEffect(() => {
    if (slideCount <= 1) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % slideCount), SLIDE_MS);
    return () => clearInterval(t);
  }, [slideCount, tick]);

  // Не выходить за границы при изменении числа слайдов
  useEffect(() => {
    if (slide >= slideCount && slideCount > 0) setSlide(0);
  }, [slide, slideCount]);

  // Клавиатура / пульт ТВ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(slide + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(slide - 1); }
      else if (e.key === "Escape") { window.location.href = exitHref; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, go, exitHref]);

  return (
    <div
      className="mrtv"
      style={{
        position: "fixed", inset: 0, width: "100vw", height: "100vh",
        background: C.bg, color: C.text, overflow: "hidden",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        fontSize: "clamp(14px, 1vw, 26px)", zIndex: 9999, userSelect: "none",
      }}
    >
      <TvResponsiveStyles />

      <a
        href={exitHref}
        aria-label="Выйти из ТВ-режима"
        title="Выйти из ТВ-режима (Esc)"
        style={{
          position: "absolute", top: "1.6vh", right: "1.4vw", zIndex: 10000,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "clamp(34px, 3vw, 52px)", height: "clamp(34px, 3vw, 52px)",
          borderRadius: 999, border: `1px solid ${C.border}`,
          background: "rgba(22,26,43,0.85)", color: C.textDim, textDecoration: "none",
        }}
      >
        <X size={20} />
      </a>

      <TvHeader companyName={my?.company.name} />

      <div className="mrtv-stage" style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {slideCount === 0 ? (
          <EmptyState />
        ) : (
          slides.map((s, i) => (
            <Slide key={s.key} active={slide === i}>{s.node}</Slide>
          ))
        )}
      </div>

      {slideCount > 1 && <Dots count={slideCount} active={slide} onPick={go} />}
    </div>
  );
}

// ───────────────────────── адаптив (media queries) ─────────────────────────

function TvResponsiveStyles() {
  return (
    <style>{`
      @media (max-width: 600px) {
        .mrtv { font-size: clamp(15px, 2.6vw, 22px) !important; }
        .mrtv-header { flex-wrap: wrap !important; gap: 1vh 3vw !important; padding: 1.4vh 4vw !important; }
        .mrtv-slide { overflow-y: auto !important; padding: 2vh 4vw !important; }
        .mrtv-kpi-grid { grid-template-columns: 1fr 1fr !important; }
        .mrtv-two { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}

// ───────────────────────── шапка ─────────────────────────

function TvHeader({ companyName }: { companyName?: string }) {
  const [clock, setClock] = useState("--:--");
  useEffect(() => {
    const f = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    };
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header
      className="mrtv-header"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.6vh 2.2vw", borderBottom: `1px solid ${C.border}`, flexShrink: 0, gap: "2vw",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "1.2vw", minWidth: 0 }}>
        <span style={{ fontSize: "2em", fontWeight: 800, letterSpacing: "-0.01em" }}>Дашборд руководителя</span>
        {companyName && <span style={{ fontSize: "1.1em", color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {companyName}</span>}
      </div>
      <div style={{ fontSize: "2.2em", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{clock}</div>
    </header>
  );
}

// ───────────────────────── слайд-обёртка ─────────────────────────

function Slide({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="mrtv-slide"
      style={{
        position: "absolute", inset: 0, padding: "2.5vh 2.4vw", boxSizing: "border-box",
        display: "flex", flexDirection: "column",
        opacity: active ? 1 : 0, transform: active ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s ease, transform 0.6s ease", pointerEvents: active ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "1.6em", fontWeight: 800, marginBottom: "2vh", flexShrink: 0, letterSpacing: "-0.01em" }}>
      {children}
    </div>
  );
}

// ───────────────────────── слайд: Обзор ─────────────────────────

function OverviewSlide({ my, competitors, ahead, activeThreats }: {
  my: AnalysisResult; competitors: number; ahead: number; activeThreats: number;
}) {
  const score = my.company.score;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "2.5vh", minHeight: 0 }}>
      <div className="mrtv-two" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "2vw" }}>
        {/* Огромный общий балл */}
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 24,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1vh",
        }}>
          <div style={{ fontSize: "1.3em", color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Общий балл</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4vw" }}>
            <span style={{ fontSize: "9em", fontWeight: 800, lineHeight: 0.9, color: scoreColor(score) }}>{score}</span>
            <span style={{ fontSize: "2.4em", color: C.textDim, fontWeight: 700 }}>/ 100</span>
          </div>
        </div>
        {/* KPI-плитки */}
        <div className="mrtv-kpi-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6vh 1.6vw" }}>
          <KpiTile label="Конкурентов" value={String(competitors)} />
          <KpiTile label="Опережают вас" value={String(ahead)} color={ahead > 0 ? C.bad : C.good} />
          <KpiTile label="Активных угроз" value={String(activeThreats)} color={activeThreats > 0 ? C.warn : C.good} />
          <KpiTile label="Рекомендаций" value={String((my.recommendations ?? []).length)} color={C.accent} />
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18,
      padding: "1.6vh 1.6vw", display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.8vh",
    }}>
      <div style={{ fontSize: "0.95em", color: C.textDim, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "3.4em", fontWeight: 800, lineHeight: 1, color: color || C.text }}>{value}</div>
    </div>
  );
}

// ───────────────────────── слайд: Рейтинг ─────────────────────────

function RankingSlide({ rows }: { rows: Array<{ name: string; score: number; mine: boolean }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <SlideTitle>Рейтинг по общему баллу</SlideTitle>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.2vh", justifyContent: "center" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "1.4vw" }}>
            <div style={{ width: "2.2em", textAlign: "center", fontSize: "1.4em", fontWeight: 800, color: i < 3 ? C.accent : C.textDim, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1vw", marginBottom: "0.6vh" }}>
                <span style={{
                  fontSize: "1.4em", fontWeight: r.mine ? 800 : 600, color: r.mine ? C.text : C.textDim,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.name}{r.mine && <span style={{ color: C.accent, fontWeight: 700 }}> · вы</span>}
                </span>
                <span style={{ fontSize: "1.6em", fontWeight: 800, color: scoreColor(r.score), flexShrink: 0 }}>{r.score}</span>
              </div>
              <div style={{ height: "1.4vh", borderRadius: 999, background: C.panelAlt, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(2, Math.min(100, r.score))}%`, height: "100%", background: r.mine ? C.accent : scoreColor(r.score), borderRadius: 999 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── слайд: Угрозы и возможности ─────────────────────────

function ThreatsSlide({ threats }: { threats: Threat[] }) {
  const color = (l: Threat["level"]) => (l === "critical" ? C.bad : l === "warning" ? C.warn : C.good);
  const badge = (l: Threat["level"]) => (l === "critical" ? "критично" : l === "warning" ? "внимание" : "возможность");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <SlideTitle>Угрозы и возможности</SlideTitle>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.2vh", justifyContent: "center" }}>
        {threats.map((t, i) => (
          <div key={i} style={{
            display: "flex", gap: "1.4vw", background: C.panel, border: `1px solid ${C.border}`,
            borderLeft: `5px solid ${color(t.level)}`, borderRadius: 14, padding: "1.6vh 1.6vw", alignItems: "flex-start",
          }}>
            <div style={{
              fontSize: "0.85em", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
              color: color(t.level), flexShrink: 0, minWidth: "7em", paddingTop: "0.3vh",
            }}>{badge(t.level)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "1.3em", fontWeight: 700, marginBottom: "0.4vh" }}>{t.title}</div>
              <div style={{ fontSize: "1.05em", color: C.textDim, lineHeight: 1.4 }}>{t.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── слайд: Рекомендации ─────────────────────────

function RecsSlide({ recs }: { recs: Array<{ priority: "high" | "medium" | "low"; text: string; category: string }> }) {
  const col = (pr: string) => (pr === "high" ? C.bad : pr === "medium" ? C.warn : C.good);
  const lab = (pr: string) => (pr === "high" ? "высокий" : pr === "medium" ? "средний" : "низкий");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <SlideTitle>Рекомендации</SlideTitle>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.2vh", justifyContent: "center" }}>
        {recs.map((r, i) => (
          <div key={i} style={{
            display: "flex", gap: "1.4vw", background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: "1.6vh 1.6vw", alignItems: "flex-start",
          }}>
            <div style={{
              fontSize: "0.85em", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
              color: col(r.priority), flexShrink: 0, minWidth: "6em", paddingTop: "0.3vh",
            }}>{lab(r.priority)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "1.2em", fontWeight: 600, lineHeight: 1.4 }}>{r.text}</div>
              {r.category && <div style={{ fontSize: "0.95em", color: C.textDim, marginTop: "0.4vh" }}>{r.category}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── слайд: Инсайты ─────────────────────────

function InsightsSlide({ insights }: { insights: Array<{ title: string; text: string }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <SlideTitle>Ключевые инсайты</SlideTitle>
      <div className="mrtv-kpi-grid" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6vh 1.6vw", alignContent: "center" }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.8vh 1.6vw" }}>
            <div style={{ fontSize: "1.25em", fontWeight: 800, marginBottom: "0.8vh", color: C.accent }}>{ins.title}</div>
            <div style={{ fontSize: "1.05em", color: C.textDim, lineHeight: 1.45 }}>{ins.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── точки + заглушка ─────────────────────────

function Dots({ count, active, onPick }: { count: number; active: number; onPick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.8vw", padding: "1.4vh 0", flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`Слайд ${i + 1}`}
          style={{
            width: i === active ? "2.4vw" : "0.9vw", maxWidth: i === active ? 48 : 18, minWidth: i === active ? 24 : 9,
            height: "0.9vh", minHeight: 8, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
            background: i === active ? C.accent : C.border, transition: "width 0.4s ease, background 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2vh", color: C.textDim }}>
      <div style={{ fontSize: "3em", fontWeight: 800 }}>Нет данных для показа</div>
      <div style={{ fontSize: "1.3em" }}>Запустите анализ компании на платформе</div>
    </div>
  );
}
