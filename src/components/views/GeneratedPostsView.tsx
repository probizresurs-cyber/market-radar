"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { GeneratedPost, BrandBook, TovCheckResult, TovIssue, PostMetrics, ReelMetrics, ReferenceImage } from "@/lib/content-types";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { ImagePromptEditor } from "@/components/ui/ImagePromptEditor";
import { Palette, Search, Loader2, X, Check, ChevronUp, ChevronDown, Sparkles, BarChart2, Eye, Heart, MessageSquare, TrendingUp, Bookmark, Timer, Film, MousePointer, Target, DollarSign, Banknote, Play, Save, Trash2, Copy, Pencil, Image, Bot, Camera, Wand2 } from "lucide-react";

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
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Loader2 size={12} className="mr-spin"/>GPT-4o проверяет тон…</span>
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

export function MetricsBlock({ c, kind, metrics, onChange }: {
  c: Colors;
  kind: "post" | "reel";
  metrics: AnyMetrics | undefined;
  onChange: (next: AnyMetrics | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnyMetrics>(metrics ?? {});
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(metrics?.screenshotUrl ?? null);
  const [dragging, setDragging] = useState(false);

  const fields = kind === "reel" ? REEL_METRIC_FIELDS : POST_METRIC_FIELDS;
  const accent = kind === "reel" ? "#ec4899" : "#f59e0b";

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
        <div style={{ fontSize: 12, fontWeight: 800, color: accent }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart2 size={12}/>Метрики {kind === "reel" ? "рилса" : "поста"}</span></div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
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
              {loading ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Bot size={11}/>GPT-4o распознаёт метрики…</span> : "Скрин загружен — поля заполнены ниже"}
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
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 8 }}>VK / Instagram / Telegram / TikTok — GPT-4o распознает все цифры автоматически</div>
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

export function PostCard({ c, post, onUpdate, onDelete, brandBook }: {
  c: Colors;
  post: GeneratedPost;
  onUpdate: (updated: GeneratedPost) => void;
  onDelete: (id: string) => void;
  brandBook?: BrandBook;
}) {
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [hashtagsRaw, setHashtagsRaw] = useState(post.hashtags.join(" "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const [showTov, setShowTov] = useState(false);
  // Промпт-редактор для DALL-E (открывается по клику «Сгенерировать фото»)
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [imageGenError, setImageGenError] = useState("");

  const handleGenerateWithPrompt = async (userPrompt: string) => {
    setImageGenError("");
    const res = await fetch("/api/generate-image-anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postText: post.body,
        hook: post.hook,
        format: "пост",
        platform: post.platform ?? "instagram",
        brandColors: brandBook?.colors ?? [],
        brandStyle: brandBook?.visualStyle ?? "",
        userPrompt, // ← пропускаем шаг Claude, рисуем именно эту строку
      }),
    });
    const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
    if (!json.ok) {
      const msg = json.error ?? "Ошибка генерации";
      setImageGenError(msg);
      throw new Error(msg); // editor покажет ошибку и не закроется
    }
    onUpdate({ ...post, imageUrl: json.data!.imageUrl });
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
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid var(--primary)50`, background: "var(--background)",
    color: "var(--foreground)", fontSize: 13, outline: "none",
    lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box",
  };

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
        </div>
      </div>

      {/* Image preview — full width if exists */}
      {post.imageUrl && !editing && (
        <div style={{ marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl} alt={post.hook}
            onClick={() => setImgExpanded(v => !v)}
            style={{
              width: "100%",
              maxHeight: imgExpanded ? 480 : 220,
              borderRadius: 12,
              objectFit: "cover",
              cursor: "pointer",
              border: "1px solid var(--border)",
              transition: "max-height 0.25s ease",
              display: "block",
            }}
          />
          <button onClick={() => setImgExpanded(v => !v)} style={{ marginTop: 6, padding: "4px 12px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer" }}>
            {imgExpanded ? "Свернуть" : "Развернуть"}
          </button>
        </div>
      )}

      {editing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4, letterSpacing: "0.05em" }}>КРЮЧОК / ЗАГОЛОВОК</label>
            <input type="text" value={hook} onChange={e => setHook(e.target.value)} style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4, letterSpacing: "0.05em" }}>
              ТЕКСТ ПОСТА {isCarousel && <span style={{ fontWeight: 400 }}>(экраны карусели разделяются через "---")</span>}
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4, letterSpacing: "0.05em" }}>ХЭШТЕГИ (через пробел)</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Save size={12}/>Сохранить</span></button>
            <button onClick={handleCancel} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Отмена</button>
            {confirmDelete ? (
              <>
                <button onClick={() => onDelete(post.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--destructive)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, cursor: "pointer" }}>Нет</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid var(--destructive)40`, background: "transparent", color: "var(--destructive)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Trash2 size={12}/>Удалить</span></button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.35, marginBottom: 12, letterSpacing: -0.2 }}>{post.hook}</div>
          <div style={{ marginBottom: 14, fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>
            <CarouselBody c={c} body={post.body} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {post.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => navigator.clipboard.writeText(`${post.hook}\n\n${post.body}\n\n${post.hashtags.join(" ")}`)}
              style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Copy size={14}/>Скопировать
            </button>
            {brandBook && (brandBook.toneOfVoice?.length > 0 || brandBook.forbiddenWords?.length > 0) && (
              <button
                onClick={() => setShowTov(v => !v)}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${showTov ? "#6366f1" : "var(--border)"}`, background: showTov ? "#6366f115" : "transparent", color: showTov ? "#6366f1" : "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Palette size={14}/>Tone of Voice
              </button>
            )}
            <button
              onClick={() => { setShowPromptEditor(v => !v); setImageGenError(""); }}
              style={{ padding: "9px 14px", borderRadius: 8, border: post.imageUrl ? "1px solid var(--border)" : "none", background: post.imageUrl ? "transparent" : "var(--primary)", color: post.imageUrl ? "var(--foreground-secondary)" : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Wand2 size={14}/>
              {showPromptEditor ? "Закрыть" : post.imageUrl ? "Перерисовать" : "Сгенерировать фото"}
            </button>
          </div>
          {imageGenError && !showPromptEditor && (
            <div style={{ fontSize: 13, color: "var(--destructive)", marginTop: 10, padding: "8px 12px", background: "color-mix(in oklch, var(--destructive) 8%, transparent)", borderRadius: 8 }}>{imageGenError}</div>
          )}
          {showPromptEditor && (
            <ImagePromptEditor
              params={{
                postText: post.body,
                hook: post.hook,
                format: "пост",
                platform: post.platform ?? "instagram",
                brandColors: brandBook?.colors ?? [],
                brandStyle: brandBook?.visualStyle ?? "",
              }}
              generateLabel={post.imageUrl ? "Перерисовать" : "Сгенерировать фото"}
              onGenerate={handleGenerateWithPrompt}
              onCancel={() => setShowPromptEditor(false)}
            />
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
          <MetricsBlock c={c} kind="post" metrics={post.metrics} onChange={m => onUpdate({ ...post, metrics: m })} />
        </>
      )}
    </div>
  );
}

export function GeneratedPostsView({ c, posts, onUpdatePost, onDeletePost, referenceImages, onUpdateReferenceImages, brandBook }: {
  c: Colors;
  posts: GeneratedPost[];
  onUpdatePost: (updated: GeneratedPost) => void;
  onDeletePost: (id: string) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook?: BrandBook;
}) {
  if (posts.length === 0) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Готовые посты</h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 24px" }}>Все сгенерированные посты с картинками появятся здесь.</p>
        <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "56px 32px", textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Pencil size={36} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 10 }}>Пока нет постов</div>
          <div style={{ fontSize: 15, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 28px" }}>
            Создайте первый пост — выберите идею в «Плане контента» или дайте AI-агенту собрать тренды по вашей нише.
          </div>
          <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <a href="/?nav=content-plan" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)" }}>
              План контента →
            </a>
            <a href="/?nav=content-trends" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: "var(--background)", color: "var(--foreground)", fontWeight: 700, fontSize: 15, textDecoration: "none", border: "1.5px solid var(--border)" }}>
              Тренды по нише →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--foreground)", letterSpacing: -0.5 }}>Готовые посты</h1>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", padding: "4px 12px", borderRadius: 20, background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
          {posts.length}
        </span>
      </div>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 24px" }}>Кликните на карточке, чтобы посмотреть и отредактировать.</p>
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
        {posts.map(post => (
          <PostCard key={post.id} c={c} post={post} onUpdate={onUpdatePost} onDelete={onDeletePost} brandBook={brandBook} />
        ))}
      </div>
    </div>
  );
}
