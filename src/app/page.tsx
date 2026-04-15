"use client";

import React, { useState, useEffect } from "react";
import { LayoutDashboard, Users, Sword, BookOpen, BarChart2, Settings, Menu, ChevronRight, X } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult, TASegment } from "@/lib/ta-types";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, GeneratedPost, GeneratedReel, AvatarSettings, ReferenceImage, BrandBook, PostMetrics, ReelMetrics, GeneratedStory, TovCheckResult, TovIssue, PresentationStyle } from "@/lib/content-types";
import type { Review, ReviewAnalysis } from "@/lib/review-types";

// ─── Shared modules (extracted from this file) ─────────────────────────────────
import { COLORS, type Theme, type Colors } from "@/lib/colors";
import { type UserAccount, NICHE_COMPETITORS, syncToServer, loadAllFromServer, authGetCurrentUser, authSetCurrentUser, sendTgNotification } from "@/lib/user";
import { SOURCES_FREE } from "@/lib/data/sources";

// ─── Extracted view components ────────────────────────────────────────────────
import { LandingPageView } from "@/components/views/LandingPageView";
import { RegisterView } from "@/components/views/RegisterView";
import { LoginView } from "@/components/views/LoginView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { LandingView } from "@/components/views/LandingView";
import { LoadingView } from "@/components/views/LoadingView";

// ─── Extracted UI components ──────────────────────────────────────────────────
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { RadarChart } from "@/components/ui/RadarChart";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { PreviousAnalysesView } from "@/components/views/PreviousAnalysesView";
import { DashboardView } from "@/components/views/DashboardView";
import { CompetitorsView } from "@/components/views/CompetitorsView";
import { CompetitorProfileView } from "@/components/views/CompetitorProfileView";
import { CompareView } from "@/components/views/CompareView";
import { InsightsView } from "@/components/views/InsightsView";
import { ReportsView } from "@/components/views/ReportsView";
import { SourcesView } from "@/components/views/SourcesView";

type AnyMetrics = PostMetrics & ReelMetrics;

// ============================================================
// New Analysis View (inside dashboard sidebar)
// ============================================================

function NewAnalysisView({ c, onAnalyze, isAnalyzing }: { c: Colors; onAnalyze: (url: string) => Promise<void>; isAnalyzing: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isAnalyzing) return;
    setError(null);
    try {
      await onAnalyze(url.trim());
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Новый анализ</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Введите URL сайта для анализа. Результат будет добавлен в дашборд и список конкурентов.</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.ru" disabled={isAnalyzing}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: isAnalyzing || !url.trim() ? 0.65 : 1, fontFamily: "inherit" }}>
              {isAnalyzing ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin2 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 16, height: 16, border: `2px solid ${c.borderLight}`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin2 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: c.textSecondary }}>Анализируем сайт…</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}












import { SettingsView } from "@/components/views/SettingsView";
import { NewTAView, TAEmptyDashboard, TADashboardView } from "@/components/views/TAViews";
import { BrandSuggestionsView } from "@/components/views/BrandSuggestionsView";
import { NewSMMView, SMMEmptyDashboard, SMMDashboardView } from "@/components/views/SMMViews";

import { ContentEmptyView, NewContentPlanView, ContentPlanView } from "@/components/views/ContentPlanView";
import { GeneratedPostsView } from "@/components/views/GeneratedPostsView";
import { GeneratedReelsView } from "@/components/views/GeneratedReelsView";
import { ContentAnalyticsView, ROICalculatorView } from "@/components/views/ContentAnalyticsView";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { BrandBookPanel } from "@/components/ui/BrandBookPanel";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";

// ============================================================
// Presentation Builder View
// ============================================================

interface PresentationSlide {
  title: string;
  subtitle?: string;
  type: string;
  content: string;
  bullets: string[];
  stats: Array<{ value: string; label: string }>;
  quote?: string;
  note?: string;
  items?: Array<{ title: string; description: string; icon?: string }>;
  leftContent?: string;
  rightContent?: string;
  isEdited?: boolean;
}

const PRESET_STYLES: PresentationStyle[] = [
  { id: "minimalist", name: "Минимализм", colors: ["#1a1a2e", "#f5f5f5", "#6366f1", "#ffffff", "#1a1a2e"], fontHeader: "Inter", fontBody: "Inter", mood: "Чистый, воздушный, элегантный" },
  { id: "corporate", name: "Корпоративный", colors: ["#0f2b46", "#c7985e", "#2563eb", "#f8f9fc", "#1e293b"], fontHeader: "Georgia", fontBody: "Calibri", mood: "Надёжный, солидный, деловой" },
  { id: "bright", name: "Яркий", colors: ["#7c3aed", "#f59e0b", "#10b981", "#ffffff", "#18181b"], fontHeader: "Montserrat", fontBody: "Open Sans", mood: "Энергичный, современный, динамичный" },
  { id: "warm", name: "Тёплый", colors: ["#92400e", "#d97706", "#b45309", "#fffbeb", "#422006"], fontHeader: "Merriweather", fontBody: "Source Sans Pro", mood: "Уютный, натуральный, человечный" },
  { id: "dark", name: "Премиум", colors: ["#0a0a0a", "#a855f7", "#22d3ee", "#111111", "#f1f5f9"], fontHeader: "Playfair Display", fontBody: "Raleway", mood: "Элитный, технологичный, стильный" },
  { id: "fresh", name: "Свежий", colors: ["#059669", "#34d399", "#06b6d4", "#f0fdf4", "#064e3b"], fontHeader: "Nunito", fontBody: "Nunito", mood: "Экологичный, лёгкий, оптимистичный" },
];

function buildStyleFromBrandBook(bb: BrandBook): PresentationStyle {
  return {
    id: "brandbook",
    name: "Мой брендбук",
    colors: bb.colors.length >= 5 ? bb.colors.slice(0,5) : [
      bb.colors[0] || "#1a1a2e",
      bb.colors[1] || "#6366f1",
      bb.colors[2] || "#10b981",
      bb.colors[3] || "#ffffff",
      bb.colors[4] || "#1a1a2e",
    ],
    fontHeader: bb.fontHeader || "Georgia",
    fontBody: bb.fontBody || "Calibri",
    mood: bb.visualStyle || "Фирменный стиль",
  };
}

// ============================================================
// Landing Page Generator View
// ============================================================
interface LandingResult {
  projectId: string;
  screenId: string;
  htmlUrl: string;
  imageUrl: string;
  htmlContent?: string;
}

const STYLE_PRESETS = [
  { id: "auto",     label: "Из брендбука",  icon: "🎨", desc: "Цвета и шрифты из вашего брендбука" },
  { id: "minimal",  label: "Минимализм",    icon: "⬜", desc: "Белый фон, тёмный текст, много воздуха", colors: ["#ffffff","#111111","#6366f1"], fonts: "Inter" },
  { id: "dark",     label: "Тёмная тема",   icon: "🌑", desc: "Тёмный фон, неоновые акценты", colors: ["#0a0a0a","#f1f5f9","#a855f7"], fonts: "Inter" },
  { id: "bold",     label: "Яркий/Смелый",  icon: "🔥", desc: "Насыщенные цвета, крупная типографика", colors: ["#7c3aed","#fbbf24","#10b981"], fonts: "Montserrat" },
  { id: "corporate","label": "Корпоративный","icon": "💼", desc: "Синяя палитра, деловой стиль", colors: ["#1e3a5f","#3b82f6","#f8fafc"], fonts: "Georgia" },
  { id: "warm",     label: "Тёплый",        icon: "🍂", desc: "Земляные тона, природные текстуры", colors: ["#92400e","#d97706","#fef3c7"], fonts: "Merriweather" },
  { id: "fresh",    label: "Свежий/Эко",    icon: "🌿", desc: "Зелёная палитра, натуральный стиль", colors: ["#065f46","#34d399","#f0fdf4"], fonts: "Nunito" },
  { id: "custom",   label: "Свои цвета",    icon: "✏️", desc: "Задайте собственную цветовую гамму" },
] as const;

interface SavedLanding {
  id: string;
  title: string;
  createdAt: string;
  projectId: string;
  screenId: string;
  htmlUrl: string;
  imageUrl: string;
  landingType: string;
  stylePreset: string;
}

function LandingGeneratorView({ c, myCompany, taAnalysis, smmAnalysis, brandBook, userId }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  taAnalysis: TAResult | null;
  smmAnalysis: SMMResult | null;
  brandBook: BrandBook;
  userId: string;
}) {
  const [tab, setTab]                   = useState<"create" | "history">("create");
  const [landingHistory, setLandingHistory] = useState<SavedLanding[]>([]);
  const [landingType, setLandingType]   = useState<string>("main");
  const [stylePreset, setStylePreset]   = useState<string>("auto");
  const [customColors, setCustomColors] = useState<string>("");
  const [customFonts, setCustomFonts]   = useState<string>("");
  const [userPrompt, setUserPrompt]     = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress]         = useState(0);
  const [result, setResult]             = useState<LandingResult | null>(null);
  const [error, setError]               = useState("");
  const [editPrompt, setEditPrompt]     = useState("");
  const [isEditing, setIsEditing]       = useState(false);
  const [variants, setVariants]         = useState<Array<{ screenId: string; htmlUrl: string; imageUrl: string; htmlContent?: string }>>([]);
  const [imgZoom, setImgZoom]           = useState(1);
  const [showPreview, setShowPreview]   = useState(false);
  const [previewMode, setPreviewMode]   = useState<"screenshot" | "iframe">("iframe");

  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`mr_landings_${userId}`);
      if (saved) setLandingHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [userId]);

  const saveLanding = (r: LandingResult, type: string, preset: string) => {
    if (!userId) return;
    const entry: SavedLanding = {
      id: Date.now().toString(),
      title: `${myCompany?.company.name ?? "Лендинг"} — ${landingTypes.find(l => l.id === type)?.label ?? type}`,
      createdAt: new Date().toISOString(),
      projectId: r.projectId,
      screenId: r.screenId,
      htmlUrl: r.htmlUrl,
      imageUrl: r.imageUrl,
      landingType: type,
      stylePreset: preset,
    };
    const updated = [entry, ...landingHistory].slice(0, 20);
    setLandingHistory(updated);
    try { localStorage.setItem(`mr_landings_${userId}`, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const deleteLanding = (id: string) => {
    const updated = landingHistory.filter(h => h.id !== id);
    setLandingHistory(updated);
    try { localStorage.setItem(`mr_landings_${userId}`, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const loadLanding = (h: SavedLanding) => {
    setResult({ projectId: h.projectId, screenId: h.screenId, htmlUrl: h.htmlUrl, imageUrl: h.imageUrl });
    setLandingType(h.landingType);
    setStylePreset(h.stylePreset);
    setTab("create");
  };

  const landingTypes = [
    { id: "main",    icon: "🏠", label: "Главная страница", desc: "Полноценный лендинг с героем, услугами, преимуществами, отзывами и CTA" },
    { id: "product", icon: "📦", label: "Продукт / Услуга", desc: "Витрина продукта: фичи, тарифы, FAQ, социальное доказательство" },
    { id: "promo",   icon: "🔥", label: "Промо / Акция",    desc: "Промо-лендинг: оффер, срочность, спецпредложение, trust-бейджи" },
    { id: "lead",    icon: "📝", label: "Лид-генерация",    desc: "Сбор заявок: форма, боли клиента, решение, логотипы клиентов" },
  ];

  // Build style config to send to API
  const buildStyleConfig = () => {
    if (stylePreset === "auto") {
      return {
        source: "brandbook",
        colors: brandBook.colors ?? [] as string[],
        font: brandBook.fontHeader || undefined,
        customPrompt: "",
      };
    }
    if (stylePreset === "custom") {
      return {
        source: "custom",
        colors: customColors.split(",").map(s => s.trim()).filter(Boolean) as string[],
        font: customFonts.trim() || undefined,
        customPrompt: `Use colors: ${customColors}. Font: ${customFonts || "Inter"}.`,
      };
    }
    const preset = STYLE_PRESETS.find(p => p.id === stylePreset);
    const colorsArr: string[] = preset && "colors" in preset ? [...(preset as unknown as { colors: readonly string[] }).colors] : [];
    const fontStr: string = preset && "fonts" in preset ? (preset as unknown as { fonts: string }).fonts : "Inter";
    return {
      source: "preset",
      id: stylePreset,
      colors: colorsArr,
      font: fontStr,
      customPrompt: preset ? `Style: ${preset.label}. ${preset.desc}.` : "",
    };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");
    setProgress(0);
    setResult(null);
    setVariants([]);

    const interval = setInterval(() => setProgress(p => Math.min(p + 1.5, 90)), 600);

    try {
      const res = await fetch("/api/generate-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: myCompany?.company,
          brandBook,
          taData: taAnalysis,
          smmData: smmAnalysis,
          landingType,
          styleConfig: buildStyleConfig(),
          userPrompt: userPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка генерации");
      setResult(data);
      saveLanding(data, landingType, stylePreset);
      setProgress(100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!result || !editPrompt.trim()) return;
    setIsEditing(true);
    setError("");
    try {
      const res = await fetch("/api/edit-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          screenId: result.screenId,
          editPrompt,
          action: "edit",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка редактирования");
      setResult(prev => prev ? { ...prev, screenId: data.screenId, htmlUrl: data.htmlUrl, imageUrl: data.imageUrl, htmlContent: data.htmlContent ?? prev.htmlContent } : null);
      setEditPrompt("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsEditing(false);
    }
  };

  const handleVariants = async () => {
    if (!result) return;
    setIsEditing(true);
    setError("");
    try {
      const res = await fetch("/api/edit-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          screenId: result.screenId,
          action: "variants",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка генерации вариантов");
      setVariants(data.variants || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsEditing(false);
    }
  };

  const handleMobile = async () => {
    if (!result) return;
    setIsEditing(true);
    setError("");
    try {
      const res = await fetch("/api/edit-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          screenId: result.screenId,
          action: "mobile",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      // Open mobile version as a new variant
      setVariants(prev => [...prev, { screenId: data.screenId, htmlUrl: data.htmlUrl, imageUrl: data.imageUrl }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsEditing(false);
    }
  };

  const primary = brandBook.colors?.[0] || c.accent;

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Генератор лендингов</h1>
          <p style={{ color: c.textSecondary, fontSize: 14 }}>AI-генерация профессиональных лендингов на основе анализа компании, ЦА и брендбука</p>
        </div>
        <div style={{ display: "flex", gap: 2, background: c.bgCard, borderRadius: 10, padding: 3, border: `1px solid ${c.border}` }}>
          {(["create", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: tab === t ? c.accent : "transparent",
                color: tab === t ? "#fff" : c.textSecondary }}>
              {t === "create" ? "✦ Создать" : `📁 История (${landingHistory.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: c.accentRed + "18", color: c.accentRed, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {landingHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: c.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: c.textSecondary, marginBottom: 6 }}>Нет сохранённых лендингов</p>
              <p style={{ fontSize: 13 }}>Создайте первый — он автоматически сохранится</p>
              <button onClick={() => setTab("create")} style={{ marginTop: 16, padding: "9px 22px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Создать лендинг</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {landingHistory.map(h => {
                const typeIcon = landingTypes.find(l => l.id === h.landingType)?.icon ?? "🌐";
                const presetLabel = STYLE_PRESETS.find(p => p.id === h.stylePreset)?.label ?? h.stylePreset;
                return (
                  <div key={h.id} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    {/* Screenshot */}
                    <div style={{ position: "relative", background: c.bg }}>
                      {/* Browser chrome */}
                      <div style={{ background: c.bgCard, padding: "6px 10px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                        </div>
                        <div style={{ flex: 1, background: c.bg, borderRadius: 4, padding: "2px 8px", fontSize: 9, color: c.textMuted }}>
                          {myCompany?.company.name?.toLowerCase().replace(/\s+/g, "") ?? "landing"}.ru
                        </div>
                      </div>
                      <img src={h.imageUrl} alt={h.title} style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 3 }}>{h.title}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: c.accent + "14", color: c.accent, fontWeight: 600 }}>{typeIcon} {landingTypes.find(l => l.id === h.landingType)?.label ?? h.landingType}</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.textMuted }}>{presetLabel}</span>
                        <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(h.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadLanding(h)}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: c.accent, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          Открыть
                        </button>
                        <a href={h.htmlUrl} target="_blank" rel="noopener noreferrer"
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}>
                          ⬇
                        </a>
                        <button onClick={() => deleteLanding(h.id)}
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 12, cursor: "pointer" }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE TAB ── */}
      {tab === "create" && <>

      {/* ── Data readiness badges ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "Компания", ok: !!myCompany },
          { label: "Брендбук", ok: !!brandBook.brandName || brandBook.colors.length > 0 },
          { label: "ЦА", ok: !!taAnalysis },
          { label: "СММ", ok: !!smmAnalysis },
        ].map((b, i) => (
          <span key={i} style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: b.ok ? c.accentGreen + "18" : c.accentRed + "12",
            color: b.ok ? c.accentGreen : c.textMuted }}>
            {b.ok ? "✓" : "✗"} {b.label}
          </span>
        ))}
      </div>

      {/* ── Setup form ── */}
      {!result && !isGenerating && (
        <>
          {/* 1. Landing type */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>1. Тип лендинга</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 24 }}>
            {landingTypes.map(lt => (
              <div key={lt.id} onClick={() => setLandingType(lt.id)}
                style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  background: landingType === lt.id ? primary + "12" : c.bgCard,
                  border: `2px solid ${landingType === lt.id ? primary : c.border}`,
                  boxShadow: landingType === lt.id ? `0 4px 14px ${primary}20` : "none" }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{lt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 3 }}>{lt.label}</div>
                <div style={{ fontSize: 10.5, color: c.textSecondary, lineHeight: 1.5 }}>{lt.desc}</div>
              </div>
            ))}
          </div>

          {/* 2. Style preset */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>2. Стиль и цветовая гамма</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: stylePreset === "custom" ? 12 : 20 }}>
            {STYLE_PRESETS.map(sp => {
              const hasColors = "colors" in sp;
              return (
                <div key={sp.id} onClick={() => setStylePreset(sp.id)}
                  style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    background: stylePreset === sp.id ? primary + "12" : c.bgCard,
                    border: `2px solid ${stylePreset === sp.id ? primary : c.border}` }}>
                  {/* Color dots preview */}
                  {hasColors && (
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      {(sp as unknown as { colors: string[] }).colors.map((col, ci) => (
                        <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: col, border: "1px solid rgba(0,0,0,0.1)" }} />
                      ))}
                    </div>
                  )}
                  {!hasColors && <div style={{ fontSize: 16, marginBottom: 4 }}>{sp.icon}</div>}
                  <div style={{ fontSize: 12, fontWeight: 700, color: stylePreset === sp.id ? primary : c.textPrimary, marginBottom: 2 }}>{sp.label}</div>
                  <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.4 }}>{sp.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Custom colors input */}
          {stylePreset === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary, display: "block", marginBottom: 4 }}>
                  Цвета (через запятую)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input value={customColors} onChange={e => setCustomColors(e.target.value)}
                    placeholder="#6366f1, #fff, #1a1a2e"
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, fontSize: 12, outline: "none" }} />
                  {/* Live color dot previews */}
                  <div style={{ display: "flex", gap: 3 }}>
                    {customColors.split(",").map(s => s.trim()).filter(Boolean).slice(0, 5).map((col, i) => (
                      <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: col, border: `1px solid ${c.border}` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary, display: "block", marginBottom: 4 }}>
                  Шрифт (Google Fonts)
                </label>
                <input value={customFonts} onChange={e => setCustomFonts(e.target.value)}
                  placeholder="Montserrat, Playfair Display..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}

          {/* 3. Custom prompt */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>
            3. Дополнительные пожелания <span style={{ fontSize: 11, fontWeight: 400, color: c.textMuted }}>(необязательно)</span>
          </h3>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} rows={3}
              placeholder="Например: Добавь секцию с видео-отзывами. Используй стиль как у Apple — минималистично и продающе. Сделай большой hero с градиентным фоном. Добавь счётчик с цифрами достижений..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${c.border}`,
                background: c.bgCard, color: c.textPrimary, fontSize: 13, outline: "none",
                resize: "vertical", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>
              Описывайте на русском или английском — что добавить, какой стиль, какие секции нужны
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleGenerate} disabled={!myCompany}
              style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: primary, color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: myCompany ? "pointer" : "not-allowed", opacity: myCompany ? 1 : 0.5 }}>
              ✦ Сгенерировать лендинг
            </button>
            {stylePreset === "auto" && (brandBook.colors?.[0]) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {(brandBook.colors || []).slice(0,4).map((col: string, i: number) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: col, border: `1px solid ${c.border}` }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: c.textMuted }}>Цвета из брендбука</span>
              </div>
            )}
          </div>
          {!myCompany && <p style={{ fontSize: 11, color: c.textMuted, marginTop: 8 }}>Сначала выполните анализ компании</p>}
        </>
      )}

      {/* ── Generation progress ── */}
      {isGenerating && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 300, height: 6, borderRadius: 3, background: c.border, margin: "0 auto 16px", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${primary}, ${c.accentGreen})`, transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary }}>{Math.round(progress)}% — Генерация лендинга...</p>
          <p style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>Google Stitch создаёт дизайн на основе ваших данных</p>
        </div>
      )}

      {/* ── Result view ── */}
      {result && !isGenerating && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: primary, color: "#fff",
                textDecoration: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              🌐 Открыть лендинг
            </a>
            <a href={result.htmlUrl} download="landing.html"
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary,
                textDecoration: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              ⬇ Скачать HTML
            </a>
            <button onClick={handleVariants} disabled={isEditing}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard,
                color: c.textPrimary, cursor: isEditing ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              🎨 Варианты
            </button>
            <button onClick={handleMobile} disabled={isEditing}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard,
                color: c.textPrimary, cursor: isEditing ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              📱 Мобильная версия
            </button>
            <button onClick={() => { setResult(null); setVariants([]); setProgress(0); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard,
                color: c.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              🔄 Заново
            </button>
          </div>

          {/* Edit prompt */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
              placeholder="Пожелание: сделай хедер темнее, добавь секцию с отзывами..."
              onKeyDown={e => e.key === "Enter" && handleEdit()}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${c.border}`,
                background: c.bgCard, color: c.textPrimary, fontSize: 13, outline: "none" }} />
            <button onClick={handleEdit} disabled={isEditing || !editPrompt.trim()}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: primary,
                color: "#fff", cursor: isEditing || !editPrompt.trim() ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 13, opacity: isEditing || !editPrompt.trim() ? 0.5 : 1 }}>
              {isEditing ? "Обновляю..." : "Изменить"}
            </button>
          </div>

          {/* Preview — screenshot thumbnail with zoom + click-to-open */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${c.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", marginBottom: 20 }}>
            {/* Browser chrome bar */}
            <div style={{ background: c.bgCard, padding: "8px 12px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
              </div>
              <div style={{ flex: 1, background: c.bg, borderRadius: 5, padding: "3px 10px", fontSize: 11, color: c.textMuted }}>
                {myCompany?.company.name || "landing"}.marketradar.ai
              </div>
              {/* Zoom controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button onClick={() => setImgZoom(z => Math.max(0.3, z - 0.2))} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: 11, color: c.textMuted, minWidth: 36, textAlign: "center" }}>{Math.round(imgZoom * 100)}%</span>
                <button onClick={() => setImgZoom(z => Math.min(3, z + 0.2))} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <button onClick={() => setImgZoom(1)} title="Сбросить" style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${c.border}`, background: c.bg, color: c.textMuted, cursor: "pointer", fontSize: 11 }}>↺</button>
              </div>
              <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding: "4px 12px", borderRadius: 6, background: primary, color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                🌐 Открыть
              </a>
            </div>

            {/* Zoomable screenshot */}
            <div
              style={{ height: 560, overflow: "auto", background: "#f0f0f0", position: "relative", cursor: imgZoom > 1 ? "grab" : "zoom-in" }}
              onWheel={e => { e.preventDefault(); setImgZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.0008))); }}
              onClick={() => { if (imgZoom === 1) window.open(result.htmlUrl, "_blank"); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Landing preview"
                style={{ width: `${imgZoom * 100}%`, display: "block", transformOrigin: "top left" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {/* Click hint overlay when at 100% */}
              {imgZoom === 1 && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0)", transition: "background 0.2s",
                  opacity: 0,
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1", e.currentTarget.style.background = "rgba(0,0,0,0.35)")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0", e.currentTarget.style.background = "rgba(0,0,0,0)")}
                >
                  <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "14px 32px", borderRadius: 12, background: "#fff", color: "#111", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                    🌐 Открыть полную версию
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>
                Варианты ({variants.length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {variants.map((v, vi) => (
                  <div key={vi} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${c.border}`, cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => setResult(prev => prev ? { ...prev, screenId: v.screenId, htmlUrl: v.htmlUrl, imageUrl: v.imageUrl, htmlContent: v.htmlContent ?? prev?.htmlContent } : null)}>
                    <img src={v.imageUrl} alt={`Variant ${vi + 1}`} style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "contain", background: "#f8f8f8" }} />
                    <div style={{ padding: "8px 12px", background: c.bgCard, fontSize: 12, fontWeight: 600, color: c.textPrimary, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Вариант {vi + 1}</span>
                      <a href={v.htmlUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: primary, textDecoration: "none" }}>Скачать</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen preview removed — use "Открыть лендинг" button instead */}
      </>}
    </div>
  );
}

interface SavedPresentation {
  id: string;
  title: string;
  createdAt: string;
  slides: PresentationSlide[];
  style: PresentationStyle | null;
  slideCount: number;
}

function PresentationView({ c, myCompany, taAnalysis, smmAnalysis, brandBook, userId }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  taAnalysis: TAResult | null;
  smmAnalysis: SMMResult | null;
  brandBook: BrandBook;
  userId: string;
}) {
  // Tab
  const [tab, setTab] = useState<"create" | "history">("create");
  const [history, setHistory] = useState<SavedPresentation[]>([]);

  // Multi-stage wizard
  const [stage, setStage] = useState<"style" | "generating" | "review">("style");
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [presTitle, setPresTitle] = useState("");
  const [error, setError] = useState("");

  // Stage 1: style
  const [styleSource, setStyleSource] = useState<"brandbook" | "presets" | null>(null);
  const [paletteOptions, setPaletteOptions] = useState<PresentationStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<PresentationStyle | null>(null);

  // Stage 2: generation
  const [genProgress, setGenProgress] = useState(0);

  // Stage 3: review
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [wishText, setWishText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [isExportingSlidev, setIsExportingSlidev] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`mr_presentations_${userId}`);
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [userId]);

  const saveToHistory = (newSlides: PresentationSlide[], title: string, style: PresentationStyle | null) => {
    if (!userId) return;
    const entry: SavedPresentation = {
      id: Date.now().toString(),
      title: title || `Презентация ${new Date().toLocaleDateString("ru")}`,
      createdAt: new Date().toISOString(),
      slides: newSlides,
      style,
      slideCount: newSlides.length,
    };
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    try { localStorage.setItem(`mr_presentations_${userId}`, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const deleteFromHistory = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try { localStorage.setItem(`mr_presentations_${userId}`, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const loadFromHistory = (saved: SavedPresentation) => {
    setSlides(saved.slides);
    setPresTitle(saved.title);
    setSelectedStyle(saved.style);
    setStage("review");
    setTab("create");
  };

  // Derived colors from selected style
  const sty = selectedStyle || buildStyleFromBrandBook(brandBook);
  const primary = sty.colors[0] || c.accent;
  const secondary = sty.colors[1] || c.accentGreen;
  const bg = sty.colors[3] || "#ffffff";
  const textColor = sty.colors[4] || "#1a1a2e";

  // ── Stage 1 handlers ─────────────────────────────────
  const handlePickBrandbook = () => {
    setStyleSource("brandbook");
    const bbStyle = buildStyleFromBrandBook(brandBook);
    // Generate 3 variations: the brandbook itself + 2 tweaked
    const variations: PresentationStyle[] = [bbStyle];
    const shift = (hex: string, deg: number) => {
      const h = hex.replace("#","");
      let r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b2 = parseInt(h.slice(4,6),16);
      r = Math.min(255, Math.max(0, r + deg)); g = Math.min(255, Math.max(0, g + deg * 0.5)); b2 = Math.min(255, Math.max(0, b2 - deg * 0.3));
      return `#${Math.round(r).toString(16).padStart(2,"0")}${Math.round(g).toString(16).padStart(2,"0")}${Math.round(b2).toString(16).padStart(2,"0")}`;
    };
    variations.push({ ...bbStyle, id: "bb-light", name: "Брендбук (светлый)", colors: bbStyle.colors.map((col, i) => i === 3 ? "#ffffff" : i === 4 ? "#1a1a2e" : shift(col, 20)) });
    variations.push({ ...bbStyle, id: "bb-dark", name: "Брендбук (тёмный)", colors: [bbStyle.colors[0], bbStyle.colors[1], bbStyle.colors[2], "#111118", "#f1f5f9"], mood: "Тёмная версия бренда" });
    // Add 2 matching presets
    variations.push(...PRESET_STYLES.slice(0, 2));
    setPaletteOptions(variations);
  };

  const handlePickPresets = () => {
    setStyleSource("presets");
    setPaletteOptions(PRESET_STYLES);
  };

  // ── Stage 2 handler ──────────────────────────────────
  const handleGenerate = async () => {
    if (!myCompany || !selectedStyle) { setError("Выберите стиль и убедитесь что анализ проведён"); return; }
    setStage("generating");
    setGenProgress(0);
    setError("");
    const timer = setInterval(() => setGenProgress(p => Math.min(p + 2, 88)), 400);
    try {
      const res = await fetch("/api/generate-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: myCompany.company,
          brandBook,
          style: selectedStyle,
          taData: taAnalysis,
          smmData: smmAnalysis,
          social: myCompany.social,
          business: myCompany.business,
          seo: myCompany.seo,
          nicheForecast: myCompany.nicheForecast,
          hiring: myCompany.hiring,
        }),
      });
      const json = await res.json();
      clearInterval(timer);
      if (!json.ok) throw new Error(json.error);
      const newTitle = json.data.title ?? "Бренд-презентация";
      const newSlides = json.data.slides ?? [];
      setPresTitle(newTitle);
      setSlides(newSlides);
      setGenProgress(100);
      saveToHistory(newSlides, newTitle, selectedStyle);
      setTimeout(() => setStage("review"), 600);
    } catch (err: unknown) {
      clearInterval(timer);
      setError(err instanceof Error ? err.message : "Ошибка генерации");
      setStage("style");
    }
  };

  // ── Stage 3 handlers ─────────────────────────────────
  const handleSlideUpdate = (idx: number, patch: Partial<PresentationSlide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch, isEdited: true } : s));
  };

  const handleWishUpdate = async () => {
    if (!wishText.trim() || !myCompany) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/edit-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, wish: wishText, style: selectedStyle, brandBook, company: myCompany.company }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSlides(json.data.slides ?? slides);
      setWishText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка обновления");
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Export handlers ──────────────────────────────────
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await fetch("/api/export-slides-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, style: selectedStyle, title: presTitle }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка PDF" }));
        throw new Error(err.error || "Ошибка PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presTitle || "presentation"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPptx = async () => {
    setIsExportingPptx(true);
    try {
      const res = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, presTitle, brandBook, style: selectedStyle }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presTitle || "presentation"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка PPTX");
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleExportSlidev = async () => {
    setIsExportingSlidev(true);
    try {
      const res = await fetch("/api/export-slidev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, style: selectedStyle, title: presTitle }),
      });
      if (!res.ok) throw new Error("Ошибка экспорта Slidev");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presTitle || "presentation"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка Slidev");
    } finally {
      setIsExportingSlidev(false);
    }
  };

  const renderSlide = (slide: PresentationSlide, idx: number) => {
    const type = slide.type;
    const total = slides.length;
    const fontH = sty.fontHeader || brandBook.fontHeader || "Georgia";
    const fontB = sty.fontBody || brandBook.fontBody || "Inter";

    const darkenHex = (hex: string, amt: number) => {
      const h = hex.replace("#", "");
      const r = Math.round(parseInt(h.slice(0,2),16)*(1-amt));
      const g = Math.round(parseInt(h.slice(2,4),16)*(1-amt));
      const b2 = Math.round(parseInt(h.slice(4,6),16)*(1-amt));
      return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b2.toString(16).padStart(2,"0")}`;
    };
    const lightenHex = (hex: string, amt: number) => {
      const h = hex.replace("#", "");
      const r = Math.min(255, Math.round(parseInt(h.slice(0,2),16)+(255-parseInt(h.slice(0,2),16))*amt));
      const g = Math.min(255, Math.round(parseInt(h.slice(2,4),16)+(255-parseInt(h.slice(2,4),16))*amt));
      const b2 = Math.min(255, Math.round(parseInt(h.slice(4,6),16)+(255-parseInt(h.slice(4,6),16))*amt));
      return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b2.toString(16).padStart(2,"0")}`;
    };
    const darkPrimary = darkenHex(primary, 0.28);
    const lightPrimary = lightenHex(primary, 0.92);
    const accentColors = [primary, secondary, "#f59e0b", "#10b981", "#e11d48", "#0ea5e9"];

    const slideBase: React.CSSProperties = {
      width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden",
      position: "relative", boxShadow: "0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)",
      fontFamily: `'${fontB}', system-ui, sans-serif`,
    };
    const numTag = (dark: boolean) => (
      <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 10, fontWeight: 700,
        color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)", letterSpacing: 1.5 }}>
        {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
    );

    // ── COVER ─────────────────────────────────────────────────
    if (type === "cover") {
      return (
        <div key={idx} style={{ ...slideBase, background: `linear-gradient(135deg, ${darkPrimary} 0%, ${primary} 55%, ${lightenHex(primary, 0.15)} 100%)`, display: "flex", alignItems: "stretch" }}>
          {/* Mesh/noise overlay */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 80% 20%, ${lightenHex(secondary, 0.1)}44 0%, transparent 55%), radial-gradient(circle at 10% 80%, ${secondary}22 0%, transparent 45%)`, pointerEvents: "none" }} />
          {/* Left: narrow accent bar */}
          <div style={{ width: "38%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "32px 28px 26px", position: "relative", zIndex: 2 }}>
            {brandBook.logoDataUrl
              ? <img src={brandBook.logoDataUrl} alt="logo" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,0.12)", padding: 4 }} />
              : <div style={{ display: "flex", gap: 6 }}><div style={{ width: 28, height: 4, borderRadius: 2, background: secondary }} /><div style={{ width: 10, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} /></div>
            }
            <div>
              <div style={{ fontSize: 56, fontWeight: 900, color: "rgba(255,255,255,0.06)", lineHeight: 1, fontFamily: `'${fontH}', serif` }}>{String(idx+1).padStart(2,"0")}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 2.5, textTransform: "uppercase", marginTop: 4 }}>{brandBook.brandName || "MarketRadar"}</div>
            </div>
          </div>
          {/* Right: content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 44px 36px 8px", position: "relative", zIndex: 2 }}>
            {slide.subtitle && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <div style={{ width: 20, height: 2, background: secondary, borderRadius: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: secondary, letterSpacing: 2, textTransform: "uppercase" }}>{slide.subtitle}</span>
              </div>
            )}
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", margin: "0 0 16px", lineHeight: 1.15, fontFamily: `'${fontH}', serif`, letterSpacing: "-0.5px" }}>{slide.title}</h1>
            {slide.content && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.7, maxWidth: 320 }}>{slide.content}</p>}
            {/* Bottom chips */}
            {(slide.bullets||[]).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
                {(slide.bullets||[]).map((b,bi) => <span key={bi} style={{ padding: "4px 12px", borderRadius: 12, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 10, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }}>{b}</span>)}
              </div>
            )}
          </div>
          {numTag(true)}
        </div>
      );
    }

    // ── CTA ───────────────────────────────────────────────────
    if (type === "cta") {
      return (
        <div key={idx} style={{ ...slideBase, background: `linear-gradient(140deg, ${darkPrimary} 0%, ${primary} 50%, ${lightenHex(primary,0.12)} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, ${secondary}18 0%, transparent 50%), radial-gradient(circle at 80% 50%, ${lightenHex(primary,0.3)}22 0%, transparent 50%)`, pointerEvents: "none" }} />
          {/* Large circle decoration */}
          <div style={{ position: "absolute", right: "-8%", top: "-20%", width: "55%", paddingBottom: "55%", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: "4%", top: "5%", width: "35%", paddingBottom: "35%", borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 3, borderRadius: 2, background: secondary }} />
            <h2 style={{ fontSize: 34, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.1, fontFamily: `'${fontH}', serif`, letterSpacing: "-0.5px" }}>{slide.title}</h2>
            {slide.subtitle && <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{slide.subtitle}</p>}
            {slide.content && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", margin: 0, lineHeight: 1.65, maxWidth: 380 }}>{slide.content}</p>}
            {(slide.bullets||[]).length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {(slide.bullets||[]).map((b,bi) => <span key={bi} style={{ padding: "7px 18px", borderRadius: 22, background: "rgba(255,255,255,0.13)", color: "#fff", fontSize: 11, fontWeight: 600, border: "1px solid rgba(255,255,255,0.22)" }}>{b}</span>)}
              </div>
            )}
          </div>
          {numTag(true)}
        </div>
      );
    }

    // ── STATS ────────────────────────────────────────────────
    if (type === "stats") {
      const stats = slide.stats || [];
      // Build CSS bar chart data
      const numericStats = stats.map(s => ({ ...s, num: parseFloat(s.value.replace(/[^0-9.]/g, "")) || 0 }));
      const maxVal = Math.max(...numericStats.map(s => s.num), 1);
      const hasBars = numericStats.some(s => s.num > 0);
      return (
        <div key={idx} style={{ ...slideBase, display: "flex", background: bg || "#f8f9fc" }}>
          {/* Left accent panel */}
          <div style={{ width: "30%", background: `linear-gradient(180deg, ${primary} 0%, ${darkPrimary} 100%)`, padding: "28px 22px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: "-20%", left: "-20%", width: "100%", paddingBottom: "100%", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
            <div>
              <div style={{ width: 24, height: 3, borderRadius: 2, background: secondary, marginBottom: 14 }} />
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.25, fontFamily: `'${fontH}', serif` }}>{slide.title}</h3>
              {slide.subtitle && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: "8px 0 0", lineHeight: 1.5 }}>{slide.subtitle}</p>}
            </div>
            {/* Mini bar chart */}
            {hasBars && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {numericStats.slice(0,4).map((s,si) => (
                  <div key={si}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{s.value}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)" }}>
                      <div style={{ height: "100%", width: `${(s.num/maxVal)*100}%`, background: accentColors[si % accentColors.length], borderRadius: 3, minWidth: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 36, fontWeight: 900, color: "rgba(255,255,255,0.06)", lineHeight: 1, fontFamily: `'${fontH}', serif` }}>{String(idx+1).padStart(2,"0")}</div>
          </div>
          {/* Right: big number cards */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 22px 18px" }}>
            {slide.content && <p style={{ fontSize: 11, color: "#666", margin: "0 0 12px", lineHeight: 1.5, paddingBottom: 10, borderBottom: `1px solid ${primary}18` }}>{slide.content}</p>}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: 12, alignContent: "stretch" }}>
              {stats.map((s, si) => {
                const col = accentColors[si % accentColors.length];
                return (
                  <div key={si} style={{ background: "#fff", borderRadius: 12, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 2px 14px rgba(0,0,0,0.06)", border: `1px solid ${col}20`, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${col}, ${lightenHex(col,0.3)})` }} />
                    <div style={{ fontSize: 36, fontWeight: 900, color: col, lineHeight: 1, fontFamily: `'${fontH}', serif`, letterSpacing: "-1px" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#777", textAlign: "center", lineHeight: 1.4, maxWidth: 100 }}>{s.label}</div>
                    {/* Tiny sparkline bar */}
                    {numericStats[si].num > 0 && (
                      <div style={{ width: "60%", height: 3, borderRadius: 2, background: "#f0f0f0" }}>
                        <div style={{ height: "100%", width: `${(numericStats[si].num/maxVal)*100}%`, background: col, borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {numTag(false)}
        </div>
      );
    }

    // ── QUOTE ────────────────────────────────────────────────
    if (type === "quote") {
      return (
        <div key={idx} style={{ ...slideBase, background: `linear-gradient(150deg, ${darkPrimary} 0%, ${primary} 60%, ${lightenHex(primary,0.1)} 100%)`, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 90% 10%, ${secondary}20 0%, transparent 50%)`, pointerEvents: "none" }} />
          {/* Left: huge quote mark */}
          <div style={{ width: "22%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 140, color: "rgba(255,255,255,0.07)", fontFamily: "Georgia,serif", fontWeight: 900, lineHeight: 1, userSelect: "none" }}>&ldquo;</div>
          </div>
          {/* Right: content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 50px 40px 0", position: "relative", zIndex: 2 }}>
            <div style={{ width: 32, height: 3, background: secondary, borderRadius: 2, marginBottom: 20 }} />
            {slide.quote && (
              <p style={{ fontSize: 19, fontStyle: "italic", color: "rgba(255,255,255,0.93)", lineHeight: 1.65, margin: "0 0 22px", fontFamily: `'${fontH}', serif`, fontWeight: 400 }}>
                &ldquo;{slide.quote}&rdquo;
              </p>
            )}
            {slide.content && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 12px", lineHeight: 1.5 }}>{slide.content}</p>}
            <div style={{ fontSize: 11, fontWeight: 700, color: secondary, letterSpacing: 2, textTransform: "uppercase" }}>{slide.title}</div>
          </div>
          {numTag(true)}
        </div>
      );
    }

    // ── GRID (feature/service cards) ────────────────────────
    if (type === "grid") {
      const items = slide.items || (slide.bullets||[]).map(b => {
        const [t, ...rest] = b.split(": ");
        return { title: rest.length ? t : b, description: rest.join(": ") };
      });
      return (
        <div key={idx} style={{ ...slideBase, display: "flex", flexDirection: "column", background: lightPrimary }}>
          {/* Header */}
          <div style={{ padding: "20px 28px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: primary }} />
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: primary, margin: 0, fontFamily: `'${fontH}', serif` }}>{slide.title}</h3>
              {slide.subtitle && <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>{slide.subtitle}</p>}
            </div>
          </div>
          {slide.content && <p style={{ fontSize: 12, color: "#555", margin: "0 28px 10px", lineHeight: 1.5 }}>{slide.content}</p>}
          {/* Cards grid */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(items.length, 1), 3)}, 1fr)`, gap: 12, padding: "0 20px 18px", alignContent: "stretch" }}>
            {items.slice(0,6).map((item, ii) => {
              const col = accentColors[ii % accentColors.length];
              return (
                <div key={ii} style={{ background: "#fff", borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid rgba(0,0,0,0.05)`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: `linear-gradient(90deg, ${col}, ${lightenHex(col,0.4)})` }} />
                  {/* Icon circle */}
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.3, fontFamily: `'${fontH}', serif` }}>{item.title}</div>
                  {item.description && <div style={{ fontSize: 10, color: "#888", lineHeight: 1.55 }}>{item.description}</div>}
                </div>
              );
            })}
          </div>
          {numTag(false)}
        </div>
      );
    }

    // ── TWO-COLUMN ───────────────────────────────────────────
    if (type === "two-column") {
      const half = Math.ceil((slide.bullets || []).length / 2);
      const leftBullets = (slide.bullets || []).slice(0, half);
      const rightBullets = (slide.bullets || []).slice(half);
      const leftContent = slide.leftContent || (leftBullets.length ? null : slide.content);
      const rightContent = slide.rightContent || null;
      return (
        <div key={idx} style={{ ...slideBase, display: "flex", background: "#fff" }}>
          {/* Left col — colored */}
          <div style={{ width: "48%", background: `linear-gradient(160deg, ${primary} 0%, ${darkPrimary} 100%)`, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "28px 26px 22px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: "-18%", right: "-18%", width: "80%", paddingBottom: "80%", borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
            <div>
              <div style={{ width: 28, height: 3, borderRadius: 2, background: secondary, marginBottom: 14 }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.25, fontFamily: `'${fontH}', serif` }}>{slide.title}</h3>
              {slide.subtitle && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>{slide.subtitle}</p>}
            </div>
            {leftContent ? (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, zIndex: 1 }}>{leftContent}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, zIndex: 1 }}>
                {leftBullets.map((b,bi) => (
                  <div key={bi} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(255,255,255,0.15)", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: secondary }} />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 40, fontWeight: 900, color: "rgba(255,255,255,0.06)", lineHeight: 1, fontFamily: `'${fontH}', serif` }}>{String(idx+1).padStart(2,"0")}</div>
          </div>
          {/* Right col — white */}
          <div style={{ flex: 1, background: lightPrimary, display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 24px" }}>
            {rightContent ? (
              <p style={{ fontSize: 12, color: "#444", lineHeight: 1.7, marginBottom: 14 }}>{rightContent}</p>
            ) : null}
            {rightBullets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {rightBullets.map((b,bi) => (
                  <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: primary, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{bi+1}</div>
                    <span style={{ fontSize: 11, color: "#333", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
            {!rightContent && rightBullets.length === 0 && slide.content && (
              <p style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>{slide.content}</p>
            )}
          </div>
          {numTag(false)}
        </div>
      );
    }

    // ── BULLETS (default) — alternate layouts by even/odd ────
    const isEven = idx % 2 === 0;
    return (
      <div key={idx} style={{ ...slideBase, display: "flex", background: isEven ? "#fff" : lightPrimary }}>
        {/* Left sidebar */}
        <div style={{ width: isEven ? "27%" : "30%", background: isEven ? `linear-gradient(180deg, ${primary} 0%, ${darkPrimary} 100%)` : `linear-gradient(180deg, ${darkPrimary} 0%, ${primary} 100%)`,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "26px 20px 18px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: "-15%", left: "-15%", width: "80%", paddingBottom: "80%", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-10%", right: "-25%", width: "70%", paddingBottom: "70%", borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div>
            <div style={{ width: 26, height: 3, borderRadius: 2, background: secondary, marginBottom: 14 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.3, fontFamily: `'${fontH}', serif` }}>{slide.title}</h3>
            {slide.subtitle && <p style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", margin: "8px 0 0", lineHeight: 1.55 }}>{slide.subtitle}</p>}
          </div>
          {/* Inline mini stats if present */}
          {(slide.stats||[]).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(slide.stats||[]).slice(0,3).map((s,si) => (
                <div key={si} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: `'${fontH}', serif` }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 42, fontWeight: 900, color: "rgba(255,255,255,0.07)", lineHeight: 1, fontFamily: `'${fontH}', serif` }}>{String(idx+1).padStart(2,"0")}</div>
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: "22px 24px 18px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {slide.content && (
            <p style={{ fontSize: 12, color: "#555", margin: "0 0 12px", lineHeight: 1.65, paddingBottom: 10, borderBottom: `1.5px solid ${primary}14` }}>{slide.content}</p>
          )}
          {(slide.bullets || []).length > 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {(slide.bullets || []).map((b, bi) => (
                <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", borderRadius: 8,
                  background: bi % 2 === 0 ? `${primary}08` : "transparent", transition: "background 0.15s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: accentColors[bi % accentColors.length], flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                    {bi + 1}
                  </div>
                  <span style={{ fontSize: 12, color: "#2a2a2a", lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          {numTag(false)}
        </div>
      </div>
    );
  };

  // ── Mini cover preview for palette card ─────────────────────
  const renderMiniCover = (sty2: PresentationStyle) => {
    const [p, s2] = [sty2.colors[0], sty2.colors[1]];
    const dk = (hex: string, a: number) => { const h = hex.replace("#",""); return `#${[0,2,4].map(i => Math.round(parseInt(h.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,"0")).join("")}`; };
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", display: "flex", fontSize: 0 }}>
        <div style={{ width: "42%", background: `linear-gradient(160deg, ${dk(p, 0.3)}, ${p})`, display: "flex", alignItems: "flex-end", padding: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 4, left: 6, width: 10, height: 2, borderRadius: 1, background: s2 }} />
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 0.5 }}>{sty2.name}</div>
        </div>
        <div style={{ flex: 1, background: sty2.colors[3] || "#fff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 8px" }}>
          <div style={{ width: 14, height: 1.5, borderRadius: 1, background: s2, marginBottom: 4 }} />
          <div style={{ width: "70%", height: 4, borderRadius: 1, background: sty2.colors[4] || "#222", marginBottom: 2 }} />
          <div style={{ width: "50%", height: 2, borderRadius: 1, background: "#bbb" }} />
        </div>
      </div>
    );
  };

  // ── Fullscreen mode ──────────────────────────────────────────
  if (fullscreen && slides.length > 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}
        onKeyDown={e => { if (e.key === "Escape") setFullscreen(false); if (e.key === "ArrowRight") setActiveSlide(p => Math.min(p + 1, slides.length - 1)); if (e.key === "ArrowLeft") setActiveSlide(p => Math.max(p - 1, 0)); }}
        tabIndex={0}>
        <div style={{ width: "88vw", maxWidth: 1100, cursor: "pointer" }}
          onClick={() => setActiveSlide(prev => Math.min(prev + 1, slides.length - 1))}>
          {renderSlide(slides[activeSlide], activeSlide)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => setActiveSlide(i)} style={{ width: i === activeSlide ? 20 : 6, height: 6, borderRadius: 3,
              background: i === activeSlide ? primary : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all .2s" }} />
          ))}
        </div>
        <button onClick={() => setFullscreen(false)} style={{ position: "absolute", top: 16, right: 20, background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 18, cursor: "pointer", borderRadius: 8, padding: "4px 14px" }}>✕</button>
        <div style={{ position: "absolute", bottom: 16, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>← → навигация &nbsp;•&nbsp; ESC выход &nbsp;•&nbsp; клик → далее</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      {/* Header + tab bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Бренд-презентация</h1>
          <p style={{ color: c.textSecondary, fontSize: 14 }}>Профессиональная презентация за 5 минут из ваших данных</p>
        </div>
        <div style={{ display: "flex", gap: 2, background: c.bgCard, borderRadius: 10, padding: 3, border: `1px solid ${c.border}` }}>
          {(["create", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: tab === t ? c.accent : "transparent",
                color: tab === t ? "#fff" : c.textSecondary }}>
              {t === "create" ? "✦ Создать" : `📁 История (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: c.accentRed + "18", color: c.accentRed, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: c.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: c.textSecondary, marginBottom: 6 }}>Нет сохранённых презентаций</p>
              <p style={{ fontSize: 13 }}>Создайте первую — она автоматически сохранится</p>
              <button onClick={() => setTab("create")} style={{ marginTop: 16, padding: "9px 22px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Создать презентацию</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {history.map(h => {
                const pal = h.style?.colors ?? [];
                return (
                  <div key={h.id} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    {/* Mini slide preview */}
                    <div style={{ aspectRatio: "16/9", background: pal[0] ? `linear-gradient(135deg, ${pal[0]}, ${pal[3] || "#fff"})` : `linear-gradient(135deg, ${c.accent}, ${c.bg})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                      <div style={{ textAlign: "center", zIndex: 1, padding: "0 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{h.title}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>{h.slideCount} слайдов</div>
                      </div>
                      {/* Color dots */}
                      {pal.length > 0 && (
                        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 3 }}>
                          {pal.slice(0,4).map((col: string, i: number) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: col, border: "1px solid rgba(255,255,255,0.3)" }} />)}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 10 }}>
                        {new Date(h.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadFromHistory(h)}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: c.accent, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          Открыть
                        </button>
                        <button onClick={() => deleteFromHistory(h.id)}
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 12, cursor: "pointer" }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE TAB ── */}
      {tab === "create" && <>

      {/* ━━━ STAGE 1: STYLE SELECTION ━━━ */}
      {stage === "style" && (
        <div>
          {/* Data availability */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "Анализ компании", ok: !!myCompany },
              { label: "Анализ ЦА", ok: !!taAnalysis },
              { label: "Анализ СММ", ok: !!smmAnalysis },
              { label: "Брендбук", ok: brandBook.colors.length > 0 || !!brandBook.fontHeader },
            ].map(item => (
              <span key={item.label} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: item.ok ? c.accentGreen + "15" : c.accentRed + "15", color: item.ok ? c.accentGreen : c.accentRed }}>
                {item.ok ? "✓" : "✗"} {item.label}
              </span>
            ))}
          </div>

          {/* Step 1a: Pick source */}
          {!styleSource && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>Шаг 1: Выберите основу стиля</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
                <div onClick={brandBook.colors.length > 0 ? handlePickBrandbook : undefined}
                  style={{ background: c.bgCard, borderRadius: 14, padding: 24, border: `2px solid ${c.border}`, cursor: brandBook.colors.length > 0 ? "pointer" : "default",
                    opacity: brandBook.colors.length > 0 ? 1 : 0.4, textAlign: "center", boxShadow: c.shadow, transition: "border-color .15s" }}
                  onMouseEnter={e => brandBook.colors.length > 0 && ((e.currentTarget as HTMLElement).style.borderColor = c.accent)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = c.border)}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>На основе брендбука</div>
                  <div style={{ fontSize: 12, color: c.textSecondary }}>Цвета, шрифты и тон из вашего брендбука</div>
                  {brandBook.colors.length > 0 && (
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 10 }}>
                      {brandBook.colors.slice(0,5).map((col, i) => (
                        <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: col, border: `1px solid ${c.border}` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div onClick={handlePickPresets}
                  style={{ background: c.bgCard, borderRadius: 14, padding: 24, border: `2px solid ${c.border}`, cursor: "pointer",
                    textAlign: "center", boxShadow: c.shadow, transition: "border-color .15s" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = c.accent)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = c.border)}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>Выбрать из каталога</div>
                  <div style={{ fontSize: 12, color: c.textSecondary }}>6 готовых стилей: минимализм, корпоративный, яркий...</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1b: Pick palette */}
          {styleSource && paletteOptions.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={() => { setStyleSource(null); setPaletteOptions([]); setSelectedStyle(null); }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontSize: 12 }}>← Назад</button>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: 0 }}>Шаг 2: Выберите палитру</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
                {paletteOptions.map(p => {
                  const isSel = selectedStyle?.id === p.id;
                  return (
                    <div key={p.id} onClick={() => setSelectedStyle(p)}
                      style={{ background: c.bgCard, borderRadius: 12, overflow: "hidden", border: `2px solid ${isSel ? c.accent : c.border}`,
                        cursor: "pointer", boxShadow: isSel ? c.shadowLg : c.shadow, transition: "all .15s" }}>
                      {renderMiniCover(p)}
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 8 }}>{p.mood}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {p.colors.slice(0, 5).map((col, i) => (
                            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: col, border: `1px solid ${c.border}` }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>{p.fontHeader} / {p.fontBody}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedStyle && (
                <button onClick={handleGenerate} disabled={!myCompany} style={{ padding: "14px 36px", borderRadius: 10, border: "none",
                  background: !myCompany ? c.textMuted : c.accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: !myCompany ? "default" : "pointer" }}>
                  Создать презентацию в стиле «{selectedStyle.name}»
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ━━━ STAGE 2: GENERATING ━━━ */}
      {stage === "generating" && (
        <div style={{ background: c.bgCard, borderRadius: 16, padding: 48, boxShadow: c.shadow, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
          <h3 style={{ color: c.textPrimary, marginBottom: 8 }}>Генерируем презентацию...</h3>
          <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 24 }}>
            AI создаёт слайды на основе анализа компании, ЦА и выбранного стиля
          </p>
          <div style={{ maxWidth: 400, margin: "0 auto", background: c.border, borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, ${c.accent}, ${c.accentGreen})`, borderRadius: 8,
              width: `${genProgress}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: c.textMuted }}>{genProgress}%</div>
        </div>
      )}

      {/* ━━━ STAGE 3: REVIEW & EDIT ━━━ */}
      {stage === "review" && slides.length > 0 && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center",
            background: c.bgCard, padding: "12px 16px", borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
            <h3 style={{ margin: 0, fontSize: 15, color: c.textPrimary, flex: 1 }}>{presTitle} — {slides.length} слайдов</h3>
            <button onClick={() => setFullscreen(true)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              ▶ Показ
            </button>
            <button onClick={handleExportPdf} disabled={isExportingPdf} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPdf ? c.textMuted : c.accent, color: "#fff", cursor: isExportingPdf ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPdf ? "Экспорт..." : "📄 PDF"}
            </button>
            <button onClick={handleExportPptx} disabled={isExportingPptx} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPptx ? c.textMuted : "#10b981", color: "#fff", cursor: isExportingPptx ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPptx ? "Экспорт..." : "⬇ PPTX"}
            </button>
            <button onClick={handleExportSlidev} disabled={isExportingSlidev} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingSlidev ? c.textMuted : "#7c3aed", color: "#fff", cursor: isExportingSlidev ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingSlidev ? "Экспорт..." : "✦ Slidev .md"}
            </button>
            <button onClick={() => { setStage("style"); setSlides([]); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${c.border}`,
              background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              🔄 Заново
            </button>
          </div>

          {/* Wish input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={wishText} onChange={e => setWishText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWishUpdate()}
              placeholder="Напишите пожелание: «добавь слайд про команду», «сделай акцент на ценах»..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bgCard,
                color: c.textPrimary, fontSize: 13, outline: "none" }} />
            <button onClick={handleWishUpdate} disabled={isUpdating || !wishText.trim()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: isUpdating ? c.textMuted : c.accent,
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: isUpdating ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {isUpdating ? "Обновляю..." : "Обновить"}
            </button>
          </div>

          {/* All slides — vertical scroll (Canva-style) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {slides.map((slide, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Slide number label */}
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
                  СЛАЙД {i + 1} · {slide.type.toUpperCase()} {slide.isEdited && <span style={{ color: c.accentGreen, fontSize: 10 }}>✎ изменён</span>}
                </div>
                {/* Slide preview */}
                <div onClick={() => setEditingSlide(editingSlide === i ? null : i)} style={{ cursor: "pointer" }}>
                  {renderSlide(slide, i)}
                </div>
                {/* Inline edit panel */}
                {editingSlide === i && (
                  <div style={{ marginTop: 10, background: c.bgCard, borderRadius: 12, border: `1px solid ${c.accent}40`, padding: 16, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 10 }}>Редактирование слайда {i + 1}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ЗАГОЛОВОК</label>
                        <input value={slide.title} onChange={e => handleSlideUpdate(i, { title: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ПОДЗАГОЛОВОК</label>
                        <input value={slide.subtitle || ""} onChange={e => handleSlideUpdate(i, { subtitle: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ТЕКСТ</label>
                      <textarea value={slide.content || ""} onChange={e => handleSlideUpdate(i, { content: e.target.value })} rows={2}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, resize: "vertical" }} />
                    </div>
                    {(slide.bullets || []).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ПУНКТЫ (по строке)</label>
                        <textarea value={(slide.bullets || []).join("\n")} rows={Math.min(slide.bullets.length + 1, 6)}
                          onChange={e => handleSlideUpdate(i, { bullets: e.target.value.split("\n") })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
                      </div>
                    )}
                    {slide.note && (
                      <div style={{ fontSize: 11, color: c.textSecondary, padding: "6px 10px", background: c.bg, borderRadius: 6 }}>
                        🎤 <b>Заметка:</b> {slide.note}
                      </div>
                    )}
                    <button onClick={() => setEditingSlide(null)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1px solid ${c.border}`,
                      background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Закрыть</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Watermark */}
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: c.textMuted }}>
            Создано в MarketRadar для Company24.pro
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

// Helper: render a single slide as static HTML string for print/PDF
function renderSlideHtml(slide: PresentationSlide, i: number, total: number, primary: string, secondary: string, bg: string, textColor: string, fontH: string, fontB: string, logoUrl?: string): string {
  const type = slide.type;
  const num = `<div style="position:absolute;bottom:14px;right:18px;font-size:10px;font-weight:600;color:rgba(0,0,0,0.18);letter-spacing:1px">${i + 1} / ${total}</div>`;
  const base = `width:960px;height:540px;position:relative;overflow:hidden;box-sizing:border-box;font-family:'${fontB}',system-ui,sans-serif;`;

  if (type === "cover" || type === "cta") {
    return `<div class="slide" style="${base}background:${primary};display:flex;align-items:center;justify-content:center;text-align:center;">
      <div style="position:absolute;top:-20%;right:-10%;width:55%;padding-bottom:55%;border-radius:50%;background:${secondary};opacity:0.18"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${secondary}"></div>
      <div style="position:relative;z-index:2;max-width:70%;display:flex;flex-direction:column;align-items:center;gap:12px">
        ${logoUrl && type !== "cta" ? `<img src="${logoUrl}" style="width:56px;height:56px;border-radius:12px;object-fit:contain;background:rgba(255,255,255,0.15);padding:6px;margin-bottom:4px">` : ""}
        <h2 style="font-size:36px;font-weight:800;color:#fff;margin:0;line-height:1.15;text-shadow:0 2px 12px rgba(0,0,0,0.25);font-family:'${fontH}',serif">${slide.title}</h2>
        ${slide.subtitle ? `<p style="font-size:18px;color:rgba(255,255,255,0.82);margin:0;font-weight:500">${slide.subtitle}</p>` : ""}
        ${slide.content ? `<p style="font-size:14px;color:rgba(255,255,255,0.62);margin:0;max-width:480px;line-height:1.55">${slide.content}</p>` : ""}
      </div>
      <div style="position:absolute;bottom:14px;right:18px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:1px">${i + 1} / ${total}</div>
    </div>`;
  }

  if (type === "stats") {
    const statsHtml = (slide.stats || []).map(s => `<div style="flex:1;border-radius:12px;background:#fff;border:1px solid ${primary}22;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;gap:8px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${primary}"></div>
      <div style="font-size:42px;font-weight:900;color:${primary};line-height:1;font-family:'${fontH}',serif">${s.value}</div>
      <div style="font-size:12px;color:#666;text-align:center;line-height:1.4;max-width:120px">${s.label}</div>
    </div>`).join("");
    return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;padding:28px 36px 24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:4px;height:24px;border-radius:2px;background:${primary};flex-shrink:0"></div>
        <h3 style="font-size:22px;font-weight:700;color:${textColor};margin:0;font-family:'${fontH}',serif">${slide.title}</h3>
      </div>
      <div style="display:flex;gap:14px;flex:1">${statsHtml}</div>
      ${slide.content ? `<p style="font-size:13px;color:#777;margin:14px 0 0;line-height:1.5">${slide.content}</p>` : ""}
      ${num}
    </div>`;
  }

  if (type === "quote") {
    return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 60px;text-align:center;">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${primary},${secondary})"></div>
      <div style="position:absolute;top:16px;left:36px;font-size:80px;color:${primary};opacity:0.12;font-family:Georgia,serif;font-weight:900;line-height:1">"</div>
      <div style="position:relative;z-index:2;max-width:600px">
        <div style="width:3px;height:40px;background:${primary};margin:0 auto 20px;border-radius:2px"></div>
        <h3 style="font-size:20px;font-weight:700;color:${textColor};margin:0 0 16px;font-family:'${fontH}',serif">${slide.title}</h3>
        ${slide.quote ? `<p style="font-size:17px;font-style:italic;color:#444;line-height:1.65;margin:0 0 16px;padding:0 20px">"${slide.quote}"</p>` : ""}
        ${slide.content ? `<p style="font-size:13px;color:#777;line-height:1.5;margin:0">${slide.content}</p>` : ""}
      </div>
      ${num}
    </div>`;
  }

  // Bullets / two-column / default
  const bulletsHtml = (slide.bullets || []).map((b, bi) => `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:8px;background:${bi % 2 === 0 ? primary + "08" : "transparent"}">
    <div style="width:20px;height:20px;border-radius:50%;background:${primary};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;margin-top:1px">${bi + 1}</div>
    <span style="font-size:14px;color:#2d2d2d;line-height:1.5">${b}</span>
  </div>`).join("");
  return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;padding:28px 36px 24px;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${primary},${secondary})"></div>
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:18px">
      <div style="width:4px;min-height:28px;border-radius:2px;background:${primary};flex-shrink:0;margin-top:2px"></div>
      <div>
        <h3 style="font-size:22px;font-weight:700;color:${textColor};margin:0 0 3px;font-family:'${fontH}',serif">${slide.title}</h3>
        ${slide.subtitle ? `<p style="font-size:12px;color:#999;margin:0">${slide.subtitle}</p>` : ""}
      </div>
    </div>
    ${slide.content ? `<p style="font-size:14px;color:#555;margin:0 0 12px;line-height:1.6">${slide.content}</p>` : ""}
    <div style="flex:1;display:flex;flex-direction:column;gap:8px">${bulletsHtml}</div>
    ${num}
  </div>`;
}

// ============================================================
// Reviews Analysis View
// ============================================================

function ReviewsView({ c, companyName }: {
  c: Colors;
  companyName: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [inputMode, setInputMode] = useState<"paste" | "screenshot" | "2gis">("paste");
  const [pasteText, setPasteText] = useState("");
  const [gisUrl, setGisUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"input" | "reviews" | "analysis">("input");
  const [autoFetchStatus, setAutoFetchStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [autoFetchLog, setAutoFetchLog] = useState<string[]>([]);
  const [addressInput, setAddressInput] = useState("");
  const [addressSearchName, setAddressSearchName] = useState(companyName);

  const runAutoFetch = async (name: string, address?: string) => {
    setAutoFetchStatus("loading");
    const log: string[] = [];
    const fetched: Review[] = [];

    // Google Places
    try {
      const res = await fetch("/api/fetch-reviews-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: name, address }),
      });
      const json = await res.json();
      if (json.ok && json.data.reviews.length > 0) {
        fetched.push(...json.data.reviews);
        const placeName = json.data.placeName ? ` «${json.data.placeName}»` : "";
        log.push(`Google Maps${placeName}: ${json.data.reviews.length} отзывов (${json.data.rating}★)`);
      } else if (json.ok && json.data.reviewCount > 0) {
        log.push(`Google Maps: найдено (${json.data.reviewCount} отзывов на платформе, но тексты недоступны)`);
      } else {
        log.push("Google Maps: не найдено");
      }
    } catch {
      log.push("Google Maps: ошибка загрузки");
    }

    // 2GIS by name+address
    try {
      const res = await fetch("/api/fetch-reviews-2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: name, address }),
      });
      const json = await res.json();
      if (json.ok && json.data.reviews.length > 0) {
        fetched.push(...json.data.reviews);
        log.push(`2ГИС: ${json.data.reviews.length} отзывов`);
      } else {
        log.push("2ГИС: не найдено");
      }
    } catch {
      log.push("2ГИС: ошибка загрузки");
    }

    setAutoFetchLog(log);
    if (fetched.length > 0) {
      setReviews(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        return [...prev, ...fetched.filter(r => !existingIds.has(r.id))];
      });
      setTab("reviews");
    }
    setAutoFetchStatus("done");
  };

  // Auto-fetch from Google + 2GIS on mount when company name is known
  useEffect(() => {
    if (!companyName.trim()) return;
    runAutoFetch(companyName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  // Handle screenshot drop/paste
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setError("");
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/extract-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshot: dataUrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка извлечения");
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle pasted text
  const handleExtractFromText = async () => {
    if (!pasteText.trim()) return;
    setIsExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/extract-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText: pasteText }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      setPasteText("");
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка извлечения");
    } finally {
      setIsExtracting(false);
    }
  };

  // Fetch from 2GIS
  const handleFetch2GIS = async () => {
    if (!gisUrl.trim()) return;
    setIsExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/fetch-reviews-2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gisUrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      setGisUrl("");
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsExtracting(false);
    }
  };

  // Run AI analysis
  const handleAnalyze = async () => {
    if (reviews.length === 0) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, reviews }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAnalysis(json.data);
      setTab("analysis");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    setReviews([]);
    setAnalysis(null);
    setTab("input");
  };

  const platformLabel = (p: string) => {
    const map: Record<string, string> = {
      yandex_maps: "Яндекс.Карты", "2gis": "2ГИС", otzovik: "Отзовик",
      avito: "Авито", google: "Google", manual: "Вручную", unknown: "Другое",
    };
    return map[p] ?? p;
  };

  const starColor = (rating: number) =>
    rating >= 4 ? c.accentGreen : rating >= 3 ? c.accentYellow : c.accentRed;

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? starColor(rating) : c.border, fontSize: 14 }}>★</span>
    ));

  // --- TABS ---
  const tabs = [
    { id: "input" as const, label: "Добавить отзывы", icon: "+" },
    { id: "reviews" as const, label: `Отзывы (${reviews.length})`, icon: "💬" },
    { id: "analysis" as const, label: "Анализ", icon: "📊" },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Анализ отзывов</h1>
      <p style={{ color: c.textSecondary, marginBottom: 24, fontSize: 14 }}>
        Собирайте отзывы с разных платформ и получайте AI-анализ
      </p>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 8, border: `1px solid ${tab === t.id ? c.accent : c.border}`,
            background: tab === t.id ? c.accent : c.bgCard, color: tab === t.id ? "#fff" : c.textPrimary,
            cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        {reviews.length > 0 && (
          <button onClick={handleAnalyze} disabled={isAnalyzing} style={{
            marginLeft: "auto", padding: "8px 20px", borderRadius: 8, border: "none",
            background: isAnalyzing ? c.textMuted : c.accentGreen, color: "#fff",
            cursor: isAnalyzing ? "wait" : "pointer", fontWeight: 700, fontSize: 13,
          }}>
            {isAnalyzing ? "Анализирую..." : `🧠 Анализировать (${reviews.length})`}
          </button>
        )}
      </div>

      {/* Auto-fetch status banner */}
      {autoFetchStatus === "loading" && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accent + "12", color: c.accent, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${c.accent}40`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin 1s linear infinite" }} />
          Загружаю отзывы с Google Maps и 2ГИС...
        </div>
      )}
      {autoFetchStatus === "done" && autoFetchLog.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accentGreen + "12", color: c.textSecondary, marginBottom: 16, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: c.accentGreen }}>✓ Автозагрузка:</span>
          {autoFetchLog.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accentRed + "18", color: c.accentRed, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ===== INPUT TAB ===== */}
      {tab === "input" && (
        <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>

          {/* ── Address-based search ── */}
          <div style={{ background: c.accent + "08", borderRadius: 12, padding: 18, border: `1px solid ${c.accent}25`, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>🔍 Поиск по адресу (точнее)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={addressSearchName}
                onChange={e => setAddressSearchName(e.target.value)}
                placeholder="Название компании"
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none" }}
              />
              <input
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                placeholder="Адрес (город, улица, дом) — необязательно, но улучшает поиск"
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none" }}
              />
              <button
                onClick={() => runAutoFetch(addressSearchName || companyName, addressInput.trim() || undefined)}
                disabled={autoFetchStatus === "loading"}
                style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: autoFetchStatus === "loading" ? c.textMuted : c.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: autoFetchStatus === "loading" ? "wait" : "pointer", alignSelf: "flex-start" }}
              >
                {autoFetchStatus === "loading" ? "Ищу отзывы..." : "🔄 Найти отзывы в Google и 2ГИС"}
              </button>
            </div>
          </div>

          {/* Input mode selector */}
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.04em" }}>ИЛИ ДОБАВЬТЕ ВРУЧНУЮ</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([
              { id: "paste" as const, label: "📋 Вставить текст", desc: "Скопируйте отзывы с любой платформы" },
              { id: "screenshot" as const, label: "📸 Скриншот", desc: "Загрузите скрин страницы отзывов" },
              { id: "2gis" as const, label: "🗺️ 2ГИС (ссылка)", desc: "Прямая ссылка на организацию в 2ГИС" },
            ] as const).map(mode => (
              <button key={mode.id} onClick={() => setInputMode(mode.id)} style={{
                flex: 1, padding: 16, borderRadius: 12, border: `2px solid ${inputMode === mode.id ? c.accent : c.border}`,
                background: inputMode === mode.id ? c.accent + "10" : "transparent",
                cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>{mode.label}</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{mode.desc}</div>
              </button>
            ))}
          </div>

          {/* Paste mode */}
          {inputMode === "paste" && (
            <div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Вставьте сюда отзывы с любой платформы.\n\nПример:\n★★★★★ Иван Иванов\nОтличный сервис! Быстро и качественно.\n\n★★☆☆☆ Мария Петрова\nДолго ждала заказ, разочарована."}
                style={{
                  width: "100%", minHeight: 200, padding: 16, borderRadius: 12, border: `1px solid ${c.border}`,
                  background: c.bg, color: c.textPrimary, fontSize: 14, fontFamily: "inherit", resize: "vertical",
                }}
              />
              <button
                onClick={handleExtractFromText}
                disabled={isExtracting || !pasteText.trim()}
                style={{
                  marginTop: 12, padding: "10px 24px", borderRadius: 8, border: "none",
                  background: isExtracting ? c.textMuted : c.accent, color: "#fff",
                  cursor: isExtracting ? "wait" : "pointer", fontWeight: 700, fontSize: 14,
                }}
              >
                {isExtracting ? "Извлекаю отзывы..." : "Извлечь отзывы"}
              </button>
            </div>
          )}

          {/* Screenshot mode */}
          {inputMode === "screenshot" && (
            <div>
              <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Сделайте скриншот страницы отзывов на Яндекс.Картах, Отзовике, Авито или любой другой платформе.
                GPT-4o распознает платформу и извлечёт все отзывы.
              </p>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: 40, borderRadius: 12, border: `2px dashed ${c.border}`,
                background: c.bg, cursor: "pointer", color: c.textSecondary, fontSize: 14,
              }}>
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{ display: "none" }} />
                {isExtracting ? "Распознаю..." : "📸 Нажмите или перетащите скриншот"}
              </label>
            </div>
          )}

          {/* 2GIS mode */}
          {inputMode === "2gis" && (
            <div>
              <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Вставьте ссылку на организацию в 2ГИС. Отзывы загрузятся автоматически через открытый API.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={gisUrl}
                  onChange={e => setGisUrl(e.target.value)}
                  placeholder="https://2gis.ru/moscow/firm/70000001012345678"
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${c.border}`,
                    background: c.bg, color: c.textPrimary, fontSize: 14,
                  }}
                />
                <button
                  onClick={handleFetch2GIS}
                  disabled={isExtracting || !gisUrl.trim()}
                  style={{
                    padding: "10px 24px", borderRadius: 8, border: "none",
                    background: isExtracting ? c.textMuted : c.accent, color: "#fff",
                    cursor: isExtracting ? "wait" : "pointer", fontWeight: 700, fontSize: 14,
                  }}
                >
                  {isExtracting ? "Загружаю..." : "Загрузить"}
                </button>
              </div>
            </div>
          )}

          {/* Platform hints */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, marginBottom: 8 }}>Поддерживаемые платформы:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { name: "2ГИС", method: "Авто (ссылка)", color: c.accentGreen },
                { name: "Яндекс.Карты", method: "Скриншот / текст", color: c.accentYellow },
                { name: "Google Maps", method: "Скриншот / текст", color: c.accent },
                { name: "Отзовик", method: "Скриншот / текст", color: c.accentWarm },
                { name: "Авито", method: "Скриншот / текст", color: c.accentRed },
              ].map(p => (
                <span key={p.name} style={{
                  padding: "4px 10px", borderRadius: 6, background: p.color + "18",
                  color: p.color, fontSize: 12, fontWeight: 600,
                }}>
                  {p.name} — {p.method}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== REVIEWS LIST TAB ===== */}
      {tab === "reviews" && (
        <div>
          {reviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: c.textMuted }}>
              Отзывов пока нет. Добавьте через вкладку &ldquo;Добавить отзывы&rdquo;.
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                {(() => {
                  const platforms = [...new Set(reviews.map(r => r.platform))];
                  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                  return (
                    <>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: c.bgCard, border: `1px solid ${c.border}`, fontSize: 13 }}>
                        <b>{reviews.length}</b> отзывов
                      </div>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: c.bgCard, border: `1px solid ${c.border}`, fontSize: 13 }}>
                        Средняя оценка: <b style={{ color: starColor(Math.round(avg)) }}>{avg.toFixed(1)} ★</b>
                      </div>
                      {platforms.map(p => (
                        <div key={p} style={{ padding: "8px 14px", borderRadius: 8, background: c.accent + "12", fontSize: 13, color: c.accent, fontWeight: 600 }}>
                          {platformLabel(p)}: {reviews.filter(r => r.platform === p).length}
                        </div>
                      ))}
                      <button onClick={handleClearAll} style={{
                        marginLeft: "auto", padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.accentRed}33`,
                        background: "transparent", color: c.accentRed, fontSize: 12, cursor: "pointer",
                      }}>
                        Очистить все
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Review cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.map(rev => (
                  <div key={rev.id} style={{
                    background: c.bgCard, borderRadius: 12, padding: 16, boxShadow: c.shadow,
                    borderLeft: `3px solid ${starColor(rev.rating)}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{rev.author}</span>
                        <span>{renderStars(rev.rating)}</span>
                        <span style={{ fontSize: 11, color: c.textMuted, padding: "2px 6px", borderRadius: 4, background: c.accent + "12" }}>
                          {platformLabel(rev.platform)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {rev.date && <span style={{ fontSize: 11, color: c.textMuted }}>{rev.date}</span>}
                        <button onClick={() => handleDeleteReview(rev.id)} style={{
                          background: "none", border: "none", cursor: "pointer", color: c.textMuted, fontSize: 16, padding: 2,
                        }}>
                          ×
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: c.textPrimary, lineHeight: 1.5, margin: 0 }}>{rev.text}</p>
                    {rev.reply && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: c.bg, fontSize: 13, color: c.textSecondary }}>
                        <b>Ответ:</b> {rev.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== ANALYSIS TAB ===== */}
      {tab === "analysis" && (
        <div>
          {!analysis ? (
            <div style={{ textAlign: "center", padding: 60, color: c.textMuted }}>
              {reviews.length === 0
                ? "Сначала добавьте отзывы"
                : "Нажмите «Анализировать» чтобы запустить AI-анализ"
              }
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Summary */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.textPrimary }}>Общий вердикт</h3>
                <p style={{ fontSize: 15, color: c.textPrimary, lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
              </div>

              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Отзывов", value: analysis.totalReviews.toString(), color: c.accent },
                  { label: "Средняя оценка", value: `${analysis.avgRating.toFixed(1)} ★`, color: starColor(Math.round(analysis.avgRating)) },
                  { label: "Позитивные", value: `${analysis.sentimentSummary.positive}`, color: c.accentGreen },
                  { label: "Негативные", value: `${analysis.sentimentSummary.negative}`, color: c.accentRed },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background: c.bgCard, borderRadius: 12, padding: 16, textAlign: "center",
                    boxShadow: c.shadow, borderTop: `3px solid ${kpi.color}`,
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Rating distribution */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Распределение оценок</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = analysis.ratingDistribution[star] ?? 0;
                    const pct = analysis.totalReviews > 0 ? (count / analysis.totalReviews) * 100 : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: c.textPrimary }}>{star}★</span>
                        <div style={{ flex: 1, height: 20, borderRadius: 6, background: c.bg, overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", borderRadius: 6,
                            background: star >= 4 ? c.accentGreen : star >= 3 ? c.accentYellow : c.accentRed,
                            transition: "width .3s",
                          }} />
                        </div>
                        <span style={{ width: 40, fontSize: 12, color: c.textSecondary, textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Topics */}
              {analysis.topics.length > 0 && (
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Темы отзывов</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {analysis.topics.map((topic, i) => {
                      const total = topic.positive + topic.negative + topic.neutral;
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: c.bg }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{topic.topic}</span>
                            <span style={{ fontSize: 12, color: c.textMuted }}>{total} упоминаний</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: c.accentGreen }}>+{topic.positive}</span>
                            <span style={{ fontSize: 12, color: c.accentYellow }}>{topic.neutral} нейтр.</span>
                            <span style={{ fontSize: 12, color: c.accentRed }}>-{topic.negative}</span>
                          </div>
                          {topic.keyQuotes.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {topic.keyQuotes.map((q, qi) => (
                                <div key={qi} style={{
                                  fontSize: 12, color: c.textSecondary, fontStyle: "italic",
                                  padding: "4px 8px", borderRadius: 6, background: c.bgCard,
                                  borderLeft: `2px solid ${c.accent}`,
                                }}>
                                  &ldquo;{q}&rdquo;
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.accentGreen }}>Сильные стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: 14, color: c.textPrimary }}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.accentRed }}>Слабые стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} style={{ fontSize: 14, color: c.textPrimary }}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.textPrimary }}>Рекомендации</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 10, background: c.accent + "10",
                      fontSize: 14, color: c.textPrimary, borderLeft: `3px solid ${c.accent}`,
                    }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Templates */}
              {analysis.responseTemplates.length > 0 && (
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Шаблоны ответов на отзывы</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {analysis.responseTemplates.map((tpl, i) => {
                      const typeLabel = tpl.type === "positive" ? "Позитивный" : tpl.type === "negative" ? "Негативный" : "Нейтральный";
                      const typeColor = tpl.type === "positive" ? c.accentGreen : tpl.type === "negative" ? c.accentRed : c.accentYellow;
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: c.bg, borderLeft: `3px solid ${typeColor}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, marginBottom: 6 }}>{typeLabel} отзыв</div>
                          <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>{tpl.template}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(tpl.template)}
                            style={{
                              marginTop: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid ${c.border}`,
                              background: "transparent", color: c.textSecondary, cursor: "pointer", fontSize: 11,
                            }}
                          >
                            Копировать
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Stories View
// ============================================================

function StoriesView({ c, stories, plan, smmAnalysis, companyName, brandBook, onAdd, onDelete, onUpdate }: {
  c: Colors;
  stories: GeneratedStory[];
  plan: ContentPlan | null;
  smmAnalysis: unknown;
  companyName: string;
  brandBook: BrandBook;
  onAdd: (story: GeneratedStory) => void;
  onDelete: (id: string) => void;
  onUpdate: (story: GeneratedStory) => void;
}) {
  const [platform, setPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  const [slidesCount, setSlidesCount] = useState<3 | 5 | 7>(5);
  const [goal, setGoal] = useState("прогрев");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState(plan?.pillars?.[0]?.name ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, platform, slidesCount, goal, brief, pillar, smmAnalysis, brandBook }),
      });
      const json = await res.json() as { ok: boolean; data?: GeneratedStory; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");
      onAdd(json.data!);
      setBrief("");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary,
    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const accent = "#a855f7";

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>📱 Сторис-сценарии</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Серии сторис с поэкранной структурой, стикерами и CTA</p>
      </div>

      {/* Generator form */}
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadowLg, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${c.borderLight}`, background: `linear-gradient(135deg, ${c.bgCard} 50%, ${accent}06 100%)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary }}>✨ Создать серию сторис</div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
            {/* Platform */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ПЛАТФОРМА</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["instagram", "vk", "telegram"] as const).map(p => (
                  <button key={p} onClick={() => setPlatform(p)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${platform === p ? accent : c.border}`,
                      background: platform === p ? accent + "15" : c.bg, color: platform === p ? accent : c.textSecondary,
                      fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                    {p === "instagram" ? "📸 Insta" : p === "vk" ? "💙 VK" : "✈️ TG"}
                  </button>
                ))}
              </div>
            </div>

            {/* Slides count */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>КОЛ-ВО СЛАЙДОВ</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([3, 5, 7] as const).map(n => (
                  <button key={n} onClick={() => setSlidesCount(n)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${slidesCount === n ? accent : c.border}`,
                      background: slidesCount === n ? accent + "15" : c.bg, color: slidesCount === n ? accent : c.textSecondary,
                      fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕЛЬ</label>
              <select value={goal} onChange={e => setGoal(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {["прогрев", "продажа", "охват", "вовлечение", "обучение", "анонс", "доверие"].map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Pillar */}
            {plan?.pillars?.length ? (
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>КОНТЕНТ-СТОЛП</label>
                <select value={pillar} onChange={e => setPillar(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— свободная тема —</option>
                  {plan.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {/* Brief */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>
              ТЕМА / БРИФ
              <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно оставить пустым, ИИ придумает по столпу</span>
            </label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={2}
              placeholder="Например: «серия про наш процесс производства», «3 мифа о нашей нише», «анонс акции 20%»"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {genError && <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 12 }}>❌ {genError}</div>}

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14,
              cursor: generating ? "not-allowed" : "pointer",
              background: generating ? c.borderLight : `linear-gradient(135deg, #a855f7, #c084fc)`,
              color: generating ? c.textMuted : "#fff",
              boxShadow: generating ? "none" : `0 4px 16px #a855f740` }}>
            {generating ? "⏳ Генерируем сценарий…" : "📱 Создать серию сторис"}
          </button>
        </div>
      </div>

      {/* Stories list */}
      {stories.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Пока нет сгенерированных сторис. Заполните форму выше и нажмите «Создать».</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {stories.map(story => (
            <StoryCard key={story.id} c={c} story={story} onDelete={onDelete} onUpdate={onUpdate} brandBook={brandBook} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoryCard({ c, story, onDelete, onUpdate, brandBook }: {
  c: Colors;
  story: GeneratedStory;
  onDelete: (id: string) => void;
  onUpdate: (updated: GeneratedStory) => void;
  brandBook?: BrandBook;
}) {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [generatingBg, setGeneratingBg] = useState<number | null>(null); // slide order index
  const [bgError, setBgError] = useState<string | null>(null);
  const accent = "#a855f7";

  const handleGenerateBg = async (slideIndex: number) => {
    const slide = story.slides[slideIndex];
    if (!slide) return;
    setGeneratingBg(slideIndex);
    setBgError(null);
    try {
      const brandVisual = brandBook?.visualStyle?.trim();
      const brandColors = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
      const prompt = [
        `Story background for ${story.platform}: ${slide.background}.`,
        `Mood: ${slide.visualNote}.`,
        brandVisual && `Brand visual style: ${brandVisual}.`,
        brandColors,
        "Vertical 9:16 format. No text overlay. Clean, atmospheric.",
      ].filter(Boolean).join(" ");

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");

      const updatedSlides = story.slides.map((s, i) =>
        i === slideIndex ? { ...s, backgroundImageUrl: json.data!.imageUrl } : s,
      );
      onUpdate({ ...story, slides: updatedSlides });
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGeneratingBg(null);
    }
  };

  const platformLabel = { instagram: "📸 Instagram", vk: "💙 VK", telegram: "✈️ Telegram" }[story.platform];

  return (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expanded ? `1px solid ${c.borderLight}` : "none", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: accent + "15", color: accent, flexShrink: 0 }}>STORIES</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: c.bg, color: c.textMuted, flexShrink: 0 }}>{platformLabel}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: c.bg, color: c.textMuted, flexShrink: 0 }}>{story.slides.length} слайдов</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{story.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(story.generatedAt).toLocaleDateString("ru-RU")}</span>
          <span style={{ fontSize: 11, color: c.textMuted, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {/* Slide navigator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {story.slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${activeSlide === i ? accent : c.border}`,
                  background: activeSlide === i ? accent : c.bg, color: activeSlide === i ? "#fff" : c.textSecondary,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {i + 1}
              </button>
            ))}
          </div>

          {/* Active slide */}
          {story.slides[activeSlide] && (() => {
            const slide = story.slides[activeSlide];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
                {/* Phone mockup */}
                <div style={{
                  borderRadius: 16, padding: 12, minHeight: 320, display: "flex", flexDirection: "column",
                  justifyContent: "space-between", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", position: "relative",
                  overflow: "hidden",
                  background: slide.backgroundImageUrl ? "transparent" : "#0f0f0f",
                }}>
                  {/* Background image */}
                  {slide.backgroundImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={slide.backgroundImageUrl} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                  )}
                  {/* Overlay for readability */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.55) 100%)", zIndex: 1 }} />

                  {/* Content above overlay */}
                  <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                    {/* Progress bar */}
                    <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
                      {story.slides.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i <= activeSlide ? "#fff" : "rgba(255,255,255,0.4)" }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "8px 4px" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.3, marginBottom: 8, textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>{slide.headlineText}</div>
                      {slide.bodyText && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, marginBottom: 8, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{slide.bodyText}</div>}
                      {slide.sticker && (
                        <div style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 8px", fontSize: 9, color: "#fff", fontWeight: 700, marginBottom: 6 }}>
                          🎯 {slide.sticker}
                        </div>
                      )}
                    </div>
                    {slide.cta && (
                      <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: accent + "dd", borderRadius: 6, padding: "5px 8px" }}>
                        {slide.cta}
                      </div>
                    )}
                  </div>
                </div>

                {/* Slide details */}
                <div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>ФОН</div>
                      <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>{slide.background}</div>
                      <button
                        onClick={() => handleGenerateBg(activeSlide)}
                        disabled={generatingBg === activeSlide}
                        style={{
                          padding: "6px 12px", borderRadius: 7,
                          border: `1px solid ${accent}50`, background: accent + "10",
                          color: accent, fontSize: 11, fontWeight: 700,
                          cursor: generatingBg === activeSlide ? "not-allowed" : "pointer",
                          opacity: generatingBg === activeSlide ? 0.6 : 1,
                        }}>
                        {generatingBg === activeSlide ? "⏳ Генерируем…" : slide.backgroundImageUrl ? "🔄 Перегенерировать фон" : "🎨 Сгенерировать фон"}
                      </button>
                      {bgError && <div style={{ marginTop: 4, fontSize: 10, color: c.accentRed }}>❌ {bgError}</div>}
                    </div>
                    <Field c={c} label="Заголовок" value={slide.headlineText} bold />
                    {slide.bodyText && <Field c={c} label="Текст" value={slide.bodyText} />}
                    {slide.sticker && <Field c={c} label="Стикер / интерактив" value={slide.sticker} accent={accent} />}
                    {slide.cta && <Field c={c} label="CTA" value={slide.cta} accent={accent} />}
                    <Field c={c} label="Режиссёрская пометка" value={slide.visualNote} muted />
                  </div>
                  {/* Nav arrows */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: activeSlide === 0 ? "not-allowed" : "pointer", opacity: activeSlide === 0 ? 0.4 : 1 }}>
                      ← Назад
                    </button>
                    <button onClick={() => setActiveSlide(Math.min(story.slides.length - 1, activeSlide + 1))} disabled={activeSlide === story.slides.length - 1}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: activeSlide === story.slides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide === story.slides.length - 1 ? 0.4 : 1 }}>
                      Вперёд →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Hashtags + delete */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {story.hashtags.map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {confirmDelete ? (
                <>
                  <button onClick={() => onDelete(story.id)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: c.accentRed, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, cursor: "pointer" }}>Нет</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Удалить</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ c, label, value, bold, muted, accent }: { c: Colors; label: string; value: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: accent ?? (muted ? c.textMuted : c.textSecondary), fontWeight: bold ? 700 : 400, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  count: number | null;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "МАРКЕТИНГ",
    items: [
      {
        id: "company-analysis", icon: "🏢", label: "Анализ компании", count: null,
        children: [
          { id: "new-analysis", icon: "🔎", label: "Новый анализ", count: null },
          { id: "dashboard", icon: "📈", label: "Дашборд", count: null },
          { id: "prev-analyses", icon: "📂", label: "Предыдущие анализы", count: null },
        ],
      },
      {
        id: "competitor-analysis", icon: "📊", label: "Анализ конкурентов", count: null,
        children: [
          { id: "competitors", icon: "🎯", label: "Конкуренты", count: null },
          { id: "compare", icon: "⚖️", label: "Сравнение", count: null },
          { id: "insights", icon: "💡", label: "AI-инсайты", count: null },
        ],
      },
      {
        id: "ta-analysis", icon: "🧠", label: "Анализ ЦА", count: null,
        children: [
          { id: "ta-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "ta-dashboard", icon: "👥", label: "Дашборд ЦА", count: null },
          { id: "ta-cjm", icon: "🗺️", label: "Customer Journey Map", count: null },
          { id: "ta-benchmarks", icon: "📊", label: "Отраслевые бенчмарки", count: null },
          { id: "ta-brandbook", icon: "🎨", label: "Рекомендации бренда", count: null },
        ],
      },
      {
        id: "smm-analysis", icon: "📱", label: "Анализ СММ", count: null,
        children: [
          { id: "smm-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "smm-dashboard", icon: "🎨", label: "Дашборд СММ", count: null },
        ],
      },
      {
        id: "content-factory", icon: "🏭", label: "Контент-завод", count: null,
        children: [
          { id: "content-plan", icon: "📋", label: "План контента", count: null },
          { id: "content-posts", icon: "📝", label: "Готовые посты", count: null },
          { id: "content-reels", icon: "🎬", label: "Готовые видео", count: null },
          { id: "content-stories", icon: "📱", label: "Сторис-сценарии", count: null },
          { id: "content-analytics", icon: "📊", label: "Аналитика контента", count: null },
          { id: "content-roi", icon: "💰", label: "ROI калькулятор", count: null },
        ],
      },
      { id: "reviews-analysis", icon: "⭐", label: "Анализ отзывов", count: null },
      { id: "brand-presentation", icon: "🎤", label: "Презентация бренда", count: null },
      { id: "landing-generator", icon: "🌐", label: "Генератор лендингов", count: null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null },
      { id: "sources", icon: "🔗", label: "Источники", count: null },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { id: "settings", icon: "⚙️", label: "Настройки", count: null },
    ],
  },
];

// ============================================================
// Main App
// ============================================================

export default function MarketRadarDashboard() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mr_theme", t); } catch { /* ignore */ }
      const root = document.documentElement;
      root.classList.remove("dark", "warm");
      if (t !== "light") root.classList.add(t);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mr_theme") as Theme | null;
      if (saved && saved in COLORS) { setThemeState(saved); }
      else {
        // default: respect OS preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const def: Theme = prefersDark ? "dark" : "light";
        setThemeState(def);
        document.documentElement.classList.remove("dark", "warm");
        if (def !== "light") document.documentElement.classList.add(def);
      }
    } catch { /* ignore */ }
  }, []);
  const [appScreen, setAppScreen] = useState<"landing" | "register" | "login" | "onboarding" | "app">("landing");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeNav, setActiveNav] = useState("new-analysis");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const setActiveNavMobile = React.useCallback((id: string) => { setActiveNav(id); setMobileMenuOpen(false); }, []);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [myCompany, setMyCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null);
  const [taAnalysis, setTaAnalysis] = useState<TAResult | null>(null);
  const [isTAAnalyzing, setIsTAAnalyzing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cjmData, setCjmData] = useState<any | null>(null);
  const [isCJMGenerating, setIsCJMGenerating] = useState(false);
  const [cjmError, setCjmError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [benchmarksData, setBenchmarksData] = useState<any | null>(null);
  const [isBenchmarksGenerating, setIsBenchmarksGenerating] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState<string | null>(null);
  const [smmAnalysis, setSmmAnalysis] = useState<SMMResult | null>(null);
  const [isSMMAnalyzing, setIsSMMAnalyzing] = useState(false);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generatedReels, setGeneratedReels] = useState<GeneratedReel[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null);
  const [generatingReelId, setGeneratingReelId] = useState<string | null>(null);
  const [generatingVideoFor, setGeneratingVideoFor] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>({
    avatarId: "",
    voiceId: "",
    avatarDescription: "",
    voiceDescription: "",
    aspect: "portrait",
  });
  const [brandBook, setBrandBook] = useState<BrandBook>({
    brandName: "",
    tagline: "",
    mission: "",
    colors: [],
    fontHeader: "",
    fontBody: "",
    toneOfVoice: [],
    forbiddenWords: [],
    goodPhrases: [],
    visualStyle: "",
  });
  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<Array<AnalysisResult & { analyzedAt: string }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandSuggestions, setBrandSuggestions] = useState<any | null>(null);
  const c = COLORS[theme];

  // Apply server/localStorage data to React state — shared by initApp and post-login
  const applyUserData = React.useCallback((data: Record<string, unknown>, uid: string) => {
    const get = (key: string) => data[key] ?? null;

    const company = get("company") ?? JSON.parse(localStorage.getItem(`mr_company_${uid}`) ?? "null");
    if (company) { setMyCompany(company as AnalysisResult); setStatus("done"); setActiveNav("dashboard"); }

    const comps = get("competitors") ?? JSON.parse(localStorage.getItem(`mr_competitors_${uid}`) ?? "null");
    if (Array.isArray(comps) && comps.length > 0) setCompetitors(comps as AnalysisResult[]);

    const ta = get("ta") ?? JSON.parse(localStorage.getItem(`mr_ta_${uid}`) ?? "null");
    if (ta) setTaAnalysis(ta as TAResult);

    const cjm = get("cjm") ?? JSON.parse(localStorage.getItem(`mr_cjm_${uid}`) ?? "null");
    if (cjm) setCjmData(cjm);

    const bench = get("benchmarks") ?? JSON.parse(localStorage.getItem(`mr_benchmarks_${uid}`) ?? "null");
    if (bench) setBenchmarksData(bench);

    const smm = get("smm") ?? JSON.parse(localStorage.getItem(`mr_smm_${uid}`) ?? "null");
    if (smm) setSmmAnalysis(smm as SMMResult);

    const content = (get("content") ?? JSON.parse(localStorage.getItem(`mr_content_${uid}`) ?? "null")) as { plan: ContentPlan | null; posts: GeneratedPost[]; reels: GeneratedReel[] } | null;
    if (content) {
      if (content.plan) setContentPlan(content.plan);
      if (Array.isArray(content.posts)) setGeneratedPosts(content.posts);
      if (Array.isArray(content.reels)) setGeneratedReels(content.reels);
    }

    const bb = get("brandbook") ?? JSON.parse(localStorage.getItem(`mr_brandbook_${uid}`) ?? "null");
    if (bb) setBrandBook(bb as BrandBook);

    const stories = get("stories") ?? JSON.parse(localStorage.getItem(`mr_stories_${uid}`) ?? "null");
    if (Array.isArray(stories)) setGeneratedStories(stories as GeneratedStory[]);

    const history = get("history") ?? JSON.parse(localStorage.getItem(`mr_analysis_history_${uid}`) ?? "null");
    if (Array.isArray(history)) setAnalysisHistory(history as Array<AnalysisResult & { analyzedAt: string }>);

    const brandsug = get("brandsug") ?? JSON.parse(localStorage.getItem(`mr_brandsug_${uid}`) ?? "null");
    if (brandsug) setBrandSuggestions(brandsug);

    const avatar = get("avatar") ?? JSON.parse(localStorage.getItem(`mr_avatar_settings_${uid}`) ?? "null");
    if (avatar) setAvatarSettings(avatar as AvatarSettings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load server data and apply it — called after login and on init.
  // Also performs a one-time migration: if a key exists in localStorage but
  // NOT on the server, push it up so other devices can see it.
  const loadAndApplyUserData = React.useCallback(async (uid: string) => {
    let serverData: Record<string, unknown> = {};
    try {
      serverData = (await loadAllFromServer()) ?? {};
    } catch { /* keep empty */ }

    // Migration map: localStorage key prefix (without userId) → server key
    // We scan ALL localStorage keys starting with the prefix to support the
    // case where the legacy userId (old client-generated UUID) differs from
    // the new Postgres-backed userId.
    const migrations: Array<[string, string]> = [
      ["mr_company_", "company"],
      ["mr_competitors_", "competitors"],
      ["mr_ta_", "ta"],
      ["mr_cjm_", "cjm"],
      ["mr_benchmarks_", "benchmarks"],
      ["mr_smm_", "smm"],
      ["mr_content_", "content"],
      ["mr_brandbook_", "brandbook"],
      ["mr_stories_", "stories"],
      ["mr_analysis_history_", "history"],
      ["mr_brandsug_", "brandsug"],
      ["mr_avatar_settings_", "avatar"],
    ];

    // Build a snapshot of all localStorage keys once
    const lsKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) lsKeys.push(k);
      }
    } catch { /* ignore */ }

    const pushed: Record<string, unknown> = {};
    for (const [prefix, srvKey] of migrations) {
      if (serverData[srvKey] != null) continue; // server already has it
      // Prefer the current uid's key; fall back to any other uid's key
      const candidates = [
        `${prefix}${uid}`,
        ...lsKeys.filter((k) => k.startsWith(prefix) && k !== `${prefix}${uid}`),
      ];
      for (const lsKey of candidates) {
        try {
          const raw = localStorage.getItem(lsKey);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed == null) continue;
          if (Array.isArray(parsed) && parsed.length === 0) continue;
          pushed[srvKey] = parsed;
          console.log(`[migrate] pushing "${srvKey}" from localStorage key "${lsKey}"`);
          syncToServer(srvKey, parsed);
          // also store under the new uid so next reload picks it up instantly
          try { localStorage.setItem(`${prefix}${uid}`, raw); } catch { /* ignore */ }
          break; // stop after first non-empty candidate
        } catch { /* try next candidate */ }
      }
    }

    applyUserData({ ...pushed, ...serverData }, uid);
  }, [applyUserData]);

  // Check for existing session + restore saved data on mount
  useEffect(() => {
    const initApp = async () => {
      // Server session is the ONLY source of truth now.
      // If /api/auth/me fails, clear any stale legacy localStorage user and
      // force the login screen so a fresh JWT cookie gets set.
      let user: UserAccount | null = null;
      let serverReachable = false;
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        serverReachable = true;
        const meJson = await meRes.json();
        if (meJson.ok && meJson.user) {
          user = {
            id: meJson.user.id,
            name: meJson.user.name ?? "",
            email: meJson.user.email,
            password: "",
            onboardingDone: true,
            role: meJson.user.role,
          };
          authSetCurrentUser(user);
        }
      } catch { /* server unreachable */ }

      if (!user) {
        if (serverReachable) {
          // Server said "no session" → wipe stale legacy login so UI shows login screen
          const stale = authGetCurrentUser();
          if (stale) {
            console.warn("[auth] legacy localStorage session without JWT cookie — clearing, please re-login");
            authSetCurrentUser(null);
          }
        } else {
          // Server unreachable → allow legacy offline fallback
          user = authGetCurrentUser();
        }
      }

      if (!user) return; // not logged in — LandingPage will show

      setCurrentUser(user);
      await loadAndApplyUserData(user.id);
      setAppScreen(user.onboardingDone ? "app" : "onboarding");
    };
    initApp();
  }, [loadAndApplyUserData]);

  const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Ошибка анализа");
    return json.data;
  };

  // Save company to localStorage and state
  const saveMyCompany = (result: AnalysisResult, userId?: string) => {
    setMyCompany(result);
    const uid = userId ?? currentUser?.id;
    if (uid) {
      try { localStorage.setItem(`mr_company_${uid}`, JSON.stringify(result)); } catch { /* ignore */ }
      syncToServer("company", result);
    }
  };

  // New analysis from within dashboard
  const handleNewAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      // Save current analysis to history before replacing
      if (myCompany) {
        const historyEntry = { ...myCompany, analyzedAt: new Date().toISOString() };
        setAnalysisHistory(prev => {
          const next = [historyEntry, ...prev].slice(0, 20); // keep last 20
          if (currentUser?.id) {
            try { localStorage.setItem(`mr_analysis_history_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
            syncToServer("history", next);
          }
          return next;
        });
      }
      saveMyCompany(result);
      setCompetitors([]);
      if (currentUser?.id) {
        try { localStorage.removeItem(`mr_competitors_${currentUser.id}`); } catch { /* ignore */ }
      }
      setSelectedCompetitor(null);
      setActiveNav("dashboard");
      if (currentUser?.tgChatId && currentUser.tgNotifyAnalysis !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `✅ <b>MarketRadar</b>\n\nАнализ завершён: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n\nОткройте приложение, чтобы посмотреть результаты.`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add competitor
  const handleAddCompetitor = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      setCompetitors(prev => {
        const updated = [...prev, result];
        if (currentUser?.id) {
          try { localStorage.setItem(`mr_competitors_${currentUser.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
          syncToServer("competitors", updated);
        }
        return updated;
      });
      if (currentUser?.tgChatId && currentUser.tgNotifyCompetitors !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `🎯 <b>MarketRadar</b>\n\nДобавлен конкурент: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n${result.hiring?.openVacancies ? `Открытых вакансий: ${result.hiring.openVacancies}` : ""}`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTAAnalysis = async (niche: string, extraContext: string) => {
    setIsTAAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          extraContext,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа ЦА");
      setTaAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_ta_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("ta", json.data);
      }
      setActiveNav("ta-dashboard");
    } finally {
      setIsTAAnalyzing(false);
    }
  };

  const handleGenerateCJM = async () => {
    if (!myCompany) return;
    setIsCJMGenerating(true);
    setCjmError(null);
    try {
      const niche = (myCompany.company.description ?? myCompany.company.name ?? "").slice(0, 500);
      const res = await fetch("/api/generate-cjm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany.company.name,
          niche: niche || myCompany.company.name,
          taData: taAnalysis,
          companyData: { description: myCompany.company.description?.slice(0, 500), url: myCompany.company.url },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации CJM");
      setCjmData(json.data);
      setCjmError(null);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_cjm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("cjm", json.data);
      }
    } catch (e: unknown) {
      setCjmError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setIsCJMGenerating(false);
    }
  };

  const handleGenerateBenchmarks = async () => {
    if (!myCompany) return;
    setIsBenchmarksGenerating(true);
    setBenchmarksError(null);
    try {
      const niche = (myCompany.company.description ?? myCompany.company.name ?? "").slice(0, 500);
      const res = await fetch("/api/generate-benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany.company.name,
          niche: niche || myCompany.company.name,
          companyScore: myCompany.company.score,
          categories: myCompany.company.categories,
          seoData: myCompany.seo,
          competitors: competitors.map(c2 => ({ name: c2.company.name, score: c2.company.score, categories: c2.company.categories })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации бенчмарков");
      setBenchmarksData(json.data);
      setBenchmarksError(null);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_benchmarks_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("benchmarks", json.data);
      }
    } catch (e: unknown) {
      setBenchmarksError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setIsBenchmarksGenerating(false);
    }
  };

  const handleSMMAnalysis = async (niche: string, links: SMMSocialLinks) => {
    setIsSMMAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          socialLinks: links,
          websiteContext: myCompany?.company.description ?? "",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа СММ");
      setSmmAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_smm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
        syncToServer("smm", json.data);
      }
      setActiveNav("smm-dashboard");
    } finally {
      setIsSMMAnalyzing(false);
    }
  };

  // ----- Content Factory -----

  const persistContent = (plan: ContentPlan | null, posts: GeneratedPost[], reels: GeneratedReel[]) => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`mr_content_${currentUser.id}`, JSON.stringify({ plan, posts, reels }));
      syncToServer("content", { plan, posts, reels });
    } catch { /* ignore */ }
  };

  const handleUpdateAvatarSettings = (next: AvatarSettings) => {
    setAvatarSettings(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_avatar_settings_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("avatar", next);
    }
  };

  const handleUpdateBrandBook = (next: BrandBook) => {
    setBrandBook(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_brandbook_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      syncToServer("brandbook", next);
    }
  };

  const handleSetBrandSuggestions = (v: unknown) => {
    setBrandSuggestions(v);
    if (currentUser) {
      try { localStorage.setItem(`mr_brandsug_${currentUser.id}`, JSON.stringify(v)); } catch { /* ignore */ }
      syncToServer("brandsug", v);
    }
  };

  const persistStories = (stories: GeneratedStory[]) => {
    if (!currentUser?.id) return;
    try { localStorage.setItem(`mr_stories_${currentUser.id}`, JSON.stringify(stories)); } catch { /* ignore */ }
    syncToServer("stories", stories);
  };

  const handleAddStory = (story: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = [story, ...prev];
      persistStories(next);
      return next;
    });
  };

  const handleDeleteStory = (storyId: string) => {
    setGeneratedStories(prev => {
      const next = prev.filter(s => s.id !== storyId);
      persistStories(next);
      return next;
    });
  };

  const handleUpdateStory = (updated: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      persistStories(next);
      return next;
    });
  };

  const handleGenerateContentPlan = async (niche: string) => {
    if (!smmAnalysis) return;
    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/generate-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis.companyName,
          niche,
          smmAnalysis,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации плана");
      setContentPlan(json.data);
      persistContent(json.data, generatedPosts, generatedReels);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGeneratePost = async (idea: ContentPostIdea, customPrompt?: string) => {
    setGeneratingPostId(idea.id);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          generateImage: true,
          userPrompt: customPrompt,
          referenceImages: referenceImages.map(r => ({ data: r.data, mimeType: r.mimeType })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации поста");
      setGeneratedPosts(prev => {
        const next = [json.data as GeneratedPost, ...prev];
        persistContent(contentPlan, next, generatedReels);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации поста");
    } finally {
      setGeneratingPostId(null);
    }
  };

  const handleGenerateReelScenario = async (idea: ContentReelIdea, customPrompt?: string) => {
    setGeneratingReelId(idea.id);
    try {
      const res = await fetch("/api/generate-reel-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          voiceDescription: avatarSettings.voiceDescription,
          avatarDescription: avatarSettings.avatarDescription,
          userPrompt: customPrompt,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации сценария");
      setGeneratedReels(prev => {
        const next = [json.data as GeneratedReel, ...prev];
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации сценария");
    } finally {
      setGeneratingReelId(null);
    }
  };

  const handleUpdatePost = (updated: GeneratedPost) => {
    setGeneratedPosts(prev => {
      const next = prev.map(p => p.id === updated.id ? updated : p);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleUpdateReel = (updated: GeneratedReel) => {
    setGeneratedReels(prev => {
      const next = prev.map(r => r.id === updated.id ? updated : r);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleDeletePost = (postId: string) => {
    setGeneratedPosts(prev => {
      const next = prev.filter(p => p.id !== postId);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleDeleteReel = (reelId: string) => {
    setGeneratedReels(prev => {
      const next = prev.filter(r => r.id !== reelId);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleGenerateReelVideo = async (reelId: string) => {
    const reel = generatedReels.find(r => r.id === reelId);
    if (!reel) return;
    setGeneratingVideoFor(reelId);
    try {
      const res = await fetch("/api/generate-reel-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: reel.voiceoverScript,
          avatarId: avatarSettings.avatarId || undefined,
          voiceId: avatarSettings.voiceId || undefined,
          aspect: avatarSettings.aspect,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      const videoId: string = json.data.videoId;
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, heygenVideoId: videoId, videoStatus: "generating" as const, videoError: undefined }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, videoStatus: "failed" as const, videoError: msg }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  // Poll HeyGen for any reels currently generating
  useEffect(() => {
    const generating = generatedReels.filter(r => r.videoStatus === "generating" && r.heygenVideoId);
    if (generating.length === 0) return;
    const interval = setInterval(async () => {
      for (const reel of generating) {
        try {
          const res = await fetch(`/api/video-status?videoId=${encodeURIComponent(reel.heygenVideoId!)}`);
          const json = await res.json();
          if (!json.ok) continue;
          const status: string = json.data.status;
          if (status === "completed" && json.data.videoUrl) {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "ready" as const, videoUrl: json.data.videoUrl as string }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          } else if (status === "failed") {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "failed" as const, videoError: json.data.error ?? "HeyGen вернул failed" }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          }
        } catch { /* keep polling */ }
      }
    }, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedReels.map(r => `${r.id}:${r.videoStatus}`).join(",")]);

  // Onboarding complete: run initial analysis
  const handleOnboardingComplete = async (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => {
    setCurrentUser(updatedUser);
    setAppScreen("app");
    if (!companyUrl) { setStatus("done"); setActiveNav("new-analysis"); return; }
    setCurrentUrl(companyUrl);
    setStatus("loading");
    try {
      const result = await analyzeUrl(companyUrl);
      saveMyCompany(result, updatedUser.id);
      const compResults: AnalysisResult[] = [];
      for (const url of competitorUrls) {
        setCurrentUrl(url);
        const comp = await analyzeUrl(url);
        compResults.push(comp);
        setCompetitors([...compResults]);
      }
      if (compResults.length > 0 && updatedUser.id) {
        try { localStorage.setItem(`mr_competitors_${updatedUser.id}`, JSON.stringify(compResults)); } catch { /* ignore */ }
        syncToServer("competitors", compResults);
      }
      setActiveNav("dashboard");
    } catch {
      setActiveNav("new-analysis");
    } finally {
      setStatus("done");
    }
  };

  // Logout
  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    authSetCurrentUser(null);
    setCurrentUser(null);
    setAppScreen("landing");
    // Не сбрасываем myCompany/competitors — пусть остаются в памяти для UX
    // При следующем входе они восстановятся из localStorage
    setStatus("idle");
    setActiveNav("new-analysis");
    setSelectedCompetitor(null);
  };

  // Update nav counts dynamically (including nested children)
  const updateCounts = (items: typeof NAV_SECTIONS[0]["items"]): typeof NAV_SECTIONS[0]["items"] =>
    items.map(item => ({
      ...item,
      count: item.id === "competitors" ? (competitors.length > 0 ? competitors.length : null) :
        item.id === "insights" ? (myCompany?.insights?.length ?? null) :
          item.id === "competitor-analysis" ? (myCompany ? 1 : null) :
            item.id === "ta-analysis" ? (taAnalysis ? 1 : null) :
              item.id === "smm-analysis" ? (smmAnalysis ? 1 : null) :
                item.id === "content-factory" ? (contentPlan ? 1 : null) :
                  item.id === "content-posts" ? (generatedPosts.length > 0 ? generatedPosts.length : null) :
                    item.id === "content-reels" ? (generatedReels.length > 0 ? generatedReels.length : null) : item.count,
      children: item.children ? updateCounts(item.children) : undefined,
    }));
  const navSections = NAV_SECTIONS.map(section => ({ ...section, items: updateCounts(section.items) }));

  // Screen routing
  if (appScreen === "landing") {
    return <LandingPageView c={c} theme={theme} setTheme={setTheme} onRegister={() => setAppScreen("register")} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "register") {
    return <RegisterView c={c} onSuccess={(user) => { setCurrentUser(user); setAppScreen("onboarding"); }} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "login") {
    return <LoginView c={c} onSuccess={async (user) => { setCurrentUser(user); await loadAndApplyUserData(user.id); setAppScreen(user.onboardingDone ? "app" : "onboarding"); }} onRegister={() => setAppScreen("register")} />;
  }
  if (appScreen === "onboarding" && currentUser) {
    return <OnboardingView c={c} user={currentUser} onComplete={handleOnboardingComplete} />;
  }

  // App: loading state (initial analysis)
  if (status === "loading") {
    return <LoadingView c={c} url={currentUrl} />;
  }

  // Mobile chrome: top bar + drawer + bottom nav
  const mobileNav = (
    <>
      {/* Top bar — mobile only */}
      <div className="ds-mobile-only" style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 52,
        background: c.bgCard, borderBottom: `1px solid ${c.border}`,
        flexShrink: 0,
      }}>
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Открыть меню"
          style={{ background: "transparent", border: "none", width: 40, height: 40, cursor: "pointer", color: c.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <button onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")} aria-label="Сменить тему"
          style={{ background: "transparent", border: "none", width: 40, height: 40, cursor: "pointer", fontSize: 18, borderRadius: 8 }}>
          {theme === "light" ? "🌙" : theme === "dark" ? "☕" : "☀️"}
        </button>
      </div>

      {/* Drawer backdrop */}
      <div onClick={() => setMobileMenuOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 105, opacity: mobileMenuOpen ? 1 : 0, pointerEvents: mobileMenuOpen ? "auto" : "none", transition: "opacity 220ms ease" }} />

      {/* Side drawer with full nav */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 280, maxWidth: "85vw",
        background: COLORS.dark.bgSidebar, zIndex: 110,
        transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 220ms ease", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${COLORS.dark.sidebarBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>MR</div>
            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.dark.sidebarText }}>MarketRadar</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.dark.sidebarTextMuted, borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>
        <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav}
          setActiveNav={setActiveNavMobile} navSections={navSections}
          companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      </div>

      <MobileBottomNav activeNav={activeNav}
        setActiveNav={(id) => { setSelectedCompetitor(null); setActiveNavMobile(id); }}
        onOpenMenu={() => setMobileMenuOpen(true)} />
    </>
  );

  // App: competitor profile sub-view
  if (selectedCompetitor !== null && competitors[selectedCompetitor]) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", background: c.bg, color: c.textPrimary }}>
        <style>{`::selection { background: ${c.accent}30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
        {mobileNav}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={(id) => { setSelectedCompetitor(null); setActiveNav(id); }} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
          <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
            <CompetitorProfileView c={c} data={competitors[selectedCompetitor]} onBack={() => { setSelectedCompetitor(null); setActiveNav("competitors"); }} />
          </main>
        </div>
      </div>
    );
  }

  // App: main dashboard layout
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", background: c.bg, color: c.textPrimary }}>
      <style>{`::selection { background: ${c.accent}30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
      {mobileNav}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={setActiveNav} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      <main className="ds-mobile-page-padding" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "new-analysis" && <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />}
        {activeNav === "dashboard" && (myCompany ? <DashboardView c={c} data={myCompany} competitors={competitors} /> : <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />)}
        {activeNav === "prev-analyses" && <PreviousAnalysesView c={c} history={analysisHistory} currentAnalysis={myCompany} />}
        {activeNav === "competitors" && <CompetitorsView c={c} myCompany={myCompany} competitors={competitors} onSelectCompetitor={(i) => { setSelectedCompetitor(i); }} onAddCompetitor={handleAddCompetitor} isAnalyzing={isAnalyzing} />}
        {activeNav === "compare" && <CompareView c={c} myCompany={myCompany} competitors={competitors} />}
        {activeNav === "insights" && myCompany && <InsightsView c={c} data={myCompany} competitors={competitors} />}
        {activeNav === "reports" && <ReportsView c={c} data={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} />}
        {activeNav === "sources" && <SourcesView c={c} />}
        {activeNav === "settings" && <SettingsView c={c} user={currentUser} onUpdateUser={(updated) => setCurrentUser(updated)} />}
        {activeNav === "ta-new" && <NewTAView c={c} myCompany={myCompany} isAnalyzing={isTAAnalyzing} onAnalyze={handleTAAnalysis} />}
        {activeNav === "ta-dashboard" && (taAnalysis ? <TADashboardView c={c} data={taAnalysis} /> : <TAEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("ta-new")} />)}
        {activeNav === "ta-cjm" && <CJMView c={c} data={cjmData} isGenerating={isCJMGenerating} onGenerate={handleGenerateCJM} myCompany={myCompany} taAnalysis={taAnalysis} error={cjmError} />}
        {activeNav === "ta-benchmarks" && <BenchmarksView c={c} data={benchmarksData} isGenerating={isBenchmarksGenerating} onGenerate={handleGenerateBenchmarks} myCompany={myCompany} error={benchmarksError} />}
        {activeNav === "ta-brandbook" && taAnalysis && (
          <BrandSuggestionsView c={c} taData={taAnalysis} brandSuggestions={brandSuggestions} setBrandSuggestions={handleSetBrandSuggestions} brandBook={brandBook} onUpdateBrandBook={handleUpdateBrandBook} />
        )}
        {activeNav === "ta-brandbook" && !taAnalysis && (
          <div style={{ padding: 40, textAlign: "center", color: c.textSecondary }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Сначала проведите анализ ЦА</div>
            <div style={{ fontSize: 13 }}>Перейдите в «Анализ ЦА → Новый анализ»</div>
          </div>
        )}
        {activeNav === "smm-new" && <NewSMMView c={c} myCompany={myCompany} isAnalyzing={isSMMAnalyzing} onAnalyze={handleSMMAnalysis} />}
        {activeNav === "smm-dashboard" && (smmAnalysis ? <SMMDashboardView c={c} data={smmAnalysis} /> : <SMMEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("smm-new")} />)}
        {activeNav === "content-plan" && (
          contentPlan
            ? <ContentPlanView
                c={c}
                plan={contentPlan}
                isGeneratingPost={generatingPostId !== null}
                generatingPostId={generatingPostId}
                isGeneratingReel={generatingReelId !== null}
                generatingReelId={generatingReelId}
                onGeneratePost={handleGeneratePost}
                onGenerateReel={handleGenerateReelScenario}
                avatarSettings={avatarSettings}
                onUpdateAvatarSettings={handleUpdateAvatarSettings}
                referenceImages={referenceImages}
                onUpdateReferenceImages={setReferenceImages}
                brandBook={brandBook}
                onUpdateBrandBook={handleUpdateBrandBook}
              />
            : <NewContentPlanView c={c} myCompany={myCompany} smm={smmAnalysis} isGenerating={isGeneratingPlan} onGenerate={handleGenerateContentPlan} />
        )}
        {activeNav === "content-posts" && <GeneratedPostsView c={c} posts={generatedPosts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} referenceImages={referenceImages} onUpdateReferenceImages={setReferenceImages} brandBook={brandBook} />}
        {activeNav === "content-reels" && <GeneratedReelsView c={c} reels={generatedReels} onGenerateVideo={handleGenerateReelVideo} generatingVideoFor={generatingVideoFor} avatarSettings={avatarSettings} onUpdateAvatarSettings={handleUpdateAvatarSettings} onUpdateReel={handleUpdateReel} onDeleteReel={handleDeleteReel} />}
        {activeNav === "content-stories" && <StoriesView c={c} stories={generatedStories} plan={contentPlan} smmAnalysis={smmAnalysis} companyName={myCompany?.company.name ?? ""} brandBook={brandBook} onAdd={handleAddStory} onDelete={handleDeleteStory} onUpdate={handleUpdateStory} />}
        {activeNav === "content-analytics" && <ContentAnalyticsView c={c} posts={generatedPosts} reels={generatedReels} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "content-roi" && <ROICalculatorView c={c} posts={generatedPosts} reels={generatedReels} />}
        {activeNav === "reviews-analysis" && <ReviewsView c={c} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "brand-presentation" && <PresentationView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />}
        {activeNav === "landing-generator" && <LandingGeneratorView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} userId={currentUser?.id ?? ""} />}
      </main>
      </div>
    </div>
  );
}

// ============================================================
// Customer Journey Map View
// ============================================================

function CJMView({ c, data, isGenerating, onGenerate, myCompany, taAnalysis, error }: {
  c: Colors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  isGenerating: boolean;
  onGenerate: () => void;
  myCompany: AnalysisResult | null;
  taAnalysis: unknown;
  error?: string | null;
}) {
  const emotionColor = (valence: string) => {
    if (valence === "positive") return c.accentGreen;
    if (valence === "negative") return c.accentRed;
    if (valence === "mixed") return c.accentWarm;
    return c.textSecondary;
  };

  const stageColors = [c.accent, "#8b5cf6", "#3b82f6", "#f59e0b", c.accentGreen, "#14b8a6", "#ec4899"];

  if (!myCompany) return (
    <div style={{ padding: 40, textAlign: "center", color: c.textSecondary }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary }}>Сначала проанализируйте компанию</div>
    </div>
  );

  if (!data) return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Customer Journey Map</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        AI построит карту пути клиента — от первого контакта с брендом до повторных покупок и рекомендаций.
        {!!taAnalysis && <span style={{ color: c.accentGreen }}> Данные ЦА будут учтены.</span>}
      </p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 32, boxShadow: c.shadow, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
        <div style={{ fontSize: 14, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 24px" }}>
          Карта включает 7 этапов: точки касания, эмоции клиента, боли на каждом шаге и возможности для улучшения
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "13px 36px", borderRadius: 12, border: "none", background: isGenerating ? c.textMuted : "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Генерирую CJM… (30-60 сек)" : "🗺️ Построить Customer Journey Map"}
        </button>
        {isGenerating && <p style={{ fontSize: 12, color: c.textMuted, marginTop: 12 }}>Анализирую путь клиента на основе данных компании{taAnalysis ? " и ЦА" : ""}…</p>}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: c.accentRed + "15", border: `1px solid ${c.accentRed}40`, color: c.accentRed, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stages: any[] = data.stages ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>Customer Journey Map</h1>
          <p style={{ fontSize: 13, color: c.textSecondary, margin: 0 }}>{data.companyName}</p>
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textMuted, fontSize: 12, fontWeight: 600, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Обновляю…" : "🔄 Обновить"}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: c.accentRed + "15", border: `1px solid ${c.accentRed}40`, color: c.accentRed, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Horizontal journey line */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
        {stages.map((stage, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: stageColors[i % stageColors.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 6px", boxShadow: `0 2px 8px ${stageColors[i % stageColors.length]}40` }}>
                {stage.emoji}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>{stage.name}</div>
              <div style={{ fontSize: 10, color: c.textMuted }}>{stage.duration}</div>
            </div>
            {i < stages.length - 1 && (
              <div style={{ width: 24, height: 2, background: `linear-gradient(to right, ${stageColors[i % stageColors.length]}, ${stageColors[(i + 1) % stageColors.length]})`, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Stage cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stages.map((stage, i) => (
          <div key={i} style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
            {/* Stage header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${c.borderLight}`, background: stageColors[i % stageColors.length] + "08" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: stageColors[i % stageColors.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{stage.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{stage.name}</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{stage.goal}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: emotionColor(stage.emotionValence), background: emotionColor(stage.emotionValence) + "15", padding: "3px 10px", borderRadius: 20 }}>{stage.emotion}</span>
                <span style={{ fontSize: 11, color: c.textMuted, background: c.bg, padding: "3px 10px", borderRadius: 20, border: `1px solid ${c.border}` }}>{stage.duration}</span>
              </div>
            </div>

            {/* Stage body */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
              {/* Touchpoints */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.04em" }}>📍 ТОЧКИ КАСАНИЯ</div>
                {(stage.touchpoints ?? []).map((tp: { icon: string; channel: string; action: string }, j: number) => (
                  <div key={j} style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12, color: c.textSecondary }}>
                    <span style={{ flexShrink: 0 }}>{tp.icon}</span>
                    <span><strong style={{ color: c.textPrimary }}>{tp.channel}</strong> — {tp.action}</span>
                  </div>
                ))}
              </div>

              {/* Customer thoughts */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.04em" }}>💭 МЫСЛИ КЛИЕНТА</div>
                {(stage.customerThoughts ?? []).map((t: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid ${stageColors[i % stageColors.length]}40` }}>«{t}»</div>
                ))}
              </div>

              {/* Pain points */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8, letterSpacing: "0.04em" }}>⚠️ БАРЬЕРЫ</div>
                {(stage.painPoints ?? []).map((p: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid ${c.accentRed}40` }}>{p}</div>
                ))}
              </div>

              {/* Opportunities */}
              <div style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8, letterSpacing: "0.04em" }}>💡 ВОЗМОЖНОСТИ</div>
                {(stage.opportunities ?? []).map((o: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid ${c.accentGreen}40` }}>{o}</div>
                ))}
                {stage.kpi && (
                  <div style={{ marginTop: 8, fontSize: 11, color: c.accent, fontWeight: 600, background: c.accent + "10", padding: "4px 10px", borderRadius: 6 }}>
                    📈 KPI: {stage.kpi}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Benchmarks View
// ============================================================

function BenchmarksView({ c, data, isGenerating, onGenerate, myCompany, error }: {
  c: Colors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  isGenerating: boolean;
  onGenerate: () => void;
  myCompany: AnalysisResult | null;
  error?: string | null;
}) {
  if (!myCompany) return (
    <div style={{ padding: 40, textAlign: "center", color: c.textSecondary }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary }}>Сначала проанализируйте компанию</div>
    </div>
  );

  if (!data) return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Отраслевые бенчмарки</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        AI сравнит показатели компании со средними по нише на российском рынке и найдёт зоны роста.
      </p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 32, boxShadow: c.shadow, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 14, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 24px" }}>
          Получите сравнение по 6+ категориям, рыночные метрики (CAC, LTV, конверсия) и приоритизированные точки роста
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "13px 36px", borderRadius: 12, border: "none", background: isGenerating ? c.textMuted : "linear-gradient(135deg, #0ea5e9, #38bdf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Анализирую рынок… (30-60 сек)" : "📊 Сгенерировать бенчмарки"}
        </button>
        {isGenerating && <p style={{ fontSize: 12, color: c.textMuted, marginTop: 12 }}>Сравниваю с отраслевыми стандартами…</p>}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: c.accentRed + "15", border: `1px solid ${c.accentRed}40`, color: c.accentRed, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );

  const verdictColor = (v: string) => {
    if (v?.includes("Лидер") || v?.includes("выше")) return c.accentGreen;
    if (v?.includes("Отстающий") || v?.includes("ниже")) return c.accentRed;
    return c.accentWarm;
  };

  const ob = data.overallBenchmark ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catBench: any[] = data.categoryBenchmarks ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mktMetrics: any[] = data.marketMetrics ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const growthOps: any[] = data.growthOpportunities ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>Отраслевые бенчмарки</h1>
          <p style={{ fontSize: 13, color: c.textSecondary, margin: 0 }}>{data.niche}</p>
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textMuted, fontSize: 12, fontWeight: 600, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Обновляю…" : "🔄 Обновить"}
        </button>
      </div>

      {data.summary && (
        <div style={{ background: c.accent + "08", borderRadius: 12, padding: "14px 18px", border: `1px solid ${c.accent}20`, marginBottom: 24, fontSize: 13, color: c.textSecondary, lineHeight: 1.6 }}>
          {data.summary}
        </div>
      )}

      {/* Overall score block */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Ваш Score", value: ob.companyScore, color: c.accent, big: true },
          { label: "Среднее по нише", value: ob.nicheAverage, color: c.textSecondary },
          { label: "Лидер рынка", value: ob.nicheLeader, color: c.accentGreen },
          { label: "Нижняя граница", value: ob.nicheBottom, color: c.accentRed },
          { label: "Перцентиль", value: ob.percentile ? `${ob.percentile}%` : "—", color: c.accentWarm },
        ].map((item, i) => (
          <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: "16px 18px", boxShadow: c.shadow, textAlign: "center" }}>
            <div style={{ fontSize: item.big ? 28 : 22, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.value ?? "—"}</div>
            <div style={{ fontSize: 11, color: c.textMuted, fontWeight: 600 }}>{item.label}</div>
          </div>
        ))}
        {ob.verdict && (
          <div style={{ background: verdictColor(ob.verdict) + "12", borderRadius: 14, border: `2px solid ${verdictColor(ob.verdict)}30`, padding: "16px 18px", boxShadow: c.shadow, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: verdictColor(ob.verdict) }}>{ob.verdict}</div>
          </div>
        )}
      </div>

      {/* Category benchmarks */}
      {catBench.length > 0 && (
        <CollapsibleSection c={c} title="📈 Бенчмарки по категориям">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {catBench.map((cat, i) => {
              const gapPositive = (cat.gap ?? 0) >= 0;
              const barWidth = Math.min(100, Math.max(2, cat.companyScore ?? 0));
              const avgBarWidth = Math.min(100, Math.max(2, cat.nicheAverage ?? 0));
              return (
                <div key={i} style={{ background: c.bgCard, borderRadius: 12, padding: "14px 18px", border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.textPrimary }}>{cat.icon} {cat.categoryName}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: gapPositive ? c.accentGreen : c.accentRed }}>
                        {gapPositive ? "+" : ""}{cat.gap}
                      </span>
                      <span style={{ fontSize: 10, background: (cat.priority === "high" ? c.accentRed : cat.priority === "medium" ? c.accentWarm : c.accentGreen) + "15", padding: "2px 8px", borderRadius: 6, fontWeight: 600, color: cat.priority === "high" ? c.accentRed : cat.priority === "medium" ? c.accentWarm : c.accentGreen }}>
                        {cat.priority === "high" ? "Высокий приоритет" : cat.priority === "medium" ? "Средний" : "Низкий"}
                      </span>
                    </div>
                  </div>
                  {/* Bar comparison */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: c.accent, width: 50, flexShrink: 0, fontWeight: 600 }}>Вы {cat.companyScore}</span>
                      <div style={{ flex: 1, height: 6, background: c.borderLight, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barWidth}%`, background: c.accent, borderRadius: 3, transition: "width 0.5s" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: c.textMuted, width: 50, flexShrink: 0 }}>Avg {cat.nicheAverage}</span>
                      <div style={{ flex: 1, height: 6, background: c.borderLight, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${avgBarWidth}%`, background: c.textMuted, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  {cat.insight && <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.4, paddingLeft: 10, borderLeft: `2px solid ${c.accent}30` }}>{cat.insight}</div>}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Market metrics */}
      {mktMetrics.length > 0 && (
        <CollapsibleSection c={c} title="💹 Рыночные метрики">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: c.bg }}>
                  {["Метрика", "Среднее по нише", "Топ-игроки", "Ваша оценка"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mktMetrics.map((m, i) => (
                  <tr key={i} style={{ borderBottom: i < mktMetrics.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "10px 16px", color: c.textPrimary, fontWeight: 600 }}>{m.icon} {m.metric}</td>
                    <td style={{ padding: "10px 16px", color: c.textSecondary }}>{m.nicheAverage}</td>
                    <td style={{ padding: "10px 16px", color: c.accentGreen, fontWeight: 600 }}>{m.topPlayers}</td>
                    <td style={{ padding: "10px 16px", color: c.accent, fontWeight: 600 }}>{m.yourEstimate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Growth opportunities */}
      {growthOps.length > 0 && (
        <CollapsibleSection c={c} title="🚀 Точки роста">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
            {growthOps.map((op, i) => {
              const impactColor = op.potentialImpact === "high" ? c.accentGreen : op.potentialImpact === "medium" ? c.accentWarm : c.textMuted;
              const effortColor = op.effort === "low" ? c.accentGreen : op.effort === "medium" ? c.accentWarm : c.accentRed;
              return (
                <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{op.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>{op.title}</div>
                  <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>{op.description}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: impactColor, background: impactColor + "12", padding: "2px 8px", borderRadius: 6 }}>
                      Эффект: {op.potentialImpact === "high" ? "Высокий" : op.potentialImpact === "medium" ? "Средний" : "Низкий"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: effortColor, background: effortColor + "12", padding: "2px 8px", borderRadius: 6 }}>
                      Усилия: {op.effort === "low" ? "Низкие" : op.effort === "medium" ? "Средние" : "Высокие"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Niche insights */}
      {(data.nicheInsights ?? []).length > 0 && (
        <CollapsibleSection c={c} title="🔭 Инсайты по нише">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {(data.nicheInsights as string[]).map((ins, i) => (
              <div key={i} style={{ background: c.bgCard, borderRadius: 12, padding: "12px 16px", border: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary, lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: c.accent, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                {ins}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================
// Sidebar Component
// ============================================================

function SidebarComponent({ c, theme, setTheme, activeNav, setActiveNav, navSections, companyUrl, user, onLogout }: {
  c: Colors; theme: Theme; setTheme: (t: Theme) => void;
  activeNav: string; setActiveNav: (id: string) => void;
  navSections: NavSection[]; companyUrl: string;
  user?: UserAccount | null; onLogout?: () => void;
}) {
  // Auto-expand groups that contain the active item
  const getDefaultExpanded = () => {
    const expanded = new Set<string>();
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(c => c.id === activeNav)) expanded.add(item.id);
      }
    }
    return expanded;
  };
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(getDefaultExpanded);

  // When activeNav changes, ensure parent group is expanded
  useEffect(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(ch => ch.id === activeNav)) {
          setExpandedGroups(prev => { const next = new Set(prev); next.add(item.id); return next; });
        }
      }
    }
  }, [activeNav]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SB = (c as typeof COLORS["dark"]); // sidebar always reads dark-style tokens
  void SB; // suppress unused var warning

  const renderItem = (item: NavItem, depth = 0) => {
    const isGroup = !!(item.children && item.children.length > 0);
    const isExpanded = expandedGroups.has(item.id);
    const isActive = activeNav === item.id;
    const childActive = isGroup && item.children!.some(ch => ch.id === activeNav);

    return (
      <div key={item.id}>
        <div
          onClick={() => isGroup ? toggleGroup(item.id) : setActiveNav(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: depth > 0 ? "7px 10px 7px 28px" : "8px 10px",
            borderRadius: 8, cursor: "pointer",
            background: isActive ? c.bgSidebarActive : "transparent",
            color: isActive ? "#C4B8F5" : childActive ? "#C4B8F5" : c.sidebarText,
            fontWeight: isActive || (childActive && !isExpanded) ? 600 : 400, fontSize: 13,
            transition: "background 0.15s ease, color 0.15s ease", marginBottom: 1,
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = c.bgSidebarHover; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ fontSize: depth > 0 ? 13 : 15, flexShrink: 0, opacity: isActive || childActive ? 1 : 0.8 }}>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.count !== null && !isGroup && (
            <span style={{ fontSize: 10, fontWeight: 700, background: isActive ? "rgba(196,184,245,0.15)" : "rgba(255,255,255,0.07)", color: isActive ? "#C4B8F5" : c.sidebarTextMuted, borderRadius: 8, padding: "1px 7px" }}>{item.count}</span>
          )}
          {isGroup && (
            <ChevronRight size={13} style={{ color: c.sidebarTextMuted, transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
          )}
        </div>
        {isGroup && isExpanded && (
          <div style={{ borderLeft: `2px solid ${c.sidebarBorder}`, marginLeft: 18, marginBottom: 2 }}>
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="ds-sidebar-desktop" style={{ width: 240, minWidth: 240, background: c.bgSidebar, borderRight: `1px solid ${c.sidebarBorder}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${c.sidebarBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: "-0.02em", boxShadow: "0 2px 10px rgba(124,58,237,0.4)", flexShrink: 0 }}>MR</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: c.sidebarText, letterSpacing: "-0.02em" }}>MarketRadar</div>
            {companyUrl && <div style={{ fontSize: 10, color: c.sidebarTextMuted, marginTop: 1 }}>{companyUrl}</div>}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "8px", flex: 1, overflowY: "auto" }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.sidebarTextMuted, letterSpacing: "0.1em", padding: "14px 10px 6px", textTransform: "uppercase" }}>{section.title}</div>
            {section.items.map(item => renderItem(item))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: "8px", borderTop: `1px solid ${c.sidebarBorder}` }}>
        <div onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: c.sidebarText, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = c.bgSidebarHover}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span>{theme === "light" ? "🌙" : theme === "dark" ? "☕" : "☀️"}</span>
          <span style={{ opacity: 0.85 }}>{theme === "light" ? "Тёмная тема" : theme === "dark" ? "Тёплая тема" : "Светлая тема"}</span>
        </div>
        {user && (
          <div style={{ padding: "10px", borderTop: `1px solid ${c.sidebarBorder}`, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#16A34A", border: `2px solid ${c.bgSidebar}` }} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.sidebarText, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                <div style={{ fontSize: 10, color: c.sidebarTextMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
              </div>
            </div>
            <div onClick={onLogout}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#F87171", cursor: "pointer", padding: "5px 0", opacity: 0.85, transition: "opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}>
              <span>↩</span><span>Выйти</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ============================================================
// Mobile Bottom Navigation (visible on <768px)
// ============================================================
function MobileBottomNav({ activeNav, setActiveNav, onOpenMenu }: {
  activeNav: string; setActiveNav: (id: string) => void; onOpenMenu: () => void;
}) {
  const items = [
    { id: "dashboard",    label: "Главная",    icon: <LayoutDashboard size={22} /> },
    { id: "competitors",  label: "Конкуренты", icon: <Sword size={22} /> },
    { id: "ta-dashboard", label: "ЦА",         icon: <Users size={22} /> },
    { id: "content-plan", label: "Контент",    icon: <BookOpen size={22} /> },
    { id: "__menu__",     label: "Ещё",        icon: <Menu size={22} /> },
  ];
  return (
    <nav className="ds-bottom-nav ds-mobile-only" style={{ display: "flex" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", width: "100%", height: "100%" }}>
        {items.map((it) => {
          const isActive = activeNav === it.id;
          return (
            <button key={it.id}
              onClick={() => it.id === "__menu__" ? onOpenMenu() : setActiveNav(it.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, color: isActive ? "#C4B8F5" : "rgba(255,255,255,0.45)",
                cursor: "pointer", fontSize: 10, fontWeight: 500, background: "transparent",
                border: "none", fontFamily: "inherit", padding: "4px 2px",
                transition: "color 0.15s",
              }}>
              {it.icon}
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
