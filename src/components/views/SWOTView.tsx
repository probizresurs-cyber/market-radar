"use client";

/**
 * SWOTView — генерация и просмотр SWOT-анализа.
 *
 * Слева: forma запуска (требует уже выполненного анализа компании). Справа /
 * снизу: результат — 4 квадранта S/W/O/T + раскрываемый детальный отчёт.
 *
 * Действия:
 *   - Сгенерировать анализ (~60-90 сек)
 *   - Открыть полный отчёт в новой вкладке (HTML preview)
 *   - Скачать PDF
 *   - Список ранее сгенерированных отчётов из БД
 */

import React, { useEffect, useState } from "react";
import {
  Grid3x3, Loader2, FileDown, ExternalLink, RefreshCw,
  Shield, AlertTriangle, Sparkles, Zap, ChevronDown, ChevronRight,
  Crosshair, Target,
} from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import { hrefForNav } from "@/lib/products";
import type { SwotReport, SwotItems } from "@/lib/swot";
import type { TowsMatrix, TowsQuadrant } from "@/app/api/generate-tows/route";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

interface StoredReport {
  id: string;
  company_name: string;
  created_at: string;
}

export function SWOTView({
  c: _c, company, competitors, ta, smm, userId, autoGenerating,
}: {
  c: Colors;
  company: AnalysisResult | null;
  competitors: AnalysisResult[];
  ta: TAResult | null;
  smm: SMMResult | null;
  userId?: string;
  /** true, пока AppShell фоном авто-считает SWOT сразу после анализа компании
   *  (см. runSwotInBackground в AppShell.tsx). */
  autoGenerating?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ── Persistence: текущий рабочий SWOT-анализ сохраняется в localStorage
  // и подтягивается при следующем возврате на view. История отчётов
  // отдельная (DB). Это решает баг «сгенерировал SWOT, ушёл, вернулся —
  // пусто».
  const swotStateKey = userId ? `mr_swot_${userId}` : "mr_swot_anon";
  // Не используем lazy useState init — он читает localStorage один раз
  // с КЛЮЧОМ ВРЕМЕНИ МАУНТА (часто mr_swot_anon если userId ещё грузится),
  // а потом данные сохраняются в mr_swot_<userId>. В итоге был баг:
  // «генерируешь → уходишь → возвращаешься → пусто».
  const [report, setReport] = useState<SwotReport | null>(null);
  const [history, setHistory] = useState<StoredReport[]>([]);

  // Перечитываем localStorage каждый раз когда меняется swotStateKey
  // (т.е. когда userId загружается из бутстрапа). Это решает баг
  // с пропажей SWOT после генерации/перехода.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(swotStateKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SwotReport;
        setReport(parsed);
      }
    } catch { /* ignore */ }
  }, [swotStateKey]);

  // Сохраняем рабочий анализ при каждом обновлении report.
  // ВАЖНО: removeItem НЕ делаем — раньше при null'е затирали key,
  // и если userId менялся при mount'е, мы стирали реальные данные
  // в старом ключе. Теперь null просто оставляет старую запись —
  // её перезапишет следующая успешная генерация.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!report) return;
    try {
      localStorage.setItem(swotStateKey, JSON.stringify(report));
    } catch { /* ignore quota */ }
  }, [report, swotStateKey]);
  const [expandedSection, setExpandedSection] = useState<keyof SwotItems | null>(null);
  // TOWS-матрица — генерируется отдельно по уже готовому SWOT.
  // Persist в localStorage скоупом по report.id чтобы при смене вкладки
  // TOWS не терялся (та же логика что для SWOT отчёта).
  const towsStateKey = userId ? `mr_tows_${userId}` : "mr_tows_anon";
  const [tows, setTows] = useState<TowsMatrix | null>(null);
  const [towsLoading, setTowsLoading] = useState(false);
  const [towsError, setTowsError] = useState<string | null>(null);

  // При смене swot-отчёта подгружаем сохранённый TOWS если он от этого же отчёта.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!report?.id) { setTows(null); return; }
    try {
      const raw = localStorage.getItem(towsStateKey);
      if (!raw) { setTows(null); return; }
      const stored = JSON.parse(raw) as { reportId: string; tows: TowsMatrix };
      // TOWS сохраняется привязанным к id SWOT-отчёта. Если SWOT
      // перегенерировали — TOWS старого отчёта не показываем.
      setTows(stored.reportId === report.id ? stored.tows : null);
    } catch { setTows(null); }
  }, [report?.id, towsStateKey]);

  const handleGenerateTows = async () => {
    if (!report) return;
    setTowsLoading(true);
    setTowsError(null);
    try {
      const res = await fetch("/api/generate-tows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: report.rawItems,
          companyName: report.companyName,
        }),
      });
      const json = await jsonOrThrow(res);
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      const generatedTows = json.tows as TowsMatrix;
      setTows(generatedTows);
      // Сохраняем TOWS привязанным к текущему swot-отчёту
      try {
        localStorage.setItem(towsStateKey, JSON.stringify({ reportId: report.id, tows: generatedTows }));
      } catch { /* quota */ }
    } catch (e) {
      setTowsError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTowsLoading(false);
    }
  };

  // Загружаем список прошлых отчётов
  useEffect(() => {
    fetch("/api/generate-swot", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok && Array.isArray(d.reports)) setHistory(d.reports); })
      .catch(() => {});
  }, [report]);

  // Когда AppShell фоном авто-считает SWOT сразу после анализа компании —
  // при переходе autoGenerating true → false перечитываем localStorage,
  // чтобы отчёт появился без ручного клика на «Сгенерировать».
  const prevAutoGeneratingRef = React.useRef(autoGenerating);
  useEffect(() => {
    if (prevAutoGeneratingRef.current && !autoGenerating) {
      try {
        const raw = localStorage.getItem(swotStateKey);
        if (raw) setReport(JSON.parse(raw) as SwotReport);
      } catch { /* ignore */ }
    }
    prevAutoGeneratingRef.current = autoGenerating;
  }, [autoGenerating, swotStateKey]);

  const canGenerate = !!company && !generating && !autoGenerating;

  // Загрузить прошлый отчёт обратно в интерактивный вид (не только PDF).
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const handleLoadReport = async (id: string) => {
    setLoadingReportId(id);
    setError(null);
    try {
      const res = await fetch(`/api/swot/${id}`, { cache: "no-store" });
      const json = await jsonOrThrow(res);
      if (!json.ok) throw new Error(json.error ?? "Не удалось загрузить отчёт");
      setReport(json.data as SwotReport);
      // Скроллим вверх к загруженному отчёту
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки отчёта");
    } finally {
      setLoadingReportId(null);
    }
  };

  const handleGenerate = async () => {
    if (!company) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-swot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, competitors, ta, smm }),
      });
      const json = await jsonOrThrow(res);
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");
      setReport(json.data as SwotReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  const QUADRANTS: Array<{
    key: keyof SwotItems;
    label: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
    helper: string;
  }> = [
    { key: "strengths",    label: "Сильные стороны",  color: "#16a34a", bg: "#16a34a14", icon: <Shield size={20}/>,         helper: "Что даёт нам преимущество прямо сейчас" },
    { key: "weaknesses",   label: "Слабые стороны",   color: "#dc2626", bg: "#dc262614", icon: <AlertTriangle size={20}/>,  helper: "Что тормозит развитие" },
    { key: "opportunities",label: "Возможности",      color: "#6366f1", bg: "#6366f114", icon: <Sparkles size={20}/>,       helper: "Куда стоит расти в ближайшее время" },
    { key: "threats",      label: "Угрозы",           color: "#f59e0b", bg: "#f59e0b14", icon: <Zap size={20}/>,            helper: "Что может ударить, к чему готовиться" },
  ];

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 12, letterSpacing: -0.5 }}>
          <Grid3x3 size={26} /> SWOT-анализ
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
          Стратегическая оценка бизнеса по 4 квадрантам — Сильные стороны, Слабые стороны,
          Возможности и Угрозы. AI делает разбор на основе результатов всех ваших
          анализов и пишет executive-отчёт с разделами и заключением.
        </p>
      </div>

      {/* Block: Action panel */}
      {!report && (
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          padding: 28,
          marginBottom: 24,
          boxShadow: "var(--shadow)",
        }}>
          {!company ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>📊</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "var(--foreground)" }}>
                Нужен анализ компании
              </div>
              <div style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.55, maxWidth: 480, margin: "0 auto 22px" }}>
                SWOT собирается на основе данных «Моей компании», конкурентов, ЦА и СММ. Сначала запустите хотя бы анализ компании.
              </div>
              <a href={hrefForNav("new-analysis")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Запустить анализ →
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                  Источники для анализа
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 4 }}>{company.company.name}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SourceChip ok label={`Компания (балл ${company.company.score})`} />
                  <SourceChip ok={competitors.length > 0} label={`${competitors.length} конкурентов`} />
                  <SourceChip ok={!!ta} label="Целевая аудитория" />
                  <SourceChip ok={!!smm} label="СММ-стратегия" />
                </div>
              </div>
              <div>
                {autoGenerating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: "var(--muted-foreground)" }}>
                    <RefreshCw size={14} className="mr-spin" style={{ color: "var(--primary)" }} />
                    Считается в фоне после анализа компании…
                  </div>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{
                    padding: "14px 26px",
                    borderRadius: 12,
                    border: "none",
                    background: canGenerate ? "var(--primary)" : "var(--muted)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: canGenerate ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 48,
                    boxShadow: canGenerate ? "0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)" : "none",
                  }}>
                  {generating
                    ? <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }}/> Анализирую (60-90 сек)…</>
                    : <><Sparkles size={17}/> Сгенерировать SWOT</>}
                </button>
              </div>
            </div>
          )}
          {/* Skeleton during generation — показывает структуру отчёта пока Claude думает */}
          {generating && (
            <div style={{ marginTop: 24 }}>
              <style>{`
                @keyframes swot-shimmer {
                  0% { background-position: -1000px 0; }
                  100% { background-position: 1000px 0; }
                }
                .swot-skel {
                  background: linear-gradient(90deg,
                    color-mix(in oklch, var(--muted) 60%, transparent) 0%,
                    color-mix(in oklch, var(--muted) 30%, transparent) 50%,
                    color-mix(in oklch, var(--muted) 60%, transparent) 100%);
                  background-size: 1000px 100%;
                  animation: swot-shimmer 2s infinite linear;
                  border-radius: 8px;
                }
              `}</style>

              {/* Status banner */}
              <div style={{
                marginBottom: 20, padding: "16px 20px",
                background: "color-mix(in oklch, var(--primary) 8%, var(--card))",
                border: "1.5px solid color-mix(in oklch, var(--primary) 35%, var(--border))",
                borderRadius: 12,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
                    Анализируем ваш бизнес
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    Шаг 1/3: Извлекаю SWOT-пункты → Шаг 2/3: Пишу 4 раздела параллельно → Шаг 3/3: Введение и заключение. Всего 60-90 секунд.
                  </div>
                </div>
              </div>

              {/* 4 quadrant skeletons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "start" }}>
                {[
                  { color: "#16a34a", label: "Сильные стороны" },
                  { color: "#dc2626", label: "Слабые стороны" },
                  { color: "#6366f1", label: "Возможности" },
                  { color: "#f59e0b", label: "Угрозы" },
                ].map((q) => (
                  <div key={q.label} style={{
                    background: "var(--card)",
                    border: `2px solid ${q.color}30`,
                    borderRadius: 16, padding: 22,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${q.color}20` }}/>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: q.color, lineHeight: 1.2 }}>{q.label}</div>
                        <div className="swot-skel" style={{ width: 140, height: 12, marginTop: 6 }} />
                      </div>
                    </div>
                    <div className="swot-skel" style={{ height: 14, marginBottom: 10 }} />
                    <div className="swot-skel" style={{ height: 14, width: "85%", marginBottom: 10 }} />
                    <div className="swot-skel" style={{ height: 14, width: "70%", marginBottom: 10 }} />
                    <div className="swot-skel" style={{ height: 14, width: "92%", marginBottom: 10 }} />
                    <div className="swot-skel" style={{ height: 14, width: "80%" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", color: "var(--destructive)", fontSize: 14 }}>
              ❌ {error}
            </div>
          )}
        </div>
      )}

      {/* Result: 4 quadrants + actions */}
      {report && (
        <>
          {/* Top actions */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            padding: "14px 18px", marginBottom: 18,
            background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)",
          }}>
            <div style={{ flex: 1, fontSize: 14, color: "var(--foreground-secondary)" }}>
              <strong style={{ color: "var(--foreground)" }}>{report.companyName}</strong>
              {" "}· сгенерировано {new Date(report.generatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <a
              href={`/api/swot/${report.id}/pdf?view=1`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border)", color: "var(--foreground-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={14}/> Открыть отчёт
            </a>
            <a
              href={`/api/swot/${report.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "9px 14px", borderRadius: 9, border: "none", background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileDown size={14}/> PDF
            </a>
            <button
              onClick={() => {
                setReport(null);
                setError(null);
                // Явно стираем сохранённый кэш, чтобы при следующем заходе
                // на view не подтянулся старый отчёт.
                try { localStorage.removeItem(swotStateKey); } catch { /* ignore */ }
              }}
              style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14}/> Перегенерировать
            </button>
          </div>

          {/* «Шахматку» (компактный 2×2) убрали — она дублировала основные
              карточки ниже. Пользователь сразу видит карточки с подзаголовками
              типа «Что даёт нам преимущество прямо сейчас», что понятнее. */}

          {/* 2×2 quadrant grid — фиксированно 2 колонки на десктопе, 1 на мобиле */}
          <div className="swot-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            alignItems: "start",          // каждая карточка независимой высоты
            gap: 16,
            marginBottom: 24,
          }}>
            <style>{`
              @media (max-width: 720px) {
                .swot-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
            {QUADRANTS.map(q => {
              const items = report.rawItems[q.key];
              const expanded = expandedSection === q.key;
              const section = report[q.key];
              const hasDetails = section.subsections.length > 0;
              return (
                <div key={q.key} style={{
                  background: "var(--card)",
                  border: `2px solid ${q.color}40`,
                  borderRadius: 16,
                  padding: 22,
                  boxShadow: "var(--shadow)",
                  // плавный rise при раскрытии
                  transition: "border-color 200ms ease",
                  ...(expanded ? { borderColor: q.color } : {}),
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: q.bg, color: q.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {q.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: q.color, lineHeight: 1.2 }}>{q.label}</div>
                      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{q.helper}</div>
                    </div>
                  </div>

                  {/* Compact items list — показываем всегда */}
                  {items.length > 0 ? (
                    <ul style={{
                      margin: 0, paddingLeft: 20, fontSize: 14,
                      color: "var(--foreground)", lineHeight: 1.55,
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      {items.slice(0, expanded ? items.length : 5).map((it, i) => <li key={i}>{it}</li>)}
                      {!expanded && items.length > 5 && (
                        <li style={{ color: "var(--muted-foreground)" }}>+ {items.length - 5} ещё</li>
                      )}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      По этой категории пунктов не выявлено.
                    </div>
                  )}

                  {/* Toggle button */}
                  {hasDetails && (
                    <button
                      onClick={() => setExpandedSection(expanded ? null : q.key)}
                      style={{
                        marginTop: 16, padding: "10px 14px", borderRadius: 9,
                        border: `1.5px solid ${q.color}40`,
                        background: expanded ? q.bg : "transparent",
                        color: q.color, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                        transition: "background 150ms ease",
                      }}>
                      {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      {expanded ? "Скрыть детали" : "Показать детали"}
                    </button>
                  )}

                  {/* Inline detailed section — появляется ВНУТРИ карточки, под кнопкой */}
                  {expanded && hasDetails && (
                    <div style={{
                      marginTop: 18,
                      paddingTop: 18,
                      borderTop: `2px dashed ${q.color}33`,
                      animation: "swot-expand 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both",
                    }}>
                      <style>{`
                        @keyframes swot-expand {
                          from { opacity: 0; transform: translateY(-6px); }
                          to   { opacity: 1; transform: translateY(0); }
                        }
                      `}</style>
                      {section.intro && (
                        <p style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.65, margin: "0 0 14px" }}>
                          {section.intro}
                        </p>
                      )}
                      {section.subsections.map((sub, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: q.color, marginBottom: 6, lineHeight: 1.3 }}>
                            {sub.title}
                          </div>
                          {sub.paragraphs.map((p, j) => (
                            <p key={j} style={{ fontSize: 13.5, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: "0 0 8px" }}>
                              {p}
                            </p>
                          ))}
                        </div>
                      ))}
                      {section.synthesis && (
                        <div style={{
                          marginTop: 14, padding: "12px 14px", borderRadius: 10,
                          background: q.bg, borderLeft: `4px solid ${q.color}`,
                          fontSize: 13.5, fontStyle: "italic",
                          color: "var(--foreground)", lineHeight: 1.6,
                        }}>
                          {section.synthesis}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── TOWS-матрица (стратегии пересечения) ─────────────────── */}
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 10 }}>
                  <Crosshair size={20} style={{ color: "var(--primary)" }} />
                  TOWS-матрица стратегий
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.55, maxWidth: 720 }}>
                  Пересечение S/W с O/T даёт 4 типа стратегий: SO (атака), ST (защита силой), WO (рост через окно), WT (оборона). По каждой — конкретное действие на 30-60 дней.
                </p>
              </div>
              {!tows && (
                <button
                  onClick={handleGenerateTows}
                  disabled={towsLoading}
                  style={{
                    background: "var(--primary)", color: "#fff", border: "none",
                    borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 700,
                    cursor: towsLoading ? "wait" : "pointer", opacity: towsLoading ? 0.6 : 1,
                    display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit",
                    boxShadow: "0 2px 12px rgba(124,58,237,0.25)",
                  }}
                >
                  {towsLoading ? <Loader2 size={15} className="mr-spin" /> : <Sparkles size={15} />}
                  {towsLoading ? "Генерирую…" : "Сгенерировать TOWS"}
                </button>
              )}
              {tows && (
                <button
                  onClick={handleGenerateTows}
                  disabled={towsLoading}
                  style={{
                    background: "transparent", color: "var(--foreground-secondary)",
                    border: "1px solid var(--border)", borderRadius: 10,
                    padding: "10px 18px", fontSize: 13, fontWeight: 600,
                    cursor: towsLoading ? "wait" : "pointer", opacity: towsLoading ? 0.6 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}
                >
                  <RefreshCw size={13} className={towsLoading ? "mr-spin" : ""} />
                  Перегенерировать
                </button>
              )}
            </div>

            {towsError && (
              <div style={{ background: "color-mix(in oklch, var(--destructive) 10%, transparent)", border: "1px solid color-mix(in oklch, var(--destructive) 30%, transparent)", color: "var(--destructive)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
                {towsError}
              </div>
            )}

            {tows && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <TowsQuadrantCard q={tows.so} label="SO" labelRu="MAXI-MAXI · Атака" color="#16a34a" subtitle="Силы × Возможности" />
                  <TowsQuadrantCard q={tows.st} label="ST" labelRu="MAXI-MINI · Защита силой" color="#0ea5e9" subtitle="Силы × Угрозы" />
                  <TowsQuadrantCard q={tows.wo} label="WO" labelRu="MINI-MAXI · Рост через окно" color="#f59e0b" subtitle="Слабости × Возможности" />
                  <TowsQuadrantCard q={tows.wt} label="WT" labelRu="MINI-MINI · Оборона" color="#ef4444" subtitle="Слабости × Угрозы" />
                </div>
                {tows.synthesis && (
                  <div style={{ marginTop: 18, padding: "16px 20px", borderRadius: 12, background: "color-mix(in oklch, var(--primary) 7%, transparent)", border: "1px solid color-mix(in oklch, var(--primary) 25%, transparent)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                      Стратегический синтез
                    </div>
                    <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.65 }}>
                      {tows.synthesis}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Блок «Введение / Заключение» убран — был непонятен по назначению
              (повтор воды). Если нужно полное эссе — оно в HTML/PDF-экспорте. */}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", marginBottom: 12 }}>Прошлые отчёты</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map(h => (
              <div key={h.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 10, background: "var(--card)",
                border: "1px solid var(--border)", fontSize: 14,
              }}>
                <div>
                  <strong style={{ color: "var(--foreground)" }}>{h.company_name}</strong>
                  {" "}<span style={{ color: "var(--muted-foreground)" }}>· {new Date(h.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleLoadReport(h.id)}
                    disabled={loadingReportId === h.id}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: loadingReportId === h.id ? "wait" : "pointer" }}
                  >
                    {loadingReportId === h.id ? "Загрузка…" : "Открыть в интерфейсе"}
                  </button>
                  <a href={`/api/swot/${h.id}/pdf?view=1`} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    HTML
                  </a>
                  <a href={`/api/swot/${h.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 8, background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 11px", borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: ok ? "color-mix(in oklch, #16a34a 14%, transparent)" : "var(--background)",
      color: ok ? "#16a34a" : "var(--muted-foreground)",
      border: `1px solid ${ok ? "#16a34a40" : "var(--border)"}`,
    }}>
      <span>{ok ? "✓" : "—"}</span> {label}
    </span>
  );
}

// DetailedSection удалён: детали теперь рендерятся inline внутри каждой
// quadrant-карточки (см. swot-grid выше). Так пользователь видит детали
// прямо под кнопкой «Показать детали», не теряя контекст.

// ─── TOWS quadrant card ────────────────────────────────────────────
function TowsQuadrantCard({ q, label, labelRu, color, subtitle }: {
  q: TowsQuadrant;
  label: string;
  labelRu: string;
  color: string;
  subtitle: string;
}) {
  if (!q || !q.strategies?.length) return null;
  return (
    <div style={{
      background: "var(--card)", border: `1px solid ${color}30`,
      borderTop: `4px solid ${color}`, borderRadius: 14, padding: 18,
      boxShadow: `0 2px 12px ${color}10`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 18, fontWeight: 900, color, letterSpacing: -0.5,
        }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>{labelRu}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.04em" }}>{subtitle}</div>
      {q.strategy && (
        <div style={{ fontSize: 13.5, color: "var(--foreground)", fontStyle: "italic", lineHeight: 1.55, marginBottom: 14, paddingBottom: 12, borderBottom: "1px dashed var(--border)" }}>
          {q.strategy}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {q.strategies.map((s, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 10,
            background: `${color}08`, border: `1px solid ${color}20`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.3 }}>{s.title}</div>
              {typeof s.priority === "number" && s.priority <= 5 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, color,
                  background: `${color}25`, borderRadius: 6, padding: "2px 7px",
                  whiteSpace: "nowrap", letterSpacing: "0.05em",
                }}>
                  P{s.priority}
                </span>
              )}
            </div>
            {(s.fromInternal?.length ?? 0) > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 4, lineHeight: 1.5 }}>
                <b style={{ color }}>{label[0] === "S" ? "S:" : "W:"}</b>{" "}
                {s.fromInternal.join(" · ")}
              </div>
            )}
            {(s.fromExternal?.length ?? 0) > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.5 }}>
                <b style={{ color }}>{label[1] === "O" ? "O:" : "T:"}</b>{" "}
                {s.fromExternal.join(" · ")}
              </div>
            )}
            {s.action && (
              <div style={{
                fontSize: 13, color: "var(--foreground)", lineHeight: 1.55,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <Target size={13} style={{ color, flexShrink: 0, marginTop: 3 }} />
                <span>{s.action}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
