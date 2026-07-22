"use client";

import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, Search, RefreshCw, ExternalLink, Calendar, Loader2, Sparkles, Copy, Check, FileText, Film, Image, Layout, Wand2, Link2, Upload, Clapperboard, Send } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { SMMResult } from "@/lib/smm-types";
import type { BrandBook, ReelBreakdown, GeneratedReel, GeneratedPost } from "@/lib/content-types";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

interface TrendItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  description?: string;
  /** 0-100 — ранг виральности внутри своего источника (только соцсети). */
  virality?: number;
  /** Смежная ниша, по которой найден элемент (пусто = основной запрос). */
  matchedQuery?: string;
}

export type TrendIdeaFormat = "пост" | "карусель" | "рилс" | "сторис";

export interface TrendContentIdea {
  id: string;
  format: TrendIdeaFormat;
  topic: string;
  hook: string;
  prompt: string;
  trendBasis: string;
}

const FORMAT_ACTION: Record<TrendIdeaFormat, string> = {
  "пост":     "Создать пост",
  "карусель": "Создать карусель",
  "рилс":     "Создать рилс",
  "сторис":   "Создать сторис",
};

const SOURCE_OPTIONS = [
  { id: "yandex_news",    label: "Google News RU", group: "Новости",     needsKey: false },
  { id: "google_news_en", label: "Google News EN", group: "Новости",     needsKey: false },
  { id: "habr",           label: "Habr",           group: "Блоги",       needsKey: false },
  { id: "vc",             label: "VC.ru",          group: "Блоги",       needsKey: false },
  { id: "cossa",          label: "Cossa",          group: "Блоги",       needsKey: false },
  { id: "reddit",         label: "Reddit (EN)",    group: "Соцсети 🌐",  needsKey: false },
  { id: "reddit_ru",      label: "Reddit (RU)",    group: "Соцсети 🌐",  needsKey: false },
  { id: "youtube",        label: "YouTube",        group: "Соцсети 🌐",  needsKey: false },
  { id: "vk",             label: "ВКонтакте",      group: "Соцсети 🌐",  needsKey: false },
  { id: "tiktok",         label: "TikTok",         group: "Соцсети 🌐",  needsKey: false },
];

const FORMAT_ICON: Record<string, React.ReactNode> = {
  "пост":     <FileText size={11} />,
  "карусель": <Layout size={11} />,
  "рилс":     <Film size={11} />,
  "сторис":   <Image size={11} />,
};

const FORMAT_COLOR: Record<string, string> = {
  "пост":     "#3b82f6",
  "карусель": "#8b5cf6",
  "рилс":     "#ec4899",
  "сторис":   "#f59e0b",
};

function timeAgo(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ч назад`;
  return `${Math.round(diff / 86400)} д назад`;
}

function IdeaCard({ idea, onCreate, creating, onCreatePackage, creatingPackage }: {
  idea: TrendContentIdea;
  onCreate?: (idea: TrendContentIdea) => void | Promise<void>;
  creating?: boolean;
  onCreatePackage?: (idea: TrendContentIdea) => void | Promise<void>;
  creatingPackage?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const color = FORMAT_COLOR[idea.format] ?? "#6366f1";

  const handleCopy = () => {
    navigator.clipboard.writeText(idea.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="ds-card" style={{ padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Format badge + topic */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: color + "18", color,
            }}>
              {FORMAT_ICON[idea.format]} {idea.format.toUpperCase()}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>
              {idea.topic}
            </span>
          </div>

          {/* Hook */}
          <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>
            «{idea.hook}»
          </div>

          {/* Prompt */}
          <div style={{
            fontSize: 12, color: "var(--foreground)", lineHeight: 1.55,
            background: "var(--background)", borderRadius: 8,
            padding: "10px 12px", border: "1px solid var(--border)",
            marginBottom: 8,
          }}>
            {idea.prompt}
          </div>

          {/* Trend basis */}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
            📰 <span style={{ fontStyle: "italic" }}>{idea.trendBasis}</span>
          </div>

          {/* Action row — primary: Create one format, secondary: Package, tertiary: Copy */}
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onCreate && (
              <button
                onClick={() => !creating && !creatingPackage && onCreate(idea)}
                disabled={creating || creatingPackage}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: "none",
                  background: creating ? color + "55" : color,
                  color: "#fff", fontWeight: 700, fontSize: 12.5,
                  cursor: creating ? "wait" : (creatingPackage ? "not-allowed" : "pointer"),
                  opacity: creatingPackage ? 0.55 : 1,
                  transition: "all 0.15s",
                  boxShadow: creating ? "none" : `0 2px 8px ${color}40`,
                }}
              >
                {creating
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Создаю…</>
                  : <><Wand2 size={13} /> {FORMAT_ACTION[idea.format]}</>
                }
              </button>
            )}
            {onCreatePackage && (
              <button
                onClick={() => !creating && !creatingPackage && onCreatePackage(idea)}
                disabled={creating || creatingPackage}
                title="Сгенерировать сразу пост + сторис + карусель + рилс по этой идее"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: "1.5px solid var(--primary)",
                  background: creatingPackage
                    ? "color-mix(in oklch, var(--primary) 25%, transparent)"
                    : "color-mix(in oklch, var(--primary) 8%, transparent)",
                  color: "var(--primary)", fontWeight: 700, fontSize: 12.5,
                  cursor: creatingPackage ? "wait" : (creating ? "not-allowed" : "pointer"),
                  opacity: creating ? 0.55 : 1,
                  transition: "all 0.15s",
                }}
              >
                {creatingPackage
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Генерю 4 формата…</>
                  : <>📦 Пакет (4 формата)</>
                }
              </button>
            )}
            <button
              onClick={handleCopy}
              title="Скопировать промпт"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: copied ? "#22c55e15" : "var(--card)",
                color: copied ? "#22c55e" : "var(--muted-foreground)",
                fontWeight: 600, fontSize: 12.5,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {copied ? <><Check size={13} /> Скопировано</> : <><Copy size={13} /> Промпт</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContentTrendsView({ analysis, userId, onCreateFromIdea, onCreatePackage }: {
  analysis: AnalysisResult | null;
  /** Per-user скоуп localStorage. */
  userId?: string;
  /** Callback вызывается, когда пользователь нажимает «Создать пост/сторис/…»
   *  на карточке идеи. Должен вернуть Promise — пока он не разрешится, кнопка
   *  показывает спиннер. */
  onCreateFromIdea?: (idea: TrendContentIdea) => Promise<void>;
  /** Пакетная генерация — пост + сторис + карусель + рилс параллельно
   *  одной идеей. Кнопка «Пакет (4 формата)» на карточке. */
  onCreatePackage?: (idea: TrendContentIdea) => Promise<void>;
  smmAnalysis?: SMMResult | null;
  brandBook?: BrandBook | null;
  /** «Разбор ролика» — готовый адаптированный сценарий отправляется прямо в библиотеку рилсов. */
  onSendReelToLibrary?: (reel: GeneratedReel) => void;
  /** «Рерайт текста» — переписанный чужой текст отправляется в библиотеку постов. */
  onSendPostToLibrary?: (post: GeneratedPost) => void;
}) {
  const [mode, setMode] = useState<"query" | "breakdown" | "rewrite">("query");
  const defaultQuery = analysis?.company?.description?.split("\n")[0]?.slice(0, 80) || analysis?.company?.name || "";
  // Persist всё нужное состояние под mr_trends_<uid>: query, sources,
  // result (тренды), ideas (AI-рекомендации), filter. Иначе после смены
  // вкладки и возврата всё пересоздаётся с нуля.
  const storageKey = `mr_trends_${userId || "anon"}`;
  type SourceStat = { source: string; count: number; status: string; note?: string };
  type ResultShape = { query: string; total: number; items: TrendItem[]; sourceStats?: SourceStat[]; adjacentQueries?: string[] };
  type TrendsPersist = {
    query: string;
    sources: string[];
    result: ResultShape | null;
    ideas: TrendContentIdea[] | null;
    filter: string;
  };
  const loadInitial = (): Partial<TrendsPersist> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as TrendsPersist) : {};
    } catch { return {}; }
  };
  const init = loadInitial();

  const [query, setQuery] = useState(init.query ?? defaultQuery);
  const [sources, setSources] = useState<string[]>(init.sources ?? ["yandex_news", "habr", "vc"]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<ResultShape | null>(init.result ?? null);
  const [filter, setFilter] = useState<string>(init.filter ?? "all");
  // Поиск и по смежным нишам (AI подберёт до 3 соседних тем) + сортировка.
  const [expandNiches, setExpandNiches] = useState(false);
  const [sortMode, setSortMode] = useState<"viral" | "date">("viral");

  // Trend analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState("");
  const [ideas, setIdeas] = useState<TrendContentIdea[] | null>(init.ideas ?? null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(null);

  // Сохраняем при каждом изменении персистируемых полей.
  // ВАЖНО: не выходим раньше при пустом state — иначе после очистки
  // (setResult(null) / setIdeas(null) на повторном запросе) старые
  // данные остаются в localStorage и подтягиваются при следующем mount.
  // Debounce 500ms: раньше каждый набор символа в `query` дёргал
  // JSON.stringify({...result.items[50]…}) → setItem → блокировал main
  // thread при быстрой печати. setTimeout позволяет печатать плавно.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        if (!query && !result && !ideas) {
          localStorage.removeItem(storageKey);
          return;
        }
        localStorage.setItem(storageKey, JSON.stringify({ query, sources, result, ideas, filter }));
      } catch { /* quota — пропускаем */ }
    }, 500);
    return () => clearTimeout(t);
  }, [query, sources, result, ideas, filter, storageKey]);

  const handleCreate = async (idea: TrendContentIdea) => {
    if (!onCreateFromIdea) return;
    setCreatingId(idea.id);
    try {
      await onCreateFromIdea(idea);
    } finally {
      setCreatingId(null);
    }
  };

  const handleCreatePackage = async (idea: TrendContentIdea) => {
    if (!onCreatePackage) return;
    setCreatingPackageId(idea.id);
    try {
      await onCreatePackage(idea);
    } finally {
      setCreatingPackageId(null);
    }
  };

  const toggleSource = (id: string) => {
    setSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null); setIdeas(null);
    try {
      const res = await fetch("/api/content/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), sources, expandNiches, sort: sortMode }),
      });
      const data = await jsonOrThrow(res);
      if (data.ok) setResult(data.result);
      else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const analyze = async () => {
    if (!result || result.items.length === 0) return;
    setAnalyzing(true); setAnalyzeErr(""); setIdeas(null);
    try {
      const res = await fetch("/api/content/trends/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: result.items,
          query: result.query,
          companyName: analysis?.company?.name ?? "",
          niche: analysis?.company?.niche ?? "",
        }),
      });
      const data = await jsonOrThrow(res);
      if (data.ok) setIdeas(data.ideas);
      else setAnalyzeErr(data.error || "Ошибка анализа");
    } catch (e) { setAnalyzeErr(String(e)); }
    finally { setAnalyzing(false); }
  };

  const displayedItems = result
    ? (filter === "all" ? result.items : result.items.filter(i => i.source.toLowerCase().includes(filter)))
    : [];

  const allSources = result
    ? Array.from(new Set(result.items.map(i => i.source)))
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 800, color: "var(--foreground)", margin: "0 0 8px", letterSpacing: -0.5 }}>
          <TrendingUp size={28} /> Тренды по нише
        </h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: 15, margin: 0, lineHeight: 1.5 }}>
          Актуальные публикации из Habr, VC.ru, Cossa, Google News — Claude превращает их в готовые идеи контента в один клик.
        </p>
      </div>

      {/* Mode switch: поиск трендов по нише vs разбор конкретного ролика */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button
          onClick={() => setMode("query")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: `1px solid ${mode === "query" ? "var(--primary)" : "var(--border)"}`, cursor: "pointer",
            background: mode === "query" ? "var(--primary)" : "var(--card)",
            color: mode === "query" ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          <TrendingUp size={14} /> Тренды по нише
        </button>
        <button
          onClick={() => setMode("breakdown")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: `1px solid ${mode === "breakdown" ? "var(--primary)" : "var(--border)"}`, cursor: "pointer",
            background: mode === "breakdown" ? "var(--primary)" : "var(--card)",
            color: mode === "breakdown" ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          <Clapperboard size={14} /> Разбор ролика
        </button>
        <button
          onClick={() => setMode("rewrite")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: `1px solid ${mode === "rewrite" ? "var(--primary)" : "var(--border)"}`, cursor: "pointer",
            background: mode === "rewrite" ? "var(--primary)" : "var(--card)",
            color: mode === "rewrite" ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          <Wand2 size={14} /> Рерайт текста
        </button>
      </div>

      {mode === "breakdown" && (
        <ReelBreakdownPanel
          companyName={analysis?.company?.name ?? ""}
          niche={analysis?.company?.description ?? ""}
          smmAnalysis={smmAnalysis ?? null}
          brandBook={brandBook ?? null}
          onSendReelToLibrary={onSendReelToLibrary}
        />
      )}

      {mode === "rewrite" && (
        <RewritePanel
          companyName={analysis?.company?.name ?? ""}
          niche={analysis?.company?.description ?? ""}
          smmAnalysis={smmAnalysis ?? null}
          brandBook={brandBook ?? null}
          onSendPostToLibrary={onSendPostToLibrary}
        />
      )}

      {mode === "query" && <>
      {/* Search panel */}
      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            className="ds-input"
            style={{ flex: 1 }}
            placeholder="Тема или ниша (например: маркетинг, SaaS, автоматизация)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run()}
          />
          <button
            className="ds-btn ds-btn-primary"
            onClick={run}
            disabled={loading || !query.trim() || sources.length === 0}
            style={{ minWidth: 120 }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Ищем…</>
              : <><Search size={14} /> Найти тренды</>
            }
          </button>
        </div>

        {/* Source toggles grouped */}
        {(["Новости", "Блоги", "Соцсети 🌐"] as const).map(group => (
          <div key={group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{group}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SOURCE_OPTIONS.filter(s => s.group === group).map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s",
                    background: sources.includes(s.id) ? "var(--primary)" : "var(--card)",
                    color: sources.includes(s.id) ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Смежные ниши + сортировка */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer", color: "var(--foreground)" }}>
            <input type="checkbox" checked={expandNiches} onChange={e => setExpandNiches(e.target.checked)} />
            + смежные ниши (AI подберёт до 3 соседних тем)
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--muted-foreground)" }}>
            Сначала:
            <select value={sortMode} onChange={e => setSortMode(e.target.value as "viral" | "date")}
              style={{ height: 28, padding: "0 8px", fontSize: 12.5, borderRadius: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer" }}>
              <option value="viral">виральные</option>
              <option value="date">свежие</option>
            </select>
          </label>
        </div>

        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {/* Results */}
      {result && (
        <div>
          {/* Статус каждого источника — почему TikTok=0 если он выбран */}
          {result.sourceStats && result.sourceStats.some(s => s.status !== "ok") && (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: "color-mix(in oklch, var(--warning) 8%, transparent)",
              border: "1px solid color-mix(in oklch, var(--warning) 35%, transparent)",
              borderRadius: 10, fontSize: 12, color: "var(--foreground-secondary)",
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: "var(--warning)", marginBottom: 4 }}>Статус источников:</div>
              {result.sourceStats.map(s => {
                const label = s.status === "not_configured" ? "не настроен"
                  : s.status === "empty" ? "ничего не нашлось"
                  : s.status === "error" ? "ошибка"
                  : `${s.count} публикаций`;
                const color = s.status === "ok" ? "var(--success)"
                  : s.status === "not_configured" ? "var(--destructive)"
                  : "var(--muted-foreground)";
                return (
                  <div key={s.source} style={{ display: "inline-block", marginRight: 12 }}>
                    <b style={{ color }}>{s.source}</b>: {label}
                    {s.note && <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> ({s.note})</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 15 }}>
              {result.total} публикаций по «{result.query}»
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Analyze button */}
              <button
                className="ds-btn ds-btn-primary"
                style={{ fontSize: 12, gap: 6, display: "flex", alignItems: "center" }}
                onClick={analyze}
                disabled={analyzing}
              >
                {analyzing
                  ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Анализирую…</>
                  : <><Sparkles size={12} /> Создать идеи из трендов</>
                }
              </button>
              <button
                className="ds-btn ds-btn-secondary"
                style={{ fontSize: 12, gap: 6, display: "flex", alignItems: "center" }}
                onClick={run}
              >
                <RefreshCw size={12} /> Обновить
              </button>
            </div>
          </div>

          {/* Source filter tabs */}
          {allSources.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => setFilter("all")}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: filter === "all" ? "var(--primary)" : "var(--card)", color: filter === "all" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
              >Все ({result.total})</button>
              {allSources.map(src => (
                <button
                  key={src}
                  onClick={() => setFilter(filter === src.toLowerCase() ? "all" : src.toLowerCase())}
                  style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: filter === src.toLowerCase() ? "var(--primary)" : "var(--card)", color: filter === src.toLowerCase() ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {src} ({result.items.filter(i => i.source === src).length})
                </button>
              ))}
            </div>
          )}

          {/* AI Ideas panel */}
          {(analyzing || ideas || analyzeErr) && (
            <div className="ds-card" style={{ marginBottom: 20, background: "color-mix(in oklch, var(--primary) 5%, var(--card))", borderColor: "color-mix(in oklch, var(--primary) 20%, var(--border))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 18, color: "var(--foreground)", marginBottom: 14 }}>
                <Sparkles size={18} style={{ color: "var(--primary)" }} />
                Идеи для контента на основе трендов
              </div>

              {analyzing && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  Анализируем тренды и создаём идеи…
                </div>
              )}

              {analyzeErr && (
                <div style={{ color: "var(--destructive)", fontSize: 12 }}>{analyzeErr}</div>
              )}

              {ideas && ideas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ideas.map(idea => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onCreate={onCreateFromIdea ? handleCreate : undefined}
                      creating={creatingId === idea.id}
                      onCreatePackage={onCreatePackage ? handleCreatePackage : undefined}
                      creatingPackage={creatingPackageId === idea.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Articles list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayedItems.length === 0 && (
              <div className="ds-card" style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px 0", fontSize: 13 }}>
                Ничего не найдено. Попробуйте другой запрос или источники.
              </div>
            )}
            {displayedItems.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div
                  className="ds-card"
                  style={{
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                    padding: "14px 16px",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4, marginBottom: 5 }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 8 }}>
                          {item.description.slice(0, 180)}{item.description.length > 180 ? "…" : ""}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "var(--primary)15", color: "var(--primary)" }}>
                          {item.source}
                        </span>
                        {typeof item.virality === "number" && item.virality >= 60 && (
                          <span title="Ранг виральности внутри источника"
                            style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "color-mix(in srgb, #f59e0b 14%, transparent)", color: "#d97706" }}>
                            🔥 {item.virality}
                          </span>
                        )}
                        {item.matchedQuery && (
                          <span title="Найдено по смежной нише"
                            style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "color-mix(in srgb, #8b5cf6 12%, transparent)", color: "#7c3aed" }}>
                            смежная: {item.matchedQuery}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted-foreground)" }}>
                          <Calendar size={10} /> {timeAgo(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="ds-card" style={{ textAlign: "center", padding: "48px 0" }}>
          <TrendingUp size={40} style={{ color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Мониторинг трендов</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 360, margin: "0 auto" }}>
            Введите тему или нишу — получите свежие публикации из ведущих IT- и маркетинговых изданий. Идеально для планирования актуального контента.
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

const MAX_UPLOAD_MB = 24;

/**
 * «Разбор ролика» — вторая вкладка Трендов. Разбирает чужой успешный ролик
 * (YouTube-ссылка или свой файл через Whisper) на крюк/структуру/приёмы
 * удержания/CTA, затем одной кнопкой адаптирует под компанию пользователя.
 * Instagram/VK/TikTok по ссылке не поддержаны (закрытые API) — для них
 * нужно скачать ролик и загрузить как файл.
 */
function ReelBreakdownPanel({ companyName, niche, smmAnalysis, brandBook, onSendReelToLibrary }: {
  companyName: string;
  niche: string;
  smmAnalysis: SMMResult | null;
  brandBook: BrandBook | null;
  onSendReelToLibrary?: (reel: GeneratedReel) => void;
}) {
  const [source, setSource] = useState<"url" | "upload">("url");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [breakdown, setBreakdown] = useState<ReelBreakdown | null>(null);

  const [adapting, setAdapting] = useState(false);
  const [adaptErr, setAdaptErr] = useState("");
  const [adapted, setAdapted] = useState<GeneratedReel | null>(null);
  const [sent, setSent] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const runBreakdown = async () => {
    setErr(""); setBreakdown(null); setAdapted(null); setAdaptErr(""); setSent(false);
    if (source === "url") {
      if (!youtubeUrl.trim()) return;
      setLoading(true);
      try {
        const res = await fetch("/api/content/reel-breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl: youtubeUrl.trim() }),
        });
        const data = await jsonOrThrow(res);
        if (data.ok) setBreakdown(data.breakdown);
        else setErr(data.error || "Не удалось разобрать ролик");
      } catch (e) { setErr(String(e)); }
      finally { setLoading(false); }
    } else {
      if (!file) return;
      setLoading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("filename", file.name);
        const res = await fetch("/api/content/reel-breakdown", { method: "POST", body: form });
        const data = await jsonOrThrow(res);
        if (data.ok) setBreakdown(data.breakdown);
        else setErr(data.error || "Не удалось разобрать ролик");
      } catch (e) { setErr(String(e)); }
      finally { setLoading(false); }
    }
  };

  const runAdapt = async () => {
    if (!breakdown) return;
    setAdapting(true); setAdaptErr(""); setSent(false);
    try {
      const res = await fetch("/api/content/reel-breakdown/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakdown, companyName, niche, smmAnalysis, brandBook, durationSec: 30 }),
      });
      const data = await jsonOrThrow(res);
      if (data.ok) setAdapted(data.data);
      else setAdaptErr(data.error || "Не удалось адаптировать сценарий");
    } catch (e) { setAdaptErr(String(e)); }
    finally { setAdapting(false); }
  };

  const handleFileChange = (f: File | null) => {
    setErr("");
    if (f && f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErr(`Файл слишком большой (${(f.size / 1024 / 1024).toFixed(1)} МБ > ${MAX_UPLOAD_MB} МБ) — обрежьте ролик или сожмите`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  return (
    <div>
      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setSource("url")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: source === "url" ? "var(--primary)" : "var(--card)", color: source === "url" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            <Link2 size={12} /> Ссылка на YouTube
          </button>
          <button
            onClick={() => setSource("upload")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: source === "upload" ? "var(--primary)" : "var(--card)", color: source === "upload" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            <Upload size={12} /> Загрузить свой файл
          </button>
        </div>

        {source === "url" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="ds-input"
              style={{ flex: 1 }}
              placeholder="https://www.youtube.com/watch?v=... или youtu.be/..."
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runBreakdown()}
            />
            <button className="ds-btn ds-btn-primary" onClick={runBreakdown} disabled={loading || !youtubeUrl.trim()} style={{ minWidth: 130 }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Разбираю…</> : <><Clapperboard size={14} /> Разобрать</>}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              style={{ display: "none" }}
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button className="ds-btn ds-btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, justifyContent: "flex-start" }}>
              <Upload size={14} /> {file ? file.name : `Выбрать видео/аудио файл (до ${MAX_UPLOAD_MB} МБ)`}
            </button>
            <button className="ds-btn ds-btn-primary" onClick={runBreakdown} disabled={loading || !file} style={{ minWidth: 130 }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Разбираю…</> : <><Clapperboard size={14} /> Разобрать</>}
            </button>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 10, lineHeight: 1.5 }}>
          Instagram Reels и VK Клипы по ссылке не разбираем — закрытые API. Скачайте ролик и загрузите файлом — сработает так же.
        </div>

        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {breakdown && (
        <div className="ds-card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "var(--foreground)", marginBottom: 14 }}>
            <Film size={18} style={{ color: "var(--primary)" }} />
            Разбор: «{breakdown.sourceTitle}»
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Крюк</div>
              <div style={{ fontSize: 14, color: "var(--foreground)", marginBottom: 4 }}>«{breakdown.hookText}»</div>
              <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{breakdown.hookWhy}</div>
            </div>

            {breakdown.structure.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Структура по таймкодам</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {breakdown.structure.map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "monospace", flexShrink: 0, minWidth: 78 }}>{b.timeRange}</span>
                      <span style={{ fontWeight: 700, color: "var(--foreground)", flexShrink: 0 }}>{b.beat}</span>
                      <span style={{ color: "var(--muted-foreground)" }}>{b.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {breakdown.retentionTricks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Приёмы удержания</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  {breakdown.retentionTricks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}

            {breakdown.cta && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>CTA</div>
                <div style={{ fontSize: 13, color: "var(--foreground)" }}>{breakdown.cta}</div>
              </div>
            )}

            <div style={{ padding: "10px 14px", background: "color-mix(in oklch, var(--primary) 6%, var(--card))", borderRadius: 10, fontSize: 12.5, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
              <b>Почему сработало:</b> {breakdown.whyItWorks}
            </div>
          </div>

          <button
            className="ds-btn ds-btn-primary"
            onClick={runAdapt}
            disabled={adapting || !companyName}
            style={{ marginTop: 16, width: "100%" }}
            title={!companyName ? "Сначала запустите анализ компании" : undefined}
          >
            {adapting
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Адаптирую под {companyName}…</>
              : <><Wand2 size={14} /> Адаптировать под мою компанию</>
            }
          </button>
          {!companyName && (
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6, textAlign: "center" }}>
              Нужен анализ компании — запустите его на вкладке «Моя компания».
            </div>
          )}
          {adaptErr && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>{adaptErr}</div>}
        </div>
      )}

      {adapted && (
        <div className="ds-card" style={{ background: "color-mix(in oklch, var(--success) 5%, var(--card))", borderColor: "color-mix(in oklch, var(--success) 25%, var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "var(--foreground)", marginBottom: 12 }}>
            <Sparkles size={18} style={{ color: "var(--success)" }} />
            {adapted.title}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Раскадровка</div>
              <button onClick={() => copy(adapted.scenario, "scenario")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                {copiedField === "scenario" ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать</>}
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, padding: "10px 12px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)" }}>
              {adapted.scenario}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {adapted.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 10%, transparent)", padding: "2px 8px", borderRadius: 8 }}>{h}</span>
            ))}
          </div>

          {onSendReelToLibrary && (
            <button
              className="ds-btn ds-btn-primary"
              onClick={() => { onSendReelToLibrary(adapted); setSent(true); }}
              disabled={sent}
              style={{ width: "100%" }}
            >
              {sent ? <><Check size={14} /> Отправлено в «Готовые рилсы»</> : <><Send size={14} /> Отправить в библиотеку рилсов</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Рерайт чужого текста под свою компанию ──────────────────────────────────
// Обещание «адаптировать и переписывать сценарии под вашу компанию» для
// текстов: вставил чужой пост/сценарий → та же механика, своё содержание,
// свой бренд. Результат уходит в библиотеку постов.
function RewritePanel({ companyName, niche, smmAnalysis, brandBook, onSendPostToLibrary }: {
  companyName: string;
  niche: string;
  smmAnalysis: SMMResult | null;
  brandBook: BrandBook | null;
  onSendPostToLibrary?: (post: GeneratedPost) => void;
}) {
  const [sourceText, setSourceText] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [mechanicsNote, setMechanicsNote] = useState("");
  const [sent, setSent] = useState(false);

  const run = async () => {
    setBusy(true); setError(""); setResult(null); setSent(false);
    try {
      const res = await fetch("/api/content/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, companyName, niche, platform, smmAnalysis, brandBook }),
      });
      const data = await jsonOrThrow(res);
      if (!data.ok) { setError(data.error || "Ошибка"); return; }
      setResult(data.data as GeneratedPost);
      setMechanicsNote(data.mechanicsNote || "");
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="ds-card" style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Вставьте чужой работающий текст (пост конкурента, сценарий, статью) — перепишем под вашу компанию:
        та же механика крючка и структуры, но своё содержание, ваш бренд и тон голоса. Чужие факты и цифры не переносятся.
      </p>
      <textarea
        value={sourceText}
        onChange={e => setSourceText(e.target.value)}
        placeholder="Текст оригинала (от 50 символов)…"
        rows={7}
        className="ds-input"
        style={{ width: "100%", resize: "vertical", marginBottom: 10, fontSize: 13.5, lineHeight: 1.5, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={platform} onChange={e => setPlatform(e.target.value)}
          style={{ height: 36, padding: "0 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer" }}>
          <option value="instagram">Instagram</option>
          <option value="vk">ВКонтакте</option>
          <option value="telegram">Telegram</option>
        </select>
        <button className="ds-btn ds-btn-primary" onClick={run} disabled={busy || sourceText.trim().length < 50}>
          {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Переписываем…</> : <><Wand2 size={14} /> Переписать под мою компанию</>}
        </button>
      </div>
      {error && <div style={{ color: "var(--destructive)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {mechanicsNote && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10, fontStyle: "italic" }}>
              Механика оригинала: {mechanicsNote}
            </div>
          )}
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{result.hook}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{result.body}</div>
          {result.hashtags.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--primary)", marginBottom: 12 }}>{result.hashtags.join(" ")}</div>
          )}
          {onSendPostToLibrary && (
            <button className="ds-btn ds-btn-primary" disabled={sent}
              onClick={() => { onSendPostToLibrary(result); setSent(true); }}>
              {sent ? <><Check size={14} /> В библиотеке постов</> : <><Send size={14} /> В библиотеку постов</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
