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
} from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { SwotReport, SwotItems } from "@/lib/swot";

interface StoredReport {
  id: string;
  company_name: string;
  created_at: string;
}

export function SWOTView({
  c: _c, company, competitors, ta, smm,
}: {
  c: Colors;
  company: AnalysisResult | null;
  competitors: AnalysisResult[];
  ta: TAResult | null;
  smm: SMMResult | null;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SwotReport | null>(null);
  const [history, setHistory] = useState<StoredReport[]>([]);
  const [expandedSection, setExpandedSection] = useState<keyof SwotItems | null>(null);

  // Загружаем список прошлых отчётов
  useEffect(() => {
    fetch("/api/generate-swot", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok && Array.isArray(d.reports)) setHistory(d.reports); })
      .catch(() => {});
  }, [report]);

  const canGenerate = !!company && !generating;

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
      const json = await res.json();
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
          Возможности и Угрозы. Claude Sonnet делает разбор на основе результатов всех ваших
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
              <a href="/?nav=new-analysis" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
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
              onClick={() => { setReport(null); setError(null); }}
              style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14}/> Перегенерировать
            </button>
          </div>

          {/* 2×2 quadrant grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 24 }}>
            {QUADRANTS.map(q => {
              const items = report.rawItems[q.key];
              const expanded = expandedSection === q.key;
              const section = report[q.key];
              return (
                <div key={q.key} style={{
                  background: "var(--card)",
                  border: `2px solid ${q.color}40`,
                  borderRadius: 16,
                  padding: 22,
                  boxShadow: "var(--shadow)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: q.bg, color: q.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {q.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: q.color, lineHeight: 1.2 }}>{q.label}</div>
                      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{q.helper}</div>
                    </div>
                  </div>

                  {items.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--foreground)", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.slice(0, 5).map((it, i) => <li key={i}>{it}</li>)}
                      {items.length > 5 && <li style={{ color: "var(--muted-foreground)" }}>+ {items.length - 5} ещё</li>}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      По этой категории пунктов не выявлено.
                    </div>
                  )}

                  {section.subsections.length > 0 && (
                    <button
                      onClick={() => setExpandedSection(expanded ? null : q.key)}
                      style={{
                        marginTop: 14, padding: "8px 12px", borderRadius: 8,
                        border: `1px solid ${q.color}40`,
                        background: expanded ? q.bg : "transparent",
                        color: q.color, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                      {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      {expanded ? "Скрыть детали" : "Показать детали"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded section detail */}
          {expandedSection && (
            <DetailedSection section={report[expandedSection]} color={QUADRANTS.find(q => q.key === expandedSection)!.color} />
          )}

          {/* Intro / Conclusion preview */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 12 }}>Введение</div>
              <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {report.introduction.slice(0, 480)}{report.introduction.length > 480 && "…"}
              </div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 12 }}>Заключение</div>
              <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {report.conclusion.slice(0, 480)}{report.conclusion.length > 480 && "…"}
              </div>
            </div>
          </div>
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
                  <a href={`/api/swot/${h.id}/pdf?view=1`} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    Открыть
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

function DetailedSection({ section, color }: { section: SwotReport["strengths"]; color: string }) {
  return (
    <div style={{
      background: "var(--card)",
      border: `1.5px solid ${color}40`,
      borderLeft: `6px solid ${color}`,
      borderRadius: 14,
      padding: 28,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 16, letterSpacing: -0.5 }}>{section.title}</div>
      {section.intro && (
        <div style={{ fontSize: 15, color: "var(--foreground)", lineHeight: 1.65, marginBottom: 20 }}>
          {section.intro}
        </div>
      )}
      {section.subsections.map((sub, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>{sub.title}</div>
          {sub.paragraphs.map((p, j) => (
            <p key={j} style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: "0 0 10px" }}>{p}</p>
          ))}
        </div>
      ))}
      {section.synthesis && (
        <div style={{
          padding: 18,
          marginTop: 16,
          borderRadius: 10,
          background: `${color}0c`,
          borderLeft: `4px solid ${color}`,
          fontSize: 14,
          fontStyle: "italic",
          color: "var(--foreground)",
          lineHeight: 1.65,
        }}>
          {section.synthesis}
        </div>
      )}
    </div>
  );
}
