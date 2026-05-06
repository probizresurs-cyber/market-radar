"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PenLine, Plus, Key, X, FileText, Loader2, Network, HelpCircle, ScanLine, Copy, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { BrandBook } from "@/lib/content-types";
import type { CompanyStyleProfile, CompanyStyleState } from "@/lib/company-style-types";
import { CompanyStylePanel } from "@/components/views/CompanyStylePanel";
import type {
  SEOArticle, SEOArticleBrief, SEOSection, SEOArticleMeta,
  SEOKeyword, SEOPlatform, SEOArticleType, SEOArticlesState,
} from "@/lib/seo-types";
import { SEO_PLATFORMS, SEO_ARTICLE_TYPES } from "@/lib/seo-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function calcWordCount(text: string) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function calcSEOScore(article: Partial<SEOArticle>): number {
  if (!article.fullText || !article.brief) return 0;
  let score = 0;
  const text = article.fullText.toLowerCase();
  const kw = article.brief.focusKeyword?.toLowerCase() || "";
  if (kw) {
    if (article.h1?.toLowerCase().includes(kw)) score += 20;
    if (article.meta?.title?.toLowerCase().includes(kw)) score += 15;
    if (article.meta?.metaDescription?.toLowerCase().includes(kw)) score += 10;
    if (text.slice(0, 500).includes(kw)) score += 15;
    const kwCount = (text.match(new RegExp(kw, "g")) || []).length;
    const words = text.split(/\s+/).length;
    const density = (kwCount / words) * 100;
    if (density >= 0.8 && density <= 3) score += 20;
    else if (density > 0) score += 10;
  }
  if (article.meta?.title && article.meta.title.length <= 60) score += 5;
  if (article.meta?.metaDescription && article.meta.metaDescription.length <= 160) score += 5;
  if (article.brief.callToAction && text.includes(article.brief.callToAction.slice(0, 10).toLowerCase())) score += 10;
  return Math.min(score, 100);
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function MiniScore({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--destructive)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{score}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

// ─── Platform badge ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: SEOPlatform }) {
  const p = SEO_PLATFORMS.find(x => x.id === platform);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: "var(--muted)", color: "var(--foreground)",
    }}>
      {p?.icon} {p?.label || platform}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SEOArticle["status"], string> = {
  draft: "Черновик", outline: "Структура", generated: "Сгенерировано", reviewed: "Готово",
};
const STATUS_COLORS: Record<SEOArticle["status"], string> = {
  draft: "var(--muted-foreground)", outline: "var(--warning)", generated: "var(--primary)", reviewed: "var(--success)",
};

// ─── Char counter ─────────────────────────────────────────────────────────────

function CharCounter({ value, max, label }: { value: string; max: number; label: string }) {
  const len = value?.length || 0;
  const pct = (len / max) * 100;
  const color = pct > 100 ? "var(--destructive)" : pct > 85 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
      <span>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{len} / {max}</span>
    </div>
  );
}

// ─── SEO Library View ─────────────────────────────────────────────────────────

function SEOLibraryView({
  articles,
  onNew,
  onOpen,
  onDelete,
}: {
  articles: SEOArticle[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<SEOArticle["status"] | "all">("all");

  const shown = filter === "all" ? articles : articles.filter(a => a.status === filter);

  if (articles.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
        <PenLine size={48} />
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Нет SEO-статей</div>
        <div style={{ color: "var(--muted-foreground)", textAlign: "center", maxWidth: 360 }}>
          Создайте первую SEO-статью — AI составит бриф, структуру и текст
        </div>
        <button className="ds-btn ds-btn-primary" onClick={onNew} style={{ marginTop: 8, gap: 6, display: "flex", alignItems: "center" }}>
          <Plus size={14}/> Новая статья
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Библиотека статей</div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 2 }}>{articles.length} статей</div>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={onNew} style={{ gap: 6, display: "flex", alignItems: "center" }}>
          <Plus size={14}/> Новая статья
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "draft", "outline", "generated", "reviewed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: "1px solid var(--border)", cursor: "pointer",
              background: filter === f ? "var(--primary)" : "var(--card)",
              color: filter === f ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {f === "all" ? "Все" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {shown.map(article => (
          <div
            key={article.id}
            className="ds-card"
            style={{ cursor: "pointer", position: "relative" }}
            onClick={() => onOpen(article.id)}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--foreground)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  marginBottom: 4,
                }}>
                  {article.h1 || article.brief.topic}
                </div>
                <PlatformBadge platform={article.brief.platform} />
              </div>
              {article.seoScore != null && <MiniScore score={article.seoScore} label="SEO" />}
            </div>

            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 4 }}>
              <Key size={14}/> {article.brief.focusKeyword}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[article.status] }}>
                ● {STATUS_LABELS[article.status]}
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {article.wordCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{article.wordCount} сл.</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onDelete(article.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--destructive)", fontSize: 14, padding: "2px 4px", opacity: 0.7 }}
                >
                  <X size={14}/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Keyword Cluster View ─────────────────────────────────────────────────────

function SEOKeywordsView({
  analysis,
  onBack,
}: {
  analysis: AnalysisResult | null;
  onBack: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/seo-cluster-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          companyName: analysis?.company?.name,
          niche: analysis?.company?.description?.slice(0, 60) || "",
        }),
      });
      const data = await res.json();
      if (data.cluster?.keywords) setKeywords(data.cluster.keywords);
      else setErr(data.error || "Ошибка генерации");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const copyAll = () => {
    navigator.clipboard?.writeText(keywords.map(k => k.phrase).join("\n"));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20 }}>←</button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Кластер ключевых слов</div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>AI-группировка семантики для статьи</div>
        </div>
      </div>

      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--foreground)" }}>Тема статьи</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="ds-input"
            style={{ flex: 1 }}
            placeholder="Например: продвижение сайта в поиске"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
          />
          <button
            className="ds-btn ds-btn-primary"
            onClick={generate}
            disabled={loading || !topic.trim()}
          >
            {loading ? "⏳" : "🔍"} Собрать
          </button>
        </div>
        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>

      {keywords.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{keywords.length} ключевых слов</div>
            <button className="ds-btn ds-btn-secondary" style={{ fontSize: 12, height: 30 }} onClick={copyAll}>
              📋 Копировать все
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["high", "medium", "low"].map(freq => {
              const group = keywords.filter(k => k.frequency === freq);
              if (!group.length) return null;
              const freqLabel = freq === "high" ? "Высокочастотные" : freq === "medium" ? "Среднечастотные" : "Низкочастотные";
              const freqColor = freq === "high" ? "var(--primary)" : freq === "medium" ? "var(--warning)" : "var(--muted-foreground)";
              return (
                <div key={freq} className="ds-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: freqColor, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                    {freqLabel} ({group.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {group.map(kw => (
                      <span
                        key={kw.phrase}
                        style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 12,
                          background: kw.isLsi ? "color-mix(in oklch, var(--warning) 12%, transparent)" : "color-mix(in oklch, var(--primary) 10%, transparent)",
                          color: kw.isLsi ? "var(--warning)" : "var(--primary)",
                          fontWeight: 500, cursor: "pointer",
                        }}
                        title={kw.isLsi ? "LSI-ключ" : "Основной ключ"}
                      >
                        {kw.isLsi ? "〜" : "#"} {kw.phrase}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "var(--muted-foreground)" }}>
            <span>
              <span style={{ color: "var(--primary)", fontWeight: 600 }}># основные</span> — прямые запросы
            </span>
            <span>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>〜 LSI</span> — семантически близкие
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Article Editor ───────────────────────────────────────────────────────────

function SEOArticleEditor({
  article,
  onSave,
  onBack,
  companyStyleProfile,
}: {
  article: SEOArticle;
  onSave: (updated: SEOArticle) => void;
  onBack: () => void;
  companyStyleProfile: CompanyStyleProfile | null;
}) {
  const [art, setArt] = useState<SEOArticle>(article);
  const [activeTab, setActiveTab] = useState<"outline" | "content" | "meta">("outline");
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [err, setErr] = useState("");

  const update = (patch: Partial<SEOArticle>) => {
    setArt(prev => ({ ...prev, ...patch }));
  };

  // Persist article to library. Accepts optional override so callers can save
  // a fresh computed state without waiting for React's async setArt.
  const persist = (override?: SEOArticle) => {
    const target = override ?? art;
    const score = calcSEOScore(target);
    const wc = calcWordCount(target.fullText);
    const saved = { ...target, seoScore: score, wordCount: wc, updatedAt: new Date().toISOString() };
    onSave(saved);
    return saved;
  };

  const save = () => { persist(); };

  // Generate full article
  const generateFull = async () => {
    setGeneratingFull(true); setErr("");
    try {
      const res = await fetch("/api/seo-generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: art.brief,
          h1: art.h1,
          intro: art.intro,
          sections: art.outline,
          conclusion: art.conclusion,
          mode: "full",
          companyStyleProfile,
        }),
      });
      const data = await res.json();
      if (data.fullText) {
        const nextArt: SEOArticle = {
          ...art,
          fullText: data.fullText,
          wordCount: data.wordCount,
          status: "generated",
        };
        setArt(nextArt);
        persist(nextArt);
        setActiveTab("content");
      } else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setGeneratingFull(false); }
  };

  // Generate single section
  const generateSection = async (secId: string) => {
    setGeneratingSection(secId); setErr("");
    try {
      const res = await fetch("/api/seo-generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: art.brief,
          h1: art.h1,
          intro: art.intro,
          sections: art.outline,
          conclusion: art.conclusion,
          mode: "section",
          sectionId: secId,
          companyStyleProfile,
        }),
      });
      const data = await res.json();
      if (data.content) {
        const newOutline = art.outline.map(s =>
          s.id === secId ? { ...s, generatedContent: data.content, status: "done" as const } : s
        );
        // Rebuild fullText from sections
        const fullText = `# ${art.h1}\n\n${art.intro}\n\n` +
          newOutline.map(s => `${"#".repeat(s.level)} ${s.heading}\n\n${s.generatedContent || ""}`).join("\n\n") +
          `\n\n${art.conclusion}`;
        const nextArt: SEOArticle = {
          ...art,
          outline: newOutline,
          fullText,
          status: "generated",
        };
        setArt(nextArt);
        persist(nextArt);
      } else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setGeneratingSection(null); }
  };

  // Generate meta
  const generateMeta = async () => {
    try {
      const res = await fetch("/api/seo-generate-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          h1: art.h1,
          intro: art.intro,
          focusKeyword: art.brief.focusKeyword,
          platform: art.brief.platform,
          topic: art.brief.topic,
        }),
      });
      const data = await res.json();
      if (data.meta) {
        const nextArt: SEOArticle = { ...art, meta: data.meta };
        setArt(nextArt);
        persist(nextArt);
      }
    } catch (e) { console.error(e); }
  };

  // Auto-save manual edits (title, intro, conclusion, meta fields) with a
  // debounce so we don't write to localStorage on every keystroke.
  const artRef = useRef(art);
  artRef.current = art;
  useEffect(() => {
    const t = setTimeout(() => { persist(artRef.current); }, 800);
    return () => clearTimeout(t);
    // We intentionally watch only the serialized form of `art` to avoid
    // depending on `persist` identity (would loop forever otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art]);

  const score = calcSEOScore(art);
  const wc = calcWordCount(art.fullText);
  const scoreColor = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--destructive)";

  const exportMd = () => {
    const md = art.fullText;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${art.meta?.slug || "article"}.md`;
    a.click();
  };

  const exportTxt = () => {
    const blob = new Blob([art.fullText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${art.meta?.slug || "article"}.txt`;
    a.click();
  };

  const TABS = [
    { id: "outline", label: "Структура" },
    { id: "content", label: "Текст" },
    { id: "meta", label: "SEO-мета" },
  ] as const;

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20 }}>←</button>
            <PlatformBadge platform={art.brief.platform} />
            <span style={{ fontSize: 11, color: STATUS_COLORS[art.status], fontWeight: 600 }}>● {STATUS_LABELS[art.status]}</span>
          </div>
          <input
            style={{
              fontSize: 20, fontWeight: 700, color: "var(--foreground)",
              background: "transparent", border: "none", outline: "none",
              width: "100%", padding: 0,
            }}
            value={art.h1}
            onChange={e => update({ h1: e.target.value })}
            placeholder="Заголовок H1..."
          />
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Key size={14}/> {art.brief.focusKeyword}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{score}</div>
              <div style={{ fontSize: 9, color: "var(--muted-foreground)", textTransform: "uppercase" }}>SEO</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)" }}>{wc}</div>
              <div style={{ fontSize: 9, color: "var(--muted-foreground)", textTransform: "uppercase" }}>слов</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ds-btn ds-btn-secondary" style={{ height: 30, fontSize: 11 }} onClick={exportMd}>⬇ .md</button>
            <button className="ds-btn ds-btn-secondary" style={{ height: 30, fontSize: 11 }} onClick={exportTxt}>⬇ .txt</button>
            <button className="ds-btn ds-btn-primary" style={{ height: 30, fontSize: 11 }} onClick={save}>💾 Сохранить</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, gap: 4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              color: activeTab === t.id ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === t.id ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 10%, transparent)", color: "var(--destructive)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Tab: Outline */}
      {activeTab === "outline" && (
        <div>
          {/* Intro */}
          <div className="ds-card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 6 }}>Лид-абзац</div>
            <textarea
              className="ds-textarea"
              style={{ fontSize: 13 }}
              rows={3}
              value={art.intro}
              onChange={e => update({ intro: e.target.value })}
              placeholder="Вводный абзац, привлекающий читателя..."
            />
          </div>

          {/* Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {art.outline.map((sec, i) => (
              <div
                key={sec.id}
                className="ds-card"
                style={{ borderLeft: `3px solid ${sec.status === "done" ? "var(--success)" : "var(--border)"}` }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 10%, transparent)", padding: "1px 6px", borderRadius: 4 }}>H{sec.level}</span>
                      <input
                        style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", background: "transparent", border: "none", outline: "none", flex: 1 }}
                        value={sec.heading}
                        onChange={e => {
                          const newOutline = art.outline.map(s => s.id === sec.id ? { ...s, heading: e.target.value } : s);
                          update({ outline: newOutline });
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{sec.contentBrief}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                      {sec.keywords.map(kw => (
                        <span key={kw} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)" }}>#{kw}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>~{sec.wordTarget} слов</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    {sec.status === "done"
                      ? <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>✓ готово</span>
                      : null
                    }
                    <button
                      className="ds-btn ds-btn-secondary"
                      style={{ height: 28, fontSize: 11, padding: "0 10px" }}
                      disabled={generatingSection === sec.id}
                      onClick={() => generateSection(sec.id)}
                    >
                      {generatingSection === sec.id ? <Loader2 size={14}/> : <PenLine size={14}/>} Написать
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Conclusion */}
          <div className="ds-card" style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 6 }}>Заключение / CTA</div>
            <textarea
              className="ds-textarea"
              style={{ fontSize: 13 }}
              rows={2}
              value={art.conclusion}
              onChange={e => update({ conclusion: e.target.value })}
              placeholder="Итог и призыв к действию..."
            />
          </div>

          {/* Generate all */}
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              className="ds-btn ds-btn-primary"
              style={{ flex: 1, gap: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              disabled={generatingFull}
              onClick={generateFull}
            >
              {generatingFull ? "⏳ Генерирую..." : "🚀 Сгенерировать всю статью"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Content */}
      {activeTab === "content" && (
        <div>
          {art.fullText ? (
            <textarea
              className="ds-textarea"
              style={{ minHeight: 500, fontSize: 13, lineHeight: 1.7, fontFamily: "inherit" }}
              value={art.fullText}
              onChange={e => update({ fullText: e.target.value })}
            />
          ) : (
            <div style={{ textAlign: "center", padding: 60, color: "var(--muted-foreground)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Текст ещё не сгенерирован</div>
              <button className="ds-btn ds-btn-primary" disabled={generatingFull} onClick={generateFull}>
                {generatingFull ? "⏳ Генерирую..." : "🚀 Сгенерировать статью"}
              </button>
            </div>
          )}

          {art.fullText && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>
              <span>{wc} слов · {art.brief.wordCountTarget} целевых</span>
              <span>SEO-скор: <strong style={{ color: scoreColor }}>{score}/100</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Meta */}
      {activeTab === "meta" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="ds-btn ds-btn-secondary" onClick={generateMeta} style={{ gap: 6, display: "flex", alignItems: "center" }}>
              ✨ Сгенерировать авто
            </button>
          </div>

          {/* Preview */}
          {art.meta?.title && (
            <div className="ds-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 10 }}>Превью в поиске</div>
              <div style={{ maxWidth: 600 }}>
                <div style={{ color: "#1a0dab", fontSize: 18, fontWeight: 400, marginBottom: 2 }}>
                  {art.meta.title}
                </div>
                <div style={{ color: "#006621", fontSize: 13, marginBottom: 2 }}>
                  {`yourdomain.ru/${art.meta.slug || "article"}`}
                </div>
                <div style={{ color: "#545454", fontSize: 13, lineHeight: 1.5 }}>
                  {art.meta.metaDescription}
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>Title (title тег)</label>
            <input
              className="ds-input"
              value={art.meta?.title || ""}
              onChange={e => update({ meta: { ...art.meta!, title: e.target.value } })}
              placeholder="SEO-заголовок страницы..."
            />
            <CharCounter value={art.meta?.title || ""} max={60} label="рекомендуется до 60 символов" />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>Meta Description</label>
            <textarea
              className="ds-textarea"
              rows={3}
              value={art.meta?.metaDescription || ""}
              onChange={e => update({ meta: { ...art.meta!, metaDescription: e.target.value } })}
              placeholder="Краткое описание для поисковой выдачи..."
            />
            <CharCounter value={art.meta?.metaDescription || ""} max={160} label="рекомендуется до 160 символов" />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>Slug (URL)</label>
            <input
              className="ds-input"
              value={art.meta?.slug || ""}
              onChange={e => update({ meta: { ...art.meta!, slug: e.target.value } })}
              placeholder="url-friendly-slug"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>Фокус-ключ</label>
            <input
              className="ds-input"
              value={art.meta?.focusKeyword || art.brief.focusKeyword || ""}
              onChange={e => update({ meta: { ...art.meta!, focusKeyword: e.target.value } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Topic suggestion helpers ────────────────────────────────────────────────

interface SuggestedTopic {
  title: string;
  keyword?: string;
  source: "analysis" | "keyword-gap" | "opportunity" | "template";
  badge: string;
  badgeColor: string;
  difficulty?: "low" | "medium" | "high";
  volume?: number;
}

function extractAnalysisTopics(a: AnalysisResult | null, at: SEOArticleType): SuggestedTopic[] {
  if (!a) return [];
  const out: SuggestedTopic[] = [];
  for (const idea of (a.practicalAdvice?.contentIdeas || []).slice(0, 6)) {
    out.push({ title: idea, source: "analysis", badge: "AI-идея", badgeColor: "var(--primary)" });
  }
  const pre: Record<string, string> = {
    informational: "Что такое", "how-to": "Как использовать", listicle: "Топ инструментов для",
    review: "Обзор:", comparison: "Сравнение решений:", faq: "FAQ по теме",
    "case-study": "Кейс по", "landing-article": "Почему выбирают",
    news: "Новости в области", "expert-column": "Экспертное мнение:",
  };
  for (const g of (a.practicalAdvice?.keywordGaps || []).slice(0, 5)) {
    out.push({
      title: `${pre[at] || ""} ${g.keyword}`.trim(), keyword: g.keyword, source: "keyword-gap",
      badge: g.difficulty === "low" ? "Легко" : g.difficulty === "medium" ? "Средне" : "Сложно",
      badgeColor: g.difficulty === "low" ? "var(--success)" : g.difficulty === "medium" ? "var(--warning)" : "var(--destructive)",
      difficulty: g.difficulty, volume: g.volume,
    });
  }
  for (const opp of (a.nicheForecast?.opportunities || []).slice(0, 4)) {
    out.push({ title: opp, source: "opportunity", badge: "Тренд", badgeColor: "var(--success)" });
  }
  return out;
}

function getTemplateTopics(at: SEOArticleType, niche: string): SuggestedTopic[] {
  const n = niche || "вашей нише";
  const m: Record<SEOArticleType, string[]> = {
    informational: [`Полное руководство по ${n}`, `Что такое ${n} и зачем это нужно`, `${n}: от основ до продвинутого уровня`, `Всё, что нужно знать о ${n} в 2026`, `Как ${n} меняет рынок`],
    "how-to": [`Как начать работу с ${n}`, `Как выбрать лучшее решение в ${n}`, `Как увеличить эффективность в ${n}`, `Как автоматизировать процессы в ${n}`, `Как избежать ошибок в ${n}`],
    listicle: [`Топ-10 инструментов для ${n}`, `7 лучших практик в ${n}`, `15 ошибок в ${n}, которых легко избежать`, `5 трендов ${n} в 2026`, `12 советов по ${n} от экспертов`],
    review: [`Обзор лучших решений в ${n}`, `Детальный обзор рынка ${n}`, `Обзор новинок в ${n}`, `Независимый обзор сервисов для ${n}`],
    comparison: [`Сравнение подходов к ${n}`, `Что лучше для ${n}: варианты`, `Онлайн vs офлайн в ${n}`, `Бюджетные vs премиум в ${n}`],
    "case-study": [`Кейс: как мы увеличили показатели в ${n}`, `Реальный опыт внедрения ${n}`, `Результаты за 6 месяцев в ${n}`, `От нуля до результата: ${n}`],
    faq: [`FAQ: 20 вопросов про ${n}`, `Ответы на главные вопросы о ${n}`, `${n} простыми словами`, `Мифы и факты о ${n}`],
    "landing-article": [`Почему ${n} — это то, что вам нужно`, `${n}: преимущества для бизнеса`, `Готовое решение для ${n}`, `Как ${n} поможет расти`],
    news: [`Новые тренды в ${n}`, `${n} в 2026: обзор изменений`, `Главные события в ${n} за квартал`],
    "expert-column": [`Будущее ${n}: экспертный взгляд`, `Почему ${n} ждут перемены`, `Инсайды рынка ${n}`, `Уроки из работы с ${n}`],
  };
  return (m[at] || []).map(title => ({ title, source: "template" as const, badge: "Шаблон", badgeColor: "var(--muted-foreground)" }));
}

// ─── New Article Wizard ────────────────────────────────────────────────────────

function SEONewArticleView({
  analysis,
  taResult,
  brandBook,
  onCreated,
  onBack,
}: {
  analysis: AnalysisResult | null;
  taResult: TAResult | null;
  brandBook: BrandBook | null;
  onCreated: (article: SEOArticle) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"type" | "platform" | "topic" | "generating">("type");
  const [articleType, setArticleType] = useState<SEOArticleType>("informational");
  const [platform, setPlatform] = useState<SEOPlatform>("website");
  const [topic, setTopic] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [topicTab, setTopicTab] = useState<"analysis" | "templates" | "custom">(() => {
    const hasAny = analysis?.practicalAdvice?.contentIdeas?.length
      || analysis?.practicalAdvice?.keywordGaps?.length
      || analysis?.nicheForecast?.opportunities?.length;
    return hasAny ? "analysis" : "templates";
  });

  const niche = analysis?.company?.description?.slice(0, 60) || "";
  const analysisTopics = extractAnalysisTopics(analysis, articleType);
  const templateTopics = getTemplateTopics(articleType, niche);
  const hasAnalysis = analysisTopics.length > 0;

  const selectSuggested = (t: SuggestedTopic) => {
    setTopic(t.title);
    if (t.keyword) setFocusKeyword(t.keyword);
  };

  const taContext = taResult?.segments?.[0]
    ? `${taResult.segments[0].segmentName}: ${taResult.segments[0].mainProblems?.slice(0, 2).join("; ")}`
    : "";

  const create = async () => {
    if (!topic.trim()) return;
    setStep("generating");
    setLoading(true);
    setErr("");

    try {
      // Step 1: Generate brief
      setProgress("Составляем бриф...");
      const briefRes = await fetch("/api/seo-generate-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          companyName: analysis?.company?.name,
          niche: analysis?.company?.description?.slice(0, 60) || "",
          platform,
          articleType,
          taContext,
          brandBook,
        }),
      });
      const briefData = await briefRes.json();
      if (!briefData.brief) throw new Error(briefData.error || "Ошибка брифа");

      const brief: SEOArticleBrief = {
        articleType,
        platform,
        topic,
        audience: briefData.brief.audience || taContext || "широкая аудитория",
        wordCountTarget: briefData.brief.wordCountTarget || 2000,
        focusKeyword: focusKeyword || briefData.brief.focusKeyword || topic,
        secondaryKeywords: briefData.brief.secondaryKeywords || [],
        competitorUrls: [],
        toneOfVoice: brandBook?.toneOfVoice || briefData.brief.toneOfVoice || [],
        callToAction: briefData.brief.callToAction || "",
        internalLinks: [],
      };

      // Step 2: Generate outline
      setProgress("Строим структуру...");
      const outlineRes = await fetch("/api/seo-generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, keywords: [] }),
      });
      const outlineData = await outlineRes.json();
      if (!outlineData.outline) throw new Error(outlineData.error || "Ошибка структуры");

      const { h1, intro, sections, conclusion } = outlineData.outline;

      const outlineSections: SEOSection[] = (sections || []).map((s: Omit<SEOSection, "id"> & { id?: string }, i: number) => ({
        ...s,
        id: s.id || `s${i + 1}`,
        status: "empty" as const,
      }));

      // Step 3: Generate meta
      setProgress("Генерируем мета-теги...");
      let meta: SEOArticleMeta = {
        title: briefData.brief.suggestedMeta?.title || h1?.slice(0, 60) || topic,
        metaDescription: briefData.brief.suggestedMeta?.metaDescription || "",
        slug: briefData.brief.suggestedMeta?.slug || "",
        focusKeyword: brief.focusKeyword,
      };

      try {
        const metaRes = await fetch("/api/seo-generate-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ h1, intro, focusKeyword: brief.focusKeyword, platform, topic }),
        });
        const metaData = await metaRes.json();
        if (metaData.meta) meta = metaData.meta;
      } catch { /* use fallback */ }

      const article: SEOArticle = {
        id: genId(),
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        brief,
        keywords: [],
        outline: outlineSections,
        meta,
        h1: briefData.brief.suggestedH1 || h1 || topic,
        intro: intro || "",
        conclusion: conclusion || brief.callToAction,
        fullText: "",
        wordCount: 0,
        status: "outline",
        exportedFormats: [],
      };

      onCreated(article);
    } catch (e) {
      setErr(String(e));
      setStep("topic");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20 }}>←</button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Новая SEO-статья</div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>AI составит бриф, структуру и текст</div>
        </div>
      </div>

      {/* Progress indicator */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28, alignItems: "center" }}>
        {(["type", "platform", "topic"] as const).map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              background: step === s || (step === "generating" && i === 2) ? "var(--primary)" : ["type", "platform", "topic"].indexOf(step) > i ? "var(--success)" : "var(--muted)",
              color: step === s || (step === "generating" && i === 2) ? "var(--primary-foreground)" : ["type", "platform", "topic"].indexOf(step) > i ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}>{i + 1}</div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: ["type", "platform", "topic"].indexOf(step) > i ? "var(--success)" : "var(--muted)" }} />}
          </React.Fragment>
        ))}
      </div>

      {err && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 10%, transparent)", color: "var(--destructive)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Step 1: Article type */}
      {step === "type" && (
        <div>
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Тип статьи</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {SEO_ARTICLE_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => setArticleType(t.id)}
                style={{
                  padding: 14, borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${articleType === t.id ? "var(--primary)" : "var(--border)"}`,
                  background: articleType === t.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "var(--card)",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <button className="ds-btn ds-btn-primary" style={{ marginTop: 20, width: "100%" }} onClick={() => setStep("platform")}>
            Далее →
          </button>
        </div>
      )}

      {/* Step 2: Platform */}
      {step === "platform" && (
        <div>
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Площадка публикации</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SEO_PLATFORMS.map(p => {
              const [min, max] = p.recommendedChars;
              return (
                <div
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  style={{
                    padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${platform === p.id ? "var(--primary)" : "var(--border)"}`,
                    background: platform === p.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "var(--card)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{min.toLocaleString()}–{max ? max.toLocaleString() : "∞"} симв. · {p.formattingNote}</div>
                  </div>
                  {platform === p.id && <div style={{ color: "var(--primary)", fontSize: 16 }}>✓</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => setStep("type")}>← Назад</button>
            <button className="ds-btn ds-btn-primary" style={{ flex: 2 }} onClick={() => setStep("topic")}>Далее →</button>
          </div>
        </div>
      )}

      {/* Step 3: Topic + keyword — tabbed */}
      {step === "topic" && (
        <div>
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Выберите тему статьи</div>

          {/* Topic source tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16, gap: 2 }}>
            {([
              { id: "analysis" as const, label: "По анализу рынка", icon: "📊", disabled: !hasAnalysis },
              { id: "templates" as const, label: "Общие темы", icon: "📋", disabled: false },
              { id: "custom" as const, label: "Своя тема", icon: "✏️", disabled: false },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setTopicTab(tab.id)}
                style={{
                  padding: "8px 14px", background: "none", border: "none", cursor: tab.disabled ? "default" : "pointer",
                  fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                  color: tab.disabled ? "var(--muted)" : topicTab === tab.id ? "var(--primary)" : "var(--muted-foreground)",
                  borderBottom: topicTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
                  marginBottom: -1, opacity: tab.disabled ? 0.5 : 1,
                }}
                title={tab.disabled ? "Сначала проведите анализ компании" : ""}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Analysis-based topics */}
          {topicTab === "analysis" && (
            <div>
              {hasAnalysis ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis?.company && (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>
                      Темы на основе анализа <strong>{analysis.company.name}</strong>
                    </div>
                  )}
                  {analysisTopics.map((t, i) => (
                    <div
                      key={i}
                      onClick={() => selectSuggested(t)}
                      style={{
                        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                        border: `2px solid ${topic === t.title ? "var(--primary)" : "var(--border)"}`,
                        background: topic === t.title ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "var(--card)",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "border-color 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4 }}>{t.title}</div>
                        {t.keyword && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                            <Key size={14}/> {t.keyword}{t.volume ? ` · ~${t.volume.toLocaleString()} запр/мес` : ""}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: `color-mix(in oklch, ${t.badgeColor} 12%, transparent)`,
                        color: t.badgeColor, whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        {t.badge}
                      </span>
                      {topic === t.title && <span style={{ color: "var(--primary)", fontSize: 16, flexShrink: 0 }}>✓</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted-foreground)" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Нет данных анализа</div>
                  <div style={{ fontSize: 12 }}>Проведите анализ компании — AI предложит актуальные темы на основе рынка, конкурентов и ключевых слов</div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Template topics */}
          {topicTab === "templates" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Универсальные темы для типа «{SEO_ARTICLE_TYPES.find(t => t.id === articleType)?.label}»
              </div>
              {templateTopics.map((t, i) => (
                <div
                  key={i}
                  onClick={() => selectSuggested(t)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${topic === t.title ? "var(--primary)" : "var(--border)"}`,
                    background: topic === t.title ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "var(--card)",
                    display: "flex", alignItems: "center", gap: 10,
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t.title}</div>
                  {topic === t.title && <span style={{ color: "var(--primary)", fontSize: 16 }}>✓</span>}
                </div>
              ))}
            </div>
          )}

          {/* Tab: Custom topic */}
          {topicTab === "custom" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>Тема статьи *</label>
                <input
                  className="ds-input"
                  placeholder="Например: как выбрать CRM-систему для малого бизнеса"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && topic.trim() && create()}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 4 }}>
                  Фокус-ключевой запрос
                  <span style={{ color: "var(--muted-foreground)", fontWeight: 400, marginLeft: 6 }}>(опционально)</span>
                </label>
                <input
                  className="ds-input"
                  placeholder="Например: crm для малого бизнеса"
                  value={focusKeyword}
                  onChange={e => setFocusKeyword(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Selected topic preview + keyword override (for analysis/template tabs) */}
          {topicTab !== "custom" && topic && (
            <div className="ds-card" style={{ marginTop: 14, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 6 }}>Выбрана тема</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>{topic}</div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Фокус-ключ (можно изменить)</label>
                <input
                  className="ds-input"
                  style={{ fontSize: 12, height: 32 }}
                  placeholder="AI подберёт сам"
                  value={focusKeyword}
                  onChange={e => setFocusKeyword(e.target.value)}
                />
              </div>
            </div>
          )}

          {analysis?.company && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", background: "var(--muted)", padding: "8px 12px", borderRadius: 8, marginTop: 12 }}>
              ℹ️ Статья будет создана в контексте компании <strong>{analysis.company.name}</strong>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => setStep("platform")}>← Назад</button>
            <button className="ds-btn ds-btn-primary" style={{ flex: 2 }} disabled={!topic.trim()} onClick={create}>
              🚀 Создать статью
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {step === "generating" && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <PenLine size={48} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Создаём статью...</div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 14 }}>{progress}</div>
          <div style={{ marginTop: 20 }}>
            <div style={{ width: 200, height: 4, background: "var(--muted)", borderRadius: 4, margin: "0 auto" }}>
              <div style={{
                height: "100%", borderRadius: 4, background: "var(--primary)",
                animation: "pulse 1.5s ease-in-out infinite",
                width: "60%",
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Keyword Expand View ─────────────────────────────────────────────────────

function SEOKeywordExpandView({ analysis, onBack }: { analysis: AnalysisResult | null; onBack: () => void }) {
  const [seed, setSeed] = useState("");
  const [niche, setNiche] = useState(analysis?.company?.description?.slice(0, 80) || "");
  const [count, setCount] = useState(80);
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{
    seed: string; totalCount: number;
    clusters: Record<string, string[]>;
    modifiers: Record<string, string[]>;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  const run = async () => {
    if (!seed.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/seo/keyword-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seed.trim(), niche: niche.trim(), count, lang }),
      });
      const data = await res.json();
      if (data.ok) setResult(data.result);
      else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const copyGroup = (label: string, words: string[]) => {
    navigator.clipboard?.writeText(words.join("\n"));
    setCopied(label); setTimeout(() => setCopied(null), 1500);
  };

  const CLUSTER_LABELS: Record<string, string> = {
    informational: "📚 Информационные",
    commercial: "🛒 Коммерческие",
    transactional: "💰 Транзакционные",
    navigational: "🧭 Навигационные",
    longTail: "🎯 Длинный хвост",
    questions: "❓ Вопросы",
  };
  const MOD_LABELS: Record<string, string> = {
    geography: "📍 Гео-модификаторы",
    audience: "👥 Аудитория",
    quality: "⭐ Качество",
    price: "💵 Цена",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20, padding: 0 }}>←</button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
            <Network size={22} /> Расширить семантику
          </div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>NebulaKeyword-стиль: до 150 запросов по 10 кластерам интентов</div>
        </div>
      </div>

      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Сид-ключ *</label>
            <input className="ds-input" placeholder="Например: CRM для бизнеса" value={seed}
              onChange={e => setSeed(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Ниша (контекст)</label>
            <input className="ds-input" placeholder="B2B SaaS, Россия" value={niche} onChange={e => setNiche(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Кол-во ({count})</label>
            <input type="range" min={30} max={150} step={10} value={count} onChange={e => setCount(+e.target.value)}
              style={{ width: 120, accentColor: "var(--primary)" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ru", "en"] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: "1px solid var(--border)", cursor: "pointer",
                background: lang === l ? "var(--primary)" : "var(--card)",
                color: lang === l ? "var(--primary-foreground)" : "var(--foreground)",
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button className="ds-btn ds-btn-primary" onClick={run} disabled={loading || !seed.trim()} style={{ marginLeft: "auto" }}>
            {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Генерируем…</> : <><Network size={14} /> Расширить</>}
          </button>
        </div>
        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {result && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 16 }}>
              {result.totalCount} ключевых слов для «{result.seed}»
            </div>
            <button className="ds-btn ds-btn-secondary" style={{ fontSize: 12 }} onClick={() => {
              const all = Object.values(result.clusters).flat().concat(Object.values(result.modifiers).flat());
              navigator.clipboard?.writeText(all.join("\n"));
              setCopied("all"); setTimeout(() => setCopied(null), 1500);
            }}>
              {copied === "all" ? <><CheckCircle size={13}/> Скопировано</> : <><Copy size={13}/> Копировать всё</>}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(result.clusters).map(([key, words]) => {
              const label = CLUSTER_LABELS[key] || key;
              const isOpen = openCluster === key;
              return (
                <div key={key} className="ds-card" style={{ padding: 0, overflow: "hidden" }}>
                  <button onClick={() => setOpenCluster(isOpen ? null : key)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
                    color: "var(--foreground)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 10, padding: "1px 8px" }}>{words.length}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); copyGroup(key, words); }} className="ds-btn ds-btn-secondary" style={{ fontSize: 11, height: 26, padding: "0 10px" }}>
                      {copied === key ? "✓" : <Copy size={11}/>}
                    </button>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 16px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {words.map((w, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "var(--muted)", color: "var(--foreground)", cursor: "pointer" }}
                          onClick={() => { navigator.clipboard?.writeText(w); }}>{w}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", marginTop: 8, marginBottom: 4 }}>Модификаторы</div>
            {Object.entries(result.modifiers).map(([key, words]) => (
              words.length > 0 && (
                <div key={key} className="ds-card" style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>{MOD_LABELS[key] || key}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {words.map((w, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--muted)", color: "var(--foreground)" }}>{w}</span>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAA Questions View ───────────────────────────────────────────────────────

function SEOPAAView({ analysis, onBack }: { analysis: AnalysisResult | null; onBack: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{
    keyword: string;
    autocomplete: string[];
    questions: string[];
    related: string[];
    alphabet: { letter: string; suggestions: string[] }[];
  } | null>(null);
  const [tab, setTab] = useState<"questions" | "autocomplete" | "related" | "alphabet">("questions");
  const [copied, setCopied] = useState(false);

  const defaultKeyword = analysis?.company?.name || "";

  const run = async () => {
    const kw = keyword.trim() || defaultKeyword;
    if (!kw) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/seo/paa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, lang }),
      });
      const data = await res.json();
      if (data.ok) setResult(data.result);
      else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const copyList = (items: string[]) => {
    navigator.clipboard?.writeText(items.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const TABS = [
    { id: "questions" as const, label: "Вопросы", count: result?.questions.length },
    { id: "autocomplete" as const, label: "Автодополнение", count: result?.autocomplete.length },
    { id: "related" as const, label: "Похожие", count: result?.related.length },
    { id: "alphabet" as const, label: "A-Z", count: result?.alphabet.length },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20, padding: 0 }}>←</button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
            <HelpCircle size={22} /> Что спрашивают
          </div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>People Also Ask — автодополнение Google + Yandex, вопросы, A-Z расширение</div>
        </div>
      </div>

      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input className="ds-input" style={{ flex: 1 }}
            placeholder={defaultKeyword ? `По умолчанию: ${defaultKeyword}` : "Введите ключевое слово"}
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run()} />
          <div style={{ display: "flex", gap: 6 }}>
            {(["ru", "en"] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: "1px solid var(--border)", cursor: "pointer",
                background: lang === l ? "var(--primary)" : "var(--card)",
                color: lang === l ? "var(--primary-foreground)" : "var(--foreground)",
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button className="ds-btn ds-btn-primary" onClick={run} disabled={loading}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <HelpCircle size={14} />}
            {loading ? " Ищем…" : " Найти"}
          </button>
        </div>
        {err && <div style={{ color: "var(--destructive)", fontSize: 12 }}>{err}</div>}
      </div>

      {result && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 16px", borderRadius: "8px 8px 0 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "1px solid var(--border)", borderBottom: tab === t.id ? "1px solid var(--card)" : "1px solid var(--border)",
                background: tab === t.id ? "var(--card)" : "var(--muted)", color: tab === t.id ? "var(--primary)" : "var(--muted-foreground)",
                marginBottom: -1,
              }}>
                {t.label} {t.count != null && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="ds-card">
            {tab !== "alphabet" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button className="ds-btn ds-btn-secondary" style={{ fontSize: 11, height: 28 }}
                    onClick={() => copyList(tab === "questions" ? result.questions : tab === "autocomplete" ? result.autocomplete : result.related)}>
                    {copied ? <><CheckCircle size={12}/> Скопировано</> : <><Copy size={12}/> Копировать</>}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(tab === "questions" ? result.questions : tab === "autocomplete" ? result.autocomplete : result.related).map((item, i) => (
                    <div key={i} style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, background: "var(--muted)", color: "var(--foreground)", cursor: "pointer" }}
                      onClick={() => navigator.clipboard?.writeText(item)}>
                      {item}
                    </div>
                  ))}
                  {(tab === "questions" ? result.questions : tab === "autocomplete" ? result.autocomplete : result.related).length === 0 && (
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Ничего не найдено</div>
                  )}
                </div>
              </>
            )}
            {tab === "alphabet" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {result.alphabet.map(({ letter, suggestions }) => (
                  <div key={letter} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", marginBottom: 6 }}>{letter.toUpperCase()}</div>
                    {suggestions.map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: "var(--foreground-secondary)", cursor: "pointer", padding: "2px 0" }}
                        onClick={() => navigator.clipboard?.writeText(s)}>{s}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tech Audit View ─────────────────────────────────────────────────────────

function SEOTechAuditView({ analysis, onBack }: { analysis: AnalysisResult | null; onBack: () => void }) {
  const [url, setUrl] = useState(analysis?.company?.url || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<{
    url: string; finalUrl: string; fetchedAt: string; status: number;
    loadTimeMs: number; contentBytes: number; textBytes: number; contentRatio: number;
    language?: string; charset?: string;
    title: { value: string; length: number; ok: boolean };
    metaDescription: { value: string; length: number; ok: boolean };
    headings: { h1: { count: number; values: string[]; ok: boolean }; h2: { count: number; values: string[] }; h3: { count: number; values: string[] }; h4plus: number };
    images: { total: number; withAlt: number; withoutAlt: number; altCoverage: number };
    links: { internal: number; external: number; nofollow: number; externalDomains: string[] };
    words: { total: number; unique: number; avgWordLength: number; topKeywords: { word: string; count: number; density: number }[] };
    meta: { canonical?: string; robots?: string; viewport: boolean; hreflang: string[]; ogTags: number; twitterTags: number };
    warnings: { severity: "error" | "warning" | "info"; message: string }[];
  } | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(""); setReport(null);
    try {
      const res = await fetch("/api/seo/tech-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.ok) setReport(data.report);
      else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const SEV_COLOR = { error: "var(--destructive)", warning: "#f59e0b", info: "var(--primary)" };
  const SEV_ICON = { error: <AlertTriangle size={13}/>, warning: <AlertTriangle size={13}/>, info: <Info size={13}/> };

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 20, padding: 0 }}>←</button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
            <ScanLine size={22} /> Тех-аудит страницы
          </div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Проверка тайтла, мета, заголовков, картинок, ссылок, ключевых слов</div>
        </div>
      </div>

      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input className="ds-input" style={{ flex: 1 }} placeholder="https://example.com/page"
            value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} />
          <button className="ds-btn ds-btn-primary" onClick={run} disabled={loading || !url.trim()}>
            {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> Анализируем…</> : <><ScanLine size={14}/> Аудит</>}
          </button>
        </div>
        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {[
              { label: "HTTP статус", value: report.status, color: report.status === 200 ? "var(--success)" : "var(--destructive)" },
              { label: "Загрузка", value: `${(report.loadTimeMs / 1000).toFixed(1)}с`, color: report.loadTimeMs > 3000 ? "var(--destructive)" : "var(--success)" },
              { label: "Размер", value: `${(report.contentBytes / 1024).toFixed(0)} KB` },
              { label: "Контент/код", value: `${report.contentRatio}%`, color: report.contentRatio < 10 ? "var(--warning)" : "var(--success)" },
              { label: "Слов", value: fmt(report.words.total), color: report.words.total < 300 ? "var(--warning)" : "var(--foreground)" },
              { label: "Картинок", value: report.images.total },
              { label: "Alt покрытие", value: `${report.images.altCoverage}%`, color: report.images.altCoverage < 80 ? "var(--warning)" : "var(--success)" },
              { label: "Внут. ссылки", value: report.links.internal },
              { label: "Внеш. ссылки", value: report.links.external },
              { label: "OG теги", value: report.meta.ogTags },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--foreground)" }}>{value}</div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {report.warnings.length > 0 && (
            <div className="ds-card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--foreground)" }}>
                Проблемы и рекомендации ({report.warnings.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {report.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 12px", borderRadius: 8, background: `color-mix(in oklch, ${SEV_COLOR[w.severity]} 8%, transparent)`, border: `1px solid color-mix(in oklch, ${SEV_COLOR[w.severity]} 25%, transparent)` }}>
                    <span style={{ color: SEV_COLOR[w.severity], marginTop: 1, flexShrink: 0 }}>{SEV_ICON[w.severity]}</span>
                    <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Title & Meta */}
          <div className="ds-card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Title & Meta description</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>TITLE</span>
                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 8, background: report.title.ok ? "var(--success)20" : "var(--warning)20", color: report.title.ok ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>
                  {report.title.length} симв. {report.title.ok ? "✓" : "⚠"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground)", background: "var(--muted)", padding: "8px 12px", borderRadius: 8 }}>{report.title.value || "—"}</div>
            </div>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>META DESCRIPTION</span>
                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 8, background: report.metaDescription.ok ? "var(--success)20" : "var(--warning)20", color: report.metaDescription.ok ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>
                  {report.metaDescription.length} симв. {report.metaDescription.ok ? "✓" : "⚠"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--foreground)", background: "var(--muted)", padding: "8px 12px", borderRadius: 8 }}>{report.metaDescription.value || "—"}</div>
            </div>
          </div>

          {/* Headings */}
          <div className="ds-card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Структура заголовков</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[
                { tag: "H1", count: report.headings.h1.count, ok: report.headings.h1.ok },
                { tag: "H2", count: report.headings.h2.count, ok: report.headings.h2.count >= 2 },
                { tag: "H3", count: report.headings.h3.count, ok: true },
                { tag: "H4+", count: report.headings.h4plus, ok: true },
              ].map(({ tag, count, ok }) => (
                <div key={tag} style={{ textAlign: "center", padding: "8px 14px", borderRadius: 8, background: ok ? "var(--success)10" : "var(--warning)10", border: `1px solid ${ok ? "var(--success)" : "var(--warning)"}30` }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: ok ? "var(--success)" : "var(--warning)" }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{tag}</div>
                </div>
              ))}
            </div>
            {report.headings.h1.values.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>H1: {report.headings.h1.values.join(" · ")}</div>
            )}
          </div>

          {/* Top Keywords */}
          {report.words.topKeywords.length > 0 && (
            <div className="ds-card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Топ ключевых слов (TF)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {report.words.topKeywords.slice(0, 20).map(({ word, count, density }) => (
                  <span key={word} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, background: "var(--muted)", color: "var(--foreground)", display: "inline-flex", gap: 5, alignItems: "center" }}>
                    {word} <span style={{ fontSize: 10, opacity: 0.6 }}>{count}×</span>
                    <span style={{ fontSize: 10, color: density > 3 ? "var(--destructive)" : "var(--success)" }}>{density}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main SEO Articles View ───────────────────────────────────────────────────

export function SEOArticlesView({
  c,
  userId,
  analysis,
  taResult,
  brandBook,
  companyStyleProfile,
  companyStyleState,
  onUpdateCompanyStyle,
  onOpenStyleTab,
  activeSubNav,
}: {
  c: Colors;
  userId: string;
  analysis: AnalysisResult | null;
  taResult: TAResult | null;
  brandBook: BrandBook | null;
  companyStyleProfile: CompanyStyleProfile | null;
  companyStyleState: CompanyStyleState;
  onUpdateCompanyStyle: (next: CompanyStyleState) => void;
  onOpenStyleTab: () => void;
  activeSubNav: string;
}) {
  void c; // CSS variables handle theming now

  const storageKey = `mr_seo_${userId}`;

  const [state, setState] = useState<SEOArticlesState>({ articles: [], keywordClusters: [] });
  const [currentArticle, setCurrentArticle] = useState<SEOArticle | null>(null);
  const [subView, setSubView] = useState<"library" | "new" | "keywords" | "editor" | "expand" | "paa" | "tech-audit">("library");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved));
    } catch { /* */ }
  }, [storageKey]);

  // Sync subView with activeSubNav prop
  useEffect(() => {
    if (activeSubNav === "seo-new") setSubView("new");
    else if (activeSubNav === "seo-keywords") setSubView("keywords");
    else if (activeSubNav === "seo-library") setSubView("library");
    else if (activeSubNav === "seo-expand") setSubView("expand");
    else if (activeSubNav === "seo-paa") setSubView("paa");
    else if (activeSubNav === "seo-tech-audit") setSubView("tech-audit");
  }, [activeSubNav]);

  const save = useCallback((newState: SEOArticlesState) => {
    setState(newState);
    try { localStorage.setItem(storageKey, JSON.stringify(newState)); } catch { /* */ }
  }, [storageKey]);

  const handleCreated = (article: SEOArticle) => {
    const newState = { ...state, articles: [article, ...state.articles] };
    save(newState);
    setCurrentArticle(article);
    setSubView("editor");
  };

  const handleSave = (updated: SEOArticle) => {
    const newState = { ...state, articles: state.articles.map(a => a.id === updated.id ? updated : a) };
    save(newState);
    setCurrentArticle(updated);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Удалить статью?")) return;
    save({ ...state, articles: state.articles.filter(a => a.id !== id) });
  };

  const handleOpen = (id: string) => {
    const article = state.articles.find(a => a.id === id);
    if (article) { setCurrentArticle(article); setSubView("editor"); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Company style status — appears on new article + editor screens */}
      {(subView === "new" || subView === "editor") && (
        <CompanyStylePanel
          c={c}
          state={companyStyleState}
          onChange={onUpdateCompanyStyle}
          onOpenStyleTab={onOpenStyleTab}
        />
      )}
      {subView === "editor" && currentArticle ? (
        <SEOArticleEditor
          article={currentArticle}
          onSave={handleSave}
          onBack={() => setSubView("library")}
          companyStyleProfile={companyStyleProfile}
        />
      ) : subView === "new" ? (
        <SEONewArticleView
          analysis={analysis}
          taResult={taResult}
          brandBook={brandBook}
          onCreated={handleCreated}
          onBack={() => setSubView("library")}
        />
      ) : subView === "keywords" ? (
        <SEOKeywordsView
          analysis={analysis}
          onBack={() => setSubView("library")}
        />
      ) : subView === "expand" ? (
        <SEOKeywordExpandView
          analysis={analysis}
          onBack={() => setSubView("library")}
        />
      ) : subView === "paa" ? (
        <SEOPAAView
          analysis={analysis}
          onBack={() => setSubView("library")}
        />
      ) : subView === "tech-audit" ? (
        <SEOTechAuditView
          analysis={analysis}
          onBack={() => setSubView("library")}
        />
      ) : (
        <SEOLibraryView
          articles={state.articles}
          onNew={() => setSubView("new")}
          onOpen={handleOpen}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
