"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { GeneratedPost, BrandBook, TovCheckResult, TovIssue, PostMetrics, ReelMetrics, ReferenceImage } from "@/lib/content-types";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { ImagePromptEditor } from "@/components/ui/ImagePromptEditor";
import { OnboardingChecklist, type OnboardingState } from "@/components/ui/OnboardingChecklist";
import { ContentGeneratorBlock } from "@/components/views/ContentPlanView";
import { Palette, Search, Loader2, X, Check, ChevronUp, ChevronDown, Sparkles, BarChart2, Eye, Heart, MessageSquare, TrendingUp, Bookmark, Timer, Film, MousePointer, Target, DollarSign, Banknote, Play, Save, Trash2, Copy, Pencil, Image, Bot, Camera, Wand2, Send, ExternalLink, Shuffle } from "lucide-react";

type AnyMetrics = PostMetrics & ReelMetrics;


// Render carousel body (split by "---") as numbered screens
export function CarouselBody({ c, body }: { c: Colors; body: string }) {
  const slides = body.split(/\n?---\n?/).map(s => s.trim()).filter(Boolean);
  if (slides.length <= 1) {
    return <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{body}</p>;
  }
  return (
    <div>
      {slides.map((slide, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
          <p style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.55, margin: 0 }}>{slide}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Tone of Voice panel ----------

export function TovPanel({ c, post, brandBook, onApply, onClose }: {
  c: Colors;
  post: GeneratedPost;
  brandBook: BrandBook;
  onApply: (corrected: GeneratedPost) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TovCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCorrected, setShowCorrected] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check-tov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: post.hook,
          text: post.body,
          hashtags: post.hashtags,
          platform: post.platform,
          brandBook,
        }),
      });
      const json = await res.json() as { ok: boolean; data?: TovCheckResult; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setResult(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? "#22c55e" : score >= 55 ? "#f59e0b" : "var(--destructive)";

  const issueTypeLabel: Record<TovIssue["type"], string> = {
    forbidden_word: "Запрещённое слово",
    wrong_tone: "Неверный тон",
    missing_phrase_style: "Не тот стиль",
    format: "Формат",
  };

  return (
    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: "var(--background)", border: "1.5px solid #6366f140" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6366f1" }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Palette size={12}/>Корректор Tone of Voice</span></div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 14, cursor: "pointer" }}>×</button>
      </div>

      {!result && !loading && (
        <button
          onClick={run}
          style={{ width: "100%", padding: "9px 16px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px #6366f140" }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Search size={12}/>Проверить на соответствие брендбуку</span>
        </button>
      )}
      {loading && (
        <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "#6366f1", fontWeight: 700 }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Loader2 size={12} className="mr-spin"/>Проверяем тон…</span>
        </div>
      )}
      {error && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", color: "var(--destructive)", padding: "8px 12px", borderRadius: 8, fontSize: 11 }}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/>{error}</span></div>
      )}
      {result && (
        <div>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: scoreColor(result.score) + "20", border: `3px solid ${scoreColor(result.score)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: scoreColor(result.score) }}>{result.score}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{result.verdict}</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                {result.issues.length === 0 ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Check size={11}/>Нарушений не найдено</span> : `${result.issues.length} ${result.issues.length === 1 ? "нарушение" : "нарушения/нарушений"}`}
              </div>
            </div>
            <button
              onClick={run}
              style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 6, border: `1px solid #6366f130`, background: "transparent", color: "#6366f1", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ↺ Перепроверить
            </button>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {result.issues.map((issue, i) => (
                <div key={i} style={{ padding: "8px 10px", background: "color-mix(in oklch, var(--destructive) 3%, transparent)", border: `1px solid var(--destructive)25`, borderRadius: 7, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, background: "color-mix(in oklch, var(--destructive) 13%, transparent)", color: "var(--destructive)", borderRadius: 4, padding: "2px 6px" }}>{issueTypeLabel[issue.type]}</span>
                    <span style={{ fontSize: 11, fontStyle: "italic", color: "var(--muted-foreground)" }}>«{issue.text}»</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--foreground-secondary)", marginBottom: 3 }}>{issue.explanation}</div>
                  <div style={{ fontSize: 11, color: "#22c55e" }}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><TrendingUp size={11}/>{issue.suggestion}</span></div>
                </div>
              ))}
            </div>
          )}

          {/* Corrected version */}
          <button
            onClick={() => setShowCorrected(v => !v)}
            style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid #6366f140`, background: "#6366f108", color: "#6366f1", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: showCorrected ? 10 : 0 }}>
            {showCorrected ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}><ChevronUp size={12}/>Скрыть исправленную версию</span> : <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Sparkles size={12}/>Показать исправленную версию</span>}
          </button>
          {showCorrected && (
            <div style={{ padding: 12, background: "#6366f108", borderRadius: 8, border: "1px solid #6366f125", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ИСПРАВЛЕННАЯ ВЕРСИЯ</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>{result.correctedHook}</div>
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{result.correctedBody}</div>
              <button
                onClick={() => onApply({ ...post, hook: result.correctedHook, body: result.correctedBody })}
                style={{ marginTop: 10, width: "100%", padding: "9px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Check size={12}/>Применить исправления к посту</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Metrics block (screenshot → vision → editable form) ----------

const POST_METRIC_FIELDS: Array<{ key: keyof PostMetrics; label: string; emoji: string }> = [
  { key: "reach", label: "Охват", emoji: "👁" },
  { key: "impressions", label: "Показы", emoji: "📊" },
  { key: "likes", label: "Лайки", emoji: "❤️" },
  { key: "comments", label: "Комменты", emoji: "💬" },
  { key: "shares", label: "Репосты", emoji: "↗️" },
  { key: "saves", label: "Сохранения", emoji: "🔖" },
  { key: "clicks", label: "Клики", emoji: "🖱" },
  { key: "leads", label: "Лиды", emoji: "🎯" },
  { key: "revenue", label: "Выручка ₽", emoji: "💰" },
  { key: "adSpend", label: "Реклама ₽", emoji: "💸" },
];

const REEL_METRIC_FIELDS: Array<{ key: keyof ReelMetrics; label: string; emoji: string }> = [
  { key: "views", label: "Просмотры", emoji: "▶️" },
  { key: "reach", label: "Охват", emoji: "👁" },
  { key: "likes", label: "Лайки", emoji: "❤️" },
  { key: "comments", label: "Комменты", emoji: "💬" },
  { key: "shares", label: "Репосты", emoji: "↗️" },
  { key: "saves", label: "Сохранения", emoji: "🔖" },
  { key: "avgWatchTimeSec", label: "Ср. время (сек)", emoji: "⏱" },
  { key: "watchedFullPct", label: "Досмотры %", emoji: "🎬" },
  { key: "clicks", label: "Клики", emoji: "🖱" },
  { key: "leads", label: "Лиды", emoji: "🎯" },
  { key: "revenue", label: "Выручка ₽", emoji: "💰" },
  { key: "adSpend", label: "Реклама ₽", emoji: "💸" },
];

export function fmtNumber(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

export function MetricsBlock({ c, kind, metrics, onChange, locked }: {
  c: Colors;
  /** Тип контента влияет только на лейблы/набор полей. story и carousel
   *  используют POST_METRIC_FIELDS (та же структура — reach/likes/leads/...). */
  kind: "post" | "reel" | "story" | "carousel";
  metrics: AnyMetrics | undefined;
  onChange: (next: AnyMetrics | undefined) => void;
  /** Когда true — блок не редактируется, показывается подсказка о смене статуса. */
  locked?: boolean;
}) {
  // ВАЖНО: все useState — ДО любого условного return. Раньше часть хуков
  // была после `if (locked) return …` — React выкидывал "Rendered fewer
  // hooks than expected" при смене статуса поста (drafts ↔ published).
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnyMetrics>(metrics ?? {});
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(metrics?.screenshotUrl ?? null);
  const [dragging, setDragging] = useState(false);
  // Авто-fetch metrics из публичного URL (VK / Telegram)
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Если контент не опубликован — показываем placeholder вместо формы.
  if (locked) {
    return (
      <div style={{
        marginTop: 14, padding: "10px 14px", borderRadius: 9,
        background: "color-mix(in oklch, var(--primary) 4%, transparent)",
        border: "1px dashed color-mix(in oklch, var(--primary) 22%, transparent)",
        fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.5,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <BarChart2 size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <span>Метрики можно внести только для опубликованного {kind === "reel" ? "рилса" : kind === "story" ? "сторис" : kind === "carousel" ? "карусели" : "поста"}. Переместите в «Опубликован» в шапке.</span>
      </div>
    );
  }

  const handleFetchFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlFetching(true);
    setUrlError(null);
    try {
      const res = await fetch("/api/post-metrics-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json() as { ok: boolean; metrics?: AnyMetrics; error?: string };
      if (!json.ok || !json.metrics) throw new Error(json.error ?? "Не удалось получить metrics");
      setDraft(prev => ({ ...prev, ...json.metrics }));
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUrlFetching(false);
    }
  };

  // Сторис и карусели используют тот же набор полей что и пост:
  // reach/likes/comments/shares/saves/leads/revenue/adSpend.
  const fields = kind === "reel" ? REEL_METRIC_FIELDS : POST_METRIC_FIELDS;
  const accent = kind === "reel" ? "#ec4899"
    : kind === "story" ? "#a855f7"
    : kind === "carousel" ? "#0ea5e9"
    : "#f59e0b";

  const reach = draft.reach ?? draft.views ?? 0;
  const engagement = (draft.likes ?? 0) + (draft.comments ?? 0) + (draft.shares ?? 0) + (draft.saves ?? 0);
  const er = reach > 0 ? (engagement / reach) * 100 : 0;
  const cpl = (draft.adSpend && draft.leads && draft.leads > 0) ? draft.adSpend / draft.leads : 0;
  const romi = (draft.adSpend && draft.adSpend > 0 && draft.revenue != null)
    ? ((draft.revenue - draft.adSpend) / draft.adSpend) * 100 : 0;

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setScreenshotPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/extract-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, contentType: kind }),
      });
      const json = await res.json() as { ok: boolean; data?: AnyMetrics; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Не удалось распознать");
      setDraft(prev => ({ ...prev, ...json.data, screenshotUrl: dataUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const updateField = (key: string, raw: string) => {
    const num = raw === "" ? undefined : Number(raw.replace(/\s/g, "").replace(",", "."));
    setDraft({ ...draft, [key]: num });
  };

  const handleSave = () => {
    onChange({ ...draft, capturedAt: new Date().toISOString() });
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({});
    setScreenshotPreview(null);
    onChange(undefined);
    setOpen(false);
  };

  if (!open) {
    if (!metrics) {
      return (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginTop: 10, padding: "7px 12px", borderRadius: 8,
            border: `1px dashed ${accent}60`, background: accent + "08",
            color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%",
          }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart2 size={11}/>Внести метрики (бросьте сюда скрин статистики)</span>
        </button>
      );
    }
    const reachVal = metrics.reach ?? metrics.views ?? 0;
    const eng = (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0);
    const erVal = reachVal > 0 ? ((eng / reachVal) * 100).toFixed(1) : "—";
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          marginTop: 10, padding: "8px 12px", borderRadius: 8,
          background: accent + "0c", border: `1px solid ${accent}30`,
          cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 11,
        }}>
        <span style={{ display:"inline-flex", color: accent }}><BarChart2 size={11}/></span>
        {metrics.views != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><Play size={10}/></span> <b>{fmtNumber(metrics.views)}</b></span>}
        {metrics.reach != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><Eye size={10}/></span> <b>{fmtNumber(metrics.reach)}</b></span>}
        {metrics.likes != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><Heart size={10}/></span> <b>{fmtNumber(metrics.likes)}</b></span>}
        {metrics.comments != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><MessageSquare size={10}/></span> <b>{fmtNumber(metrics.comments)}</b></span>}
        {metrics.saves != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><Bookmark size={10}/></span> <b>{fmtNumber(metrics.saves)}</b></span>}
        <span style={{ color: "var(--foreground-secondary)" }}>ER: <b style={{ color: accent }}>{erVal}%</b></span>
        {metrics.leads != null && <span style={{ color: "var(--foreground-secondary)" }}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><Target size={10}/></span> <b>{metrics.leads}</b></span>}
        <span style={{ marginLeft: "auto", color: "var(--muted-foreground)", fontSize: 10, display:"inline-flex", alignItems:"center", gap:3 }}><Pencil size={10}/>изменить</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--background)", border: `1.5px solid ${accent}40` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: accent }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart2 size={12}/>Метрики {kind === "reel" ? "рилса" : kind === "story" ? "сторис" : kind === "carousel" ? "карусели" : "поста"}</span></div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* Авто-fetch metrics из публичной VK/TG ссылки */}
      <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "var(--card)", border: `1px solid var(--border)` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Авто-сбор из ссылки
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !urlFetching && handleFetchFromUrl()}
            placeholder="https://vk.com/wall-12345_678  или  https://t.me/channel/123"
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--background)",
              color: "var(--foreground)", fontSize: 12, outline: "none",
              fontFamily: "inherit", minWidth: 0,
            }}
          />
          <button
            onClick={handleFetchFromUrl}
            disabled={urlFetching || !urlInput.trim()}
            style={{
              padding: "8px 14px", borderRadius: 6, border: "none",
              background: accent, color: "#fff", fontSize: 12, fontWeight: 700,
              cursor: (urlFetching || !urlInput.trim()) ? "not-allowed" : "pointer",
              opacity: (urlFetching || !urlInput.trim()) ? 0.5 : 1,
              fontFamily: "inherit", whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {urlFetching ? <Loader2 size={12} className="mr-spin" /> : <ExternalLink size={12} />}
            {urlFetching ? "Загружаю…" : "Загрузить"}
          </button>
        </div>
        {urlError && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--destructive)" }}>{urlError}</div>
        )}
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted-foreground)" }}>
          VK: лайки/коммент/репост/просмотры. Telegram: views + сумма реакций.
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          padding: screenshotPreview ? 8 : 16, borderRadius: 8,
          border: `1.5px dashed ${dragging ? accent : "var(--border)"}`,
          background: dragging ? accent + "12" : "var(--card)",
          textAlign: "center", marginBottom: 10, transition: "all 0.15s",
        }}>
        {screenshotPreview ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotPreview} alt="screenshot" style={{ maxHeight: 80, maxWidth: 140, borderRadius: 6, border: `1px solid var(--border)` }} />
            <div style={{ flex: 1, textAlign: "left", fontSize: 11, color: "var(--foreground-secondary)" }}>
              {loading ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Bot size={11}/>Распознаём метрики…</span> : "Скрин загружен — поля заполнены ниже"}
            </div>
            <label style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ↻ заменить
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
            </label>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 8, color:"var(--muted-foreground)", display:"flex", justifyContent:"center"}}><Camera size={28}/></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>Бросьте сюда скриншот статистики</div>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 8 }}>VK / Instagram / Telegram / TikTok — AI распознает все цифры автоматически</div>
            <label style={{ display: "inline-block", padding: "6px 14px", borderRadius: 7, background: accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Выбрать файл
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
            </label>
          </>
        )}
        {loading && <div style={{ marginTop: 8, fontSize: 11, color: accent, fontWeight: 700, display:"flex", alignItems:"center", gap:4, justifyContent:"center" }}><Loader2 size={11} className="mr-spin"/>Распознаём…</div>}
        {error && <div style={{ marginTop: 8, fontSize: 11, color: "var(--destructive)", display:"flex", alignItems:"center", gap:4 }}><X size={11}/>{error}</div>}
      </div>

      {draft.source && (
        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 8 }}>
          Источник: <b style={{ color: "var(--foreground-secondary)" }}>{draft.source}</b>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
        {fields.map(f => (
          <div key={String(f.key)}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 3, letterSpacing: "0.03em" }}>
              {f.label.toUpperCase()}
            </label>
            <input
              type="number"
              value={(draft[f.key as keyof AnyMetrics] as number | undefined) ?? ""}
              onChange={e => updateField(String(f.key), e.target.value)}
              placeholder="—"
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)",
                fontSize: 12, fontWeight: 600, outline: "none", boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>
        ))}
      </div>

      {(reach > 0 || (draft.adSpend && draft.adSpend > 0)) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 7, background: accent + "0c", border: `1px solid ${accent}25`, fontSize: 11, marginBottom: 10, flexWrap: "wrap" }}>
          {reach > 0 && (
            <span style={{ color: "var(--foreground-secondary)" }}>
              ER: <b style={{ color: accent }}>{er.toFixed(1)}%</b>
            </span>
          )}
          {cpl > 0 && (
            <span style={{ color: "var(--foreground-secondary)" }}>
              CPL: <b style={{ color: accent }}>{cpl.toFixed(0)} ₽</b>
            </span>
          )}
          {(draft.adSpend != null && draft.adSpend > 0 && draft.revenue != null) && (
            <span style={{ color: "var(--foreground-secondary)" }}>
              ROMI: <b style={{ color: romi >= 0 ? "#22c55e" : "var(--destructive)" }}>{romi.toFixed(0)}%</b>
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Save size={12}/>Сохранить метрики</span>
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Отмена
        </button>
        {metrics && (
          <button
            onClick={handleClear}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid var(--destructive)40`, background: "transparent", color: "var(--destructive)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Trash2 size={12}/>Удалить метрики</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Компактный аплоадер референсов для конкретного поста.
// Похож на ImageReferencePanel, но без общей шапки/onboarding —
// и хранит данные прямо в post.referenceImages.
function PostReferencesUploader({ refs, onChange }: {
  refs: ReferenceImage[];
  onChange: (next: ReferenceImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const readFiles = async (files: FileList) => {
    setError(null);
    const slots = 3 - refs.length;
    if (slots <= 0) { setError("Максимум 3 референса"); return; }
    const toRead = Array.from(files).slice(0, slots);
    const next: ReferenceImage[] = [];
    for (const f of toRead) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 4 * 1024 * 1024) { setError(`${f.name} больше 4 МБ`); continue; }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) continue;
      next.push({
        id: Math.random().toString(36).slice(2),
        name: f.name,
        mimeType: m[1],
        data: m[2],
        previewUrl: dataUrl,
      });
    }
    if (next.length > 0) onChange([...refs, ...next]);
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Референсы стиля для этого поста ({refs.length}/3)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {refs.map(r => (
          <div key={r.id} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.previewUrl} alt={r.name} style={{
              width: 56, height: 56, borderRadius: 8, objectFit: "cover",
              border: "1px solid var(--border)",
            }} />
            <button
              onClick={() => onChange(refs.filter(x => x.id !== r.id))}
              title="Удалить"
              style={{
                position: "absolute", top: -6, right: -6,
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--destructive)", border: "none", color: "#fff",
                fontSize: 11, cursor: "pointer", fontWeight: 700, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))}
        {refs.length < 3 && (
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              width: 56, height: 56, borderRadius: 8,
              border: "1.5px dashed var(--border)",
              background: "transparent", color: "var(--muted-foreground)",
              cursor: "pointer", fontSize: 22, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "inherit",
            }}
            title="Загрузить референс-картинку"
          >+</button>
        )}
        <input
          ref={inputRef}
          type="file" accept="image/*" multiple
          style={{ display: "none" }}
          onChange={e => e.target.files && readFiles(e.target.files)}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: "var(--destructive)", marginTop: 6 }}>{error}</div>
      )}
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.4 }}>
        Картинки в нужном стиле — AI ориентируется на цвета, композицию и настроение.
      </div>
    </div>
  );
}

export function PostCard({ c, post, onUpdate, onDelete, brandBook, alwaysExpanded = false, onRowClick, onRowDelete }: {
  c: Colors;
  post: GeneratedPost;
  onUpdate: (updated: GeneratedPost) => void;
  onDelete: (id: string) => void;
  brandBook?: BrandBook;
  /** Когда true — игнорируем collapsed state и сразу рендерим полную карточку.
   *  Нужно когда PostCard используется внутри модалки PostDetailModal. */
  alwaysExpanded?: boolean;
  /** Альтернативный click-handler для свёрнутой строки (используется в новой
   *  list-view: вместо разворота на месте — открыть модалку детальной работы). */
  onRowClick?: (post: GeneratedPost) => void;
  /** Удаление прямо со строки (с подтверждением).
   *  Если не передано — используем стандартный onDelete без confirm. */
  onRowDelete?: (post: GeneratedPost) => void;
}) {
  // Карточка по умолчанию свёрнута в компактную строку (превью + крючок).
  // Это даёт быстрый скан 20+ постов на одной странице — раньше каждая
  // карточка занимала 700-1000px высоты, и при 10 постах терялся контекст.
  const [collapsed, setCollapsed] = useState(true);
  // Чекбокс «встроить текст в картинку» (gpt-image-2). Локально для процесса
  // генерации; финальное значение пишется в post.hasEmbeddedText после
  // успешного рендера.
  const [embedTextMode, setEmbedTextMode] = useState<boolean>(!!post.hasEmbeddedText);
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [hashtagsRaw, setHashtagsRaw] = useState(post.hashtags.join(" "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const [showTov, setShowTov] = useState(false);
  // Промпт-редактор для DALL-E (открывается по клику «Сгенерировать фото»)
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  // Локальный override формата и платформы для генерации картинки —
  // юзер может в редакторе переключить «квадрат / 9:16 / 16:9» и
  // «instagram / vk / telegram / tiktok» без смены платформы поста.
  const [imageFormat, setImageFormat] = useState<"пост" | "сторис" | "пост-горизонтальный">("пост");
  const [imagePlatform, setImagePlatform] = useState<"instagram" | "vk" | "telegram" | "tiktok">(
    (post.platform as "instagram" | "vk" | "telegram" | "tiktok") ?? "instagram"
  );
  const [imageGenError, setImageGenError] = useState("");
  // Платформо-адаптация (Insta / VK / TG)
  const [activeTab, setActiveTab] = useState<"canonical" | "instagram" | "vk" | "telegram">("canonical");
  const [adapting, setAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState("");
  // Публикация
  const [showPublishModal, setShowPublishModal] = useState(false);
  // A/B варианты крючка
  const [hookPickerOpen, setHookPickerOpen] = useState(false);
  const [hookLoading, setHookLoading] = useState(false);
  const [hookError, setHookError] = useState("");

  const handleFetchHookVariants = async () => {
    setHookLoading(true);
    setHookError("");
    setHookPickerOpen(true);
    try {
      const r = await fetch("/api/hook-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: post.hook,
          body: post.body,
          pillar: post.pillar,
          platform: post.platform,
          brandBook,
          count: 3,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "Ошибка");
      onUpdate({ ...post, hookVariants: j.variants });
    } catch (e) {
      setHookError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setHookLoading(false);
    }
  };

  const handlePickHook = (newHook: string) => {
    if (!newHook || newHook === post.hook) {
      setHookPickerOpen(false);
      return;
    }
    // Сохраняем старый hook как один из вариантов, ставим новый активным
    const existing = post.hookVariants ?? [];
    const newVariants = [post.hook, ...existing.filter(v => v !== newHook && v !== post.hook)].slice(0, 5);
    onUpdate({ ...post, hook: newHook, hookVariants: newVariants });
    setHookPickerOpen(false);
  };

  const handleAdapt = async () => {
    setAdapting(true);
    setAdaptError("");
    try {
      const r = await fetch("/api/adapt-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: post.hook, body: post.body, hashtags: post.hashtags }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "Ошибка");
      onUpdate({ ...post, platformVariants: j.data });
      setActiveTab("instagram");
    } catch (e) {
      setAdaptError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdapting(false);
    }
  };

  // Собирает «вшиваемый» текст когда включён режим текст-в-картинке.
  // Для постов используем заголовок (он самый акцентный и короткий);
  // body длинный и gpt-image-2 будет ошибаться в Cyrillic-спеллинге.
  const buildEmbedText = (): string => {
    const hk = (post.hook || "").trim();
    return hk.slice(0, 140);
  };

  const handleGenerateWithPrompt = async (userPrompt: string) => {
    setImageGenError("");
    const embedText = embedTextMode ? buildEmbedText() : "";
    const refs = post.referenceImages ?? [];
    const res = await fetch("/api/generate-image-anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postText: post.body,
        hook: post.hook,
        format: imageFormat,
        platform: imagePlatform,
        brandColors: brandBook?.colors ?? [],
        brandStyle: brandBook?.visualStyle ?? "",
        userPrompt,
        embedText: embedText || undefined,
        referenceImages: refs.length > 0 ? refs.map(r => ({ data: r.data, mimeType: r.mimeType })) : undefined,
      }),
    });
    const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
    if (!json.ok) {
      const msg = json.error ?? "Ошибка генерации";
      setImageGenError(msg);
      throw new Error(msg); // editor покажет ошибку и не закроется
    }
    onUpdate({
      ...post,
      imageUrl: json.data!.imageUrl,
      hasEmbeddedText: !!embedText,
    });
    setShowPromptEditor(false);
  };

  const isCarousel = post.body.includes("---");

  const handleSave = () => {
    const tags = hashtagsRaw.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith("#") ? t : "#" + t);
    onUpdate({ ...post, hook, body, hashtags: tags });
    setEditing(false);
  };

  const handleCancel = () => {
    setHook(post.hook);
    setBody(post.body);
    setHashtagsRaw(post.hashtags.join(" "));
    setEditing(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1.5px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 14, outline: "none",
    lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box",
  };
  const editLabelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)",
    marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase",
  };

  // Цвет «акцента» под платформу — для левой полоски и chip.
  const platformAccent =
    post.platform === "instagram" ? "#ec4899" :
    post.platform === "vk" ? "#4a76a8" :
    post.platform === "telegram" ? "#229ED9" :
    post.platform === "linkedin" ? "#0a66c2" :
    "#f59e0b";

  // === Свёрнутый режим: одна строка-сводка (если не alwaysExpanded) ===
  if (!alwaysExpanded && collapsed && !editing) {
    const hookSnippet = (post.hook || post.body).slice(0, 130).trim();
    const dateObj = new Date(post.generatedAt);
    const dayStr = dateObj.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
    const timeStr = dateObj.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const handleRowClick = () => {
      if (onRowClick) onRowClick(post);
      else setCollapsed(false);
    };
    const handleRowDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRowDelete) onRowDelete(post);
      else if (confirm("Удалить пост безвозвратно?")) onDelete(post.id);
    };

    return (
      <div
        onClick={handleRowClick}
        style={{
          background: "var(--card)",
          borderRadius: 10,
          border: "1px solid var(--border)",
          borderLeft: `3px solid ${platformAccent}`,
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer",
          transition: "background 0.12s, border-color 0.12s",
          minHeight: 56,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklch, var(--card) 92%, var(--primary) 4%)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
        title="Кликните, чтобы открыть пост"
      >
        {/* Thumb 40×40 */}
        <div style={{
          width: 40, height: 40, borderRadius: 7,
          background: post.imageUrl ? "transparent" : `linear-gradient(135deg, ${platformAccent}30, ${platformAccent}10)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
          border: post.imageUrl ? `1px solid var(--border)` : "none",
        }}>
          {post.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Image size={16} style={{ color: platformAccent, opacity: 0.7 }} />
          )}
        </div>

        {/* Платформа chip */}
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
          background: `${platformAccent}18`, color: platformAccent,
          borderRadius: 4, padding: "2px 7px",
          flexShrink: 0,
        }}>{post.platform}</span>

        {/* Hook — занимает всё доступное место */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 13.5, fontWeight: 600, color: "var(--foreground)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>
          {hookSnippet || "Без заголовка"}
        </div>

        {/* Доп бейджи (миниатюрные) */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {isCarousel && (
            <span style={{
              fontSize: 9.5, fontWeight: 700,
              background: "#6366f118", color: "#818cf8",
              borderRadius: 4, padding: "2px 6px",
            }}>Карусель</span>
          )}
          {post.imageUrl && (
            <span title={post.hasEmbeddedText ? "Картинка с встроенным текстом" : "Картинка готова"} style={{
              fontSize: 9.5, fontWeight: 700,
              background: "#22c55e18", color: "#22c55e",
              borderRadius: 4, padding: "2px 6px",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>
              <Image size={8}/>
              {post.hasEmbeddedText && <span style={{ fontWeight: 800 }}>Тx</span>}
            </span>
          )}
        </div>

        {/* Дата — крупнее (две строки: день, время) */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          flexShrink: 0, minWidth: 56, lineHeight: 1.15,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{dayStr}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{timeStr}</span>
        </div>

        {/* Delete */}
        <button
          onClick={handleRowDelete}
          title="Удалить пост"
          style={{
            background: "transparent", border: "none",
            padding: 6, cursor: "pointer",
            color: "var(--muted-foreground)",
            borderRadius: 6,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "color-mix(in oklch, var(--destructive) 12%, transparent)";
            e.currentTarget.style.color = "var(--destructive)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--muted-foreground)";
          }}
        >
          <Trash2 size={15}/>
        </button>
      </div>
    );
  }

  // === Развёрнутый режим — старая большая карточка ===
  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `2px solid ${editing ? "color-mix(in oklch, var(--primary) 38%, transparent)" : "var(--border)"}`, padding: 20, boxShadow: "var(--shadow)", transition: "border-color 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, background: "#f59e0b18", color: "#f59e0b", borderRadius: 8, padding: "5px 11px", textTransform: "capitalize" }}>{post.platform}</span>
          {isCarousel && <span style={{ fontSize: 12, fontWeight: 700, background: "#6366f118", color: "#818cf8", borderRadius: 8, padding: "5px 11px" }}>Карусель</span>}
          {post.imageUrl && (
            <span title="Картинка готова" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#22c55e", padding: "5px 10px", borderRadius: 8, background: "#22c55e15" }}>
              <Image size={12}/> готово
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{new Date(post.generatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</span>
          {!editing && (
            <button onClick={() => setEditing(true)} title="Редактировать" style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Pencil size={13}/>
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setCollapsed(true)}
              title="Свернуть карточку"
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              ▲
            </button>
          )}
        </div>
      </div>

      {/* Image preview — в модалке показываем целиком (contain), в обычной
          карточке оставляем компактный вид (cover) с возможностью развернуть. */}
      {post.imageUrl && !editing && (
        <div style={{ marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl} alt={post.hook}
            onClick={alwaysExpanded ? undefined : () => setImgExpanded(v => !v)}
            style={{
              width: "100%",
              // В модалке (alwaysExpanded) — высота по контенту, contain.
              // В обычной карточке — old compact mode.
              maxHeight: alwaysExpanded ? "none" : (imgExpanded ? 480 : 220),
              borderRadius: 12,
              objectFit: alwaysExpanded ? "contain" : "cover",
              cursor: alwaysExpanded ? "default" : "pointer",
              border: "1px solid var(--border)",
              transition: "max-height 0.25s ease",
              display: "block",
              background: alwaysExpanded ? "var(--background)" : "transparent",
            }}
          />
          {!alwaysExpanded && (
            <button onClick={() => setImgExpanded(v => !v)} style={{ marginTop: 6, padding: "4px 12px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer" }}>
              {imgExpanded ? "Свернуть" : "Развернуть"}
            </button>
          )}
        </div>
      )}

      {editing ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={editLabelStyle}>Крючок / заголовок</label>
            <input type="text" value={hook} onChange={e => setHook(e.target.value)} style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={editLabelStyle}>
              Текст поста {isCarousel && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)" }}>(экраны карусели разделяются через «---»)</span>}
              <span style={{ float: "right", fontWeight: 600, color: body.length > 2200 ? "var(--destructive)" : "var(--muted-foreground)", textTransform: "none", letterSpacing: 0 }}>
                {body.length} символов
              </span>
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={editLabelStyle}>Хэштеги (через пробел)</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button onClick={handleSave} style={{ padding: "11px 20px", borderRadius: 9, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, minHeight: 42 }}>
              <Save size={15}/>Сохранить
            </button>
            <button onClick={handleCancel} style={{ padding: "11px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 42 }}>
              Отмена
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {confirmDelete ? (
                <>
                  <button onClick={() => onDelete(post.id)} style={{ padding: "11px 18px", borderRadius: 9, border: "none", background: "var(--destructive)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 42 }}>
                    Удалить
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "11px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 42 }}>
                    Нет
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} title="Удалить пост" style={{ padding: "11px 14px", borderRadius: 9, border: "1px solid color-mix(in oklch, var(--destructive) 30%, var(--border))", background: "transparent", color: "var(--destructive)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 42 }}>
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Platform tabs */}
          {post.platformVariants && (
            <div style={{ display: "flex", gap: 4, marginBottom: 14, padding: 4, background: "var(--background)", borderRadius: 10, border: "1px solid var(--border)", overflowX: "auto" }}>
              {([
                { id: "canonical", label: "Канонический", limit: null, color: "var(--muted-foreground)" },
                { id: "instagram", label: "Instagram", limit: 2200, color: "#E4405F" },
                { id: "vk", label: "ВКонтакте", limit: 16000, color: "#4A76A8" },
                { id: "telegram", label: "Telegram", limit: 4096, color: "#229ED9" },
              ] as const).map(t => {
                const isActive = activeTab === t.id;
                const variant = t.id === "canonical" ? null : post.platformVariants?.[t.id];
                const overLimit = variant && t.limit && variant.charCount > t.limit;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 7, border: "none",
                      background: isActive ? "var(--card)" : "transparent",
                      color: isActive ? t.color : "var(--muted-foreground)",
                      fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}>
                    {t.label}
                    {variant && t.limit && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: overLimit ? "var(--destructive)" : "var(--muted-foreground)", opacity: 0.7 }}>
                        {variant.charCount}/{t.limit}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {(() => {
            // Текущий вариант (canonical или платформенный)
            const v = activeTab === "canonical" || !post.platformVariants
              ? { hook: post.hook, body: post.body, hashtags: post.hashtags, charCount: 0 }
              : post.platformVariants[activeTab];
            const limits: Record<string, number> = { instagram: 2200, vk: 16000, telegram: 4096 };
            const limit = activeTab !== "canonical" ? limits[activeTab] : null;
            const overLimit = limit && v.charCount > limit;
            return (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.35, marginBottom: 6, letterSpacing: -0.2, whiteSpace: "pre-wrap" }}>
                  {v.hook}
                </div>
                {activeTab === "canonical" && (
                  <button
                    onClick={handleFetchHookVariants}
                    disabled={hookLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "1px dashed var(--border)",
                      background: "transparent",
                      color: "var(--muted-foreground)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: hookLoading ? "wait" : "pointer",
                      marginBottom: 12,
                      fontFamily: "inherit",
                    }}
                    title="Получить 3 альтернативных крючка для A/B-тестирования"
                  >
                    {hookLoading
                      ? <Loader2 size={12} className="mr-spin" />
                      : <Shuffle size={12} />}
                    {hookLoading ? "Подбираю варианты…" : "A/B варианты крючка"}
                  </button>
                )}
                <div style={{ marginBottom: 14, fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {activeTab === "canonical" ? <CarouselBody c={c} body={v.body} /> : v.body}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {v.hashtags.map((h, i) => (
                    <span key={i} style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
                  ))}
                </div>

                {/* Платформа + текущая длина текста + лимит — всегда видно,
                    даже если нет platformVariants. Каноническая длина считается
                    как hook + body + hashtags (как при публикации). */}
                {(() => {
                  const platformLimits: Record<string, number> = {
                    instagram: 2200, vk: 16000, telegram: 4096, linkedin: 3000, facebook: 63206, tiktok: 2200,
                  };
                  const targetPlatform = activeTab === "canonical" ? post.platform : activeTab;
                  const targetLimit = platformLimits[targetPlatform];
                  const tagStr = v.hashtags.map(h => h.startsWith("#") ? h : "#" + h).join(" ");
                  const canonChars = (v.hook?.length ?? 0) + 2 + (v.body?.length ?? 0) + (tagStr ? 2 + tagStr.length : 0);
                  const charsToShow = v.charCount || canonChars;
                  const over = targetLimit && charsToShow > targetLimit;
                  return (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      marginBottom: 12,
                      padding: "5px 11px", borderRadius: 7,
                      background: "color-mix(in oklch, var(--primary) 5%, transparent)",
                      border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)",
                      fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {targetPlatform}
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ color: over ? "var(--destructive)" : "var(--foreground-secondary)", fontWeight: 600 }}>
                        {charsToShow} {targetLimit ? `/ ${targetLimit}` : ""} символов
                      </span>
                      {over && (
                        <span style={{ color: "var(--destructive)", fontWeight: 700, fontSize: 11 }}>
                          превышение
                        </span>
                      )}
                    </div>
                  );
                })()}

                {overLimit && (
                  <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "color-mix(in oklch, var(--destructive) 10%, transparent)", color: "var(--destructive)", fontSize: 12.5 }}>
                    ⚠ Текст превышает лимит платформы ({v.charCount} вместо {limit}). При публикации будет обрезан.
                  </div>
                )}
              </>
            );
          })()}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => {
                const v = activeTab === "canonical" || !post.platformVariants
                  ? { hook: post.hook, body: post.body, hashtags: post.hashtags }
                  : post.platformVariants[activeTab];
                navigator.clipboard.writeText(`${v.hook}\n\n${v.body}\n\n${v.hashtags.map(h => h.startsWith("#") ? h : "#" + h).join(" ")}`);
              }}
              style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Copy size={14}/>Скопировать
            </button>
            {!post.platformVariants && (
              <button
                onClick={handleAdapt}
                disabled={adapting}
                style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid var(--primary)", background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)", fontSize: 13, fontWeight: 700, cursor: adapting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                {adapting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <Sparkles size={14}/>}
                {adapting ? "Адаптирую…" : "Адаптировать под Insta/VK/TG"}
              </button>
            )}
            <button
              onClick={() => setShowPublishModal(true)}
              style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: post.publishStatus?.vk?.ok || post.publishStatus?.telegram?.ok ? "#16a34a" : "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Send size={14}/>
              {post.publishStatus?.vk?.ok || post.publishStatus?.telegram?.ok ? "Опубликован" : "Опубликовать"}
            </button>
            {brandBook && (brandBook.toneOfVoice?.length > 0 || brandBook.forbiddenWords?.length > 0) && (
              <button
                onClick={() => setShowTov(v => !v)}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${showTov ? "#6366f1" : "var(--border)"}`, background: showTov ? "#6366f115" : "transparent", color: showTov ? "#6366f1" : "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Palette size={14}/>ToV
              </button>
            )}
            <button
              onClick={() => { setShowPromptEditor(v => !v); setImageGenError(""); }}
              style={{ padding: "9px 14px", borderRadius: 8, border: post.imageUrl ? "1px solid var(--border)" : "1.5px solid var(--border)", background: post.imageUrl ? "transparent" : "color-mix(in oklch, var(--primary) 10%, transparent)", color: post.imageUrl ? "var(--foreground-secondary)" : "var(--primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Wand2 size={14}/>
              {showPromptEditor ? "Закрыть" : post.imageUrl ? "Перерисовать" : "Фото"}
            </button>
          </div>

          {/* AI-подсказка про будущую картинку, показываем только если её ещё нет.
              Помогает юзеру решить — устроит ли план до клика «Сгенерировать». */}
          {!post.imageUrl && !showPromptEditor && post.imageSuggestionRu && (
            <div style={{
              marginTop: 10, padding: "9px 12px", borderRadius: 8,
              background: "color-mix(in oklch, var(--primary) 5%, transparent)",
              border: "1px dashed color-mix(in oklch, var(--primary) 25%, transparent)",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <Image size={13} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, color: "var(--foreground-secondary)", lineHeight: 1.45 }}>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>На картинке будет: </span>
                {post.imageSuggestionRu}
              </div>
            </div>
          )}

          {adaptError && (
            <div style={{ fontSize: 13, color: "var(--destructive)", marginTop: 10, padding: "8px 12px", background: "color-mix(in oklch, var(--destructive) 8%, transparent)", borderRadius: 8 }}>{adaptError}</div>
          )}
          {imageGenError && !showPromptEditor && (
            <div style={{ fontSize: 13, color: "var(--destructive)", marginTop: 10, padding: "8px 12px", background: "color-mix(in oklch, var(--destructive) 8%, transparent)", borderRadius: 8 }}>{imageGenError}</div>
          )}
          {showPromptEditor && (
            <>
              {/* Per-post controls: embed-text toggle + reference images uploader.
                  Появляются вместе с промпт-редактором — это контекст для генерации. */}
              <div style={{
                marginTop: 12, padding: 14, borderRadius: 12,
                background: "color-mix(in oklch, var(--primary) 4%, var(--card))",
                border: "1.5px dashed color-mix(in oklch, var(--primary) 25%, var(--border))",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {/* Toggle */}
                <label
                  style={{
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none",
                  }}
                  title="gpt-image-2 нарисует заголовок прямо на картинке вместо отдельного оверлея"
                >
                  <input
                    type="checkbox"
                    checked={embedTextMode}
                    onChange={e => setEmbedTextMode(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: "var(--primary)", cursor: "pointer", flexShrink: 0 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>
                      Встроить заголовок в картинку
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "var(--primary)", color: "#fff", marginLeft: 6, verticalAlign: "middle" }}>NEW</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                      Картинка будет с типографикой как готовый дизайн. Дороже и медленнее, но смотрится премиально.
                    </span>
                  </div>
                </label>

                {/* Per-post reference images */}
                <PostReferencesUploader
                  refs={post.referenceImages ?? []}
                  onChange={next => onUpdate({ ...post, referenceImages: next })}
                />
              </div>

              <ImagePromptEditor
                params={{
                  postText: post.body,
                  hook: post.hook,
                  format: imageFormat,
                  platform: imagePlatform,
                  brandColors: brandBook?.colors ?? [],
                  brandStyle: brandBook?.visualStyle ?? "",
                }}
                generateLabel={post.imageUrl ? "Перерисовать" : "Сгенерировать фото"}
                onFormatChange={setImageFormat}
                onPlatformChange={setImagePlatform}
                onGenerate={handleGenerateWithPrompt}
                onCancel={() => setShowPromptEditor(false)}
              />
            </>
          )}
          {showTov && brandBook && (
            <TovPanel
              c={c}
              post={post}
              brandBook={brandBook}
              onApply={corrected => { onUpdate(corrected); setShowTov(false); }}
              onClose={() => setShowTov(false)}
            />
          )}
          <MetricsBlock
            c={c} kind="post"
            metrics={post.metrics}
            onChange={m => onUpdate({ ...post, metrics: m })}
            locked={
              // Метрики разрешены только если пост опубликован: либо publishStatus
              // отметил успех, либо ручной manualStatus = published.
              post.manualStatus !== "published"
              && !post.publishStatus?.vk?.ok
              && !post.publishStatus?.telegram?.ok
            }
          />
          {showPublishModal && (
            <PublishModal
              post={post}
              onClose={() => setShowPublishModal(false)}
              onPublished={(publishStatus) => {
                onUpdate({ ...post, publishStatus: { ...post.publishStatus, ...publishStatus } });
              }}
            />
          )}
        </>
      )}

      {hookPickerOpen && (
        <HookVariantsPicker
          currentHook={post.hook}
          variants={post.hookVariants ?? []}
          loading={hookLoading}
          error={hookError}
          onPick={handlePickHook}
          onRetry={handleFetchHookVariants}
          onClose={() => setHookPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Post detail modal — полноэкранное окно работы с постом ────────────────
// Используется как clickthrough из компактной строки в списке. Внутри —
// та же PostCard в alwaysExpanded режиме + sticky-шапка с кнопкой скачать
// картинку и удалить пост.
export function PostDetailModal({
  c, post, brandBook, onClose, onUpdate, onDelete,
}: {
  c: Colors;
  post: GeneratedPost;
  brandBook?: BrandBook;
  onClose: () => void;
  onUpdate: (updated: GeneratedPost) => void;
  onDelete: (id: string) => void;
}) {
  // Закрытие по ESC + блокировка скролла body
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1);

  // Скачать картинку «как есть» — браузер сохраняет с правильным расширением.
  // OpenAI gpt-image-2 рендерит сразу в платформенном соотношении (1:1 / 9:16 /
  // 16:9 в зависимости от idea.format), поэтому отдельная конвертация не нужна.
  const downloadImage = () => {
    if (!post.imageUrl) return;
    const a = document.createElement("a");
    a.href = post.imageUrl;
    const safeHook = (post.hook || "post").replace(/[^a-zа-я0-9-_ ]/gi, "").slice(0, 40).trim() || "post";
    a.download = `${post.platform}_${safeHook}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--background)",
          borderRadius: 18,
          maxWidth: 920, width: "100%",
          maxHeight: "calc(100vh - 48px)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Sticky header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          background: "var(--card)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.2 }}>
              Пост · {platformLabel}
            </div>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {new Date(post.generatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {/* Дропдаун статуса — позволяет вручную перенести пост между табами */}
            <select
              value={post.manualStatus
                ?? ((post.publishStatus?.vk?.ok || post.publishStatus?.telegram?.ok) ? "published" : (post.scheduledFor && new Date(post.scheduledFor) > new Date()) ? "scheduled" : "drafts")
              }
              onChange={e => {
                const next = e.target.value as "drafts" | "scheduled" | "published";
                onUpdate({ ...post, manualStatus: next });
              }}
              title="Перенести пост в другой статус"
              style={{
                padding: "7px 11px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)", color: "var(--foreground)",
                fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", outline: "none",
              }}
            >
              <option value="drafts">Черновик</option>
              <option value="scheduled">Запланирован</option>
              <option value="published">Опубликован</option>
            </select>

            {post.imageUrl && (
              <button
                onClick={downloadImage}
                title="Скачать картинку (PNG)"
                style={{
                  padding: "8px 14px", borderRadius: 9,
                  border: "1.5px solid var(--primary)",
                  background: "color-mix(in oklch, var(--primary) 10%, transparent)",
                  color: "var(--primary)", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Save size={14}/> Скачать фото
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("Удалить пост безвозвратно?")) {
                  onDelete(post.id);
                  onClose();
                }
              }}
              title="Удалить пост"
              style={{
                padding: 8, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "color-mix(in oklch, var(--destructive) 12%, transparent)";
                e.currentTarget.style.color = "var(--destructive)";
                e.currentTarget.style.borderColor = "var(--destructive)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--muted-foreground)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <Trash2 size={15}/>
            </button>
            <button
              onClick={onClose}
              title="Закрыть (Esc)"
              style={{
                padding: 8, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent", color: "var(--muted-foreground)",
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Body — скроллируется */}
        <div style={{ overflow: "auto", padding: 18, flex: 1 }}>
          <PostCard
            c={c}
            post={post}
            onUpdate={onUpdate}
            onDelete={onDelete}
            brandBook={brandBook}
            alwaysExpanded
          />
        </div>
      </div>
    </div>
  );
}

// ─── Hook A/B picker modal ────────────────────────────────────────────────
function HookVariantsPicker({
  currentHook, variants, loading, error, onPick, onRetry, onClose,
}: {
  currentHook: string;
  variants: string[];
  loading: boolean;
  error: string;
  onPick: (h: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const labels = ["Цифровой", "Эмоциональный", "Утилитарный", "Доп. №4", "Доп. №5"];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)", border: `1px solid var(--border)`,
          borderRadius: 16, padding: 22, maxWidth: 560, width: "100%",
          maxHeight: "85vh", overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--foreground)" }}>
            A/B варианты крючка
          </h3>
          <button onClick={onClose} aria-label="Закрыть" style={{ background: "transparent", border: "none", color: "var(--foreground-secondary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px" }}>
          Выберите альтернативу — она станет активным крючком. Текущий уйдёт в варианты.
        </p>

        {/* Current */}
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>
            Текущий
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.4 }}>
            {currentHook}
          </div>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: "var(--muted-foreground)", fontSize: 13 }}>
            <Loader2 size={16} className="mr-spin" />
            Подбираю варианты — Claude думает над крючками…
          </div>
        )}
        {error && (
          <div style={{ background: "color-mix(in oklch, var(--destructive) 10%, transparent)", border: "1px solid color-mix(in oklch, var(--destructive) 30%, transparent)", color: "var(--destructive)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            {error}
            <button onClick={onRetry} style={{ marginLeft: 10, background: "transparent", border: "none", color: "var(--destructive)", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "inherit", textDecoration: "underline" }}>
              Повторить
            </button>
          </div>
        )}
        {!loading && !error && variants.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => onPick(v)}
                style={{
                  background: "var(--background)", border: "1.5px solid var(--border)",
                  borderRadius: 10, padding: "14px 16px", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "border-color 0.12s, background 0.12s",
                  display: "block", width: "100%",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "color-mix(in oklch, var(--primary) 5%, var(--background))"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--background)"; }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
                  {labels[i] ?? `Вариант ${i + 1}`}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.4 }}>
                  {v}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Publish Modal ────────────────────────────────────────────────────────
function PublishModal({ post, onClose, onPublished }: {
  post: GeneratedPost;
  onClose: () => void;
  onPublished: (status: GeneratedPost["publishStatus"]) => void;
}) {
  const [selected, setSelected] = useState<{ vk: boolean; telegram: boolean }>({ vk: false, telegram: true });
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, { ok: boolean; messageUrl?: string; error?: string }> | null>(null);

  const platforms = (Object.keys(selected) as Array<"vk" | "telegram">).filter(k => selected[k]);

  const handlePublish = async () => {
    if (platforms.length === 0) return;
    setPublishing(true);
    setResults(null);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post, platforms }),
      });
      const j = await r.json();
      if (j.ok) {
        setResults(j.results);
        // Сохраняем статусы в пост
        const status: GeneratedPost["publishStatus"] = {};
        if (j.results.vk) status.vk = { ...j.results.vk };
        if (j.results.telegram) status.telegram = { ...j.results.telegram };
        onPublished(status);
      } else {
        setResults({ error: { ok: false, error: j.error || "Ошибка" } });
      }
    } catch (e) {
      setResults({ error: { ok: false, error: e instanceof Error ? e.message : "Ошибка" } });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card)", borderRadius: 16, maxWidth: 480, width: "100%",
        padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 4, letterSpacing: -0.3 }}>
              Опубликовать пост
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Выберите платформы. Текст подгрузится из соответствующей вкладки (Instagram / VK / Telegram).
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {([
            { id: "telegram" as const, label: "Telegram", desc: "В чат с ботом (тестовый канал)", color: "#229ED9" },
            { id: "vk" as const, label: "ВКонтакте", desc: "В сообщество (требует VK_GROUP_ID в .env)", color: "#4A76A8" },
          ]).map(p => {
            const active = selected[p.id];
            const result = results?.[p.id];
            return (
              <label key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                borderRadius: 10, border: `2px solid ${active ? p.color : "var(--border)"}`,
                background: active ? `${p.color}10` : "transparent",
                cursor: "pointer",
              }}>
                <input type="checkbox" checked={active} onChange={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))} style={{ width: 18, height: 18 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: active ? p.color : "var(--foreground)" }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{p.desc}</div>
                  {result && (
                    <div style={{ marginTop: 8, fontSize: 12, padding: "6px 10px", borderRadius: 6, background: result.ok ? "#16a34a14" : "#dc262614", color: result.ok ? "#16a34a" : "#dc2626", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {result.ok
                        ? <>✓ Опубликовано {result.messageUrl && <a href={result.messageUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", marginLeft: 4 }}><ExternalLink size={11} /></a>}</>
                        : <>✗ {result.error}</>}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={publishing}
            style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Отмена
          </button>
          <button onClick={handlePublish} disabled={publishing || platforms.length === 0}
            style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: publishing || platforms.length === 0 ? "var(--muted)" : "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: publishing || platforms.length === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {publishing ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Публикую…</> : <><Send size={15}/> Опубликовать</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GeneratedPostsView({
  c, posts, onUpdatePost, onDeletePost, referenceImages, onUpdateReferenceImages,
  brandBook, onboardingState,
  // Доп. пропсы — для встроенного блока «Создать пост»:
  plan, isGeneratingPost, generatingPostId, onGeneratePost,
  // Контекст для AutoIdeasModal (генерация идей из ниши/ЦА/СММ) —
  // одинаково с StoriesView/GeneratedCarouselsView.
  myCompany, taResult, smmAnalysis,
}: {
  c: Colors;
  posts: GeneratedPost[];
  onUpdatePost: (updated: GeneratedPost) => void;
  onDeletePost: (id: string) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook?: BrandBook;
  /** Состояние воронки — для OnboardingChecklist на пустом view. */
  onboardingState?: OnboardingState;
  /** План контента — даёт чипы-идеи в блоке «Создать пост». null = нет плана,
   *  блок генерации не показываем. */
  plan?: import("@/lib/content-types").ContentPlan | null;
  isGeneratingPost?: boolean;
  generatingPostId?: string | null;
  onGeneratePost?: (
    idea: import("@/lib/content-types").ContentPostIdea,
    customPrompt?: string,
    imageOpts?: { imagePromptOverride?: string; imageStyle?: string; imageWithTextOverlay?: boolean; imageOverlayText?: string },
  ) => void;
  myCompany?: import("@/lib/types").AnalysisResult | null;
  taResult?: import("@/lib/ta-types").TAResult | null;
  smmAnalysis?: import("@/lib/smm-types").SMMResult | null;
}) {
  // Фильтр по платформе + поиск по тексту: критично когда постов 20+
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "vk" | "telegram" | "linkedin">("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Какой пост открыт в полноэкранной модалке. null = модалка закрыта.
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  // Статус-таб: черновики / запланированные / опубликованные.
  // Статус выводится из полей самого поста (publishStatus, scheduledFor) —
  // не нужна миграция localStorage.
  const [statusTab, setStatusTab] = useState<"drafts" | "scheduled" | "published">("drafts");

  // Открытый пост — берём свежий объект из массива (после onUpdate инстанс
  // обновляется, модалка должна отражать актуальные данные).
  const openPost = openPostId ? posts.find(p => p.id === openPostId) ?? null : null;

  const postStatus = (p: GeneratedPost): "drafts" | "scheduled" | "published" => {
    // Ручная классификация имеет приоритет — юзер может вручную переносить
    // пост между статусами через дропдаун в модалке.
    if (p.manualStatus) return p.manualStatus;
    const anyPublished = p.publishStatus?.vk?.ok || p.publishStatus?.telegram?.ok;
    if (anyPublished) return "published";
    if (p.scheduledFor && new Date(p.scheduledFor) > new Date()) return "scheduled";
    return "drafts";
  };

  const statusCounts = {
    drafts: posts.filter(p => postStatus(p) === "drafts").length,
    scheduled: posts.filter(p => postStatus(p) === "scheduled").length,
    published: posts.filter(p => postStatus(p) === "published").length,
  };

  if (posts.length === 0) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Создать пост</h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 24px" }}>Все сгенерированные посты с картинками появятся здесь.</p>

        {/* Onboarding checklist — оставлен подсказкой что для полной картинки
            нужны все анализы. Но генератор всё равно работает по myCompany. */}
        {onboardingState && (
          <OnboardingChecklist
            state={onboardingState}
            onNavigate={(nav) => { window.location.href = `/?nav=${nav}`; }}
          />
        )}

        {/* Если есть хотя бы анализ компании — показываем генератор. План
            контента не обязателен (ContentGeneratorBlock умеет работать без
            плана: scratch-mode с брифом). */}
        {myCompany && onGeneratePost ? (
          <>
            <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />
            <ContentGeneratorBlock
              c={c}
              plan={plan ?? null}
              isGeneratingPost={!!isGeneratingPost}
              generatingPostId={generatingPostId ?? null}
              isGeneratingReel={false}
              generatingReelId={null}
              onGeneratePost={onGeneratePost}
              onGenerateReel={() => {}}
              brandBook={brandBook as BrandBook}
              lockedMode="post"
              myCompany={myCompany}
              taResult={taResult}
              smmAnalysis={smmAnalysis}
            />
          </>
        ) : (
          <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "44px 28px", textAlign: "center", boxShadow: "var(--shadow)" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Pencil size={30} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>Сначала запустите анализ компании</div>
            <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px" }}>
              Без анализа AI не знает, о чём писать. Запустите главный анализ — и сразу сможете создавать посты.
            </div>
            <a href="/?nav=new-analysis" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)" }}>
              К анализу →
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--foreground)", letterSpacing: -0.5 }}>Создать пост</h1>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", padding: "4px 12px", borderRadius: 20, background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
          {posts.length}
        </span>
      </div>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 18px" }}>Сверху — генератор. Ниже — список с табами по статусам.</p>

      {/* Референсы для стиля изображений — НАД генератором, чтобы под каждый
          новый пост можно было загрузить рефы заранее. */}
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />

      {/* Встроенный блок «Создать пост». План контента опционален —
          ContentGeneratorBlock в scratch-режиме генерирует посты по брифу
          юзера + данным myCompany. */}
      {myCompany && onGeneratePost ? (
        <ContentGeneratorBlock
          c={c}
          plan={plan ?? null}
          isGeneratingPost={!!isGeneratingPost}
          generatingPostId={generatingPostId ?? null}
          isGeneratingReel={false}
          generatingReelId={null}
          onGeneratePost={onGeneratePost}
          onGenerateReel={() => {}}
          brandBook={brandBook as BrandBook}
          lockedMode="post"
          myCompany={myCompany}
          taResult={taResult}
          smmAnalysis={smmAnalysis}
        />
      ) : (
        <div style={{
          padding: "14px 18px", borderRadius: 12,
          background: "color-mix(in oklch, var(--primary) 5%, transparent)",
          border: "1px dashed color-mix(in oklch, var(--primary) 30%, transparent)",
          marginBottom: 16, fontSize: 13.5, color: "var(--foreground-secondary)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <span>Сначала запустите анализ компании — без него AI не знает контекст.</span>
          <a href="/?nav=new-analysis" style={{
            padding: "7px 14px", borderRadius: 8,
            background: "var(--primary)", color: "#fff",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>К анализу →</a>
        </div>
      )}

      {/* Статус-табы */}
      <div style={{
        display: "flex", gap: 4,
        marginBottom: 14,
        borderBottom: "1px solid var(--border)",
      }}>
        {([
          { id: "drafts" as const, label: "Черновики", color: "#f59e0b" },
          { id: "scheduled" as const, label: "Запланированные", color: "#8b5cf6" },
          { id: "published" as const, label: "Опубликованные", color: "#22c55e" },
        ]).map(t => {
          const active = statusTab === t.id;
          const count = statusCounts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id)}
              style={{
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                color: active ? t.color : "var(--muted-foreground)",
                fontSize: 13.5, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                borderBottom: `2.5px solid ${active ? t.color : "transparent"}`,
                marginBottom: -1,
                transition: "color 0.12s, border-color 0.12s",
                display: "inline-flex", alignItems: "center", gap: 7,
              }}
            >
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 800,
                padding: "1px 7px", borderRadius: 8,
                background: active ? `${t.color}20` : "color-mix(in oklch, var(--foreground) 8%, transparent)",
                color: active ? t.color : "var(--muted-foreground)",
                minWidth: 18, textAlign: "center",
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Фильтры — chip-toolbar + поиск.
          Появляется только при ≥4 постах в текущем табе. */}
      {posts.filter(p => postStatus(p) === statusTab).length >= 4 && (() => {
        const platforms: Array<{ id: typeof platformFilter; label: string; color: string }> = [
          { id: "all", label: "Все", color: "var(--primary)" },
          { id: "instagram", label: "Instagram", color: "#ec4899" },
          { id: "vk", label: "VK", color: "#4a76a8" },
          { id: "telegram", label: "Telegram", color: "#229ED9" },
          { id: "linkedin", label: "LinkedIn", color: "#0a66c2" },
        ];
        return (
          <div style={{
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            padding: "10px 14px", borderRadius: 11,
            background: "var(--background)", border: "1px solid var(--border)",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {platforms.map(p => {
                const count = p.id === "all" ? posts.length : posts.filter(po => po.platform === p.id).length;
                if (p.id !== "all" && count === 0) return null;
                const active = platformFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatformFilter(p.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 7,
                      border: `1.5px solid ${active ? p.color : "var(--border)"}`,
                      background: active ? `${p.color}15` : "transparent",
                      color: active ? p.color : "var(--foreground-secondary)",
                      fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                    {p.label}
                    <span style={{ fontSize: 10.5, opacity: 0.7 }}>{count}</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по тексту…"
              style={{
                flex: 1, minWidth: 180,
                padding: "7px 12px", borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--card)", color: "var(--foreground)",
                fontSize: 12.5, outline: "none", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>
        );
      })()}

      {(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = posts.filter(p =>
          postStatus(p) === statusTab &&
          (platformFilter === "all" || p.platform === platformFilter) &&
          (!q || `${p.hook} ${p.body}`.toLowerCase().includes(q))
        );
        if (filtered.length === 0) {
          const emptyHints: Record<typeof statusTab, string> = {
            drafts: "В этом разделе пока пусто. Сгенерируйте пост из плана контента или из трендов.",
            scheduled: "Нет запланированных постов. Запланировать дату можно при публикации.",
            published: "Опубликованных постов пока нет.",
          };
          return (
            <div style={{
              padding: "32px 20px", borderRadius: 12,
              background: "var(--card)", border: "1px dashed var(--border)",
              textAlign: "center", color: "var(--muted-foreground)", fontSize: 14,
            }}>
              {q || platformFilter !== "all" ? "По выбранным фильтрам ничего не найдено" : emptyHints[statusTab]}
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(post => (
              <PostCard
                key={post.id}
                c={c}
                post={post}
                onUpdate={onUpdatePost}
                onDelete={onDeletePost}
                brandBook={brandBook}
                onRowClick={() => setOpenPostId(post.id)}
              />
            ))}
          </div>
        );
      })()}

      {/* Полноэкранная модалка работы с постом */}
      {openPost && (
        <PostDetailModal
          c={c}
          post={openPost}
          brandBook={brandBook}
          onClose={() => setOpenPostId(null)}
          onUpdate={onUpdatePost}
          onDelete={onDeletePost}
        />
      )}
    </div>
  );
}
