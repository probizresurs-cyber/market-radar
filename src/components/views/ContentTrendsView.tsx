"use client";

import React, { useState } from "react";
import { TrendingUp, Search, RefreshCw, ExternalLink, Calendar, Loader2, Sparkles, Copy, Check, FileText, Film, Image, Layout, Wand2 } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

interface TrendItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  description?: string;
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

export function ContentTrendsView({ analysis, onCreateFromIdea, onCreatePackage }: {
  analysis: AnalysisResult | null;
  /** Callback вызывается, когда пользователь нажимает «Создать пост/сторис/…»
   *  на карточке идеи. Должен вернуть Promise — пока он не разрешится, кнопка
   *  показывает спиннер. */
  onCreateFromIdea?: (idea: TrendContentIdea) => Promise<void>;
  /** Пакетная генерация — пост + сторис + карусель + рилс параллельно
   *  одной идеей. Кнопка «Пакет (4 формата)» на карточке. */
  onCreatePackage?: (idea: TrendContentIdea) => Promise<void>;
}) {
  const defaultQuery = analysis?.company?.description?.split("\n")[0]?.slice(0, 80) || analysis?.company?.name || "";
  const [query, setQuery] = useState(defaultQuery);
  const [sources, setSources] = useState<string[]>(["yandex_news", "habr", "vc"]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ query: string; total: number; items: TrendItem[] } | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Trend analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState("");
  const [ideas, setIdeas] = useState<TrendContentIdea[] | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(null);

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
        body: JSON.stringify({ query: query.trim(), sources }),
      });
      const data = await res.json();
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
      const data = await res.json();
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

        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {/* Results */}
      {result && (
        <div>
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
                  Claude анализирует тренды и создаёт идеи…
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
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "var(--primary)15", color: "var(--primary)" }}>
                          {item.source}
                        </span>
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
    </div>
  );
}
