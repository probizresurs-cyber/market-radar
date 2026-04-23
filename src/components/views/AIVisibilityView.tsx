"use client";

import React, { useState, useCallback } from "react";
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

// ─── helpers ────────────────────────────────────────────────────────────────
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

const LLM_META: Record<LLMName, { label: string; color: string; emoji: string }> = {
  yandex:     { label: "YandexGPT",  color: "#FF0000", emoji: "🔴" },
  giga:       { label: "GigaChat",   color: "#1DB954", emoji: "🟢" },
  chatgpt:    { label: "ChatGPT",    color: "#10A37F", emoji: "🤖" },
  perplexity: { label: "Perplexity", color: "#6C5CE7", emoji: "💜" },
};

const LLM_WEIGHTS: Record<LLMName, number> = { yandex: 0.35, giga: 0.25, chatgpt: 0.25, perplexity: 0.15 };

function calcScoreForLLM(mentions: AIMention[], llm: LLMName): number {
  const llmMentions = mentions.filter(m => m.llm === llm);
  if (!llmMentions.length) return 0;
  const mentioned = llmMentions.filter(m => m.mentioned);
  const mentionRate = mentioned.length / llmMentions.length;

  const avgPos = mentioned.length
    ? mentioned.reduce((s, m) => s + (m.position ?? 5), 0) / mentioned.length
    : 0;
  const posScore = avgPos > 0 ? Math.max(0, 1 - (avgPos - 1) / 10) : 0;

  const positiveSentiment = mentioned.filter(m => m.sentiment === "positive").length;
  const sentimentScore = mentioned.length ? positiveSentiment / mentioned.length : 0;

  return Math.round(mentionRate * 70 + posScore * 20 + sentimentScore * 10);
}

function calcTotalScore(mentions: AIMention[]): { total: number; byLlm: Record<LLMName, number> } {
  const llms: LLMName[] = ["yandex", "giga", "chatgpt", "perplexity"];
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
  for (const m of mentions) {
    for (const c of m.competitorsMentioned) {
      counts[c] = (counts[c] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

// ─── sub-components ──────────────────────────────────────────────────────────
function ScoreCircle({ score, size = 120 }: { score: number; size?: number }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x={size / 2} y={size / 2 + 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22} fontWeight="bold" fill={color}>{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.2} textAnchor="middle"
        fontSize={size * 0.09} fill="var(--muted-foreground)">/100</text>
    </svg>
  );
}

type Stage = { id: string; label: string; done: boolean; active: boolean };

function ProgressStages({ stages }: { stages: Stage[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {stages.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: s.done ? "#22c55e" : s.active ? "var(--primary)" : "var(--muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: "#fff",
            transition: "background 0.3s",
          }}>
            {s.done ? "✓" : s.active ? "…" : "○"}
          </div>
          <span style={{
            fontSize: 14,
            color: s.done ? "var(--foreground)" : s.active ? "var(--primary)" : "var(--muted-foreground)",
            fontWeight: s.active ? 700 : 400,
          }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AIVisibilityView({ c, myCompany }: Props) {
  const [view, setView] = useState<"form" | "progress" | "report">("form");
  const [audit, setAudit] = useState<AIVisibilityAudit | null>(null);

  // Form state
  const [brandName, setBrandName] = useState(myCompany?.company.name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(myCompany?.company.url ?? "");
  const [niche, setNiche] = useState(myCompany?.company.description?.slice(0, 60) ?? "");
  const [nicheCustom, setNicheCustom] = useState("");
  const [region, setRegion] = useState("Россия");
  const [queries, setQueries] = useState<string[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Progress
  const [stages, setStages] = useState<Stage[]>([]);
  const [progressError, setProgressError] = useState("");

  // Report: response modal
  const [modalMention, setModalMention] = useState<AIMention | null>(null);

  // Accordion for recommendations
  const [openRec, setOpenRec] = useState<number | null>(null);

  const effectiveNiche = niche === "Другое" ? nicheCustom : niche;

  // ── generate queries ────────────────────────────────────────────────────────
  const generateQueries = useCallback(async () => {
    if (!brandName || !effectiveNiche) {
      setFormError("Укажите название бренда и нишу");
      return;
    }
    setQueriesLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/ai-visibility/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, niche: effectiveNiche, region }),
      });
      const json = await res.json();
      if (json.ok) setQueries(json.queries);
    } catch { /* ignore */ }
    finally { setQueriesLoading(false); }
  }, [brandName, effectiveNiche, region]);

  // ── run audit pipeline ──────────────────────────────────────────────────────
  const runAudit = useCallback(async () => {
    if (!brandName || !websiteUrl || !effectiveNiche) {
      setFormError("Заполните все обязательные поля");
      return;
    }
    if (queries.length === 0) {
      setFormError("Сначала сгенерируйте или добавьте запросы");
      return;
    }

    const id = crypto.randomUUID();
    const newAudit: AIVisibilityAudit = {
      id,
      createdAt: new Date().toISOString(),
      status: "running",
      brandName,
      websiteUrl,
      niche: effectiveNiche,
      region,
      queries,
    };
    setAudit(newAudit);

    const mkStages = (active: string): Stage[] => [
      { id: "queries", label: "Подготовка запросов", done: true, active: false },
      { id: "yandex",  label: "Опрос YandexGPT",    done: false, active: active === "yandex" },
      { id: "giga",    label: "Опрос GigaChat",      done: false, active: active === "giga" },
      { id: "chatgpt", label: "Опрос ChatGPT",       done: false, active: active === "chatgpt" },
      { id: "perplexity", label: "Опрос Perplexity", done: false, active: active === "perplexity" },
      { id: "site",    label: "Анализ AI-готовности сайта", done: false, active: active === "site" },
      { id: "recs",    label: "Формирование рекомендаций",  done: false, active: active === "recs" },
    ];

    const markDone = (upTo: string) => {
      const order = ["queries", "yandex", "giga", "chatgpt", "perplexity", "site", "recs"];
      const idx = order.indexOf(upTo);
      return (stages: Stage[]) => stages.map((s, i) => ({
        ...s,
        done: order.indexOf(s.id) <= idx,
        active: order.indexOf(s.id) === idx + 1,
      }));
    };

    setView("progress");
    setProgressError("");
    setStages(mkStages("yandex"));

    const allMentions: AIMention[] = [];
    const llms: LLMName[] = ["yandex", "giga", "chatgpt", "perplexity"];

    try {
      for (const llm of llms) {
        setStages(s => s.map(st => ({ ...st, active: st.id === llm })));
        const res = await fetch("/api/ai-visibility/check-llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ llm, queries, brandName, niche: effectiveNiche }),
        });
        const json = await res.json();
        if (json.ok) allMentions.push(...json.mentions);
        setStages(markDone(llm));
      }

      setStages(s => s.map(st => ({ ...st, active: st.id === "site" })));
      let siteItems: SiteReadinessItem[] = [];
      try {
        const siteRes = await fetch("/api/ai-visibility/check-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl }),
        });
        const siteJson = await siteRes.json();
        if (siteJson.ok) siteItems = siteJson.items;
      } catch { /* ignore */ }
      setStages(markDone("site"));

      const { total, byLlm } = calcTotalScore(allMentions);
      const topCompetitors = extractTopCompetitors(allMentions);

      setStages(s => s.map(st => ({ ...st, active: st.id === "recs" })));
      let recommendations: AIRecommendation[] = [];
      try {
        const recsRes = await fetch("/api/ai-visibility/generate-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName,
            niche: effectiveNiche,
            mentions: allMentions,
            siteReadiness: siteItems,
            totalScore: total,
          }),
        });
        const recsJson = await recsRes.json();
        if (recsJson.ok) recommendations = recsJson.recommendations;
      } catch { /* ignore */ }
      setStages(s => s.map(st => ({ ...st, done: true, active: false })));

      const completed: AIVisibilityAudit = {
        ...newAudit,
        status: "done",
        completedAt: new Date().toISOString(),
        totalScore: total,
        scoresByLlm: byLlm,
        mentions: allMentions,
        siteReadiness: siteItems,
        recommendations,
        topCompetitors,
      };
      setAudit(completed);

      // Save to localStorage
      try {
        const key = `mr_ai_visibility_audits`;
        const saved: AIVisibilityAudit[] = JSON.parse(localStorage.getItem(key) ?? "[]");
        saved.unshift(completed);
        localStorage.setItem(key, JSON.stringify(saved.slice(0, 10)));
      } catch { /* ignore */ }

      setView("report");
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Ошибка аудита");
      setAudit(a => a ? { ...a, status: "failed" } : null);
    }
  }, [brandName, websiteUrl, effectiveNiche, region, queries]);

  // ─── Card wrapper ────────────────────────────────────────────────────────────
  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 24, boxShadow: "var(--shadow)",
      ...style,
    }}>{children}</div>
  );

  // ─── FORM ────────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, var(--primary), #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>👁️</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
              AI Видимость
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              Насколько вас знают ChatGPT, YandexGPT, GigaChat и Perplexity
            </p>
          </div>
        </div>

        <Card>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>
            Запустить AI-аудит
          </h2>

          <div style={{ display: "grid", gap: 16 }}>
            {/* Brand name */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                Название бренда / компании *
              </label>
              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="MarketRadar"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 14, outline: "none",
                }}
              />
            </div>

            {/* URL */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                URL сайта *
              </label>
              <input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://marketradar24.ru"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 14, outline: "none",
                }}
              />
            </div>

            {/* Niche */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                Ниша / отрасль *
              </label>
              <select
                value={niche}
                onChange={e => setNiche(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 14, outline: "none",
                }}
              >
                <option value="">— выберите нишу —</option>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {niche === "Другое" && (
                <input
                  value={nicheCustom}
                  onChange={e => setNicheCustom(e.target.value)}
                  placeholder="Укажите вашу нишу"
                  style={{
                    width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                    border: "1px solid var(--border)", background: "var(--background)",
                    color: "var(--foreground)", fontSize: 14, outline: "none",
                  }}
                />
              )}
            </div>

            {/* Region */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                Регион (необязательно)
              </label>
              <input
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="Россия"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 14, outline: "none",
                }}
              />
            </div>

            {/* Queries */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  Ключевые запросы клиентов
                </label>
                <button
                  onClick={generateQueries}
                  disabled={queriesLoading || !brandName || !effectiveNiche}
                  style={{
                    padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700,
                    opacity: queriesLoading ? 0.7 : 1,
                  }}
                >
                  {queriesLoading ? "Генерирую…" : "✨ Сгенерировать"}
                </button>
              </div>

              {queries.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {queries.map((q, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <input
                        value={q}
                        onChange={e => setQueries(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 8, boxSizing: "border-box",
                          border: "1px solid var(--border)", background: "var(--background)",
                          color: "var(--foreground)", fontSize: 13, outline: "none",
                        }}
                      />
                      <button
                        onClick={() => setQueries(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                          background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 14,
                        }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => setQueries(prev => [...prev, ""])}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px dashed var(--border)",
                      background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 13,
                    }}
                  >+ Добавить запрос</button>
                </div>
              ) : (
                <div style={{
                  padding: "16px", borderRadius: 10, border: "1px dashed var(--border)",
                  textAlign: "center", fontSize: 13, color: "var(--muted-foreground)",
                }}>
                  Нажмите «✨ Сгенерировать» — Claude создаст 8 типичных запросов для вашей ниши
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 10,
              background: "#ef444420", color: "#ef4444", fontSize: 13,
            }}>{formError}</div>
          )}

          <button
            onClick={runAudit}
            disabled={!brandName || !websiteUrl || !effectiveNiche}
            style={{
              marginTop: 24, width: "100%", padding: "14px", borderRadius: 12,
              border: "none", cursor: "pointer", fontSize: 16, fontWeight: 800,
              background: (!brandName || !websiteUrl || !effectiveNiche) ? "var(--muted)" : "var(--primary)",
              color: "#fff", transition: "opacity 0.2s",
            }}
          >
            🚀 Запустить AI-аудит
          </button>

          <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", marginTop: 10 }}>
            Аудит занимает ~2–4 минуты · Проверяет 4 AI-ассистента · Анализирует сайт
          </p>
        </Card>

        {/* What is this */}
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px", color: "var(--foreground)" }}>
            Что такое AI Видимость?
          </h3>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7, margin: 0 }}>
            GEO (Generative Engine Optimization) — новое направление: оптимизация под AI-ассистентов.
            До 40% B2B-решений в 2025 году принимаются с участием ChatGPT, Яндекс Нейро и аналогов.
            Мы проверяем, упоминают ли AI-системы ваш бренд в ответах на запросы вашей ЦА, и даём
            конкретные рекомендации по улучшению присутствия.
          </p>
        </Card>
      </div>
    );
  }

  // ─── PROGRESS ────────────────────────────────────────────────────────────────
  if (view === "progress") {
    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, var(--primary), #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>👁️</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
              AI-аудит запущен
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              {audit?.brandName} · {audit?.niche}
            </p>
          </div>
        </div>

        <Card>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>
            Прогресс проверки
          </h2>
          <ProgressStages stages={stages} />
          {progressError && (
            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 10,
              background: "#ef444420", color: "#ef4444", fontSize: 13,
            }}>
              ⚠️ {progressError}
              <button
                onClick={() => setView("form")}
                style={{
                  marginLeft: 12, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid #ef4444", background: "transparent", color: "#ef4444",
                  cursor: "pointer", fontSize: 12,
                }}
              >Назад</button>
            </div>
          )}
          {!progressError && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 20, textAlign: "center" }}>
              ⏳ Не закрывайте вкладку — аудит идёт в фоне (~2–4 мин)
            </p>
          )}
        </Card>
      </div>
    );
  }

  // ─── REPORT ──────────────────────────────────────────────────────────────────
  if (view === "report" && audit?.status === "done") {
    const { totalScore = 0, scoresByLlm, mentions = [], siteReadiness = [], recommendations = [], topCompetitors = [] } = audit;
    const llms: LLMName[] = ["yandex", "giga", "chatgpt", "perplexity"];
    const uniqueQueries = [...new Set(mentions.map(m => m.query))];

    const priorityMeta = {
      critical:    { emoji: "🔴", label: "Критично", color: "#ef4444" },
      important:   { emoji: "🟡", label: "Важно",    color: "#f59e0b" },
      recommended: { emoji: "🟢", label: "Рекомендуется", color: "#22c55e" },
    };

    return (
      <div style={{ maxWidth: 1000 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, var(--primary), #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
            }}>👁️</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
                AI Видимость — {audit.brandName}
              </h1>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                {audit.niche} · {new Date(audit.completedAt!).toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("form")}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)",
              background: "transparent", color: "var(--foreground-secondary)", cursor: "pointer", fontSize: 13,
            }}
          >+ Новый аудит</button>
        </div>

        {/* Block 1: Score */}
        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>
            ✨ AI Visibility Score
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <ScoreCircle score={totalScore} size={140} />
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Общий балл</div>
            </div>
            <div style={{ flex: 1, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {llms.map(llm => {
                const score = scoresByLlm?.[llm] ?? 0;
                const meta = LLM_META[llm];
                return (
                  <div key={llm} style={{
                    padding: 14, borderRadius: 12,
                    border: `1px solid ${meta.color}30`,
                    background: `${meta.color}08`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 6 }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: scoreColor(score) }}>{score}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>/100</div>
                    {/* Mini bar */}
                    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--muted)" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${score}%`, background: scoreColor(score), transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Block 2: Mentions table */}
        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--foreground)" }}>
            📋 Упоминания в нейросетях
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600 }}>
                    Запрос
                  </th>
                  {llms.map(llm => (
                    <th key={llm} style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", color: LLM_META[llm].color, fontWeight: 700 }}>
                      {LLM_META[llm].emoji} {LLM_META[llm].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueQueries.map((query, qi) => (
                  <tr key={qi} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--foreground-secondary)", maxWidth: 280 }}>
                      {query}
                    </td>
                    {llms.map(llm => {
                      const m = mentions.find(x => x.llm === llm && x.query === query);
                      if (!m) return <td key={llm} style={{ textAlign: "center", padding: "10px 12px", color: "var(--muted-foreground)" }}>—</td>;
                      return (
                        <td key={llm} style={{ textAlign: "center", padding: "10px 12px" }}>
                          <button
                            onClick={() => setModalMention(m)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                              background: m.mentioned ? "#22c55e20" : "#ef444420",
                              color: m.mentioned ? "#22c55e" : "#ef4444",
                              fontSize: 12, fontWeight: 700,
                            }}
                          >
                            {m.mentioned ? `✅ ${m.position ? `#${m.position}` : "упомянут"}` : "❌ нет"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
            Нажмите на ячейку чтобы увидеть полный ответ AI
          </p>
        </Card>

        {/* Block 3: Competitors */}
        {topCompetitors.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--foreground)" }}>
              🏆 Конкуренты, которых упоминают чаще
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topCompetitors.map((comp, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? "#f59e0b20" : "var(--muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: i === 0 ? "#f59e0b" : "var(--muted-foreground)",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{comp.name}</div>
                  </div>
                  <div style={{
                    padding: "3px 10px", borderRadius: 6,
                    background: "var(--primary)15", color: "var(--primary)",
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {comp.count} упом.
                  </div>
                  <div style={{ width: 100, height: 6, borderRadius: 3, background: "var(--muted)" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.round((comp.count / (topCompetitors[0]?.count ?? 1)) * 100)}%`,
                      background: "var(--primary)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Block 4: Site readiness */}
        {siteReadiness.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--foreground)" }}>
              🌐 AI-готовность сайта
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {siteReadiness.map((item) => (
                <div key={item.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: item.passed ? "#22c55e20" : "#ef444420",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: item.passed ? "#22c55e" : "#ef4444",
                  }}>
                    {item.passed ? "✓" : "✕"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{item.label}</div>
                    {item.detail && (
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{item.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 10,
              background: "var(--primary)10", border: "1px solid var(--primary)30",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                {siteReadiness.filter(i => i.passed).length}/{siteReadiness.length} пунктов выполнено
              </span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8 }}>
                AI-готовность сайта
              </span>
            </div>
          </Card>
        )}

        {/* Block 5: Recommendations */}
        {recommendations.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--foreground)" }}>
              🎯 Рекомендации
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recommendations.map((rec, i) => {
                const p = priorityMeta[rec.priority];
                return (
                  <div key={i} style={{
                    border: `1px solid ${p.color}30`,
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setOpenRec(openRec === i ? null : i)}
                      style={{
                        width: "100%", padding: "12px 16px", background: "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", gap: 12,
                      }}
                    >
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                        background: `${p.color}20`, color: p.color, flexShrink: 0,
                      }}>
                        {p.emoji} {p.label.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                        {rec.title}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "#22c55e",
                        background: "#22c55e15", padding: "2px 8px", borderRadius: 6, flexShrink: 0,
                      }}>
                        +{rec.impactScore} к score
                      </span>
                      <span style={{ color: "var(--muted-foreground)", fontSize: 16 }}>
                        {openRec === i ? "▲" : "▼"}
                      </span>
                    </button>
                    {openRec === i && (
                      <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${p.color}20` }}>
                        <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: "12px 0 8px" }}>
                          {rec.description}
                        </p>
                        {rec.howTo && (
                          <div style={{
                            padding: "10px 14px", borderRadius: 8,
                            background: "var(--muted)", borderLeft: `3px solid ${p.color}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4 }}>КАК СДЕЛАТЬ</div>
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

        {/* Response Modal */}
        {modalMention && (
          <div
            onClick={() => setModalMention(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "var(--card)", borderRadius: 18, padding: 28,
                maxWidth: 620, width: "100%", maxHeight: "80vh", overflowY: "auto",
                boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: LLM_META[modalMention.llm].color, marginBottom: 4 }}>
                    {LLM_META[modalMention.llm].emoji} {LLM_META[modalMention.llm].label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>«{modalMention.query}»</div>
                </div>
                <button
                  onClick={() => setModalMention(null)}
                  style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: "var(--muted-foreground)" }}
                >✕</button>
              </div>
              <div style={{
                padding: "14px", background: "var(--background)", borderRadius: 10,
                fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
                {modalMention.fullResponse}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: modalMention.mentioned ? "#22c55e20" : "#ef444420",
                  color: modalMention.mentioned ? "#22c55e" : "#ef4444",
                }}>
                  {modalMention.mentioned
                    ? `✅ Упомянут${modalMention.position ? ` (#${modalMention.position})` : ""}`
                    : "❌ Не упомянут"}
                </span>
                {modalMention.sentiment && (
                  <span style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "var(--muted)", color: "var(--muted-foreground)",
                  }}>
                    Тональность: {modalMention.sentiment === "positive" ? "✅ позитивная" : modalMention.sentiment === "negative" ? "⚠️ негативная" : "🔘 нейтральная"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
