"use client";

import React, { useState, useCallback } from "react";
import {
  Eye, Sparkles, Search, TrendingUp, Globe, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, X, BarChart3, Users, Zap, Target, Info,
  ClipboardList, Bot, Activity, History, Plus,
} from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type {
  AIVisibilityAudit,
  AIMention,
  LLMName,
  SiteReadinessItem,
  AIRecommendation,
} from "@/lib/ai-visibility-types";

interface Props {
  c: Colors;
  myCompany: AnalysisResult | null;
}

// ─── constants ────────────────────────────────────────────────────────────────
const NICHES = [
  "Маркетинговое агентство",
  "IT / SaaS / Разработка ПО",
  "Юридические услуги",
  "Медицина / Клиники",
  "Образование / Онлайн-курсы",
  "Финансы / Бухгалтерия",
  "Строительство / Ремонт",
  "Ресторан / Общепит",
  "Интернет-магазин / E-commerce",
  "Недвижимость",
  "Красота / Wellness",
  "Логистика / Доставка",
  "Другое",
];

const LLM_META: Record<LLMName, { label: string; color: string; bg: string; realApi: boolean }> = {
  yandex:     { label: "YandexGPT",  color: "#ef4444", bg: "#ef444415", realApi: false },
  claude:     { label: "Claude",     color: "#d97706", bg: "#d9770615", realApi: true  },
  chatgpt:    { label: "ChatGPT",    color: "#10b981", bg: "#10b98115", realApi: true  },
  perplexity: { label: "Perplexity", color: "#8b5cf6", bg: "#8b5cf615", realApi: false },
  gemini:     { label: "Gemini",     color: "#4285f4", bg: "#4285f415", realApi: false },
};

// Веса: российский YandexGPT важен для РФ-рынка; Claude и ChatGPT — глобальные.
const LLM_WEIGHTS: Record<LLMName, number> = {
  yandex:     0.30,
  claude:     0.25,
  chatgpt:    0.25,
  perplexity: 0.10,
  gemini:     0.10,
};

function calcScoreForLLM(mentions: AIMention[], llm: LLMName): number {
  const llmMentions = mentions.filter(m => m.llm === llm);
  if (!llmMentions.length) return 0;
  const mentioned = llmMentions.filter(m => m.mentioned);
  const mentionRate = mentioned.length / llmMentions.length;
  const avgPos = mentioned.length
    ? mentioned.reduce((s, m) => s + (m.position ?? 5), 0) / mentioned.length : 0;
  const posScore = avgPos > 0 ? Math.max(0, 1 - (avgPos - 1) / 10) : 0;
  const sentimentScore = mentioned.length
    ? mentioned.filter(m => m.sentiment === "positive").length / mentioned.length : 0;
  return Math.round(mentionRate * 70 + posScore * 20 + sentimentScore * 10);
}

function calcTotalScore(mentions: AIMention[]): { total: number; byLlm: Record<LLMName, number> } {
  const llms: LLMName[] = ["yandex", "claude", "chatgpt", "perplexity", "gemini"];
  const byLlm = {} as Record<LLMName, number>;
  let total = 0;
  for (const llm of llms) {
    byLlm[llm] = calcScoreForLLM(mentions, llm);
    total += byLlm[llm] * LLM_WEIGHTS[llm];
  }
  return { total: Math.round(total), byLlm };
}

function extractTopCompetitors(mentions: AIMention[]): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const m of mentions)
    for (const c of m.competitorsMentioned)
      counts[c] = (counts[c] ?? 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => ({ name, count }));
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

// ─── ScoreCircle ─────────────────────────────────────────────────────────────
function ScoreCircle({ score, size = 130 }: { score: number; size?: number }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted)" strokeWidth={11} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={11}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.24} fontWeight="800" fill={color}>{score}</text>
      <text x={size/2} y={size/2 + size*0.19} textAnchor="middle"
        fontSize={size * 0.1} fill="var(--muted-foreground)">/100</text>
    </svg>
  );
}

// ─── ProgressStages ──────────────────────────────────────────────────────────
type Stage = { id: string; label: string; done: boolean; active: boolean };

function ProgressStages({ stages }: { stages: Stage[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {stages.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: s.done ? "#22c55e" : s.active ? "var(--primary)" : "var(--muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.3s",
          }}>
            {s.done
              ? <CheckCircle2 size={16} color="#fff" />
              : s.active
                ? <Activity size={14} color="#fff" />
                : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--muted-foreground)" }} />}
          </div>
          <span style={{
            fontSize: 14, fontWeight: s.active ? 700 : 400,
            color: s.done ? "var(--foreground)" : s.active ? "var(--primary)" : "var(--muted-foreground)",
          }}>{s.label}</span>
          {s.active && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 6,
              background: "var(--primary)20", color: "var(--primary)", fontWeight: 700,
            }}>в процессе...</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 24, boxShadow: "var(--shadow)", ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: "var(--primary)15",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--primary)",
      }}>{icon}</div>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>{title}</h2>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function AIVisibilityView({ c, myCompany }: Props) {
  // Load the most recent completed audit from localStorage on mount
  const loadSavedAudits = (): AIVisibilityAudit[] => {
    try {
      return JSON.parse(localStorage.getItem("mr_ai_visibility_audits") ?? "[]");
    } catch { return []; }
  };

  const lastAudit = loadSavedAudits()[0] ?? null;
  const [view, setView] = useState<"form" | "progress" | "report" | "history">(
    lastAudit?.status === "done" ? "report" : "form"
  );
  const [audit, setAudit] = useState<AIVisibilityAudit | null>(lastAudit);
  const [savedAudits, setSavedAudits] = useState<AIVisibilityAudit[]>(() => loadSavedAudits());

  // Form
  const [brandName, setBrandName] = useState(myCompany?.company.name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(myCompany?.company.url ?? "");
  const [niche, setNiche] = useState("");
  const [nicheCustom, setNicheCustom] = useState("");
  const [region, setRegion] = useState("Россия");
  const [queries, setQueries] = useState<string[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Progress
  const [stages, setStages] = useState<Stage[]>([]);
  const [progressError, setProgressError] = useState("");

  // Report
  const [modalMention, setModalMention] = useState<AIMention | null>(null);
  const [openRec, setOpenRec] = useState<number | null>(null);

  const effectiveNiche = niche === "Другое" ? nicheCustom : niche;
  const llms: LLMName[] = ["yandex", "claude", "chatgpt", "perplexity", "gemini"];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
    border: "1px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 14, outline: "none",
  };

  // ── generate queries ────────────────────────────────────────────────────────
  const generateQueries = useCallback(async () => {
    if (!brandName || !effectiveNiche) { setFormError("Укажите название бренда и нишу"); return; }
    setQueriesLoading(true); setFormError("");
    try {
      const res = await fetch("/api/ai-visibility/generate-queries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, niche: effectiveNiche, region }),
      });
      const json = await res.json();
      if (json.ok) setQueries(json.queries);
    } catch { /* ignore */ }
    finally { setQueriesLoading(false); }
  }, [brandName, effectiveNiche, region]);

  // ── run audit ──────────────────────────────────────────────────────────────
  const runAudit = useCallback(async () => {
    if (!brandName || !websiteUrl || !effectiveNiche) { setFormError("Заполните все обязательные поля"); return; }
    if (!queries.length) { setFormError("Сгенерируйте или добавьте запросы"); return; }

    const id = crypto.randomUUID();
    const newAudit: AIVisibilityAudit = {
      id, createdAt: new Date().toISOString(), status: "running",
      brandName, websiteUrl, niche: effectiveNiche, region, queries,
    };
    setAudit(newAudit);

    const stageOrder = ["queries", "yandex", "claude", "chatgpt", "perplexity", "gemini", "site", "recs"];
    const stageLabels: Record<string, string> = {
      queries: "Подготовка запросов", yandex: "Опрос YandexGPT",
      claude: "Опрос Claude", chatgpt: "Опрос ChatGPT",
      perplexity: "Опрос Perplexity", gemini: "Опрос Gemini",
      site: "Анализ AI-готовности сайта",
      recs: "Формирование рекомендаций",
    };

    const buildStages = (doneUpTo: string, activeId: string): Stage[] =>
      stageOrder.map(id => ({
        id, label: stageLabels[id],
        done: stageOrder.indexOf(id) < stageOrder.indexOf(activeId) || id === doneUpTo,
        active: id === activeId,
      }));

    setView("progress"); setProgressError("");
    setStages(buildStages("queries", "yandex"));

    const allMentions: AIMention[] = [];
    try {
      for (const llm of llms) {
        setStages(buildStages(llms[llms.indexOf(llm) - 1] ?? "queries", llm));
        const res = await fetch("/api/ai-visibility/check-llm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ llm, queries, brandName, niche: effectiveNiche }),
        });
        const json = await res.json();
        if (json.ok) allMentions.push(...json.mentions);
      }

      setStages(buildStages("gemini", "site"));
      let siteItems: SiteReadinessItem[] = [];
      try {
        const sr = await fetch("/api/ai-visibility/check-site", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl }),
        });
        const sj = await sr.json();
        if (sj.ok) siteItems = sj.items;
      } catch { /* ignore */ }

      const { total, byLlm } = calcTotalScore(allMentions);
      const topCompetitors = extractTopCompetitors(allMentions);

      setStages(buildStages("site", "recs"));
      let recommendations: AIRecommendation[] = [];
      try {
        const rr = await fetch("/api/ai-visibility/generate-recommendations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandName, niche: effectiveNiche, mentions: allMentions, siteReadiness: siteItems, totalScore: total }),
        });
        const rj = await rr.json();
        if (rj.ok) recommendations = rj.recommendations;
      } catch { /* ignore */ }

      setStages(stageOrder.map(id => ({ id, label: stageLabels[id], done: true, active: false })));

      const completed: AIVisibilityAudit = {
        ...newAudit, status: "done", completedAt: new Date().toISOString(),
        totalScore: total, scoresByLlm: byLlm, mentions: allMentions,
        siteReadiness: siteItems, recommendations, topCompetitors,
      };
      setAudit(completed);
      try {
        const saved: AIVisibilityAudit[] = JSON.parse(localStorage.getItem("mr_ai_visibility_audits") ?? "[]");
        saved.unshift(completed);
        const trimmed = saved.slice(0, 10);
        localStorage.setItem("mr_ai_visibility_audits", JSON.stringify(trimmed));
        setSavedAudits(trimmed);
      } catch { /* ignore */ }
      setView("report");
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Ошибка аудита");
      setAudit(a => a ? { ...a, status: "failed" } : null);
    }
  }, [brandName, websiteUrl, effectiveNiche, region, queries]);

  // ─── FORM ────────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, var(--primary), #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Eye size={26} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>AI Видимость</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              GEO-аудит: честная проверка — знают ли вас ChatGPT, Claude, YandexGPT, Perplexity, Gemini
            </p>
          </div>
          {savedAudits.length > 0 && (
            <button onClick={() => { setAudit(savedAudits[0]); setView("report"); }} style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)",
              background: "transparent", color: "var(--foreground-secondary)", cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <History size={14} /> Последний отчёт
            </button>
          )}
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          {/* Left: Form */}
          <Card>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 22px", color: "var(--foreground)" }}>
              Запустить AI-аудит
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                    Название бренда *
                  </label>
                  <input value={brandName} onChange={e => setBrandName(e.target.value)}
                    placeholder="MarketRadar" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                    URL сайта *
                  </label>
                  <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://marketradar24.ru" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                    Ниша / отрасль *
                  </label>
                  <select value={niche} onChange={e => setNiche(e.target.value)} style={inputStyle}>
                    <option value="">— выберите —</option>
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {niche === "Другое" && (
                    <input value={nicheCustom} onChange={e => setNicheCustom(e.target.value)}
                      placeholder="Укажите нишу" style={{ ...inputStyle, marginTop: 8 }} />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                    Регион
                  </label>
                  <input value={region} onChange={e => setRegion(e.target.value)}
                    placeholder="Россия" style={inputStyle} />
                </div>
              </div>

              {/* Queries */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                    Ключевые запросы клиентов
                  </label>
                  <button onClick={generateQueries} disabled={queriesLoading || !brandName || !effectiveNiche}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700,
                      opacity: queriesLoading ? 0.7 : 1,
                    }}>
                    <Sparkles size={13} />
                    {queriesLoading ? "Генерирую…" : "Сгенерировать"}
                  </button>
                </div>

                {queries.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {queries.map((q, i) => (
                      <div key={i} style={{ display: "flex", gap: 6 }}>
                        <input value={q} onChange={e => setQueries(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                          style={{ ...inputStyle, padding: "8px 12px" }} />
                        <button onClick={() => setQueries(prev => prev.filter((_, j) => j !== i))}
                          style={{
                            padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                            background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
                            display: "flex", alignItems: "center",
                          }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setQueries(prev => [...prev, ""])}
                      style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--border)",
                        background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 13,
                      }}>
                      + Добавить запрос
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      padding: "14px 16px", borderRadius: 10, border: "1px dashed var(--border)",
                      display: "flex", alignItems: "center", gap: 10, color: "var(--muted-foreground)",
                    }}>
                      <Search size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                      <p style={{ fontSize: 13, margin: 0, flex: 1 }}>
                        Нажмите «Сгенерировать» или добавьте запросы вручную
                      </p>
                    </div>
                    <button
                      onClick={() => setQueries([""])}
                      style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--border)",
                        background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
                        fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Plus size={14} /> Добавить запрос вручную
                    </button>
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 10,
                background: "#ef444420", color: "#ef4444", fontSize: 13,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertTriangle size={15} /> {formError}
              </div>
            )}

            <button onClick={runAudit}
              disabled={!brandName || !websiteUrl || !effectiveNiche}
              style={{
                marginTop: 22, width: "100%", padding: "14px", borderRadius: 12, border: "none",
                cursor: (!brandName || !websiteUrl || !effectiveNiche) ? "not-allowed" : "pointer",
                fontSize: 16, fontWeight: 800,
                background: (!brandName || !websiteUrl || !effectiveNiche) ? "var(--muted)" : "var(--primary)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
              <Zap size={18} />
              Запустить AI-аудит
            </button>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
              ~2–4 минуты · 5 AI-ассистентов · анализ сайта · честные запросы без биас-подсказок
            </p>
          </Card>

          {/* Right: What & How */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Info size={16} color="var(--primary)" />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Что такое GEO?</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7, margin: 0 }}>
                <b style={{ color: "var(--foreground)" }}>Generative Engine Optimization</b> — оптимизация
                присутствия бренда в ответах AI-ассистентов. До 40% B2B-решений в 2025 году принимаются
                с участием ChatGPT, Яндекс Нейро и GigaChat.
              </p>
            </Card>

            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "var(--foreground)" }}>
                Что проверяем
              </h3>
              {[
                { icon: <Bot size={16} />, title: "5 AI-ассистентов", desc: "YandexGPT, Claude, ChatGPT, Perplexity, Gemini" },
                { icon: <BarChart3 size={16} />, title: "Share of Voice", desc: "Частота упоминаний vs конкуренты" },
                { icon: <Globe size={16} />, title: "AI-готовность сайта", desc: "Schema.org, llms.txt, FAQ, robots.txt" },
                { icon: <Target size={16} />, title: "Рекомендации", desc: "Приоритизированный план улучшений" },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: i < 3 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "var(--primary)15", color: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </Card>

            <Card style={{ background: "var(--primary)08", border: "1px solid var(--primary)30" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Sparkles size={16} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>
                  Запросы идут <b>без подсказок о вашем бренде</b> — только так можно честно измерить
                  реальную AI-видимость. ChatGPT и Claude вызываются напрямую через API.
                  Там, где реальный API недоступен, Claude симулирует ответ — ячейка помечается «симуляция».
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROGRESS ────────────────────────────────────────────────────────────────
  if (view === "progress") {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, var(--primary), #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Eye size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>AI-аудит запущен</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{audit?.brandName} · {audit?.niche}</p>
          </div>
        </div>
        <Card>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>Прогресс проверки</h2>
          <ProgressStages stages={stages} />
          {progressError && (
            <div style={{
              marginTop: 16, padding: "12px 16px", borderRadius: 10,
              background: "#ef444420", color: "#ef4444", fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={15} />
              {progressError}
              <button onClick={() => setView("form")} style={{
                marginLeft: "auto", padding: "4px 12px", borderRadius: 6,
                border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12,
              }}>Назад</button>
            </div>
          )}
          {!progressError && (
            <div style={{
              marginTop: 20, padding: "12px 16px", borderRadius: 10,
              background: "var(--primary)10", border: "1px solid var(--primary)30",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "var(--muted-foreground)",
            }}>
              <Activity size={15} color="var(--primary)" />
              Не закрывайте вкладку — аудит идёт в фоне (~2–4 мин)
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ─── REPORT ──────────────────────────────────────────────────────────────────
  if (view === "report" && audit?.status === "done") {
    const { totalScore = 0, scoresByLlm, mentions = [], siteReadiness = [], recommendations = [], topCompetitors = [] } = audit;
    const uniqueQueries = [...new Set(mentions.map(m => m.query))];

    const priorityMeta = {
      critical:    { icon: <AlertTriangle size={13} />, label: "Критично",      color: "#ef4444" },
      important:   { icon: <TrendingUp size={13} />,   label: "Важно",          color: "#f59e0b" },
      recommended: { icon: <CheckCircle2 size={13} />, label: "Рекомендуется", color: "#22c55e" },
    };

    return (
      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, var(--primary), #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Eye size={26} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
                AI Видимость — {audit.brandName}
              </h1>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                {audit.niche} · {new Date(audit.completedAt!).toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {savedAudits.length > 1 && (
              <button onClick={() => setView("history")} style={{
                padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)",
                background: "transparent", color: "var(--foreground-secondary)", cursor: "pointer", fontSize: 13,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <History size={14} /> История ({savedAudits.length})
              </button>
            )}
            <button onClick={() => { setAudit(null); setView("form"); }} style={{
              padding: "8px 16px", borderRadius: 10, border: "none",
              background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", gap: 6, fontWeight: 700,
            }}>
              <Plus size={14} /> Новый аудит
            </button>
          </div>
        </div>

        {/* Block 1: Score */}
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle icon={<Sparkles size={18} />} title="AI Visibility Score" />
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <ScoreCircle score={totalScore} size={150} />
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Общий балл</div>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, 1fr)" }}>
              {llms.map(llm => {
                const score = scoresByLlm?.[llm] ?? 0;
                const meta = LLM_META[llm];
                return (
                  <div key={llm} style={{
                    padding: 16, borderRadius: 12,
                    border: `1px solid ${meta.color}30`, background: meta.bg,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 8 }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>/100</div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.1)" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${score}%`, background: scoreColor(score),
                        transition: "width 1s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Block 2: Mentions table */}
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle icon={<ClipboardList size={18} />} title="Упоминания в нейросетях" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600 }}>
                    Запрос
                  </th>
                  {llms.map(llm => (
                    <th key={llm} style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", color: LLM_META[llm].color, fontWeight: 700 }}>
                      {LLM_META[llm].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueQueries.map((query, qi) => (
                  <tr key={qi} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--foreground-secondary)", maxWidth: 260 }}>{query}</td>
                    {llms.map(llm => {
                      const m = mentions.find(x => x.llm === llm && x.query === query);
                      if (!m) return <td key={llm} style={{ textAlign: "center", padding: "10px 12px", color: "var(--muted-foreground)" }}>—</td>;
                      return (
                        <td key={llm} style={{ textAlign: "center", padding: "10px 12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <button onClick={() => setModalMention(m)} style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                              background: m.mentioned ? "#22c55e20" : "#ef444420",
                              color: m.mentioned ? "#22c55e" : "#ef4444",
                              fontSize: 12, fontWeight: 700,
                            }}>
                              {m.mentioned
                                ? <><CheckCircle2 size={12} />{m.position ? `#${m.position}` : "упомянут"}</>
                                : <><X size={12} />нет</>}
                            </button>
                            {m.isSimulated && (
                              <span style={{ fontSize: 9, color: "var(--muted-foreground)", background: "var(--muted)", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.03em" }}>
                                симуляция
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <Info size={12} /> Нажмите на ячейку чтобы увидеть полный ответ AI
          </p>
        </Card>

        {/* Blocks 3 & 4 side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Block 3: Competitors */}
          <Card>
            <SectionTitle icon={<Users size={18} />} title="Конкуренты в ответах AI" />
            {topCompetitors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topCompetitors.map((comp, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      background: i === 0 ? "#f59e0b20" : "var(--muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800,
                      color: i === 0 ? "#f59e0b" : "var(--muted-foreground)",
                    }}>{i + 1}</div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{comp.name}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      background: "var(--primary)15", color: "var(--primary)",
                    }}>{comp.count}</span>
                    <div style={{ width: 60, height: 5, borderRadius: 3, background: "var(--muted)" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, background: "var(--primary)",
                        width: `${Math.round((comp.count / (topCompetitors[0]?.count ?? 1)) * 100)}%`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted-foreground)" }}>
                <Users size={28} style={{ opacity: 0.3, margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, margin: 0 }}>Конкуренты не найдены</p>
              </div>
            )}
          </Card>

          {/* Block 4: Site readiness */}
          <Card>
            <SectionTitle icon={<Globe size={18} />} title="AI-готовность сайта" />
            {siteReadiness.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {siteReadiness.map((item) => (
                    <div key={item.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                        background: item.passed ? "#22c55e20" : "#ef444420",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: item.passed ? "#22c55e" : "#ef4444",
                      }}>
                        {item.passed ? <CheckCircle2 size={13} /> : <X size={13} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{item.label}</div>
                        {item.detail && !item.passed && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{item.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  padding: "8px 12px", borderRadius: 8,
                  background: "var(--primary)10", border: "1px solid var(--primary)30",
                  fontSize: 13, fontWeight: 700, color: "var(--primary)",
                }}>
                  {siteReadiness.filter(i => i.passed).length}/{siteReadiness.length} пунктов выполнено
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted-foreground)" }}>
                <Globe size={28} style={{ opacity: 0.3, margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, margin: 0 }}>Не удалось загрузить сайт</p>
              </div>
            )}
          </Card>
        </div>

        {/* Block 5: Recommendations */}
        {recommendations.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle icon={<Target size={18} />} title="Рекомендации по улучшению AI-видимости" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recommendations.map((rec, i) => {
                const p = priorityMeta[rec.priority];
                return (
                  <div key={i} style={{ border: `1px solid ${p.color}30`, borderRadius: 12, overflow: "hidden" }}>
                    <button onClick={() => setOpenRec(openRec === i ? null : i)} style={{
                      width: "100%", padding: "13px 16px", background: "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                        background: `${p.color}20`, color: p.color, flexShrink: 0,
                      }}>
                        {p.icon} {p.label.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                        {rec.title}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "#22c55e",
                        background: "#22c55e15", padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                      }}>+{rec.impactScore} к score</span>
                      {openRec === i ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />}
                    </button>
                    {openRec === i && (
                      <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${p.color}20` }}>
                        <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.7, margin: "14px 0 10px" }}>{rec.description}</p>
                        {rec.howTo && (
                          <div style={{
                            padding: "12px 14px", borderRadius: 8,
                            background: "var(--muted)", borderLeft: `3px solid ${p.color}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5 }}>КАК СДЕЛАТЬ</div>
                            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>{rec.howTo}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Response modal */}
        {modalMention && (
          <div onClick={() => setModalMention(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "var(--card)", borderRadius: 18, padding: 28,
              maxWidth: 640, width: "100%", maxHeight: "80vh", overflowY: "auto",
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: LLM_META[modalMention.llm].color, marginBottom: 4 }}>
                    {LLM_META[modalMention.llm].label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>«{modalMention.query}»</div>
                </div>
                <button onClick={() => setModalMention(null)} style={{
                  border: "none", background: "var(--muted)", borderRadius: 8,
                  width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <X size={14} color="var(--foreground)" />
                </button>
              </div>
              <div style={{
                padding: "14px 16px", background: "var(--background)", borderRadius: 10,
                fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.75, whiteSpace: "pre-wrap",
              }}>
                {modalMention.fullResponse}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: modalMention.mentioned ? "#22c55e20" : "#ef444420",
                  color: modalMention.mentioned ? "#22c55e" : "#ef4444",
                }}>
                  {modalMention.mentioned
                    ? <><CheckCircle2 size={12} /> Упомянут{modalMention.position ? ` (#${modalMention.position})` : ""}</>
                    : <><X size={12} /> Не упомянут</>}
                </span>
                {modalMention.sentiment && (
                  <span style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "var(--muted)", color: "var(--muted-foreground)",
                  }}>
                    Тональность: {modalMention.sentiment === "positive" ? "позитивная" : modalMention.sentiment === "negative" ? "негативная" : "нейтральная"}
                  </span>
                )}
                {modalMention.isSimulated ? (
                  <span style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "#f59e0b20", color: "#f59e0b",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    ⚠️ Симуляция — реальный API недоступен
                  </span>
                ) : (
                  <span style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "#22c55e15", color: "#22c55e",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    ✓ Реальный ответ API
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── HISTORY ─────────────────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <div style={{ maxWidth: 800 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, var(--primary), #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <History size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>История аудитов</h1>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{savedAudits.length} сохранённых аудитов</p>
            </div>
          </div>
          <button onClick={() => { setAudit(null); setView("form"); }} style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 13,
            display: "flex", alignItems: "center", gap: 6, fontWeight: 700,
          }}>
            <Plus size={14} /> Новый аудит
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {savedAudits.map((a, i) => (
            <Card key={a.id} style={{ cursor: "pointer" }}>
              <div
                onClick={() => { setAudit(a); setView("report"); }}
                style={{ display: "flex", alignItems: "center", gap: 16 }}
              >
                {/* Score circle mini */}
                <div style={{
                  width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                  border: `3px solid ${scoreColor(a.totalScore ?? 0)}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(a.totalScore ?? 0), lineHeight: 1 }}>
                    {a.totalScore ?? "—"}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>/100</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>
                    {a.brandName}
                    {i === 0 && (
                      <span style={{
                        marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 6,
                        background: "var(--primary)20", color: "var(--primary)", fontWeight: 700,
                      }}>последний</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {a.niche} · {new Date(a.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  {/* LLM mini scores */}
                  {a.scoresByLlm && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      {(["yandex", "claude", "chatgpt", "perplexity", "gemini"] as LLMName[]).map(llm => (
                        <span key={llm} style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 6,
                          background: LLM_META[llm].bg, color: LLM_META[llm].color, fontWeight: 700,
                        }}>
                          {LLM_META[llm].label}: {a.scoresByLlm![llm]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>
                  <ChevronDown size={18} style={{ transform: "rotate(-90deg)" }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
