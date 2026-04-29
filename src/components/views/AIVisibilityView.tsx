"use client";

import React, { useState, useCallback } from "react";
import {
  Eye, Sparkles, Search, TrendingUp, Globe, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, X, BarChart3, Users, Zap, Target, Info,
  ClipboardList, Bot, Activity, History, Plus, MessageSquare, ListChecks,
  Code2, FileText, Award, Rocket, RefreshCw,
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
// Perplexity исключён из аудита (Keys.so для Яндекс Нейро/Алисы покрывает русский AI-сегмент).
const LLM_WEIGHTS: Record<LLMName, number> = {
  yandex:     0.32,
  claude:     0.27,
  chatgpt:    0.27,
  perplexity: 0,     // не используется — оставлено для совместимости старых отчётов
  gemini:     0.14,
};

function calcScoreForLLM(mentions: AIMention[], llm: LLMName): number {
  const llmMentions = mentions.filter(m => m.llm === llm && !m.unavailable);
  if (!llmMentions.length) return -1; // -1 = нет данных (ключ не настроен)
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
  // Perplexity исключён из аудита (Yandex Neuro/Alice покрываются Keys.so отдельным блоком).
  const llms: LLMName[] = ["yandex", "claude", "chatgpt", "gemini"];
  const byLlm = {} as Record<LLMName, number>;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const llm of llms) {
    const score = calcScoreForLLM(mentions, llm);
    byLlm[llm] = score;
    if (score >= 0) { // только если данные есть
      weightedSum += score * LLM_WEIGHTS[llm];
      totalWeight += LLM_WEIGHTS[llm];
    }
  }
  return { total: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0, byLlm };
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

  // Direct mentions ("Расскажи о компании X")
  interface DirectMention {
    llm: LLMName; query: string; response: string;
    mentioned: boolean; isReal: boolean; isSimulated: boolean; unavailable: boolean;
  }
  const [directMentions, setDirectMentions] = useState<DirectMention[] | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directExpanded, setDirectExpanded] = useState<number | null>(null);

  const runDirectMentions = useCallback(async () => {
    if (!audit?.brandName) return;
    setDirectLoading(true); setDirectError(null);
    try {
      const res = await fetch("/api/ai-visibility/direct-mentions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: audit.brandName, websiteUrl: audit.websiteUrl }),
      });
      const json = await res.json();
      if (json.ok) setDirectMentions(json.mentions);
      else setDirectError(json.error ?? "Ошибка");
    } catch {
      setDirectError("Не удалось выполнить запрос");
    } finally {
      setDirectLoading(false);
    }
  }, [audit]);

  // Keys.so AI mentions in Yandex Neuro/Alice — реальные данные
  interface KeysoAiMention {
    query: string;
    mentioned: boolean;
    position?: number | null;
    answer?: string;
  }
  interface KeysoAiCompetitor {
    domain: string;
    mentions: number;
    share?: number;
  }
  interface KeysoAiData {
    stats: { totalQueries: number; mentionedCount: number; mentionRate: number };
    mentions: KeysoAiMention[];
    competitors: KeysoAiCompetitor[];
  }
  const [keysoAi, setKeysoAi] = useState<KeysoAiData | null>(null);
  const [keysoAiLoading, setKeysoAiLoading] = useState(false);
  const [keysoAiError, setKeysoAiError] = useState<string | null>(null);
  const [keysoMentionsLimit, setKeysoMentionsLimit] = useState(8);

  const runKeysoAi = useCallback(async () => {
    if (!audit?.websiteUrl) return;
    setKeysoAiLoading(true);
    setKeysoAiError(null);
    try {
      const res = await fetch("/api/keyso/ai-mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: audit.websiteUrl, base: "msk", limit: 25 }),
      });
      const json = await res.json();
      if (json.ok) setKeysoAi({ stats: json.stats, mentions: json.mentions, competitors: json.competitors });
      else setKeysoAiError(json.error ?? "Не удалось получить данные");
    } catch {
      setKeysoAiError("Ошибка запроса к Keys.so");
    } finally {
      setKeysoAiLoading(false);
    }
  }, [audit]);

  const effectiveNiche = niche === "Другое" ? nicheCustom : niche;
  // Perplexity исключён из аудита (Yandex Neuro/Alice покрываются Keys.so отдельным блоком).
  const llms: LLMName[] = ["yandex", "claude", "chatgpt", "gemini"];

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

    const stageOrder = ["queries", "yandex", "claude", "chatgpt", "gemini", "site", "recs"];
    const stageLabels: Record<string, string> = {
      queries: "Подготовка запросов", yandex: "Опрос YandexGPT",
      claude: "Опрос Claude", chatgpt: "Опрос ChatGPT",
      gemini: "Опрос Gemini",
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
              GEO-аудит: честная проверка — знают ли вас ChatGPT, Claude, YandexGPT, Gemini + реальные данные Я.Нейро/Алисы из Keys.so
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
              ~2–3 минуты · 4 AI-ассистента + Keys.so для Алисы/Нейро · честные запросы без биас-подсказок
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
                { icon: <Bot size={16} />, title: "4 AI-ассистента + Keys.so", desc: "YandexGPT, Claude, ChatGPT, Gemini + Алиса/Нейро через Keys.so" },
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
                const score = scoresByLlm?.[llm] ?? -1;
                const meta = LLM_META[llm];
                const noData = score < 0;
                return (
                  <div key={llm} style={{
                    padding: 16, borderRadius: 12,
                    border: `1px solid ${noData ? "var(--border)" : meta.color + "30"}`,
                    background: noData ? "var(--muted)" : meta.bg,
                    opacity: noData ? 0.6 : 1,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: noData ? "var(--muted-foreground)" : meta.color, marginBottom: 8 }}>
                      {meta.label}
                    </div>
                    {noData ? (
                      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.4 }}>Ключ<br/>не настроен</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>/100</div>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.1)" }}>
                          <div style={{
                            height: "100%", borderRadius: 3,
                            width: `${score}%`, background: scoreColor(score),
                            transition: "width 1s ease",
                          }} />
                        </div>
                      </>
                    )}
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
                      if (m.unavailable) return (
                        <td key={llm} style={{ textAlign: "center", padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)", background: "var(--muted)", padding: "3px 8px", borderRadius: 6 }}>
                            ключ не настроен
                          </span>
                        </td>
                      );
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

        {/* Block 2.5: Direct mentions — "Расскажи о компании X" */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--primary)15", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Прямые ответы AI о компании</h2>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                  Что каждая нейросеть говорит, если у неё спросить «Расскажи о {audit.brandName}»
                </p>
              </div>
            </div>
            <button
              onClick={runDirectMentions}
              disabled={directLoading}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: directLoading ? "var(--muted)" : "var(--primary)",
                color: directLoading ? "var(--muted-foreground)" : "#fff",
                fontWeight: 700, fontSize: 13, cursor: directLoading ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}
            >
              {directLoading ? (
                <><RefreshCw size={14} className="mr-spin" /> Опрашиваем…</>
              ) : directMentions ? (
                <><RefreshCw size={14} /> Обновить</>
              ) : (
                <><Zap size={14} /> Запросить ответы</>
              )}
            </button>
          </div>
          <style>{`@keyframes mr-aiv-spin { to { transform: rotate(360deg); } } .mr-spin { animation: mr-aiv-spin 0.9s linear infinite; }`}</style>

          {directError && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ef444415", color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={14} /> {directError}
            </div>
          )}

          {!directMentions && !directLoading && !directError && (
            <div style={{ padding: "20px 16px", borderRadius: 12, background: "var(--background)", border: "1px dashed var(--border)", textAlign: "center" }}>
              <Bot size={32} style={{ opacity: 0.3, marginBottom: 8, color: "var(--muted-foreground)" }} />
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
                Нажмите «Запросить ответы» — пошлём запрос<br/>
                «Расскажи о компании <b style={{ color: "var(--foreground)" }}>{audit.brandName}</b>» во все 5 нейросетей.<br/>
                <span style={{ fontSize: 12 }}>ChatGPT и Claude отвечают через реальный API.</span>
              </p>
            </div>
          )}

          {directLoading && (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--muted-foreground)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <RefreshCw size={18} className="mr-spin" />
                Опрашиваем 5 нейросетей параллельно (15–25 сек)…
              </div>
            </div>
          )}

          {directMentions && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 12 }}>
              {directMentions.map((m, i) => {
                const meta = LLM_META[m.llm];
                const isOpen = directExpanded === i;
                const trimmed = m.response.length > 200 ? m.response.slice(0, 200) + "…" : m.response;
                return (
                  <div key={i} style={{
                    borderRadius: 14, border: `1.5px solid ${m.unavailable ? "var(--border)" : meta.color + "40"}`,
                    background: m.unavailable ? "var(--muted)" : "var(--card)",
                    overflow: "hidden", display: "flex", flexDirection: "column",
                    opacity: m.unavailable ? 0.7 : 1,
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: "10px 14px",
                      background: m.unavailable ? "transparent" : meta.bg,
                      borderBottom: `1px solid ${m.unavailable ? "var(--border)" : meta.color + "30"}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: m.unavailable ? "var(--muted-foreground)" : meta.color }}>
                        {meta.label}
                      </span>
                      {m.unavailable ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "var(--muted)", color: "var(--muted-foreground)" }}>
                          ключ не настроен
                        </span>
                      ) : (
                        <div style={{ display: "flex", gap: 5 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                            background: m.mentioned ? "#22c55e25" : "#ef444425",
                            color: m.mentioned ? "#22c55e" : "#ef4444",
                            display: "flex", alignItems: "center", gap: 3,
                          }}>
                            {m.mentioned ? <><CheckCircle2 size={10} /> знает</> : <><X size={10} /> не знает</>}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                            background: m.isReal ? "#22c55e15" : "#f59e0b15",
                            color: m.isReal ? "#22c55e" : "#f59e0b",
                          }}>
                            {m.isReal ? "API" : "симуляция"}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Body */}
                    <div style={{ padding: "12px 14px", flex: 1, fontSize: 12, lineHeight: 1.65, color: "var(--foreground-secondary)", whiteSpace: "pre-wrap" }}>
                      {m.unavailable ? (
                        <span style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>
                          Реальный API не настроен. Добавьте OPENAI_API_KEY на сервер чтобы получить честный ответ ChatGPT.
                        </span>
                      ) : (
                        <>
                          {isOpen ? m.response : trimmed}
                          {m.response.length > 200 && (
                            <button
                              onClick={() => setDirectExpanded(isOpen ? null : i)}
                              style={{
                                display: "block", marginTop: 8, padding: 0, border: "none", background: "transparent",
                                color: meta.color, fontWeight: 700, fontSize: 12, cursor: "pointer",
                              }}
                            >
                              {isOpen ? "← свернуть" : "развернуть полностью →"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {directMentions && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "var(--primary)08", border: "1px solid var(--primary)20", fontSize: 12, color: "var(--foreground-secondary)", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--primary)" }} />
              <span>
                Если ни одна нейросеть не «знает» компанию — это нормально для среднего бизнеса.
                Чтобы попасть в ответы, выполняйте действия из <b>чек-листа ниже</b>: чем больше упоминаний на авторитетных площадках и чем лучше структурирован сайт — тем выше шанс попасть в обучающие данные следующих версий моделей.
              </span>
            </div>
          )}
        </Card>

        {/* Block 2.7: Real Yandex Neuro / Alice mentions from Keys.so */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ef444415", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                <Search size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Упоминания в Яндекс Алисе и Нейро</h2>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                  Реальные данные от Keys.so — где Алиса/Нейро упоминают <b>{audit.websiteUrl}</b>
                </p>
              </div>
            </div>
            <button
              onClick={runKeysoAi}
              disabled={keysoAiLoading}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: keysoAiLoading ? "var(--muted)" : "#ef4444",
                color: keysoAiLoading ? "var(--muted-foreground)" : "#fff",
                fontWeight: 700, fontSize: 13, cursor: keysoAiLoading ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}
            >
              {keysoAiLoading ? "Загружаем…" : keysoAi ? "Обновить" : "Загрузить из Keys.so"}
            </button>
          </div>

          {keysoAiError && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ef444415", color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={14} /> {keysoAiError}
            </div>
          )}

          {!keysoAi && !keysoAiLoading && !keysoAiError && (
            <div style={{ padding: "16px", borderRadius: 12, background: "var(--background)", border: "1px dashed var(--border)", textAlign: "center" }}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 8, color: "var(--muted-foreground)" }} />
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.55 }}>
                Нажмите «Загрузить из Keys.so» — увидим реальные ответы Яндекс Нейро/Алисы<br/>
                по запросам, в которых ваша ниша упоминается, и есть ли там ваш домен.
              </p>
            </div>
          )}

          {keysoAi && (
            <>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 600 }}>ВСЕГО ЗАПРОСОВ</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)" }}>{keysoAi.stats.totalQueries}</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#22c55e08", border: "1px solid #22c55e25" }}>
                  <div style={{ fontSize: 11, color: "#22c55e", marginBottom: 4, fontWeight: 600 }}>ВЫ УПОМЯНУТЫ</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{keysoAi.stats.mentionedCount}</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--primary)08", border: "1px solid var(--primary)25" }}>
                  <div style={{ fontSize: 11, color: "var(--primary)", marginBottom: 4, fontWeight: 600 }}>ДОЛЯ УПОМИНАНИЙ</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>{keysoAi.stats.mentionRate}%</div>
                </div>
              </div>

              {/* Top queries */}
              {keysoAi.mentions.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 10 }}>
                    ЗАПРОСЫ В ЯНДЕКС НЕЙРО
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {keysoAi.mentions.slice(0, keysoMentionsLimit).map((m, i) => (
                      <div key={i} style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: m.mentioned ? "#22c55e08" : "var(--background)",
                        border: `1px solid ${m.mentioned ? "#22c55e30" : "var(--border)"}`,
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: m.mentioned ? "#22c55e" : "var(--muted)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: m.mentioned ? "#fff" : "var(--muted-foreground)",
                          fontSize: 11, fontWeight: 800,
                        }}>
                          {m.mentioned ? <CheckCircle2 size={12} /> : <X size={11} />}
                        </div>
                        <div style={{ flex: 1, fontSize: 13, color: "var(--foreground)", fontWeight: m.mentioned ? 600 : 400 }}>
                          «{m.query}»
                        </div>
                        {m.position !== null && m.position !== undefined && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                            background: "var(--primary)15", color: "var(--primary)",
                          }}>
                            #{m.position}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {keysoAi.mentions.length > keysoMentionsLimit && (
                    <button
                      onClick={() => setKeysoMentionsLimit(prev => prev + 10)}
                      style={{ marginTop: 10, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                    >
                      Показать ещё ({keysoAi.mentions.length - keysoMentionsLimit})
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
                  Keys.so не нашёл AI-запросов где упоминается ваш домен.
                </div>
              )}

              {/* Competitors in AI answers */}
              {keysoAi.competitors.length > 0 && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 10 }}>
                    КТО УПОМИНАЕТСЯ РЯДОМ В AI-ОТВЕТАХ
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {keysoAi.competitors.map((comp, i) => (
                      <div key={i} style={{
                        padding: "9px 12px", borderRadius: 9, background: "var(--background)", border: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: 9,
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: i === 0 ? "#f59e0b25" : "var(--muted)",
                          color: i === 0 ? "#f59e0b" : "var(--muted-foreground)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 800,
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {comp.domain}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                          background: "var(--primary)15", color: "var(--primary)", flexShrink: 0,
                        }}>
                          {comp.mentions}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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

        {/* Block 6: GEO Checklist — what to do to appear in AI answers */}
        {(() => {
          const checks = new Map(siteReadiness.map(it => [it.key, it.passed]));
          const checklist: Array<{
            category: string;
            icon: React.ReactNode;
            color: string;
            items: Array<{ label: string; done?: boolean; how: string; auto?: boolean }>;
          }> = [
            {
              category: "Технические основы",
              icon: <Code2 size={16} />,
              color: "#3b82f6",
              items: [
                { label: "Schema.org JSON-LD разметка", auto: true, done: checks.get("schemaOrg") ?? false,
                  how: "Добавьте <script type=\"application/ld+json\"> с типом Organization в <head> главной страницы — описание, URL, контакты, соцсети." },
                { label: "Organization schema", auto: true, done: checks.get("orgSchema") ?? false,
                  how: "В JSON-LD укажите @type:\"Organization\" с полями name, url, logo, sameAs (соцсети), contactPoint." },
                { label: "FAQPage schema", auto: true, done: checks.get("faqSchema") ?? false,
                  how: "Если на сайте есть FAQ — оберните его в @type:\"FAQPage\" с массивом mainEntity (Question/Answer). Это самый цитируемый формат для AI." },
                { label: "Файл /llms.txt в корне сайта", auto: true, done: checks.get("llmsTxt") ?? false,
                  how: "Создайте /llms.txt — новый стандарт для AI-ботов. Структура как у README: # Название\\n> описание\\n## Разделы\\n- [Имя](url): пояснение." },
                { label: "robots.txt разрешает GPTBot, ClaudeBot, PerplexityBot", auto: true, done: checks.get("robotsTxt") ?? false,
                  how: "Откройте /robots.txt и убедитесь что НЕТ строк \"User-agent: GPTBot Disallow: /\" и аналогичных для ClaudeBot, PerplexityBot, Google-Extended." },
                { label: "sitemap.xml — актуальный, со всеми страницами", how: "Сгенерируйте sitemap.xml через Next.js или XML-Sitemaps; добавьте ссылку Sitemap: в robots.txt." },
                { label: "Open Graph + Twitter Cards", how: "Добавьте og:title, og:description, og:image, twitter:card на каждую страницу — AI-парсеры читают эти теги для preview." },
              ],
            },
            {
              category: "Контент и структура",
              icon: <FileText size={16} />,
              color: "#10b981",
              items: [
                { label: "FAQ-блоки с реальными вопросами клиентов", auto: true, done: checks.get("faqBlocks") ?? false,
                  how: "Соберите 8–15 типовых вопросов клиентов. Ответы — короткие, конкретные, с цифрами. Это материал #1 для AI-цитат." },
                { label: "H2-заголовки в виде вопросов", auto: true, done: checks.get("h2Questions") ?? false,
                  how: "Перепишите H2: вместо «Преимущества» → «Чем мы отличаемся от X?»; вместо «Услуги» → «Что входит в услугу X?». LLM выбирают такие фрагменты." },
                { label: "Цифры и факты в первых 200 словах", auto: true, done: checks.get("numbersFirst200") ?? false,
                  how: "На главной странице в первом блоке: «12 лет на рынке», «250+ клиентов», «средний срок 14 дней». Конкретика > общие фразы." },
                { label: "Атрибуция авторов (E-E-A-T)", auto: true, done: checks.get("author") ?? false,
                  how: "К каждой статье / экспертному материалу добавьте имя автора с meta name=\"author\" и желательно ссылку на профиль (Habr, LinkedIn)." },
                { label: "Страница «О компании» с фактами", how: "Год основания, команда, миссия, конкретные цифры (выручка, клиенты, награды), сертификаты, юр-реквизиты." },
                { label: "Цены/тарифы открыто", how: "Закрытые цены = нет цитат от AI. Опубликуйте прайс или хотя бы вилки «от X ₽»." },
                { label: "Кейсы с измеримыми результатами", how: "Минимум 5 кейсов в формате: «Клиент / Задача / Что сделали / Результат с цифрами»." },
              ],
            },
            {
              category: "Внешние сигналы (авторитет)",
              icon: <Award size={16} />,
              color: "#f59e0b",
              items: [
                { label: "Упоминания на Habr / VC.ru / RB.ru", how: "Опубликуйте 2–3 экспертные статьи в год на Habr или VC. AI-модели обучаются на этих доменах активно." },
                { label: "Профиль на агрегаторах ниши", how: "Ruward / Tagline / Workspace для digital; Roem.ru, CRMRating, SoftwareSuggest — в зависимости от ниши." },
                { label: "Отзывы 50+ на 2GIS / Яндекс.Картах / Google Maps", how: "Активно собирайте отзывы. AI цитирует именно эти платформы для оценки репутации." },
                { label: "Цитаты экспертов компании в СМИ", how: "Pressfeed / Deadline / журналистские запросы — отвечайте регулярно. Каждое цитирование = упоминание в обучении." },
                { label: "Pres-release дистрибуция", how: "B2Blogger, Pressfeed, ExpoPromoter — публикация ≥ 1 пресс-релиза в квартал." },
                { label: "Wikipedia / Crunchbase профиль (для крупных)", how: "Если есть пресса и значимость — заведите страницу на Wikipedia (требует независимых источников). Crunchbase — опционально." },
                { label: "Подкасты / выступления / вебинары", how: "Транскрипты подкастов и видео — попадают в обучающие наборы. Запишите 4–6 выступлений в год." },
              ],
            },
            {
              category: "Оптимизация под AI-поиск",
              icon: <Sparkles size={16} />,
              color: "#8b5cf6",
              items: [
                { label: "Прямые ответы на типовые вопросы клиентов", how: "Создайте отдельную страницу /knowledge или /faq с короткими (50–150 слов) ответами на 30+ вопросов из ниши." },
                { label: "Цитируемая статистика и факты со ссылками", how: "В статьях указывайте источник: «По данным Data Insight, 2025…». AI любит верифицируемые факты." },
                { label: "Глоссарий терминов ниши", how: "Раздел /glossary с короткими определениями. Часто появляется в выдаче AI на запросы «что такое X»." },
                { label: "Структурированный контент: списки, таблицы", how: "Маркированные списки, нумерация шагов, сравнительные таблицы — они выбираются LLM как готовые блоки для ответа." },
                { label: "Альтернативный текст у изображений", how: "alt=\"...\" с описанием смысла, а не «image1.png». Influence на multimodal-модели (GPT-4o, Gemini)." },
              ],
            },
          ];

          const totalDone = checklist.flatMap(c => c.items).filter(i => i.done).length;
          const totalAuto = checklist.flatMap(c => c.items).filter(i => i.auto).length;

          return (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--primary)15", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                    <ListChecks size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                      Чек-лист: что сделать чтобы попасть в ответы AI
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                      Полный план GEO-оптимизации по 4 категориям. Автопроверка: <b style={{ color: "var(--success)" }}>{totalDone}</b> из {totalAuto} технических пунктов выполнено.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
                {checklist.map((cat) => (
                  <div key={cat.category} style={{
                    borderRadius: 14, border: `1.5px solid ${cat.color}30`,
                    background: `${cat.color}06`, padding: 16,
                  }}>
                    {/* Category header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${cat.color}20` }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cat.color}20`, color: cat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {cat.icon}
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>{cat.category}</h3>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>
                        {cat.items.filter(i => i.done).length}/{cat.items.filter(i => i.auto).length || cat.items.length}
                      </span>
                    </div>

                    {/* Items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cat.items.map((item, i) => {
                        const isAuto = !!item.auto;
                        const isDone = item.done;
                        return (
                          <details key={i} style={{
                            background: "var(--card)", borderRadius: 10,
                            border: `1px solid ${isDone ? "#22c55e30" : isAuto ? "#ef444430" : "var(--border)"}`,
                            overflow: "hidden",
                          }}>
                            <summary style={{ padding: "9px 12px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: isDone ? "#22c55e" : isAuto ? "#ef444415" : "var(--muted)",
                                color: isDone ? "#fff" : isAuto ? "#ef4444" : "var(--muted-foreground)",
                                border: isDone ? "none" : `1.5px solid ${isAuto ? "#ef444450" : "var(--border)"}`,
                              }}>
                                {isDone ? <CheckCircle2 size={13} /> : isAuto ? <X size={11} /> : ""}
                              </div>
                              <span style={{ flex: 1, color: "var(--foreground)", fontWeight: isDone ? 500 : 600, textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.7 : 1 }}>
                                {item.label}
                              </span>
                              {isAuto && !isDone && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#ef444415", color: "#ef4444" }}>
                                  не выполнено
                                </span>
                              )}
                              {!isAuto && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>
                                  вручную
                                </span>
                              )}
                              <ChevronDown size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                            </summary>
                            <div style={{ padding: "0 12px 12px 42px", fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.65 }}>
                              <div style={{ padding: "10px 12px", borderRadius: 8, background: `${cat.color}08`, borderLeft: `3px solid ${cat.color}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 4 }}>КАК СДЕЛАТЬ</div>
                                {item.how}
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom note */}
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "var(--primary)08", border: "1px solid var(--primary)25", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Rocket size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.65 }}>
                  <b style={{ color: "var(--foreground)" }}>Реалистичный таймлайн:</b> технические пункты — 1–2 недели разработки;
                  контент и сайт — 1 месяц; внешние сигналы — 3–6 месяцев. Эффект (рост AI-видимости) виден через
                  3–6 мес после старта работ — модели обновляют обучающие данные с задержкой.
                </div>
              </div>
            </Card>
          );
        })()}

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
                      {(["yandex", "claude", "chatgpt", "gemini"] as LLMName[]).map(llm => (
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
