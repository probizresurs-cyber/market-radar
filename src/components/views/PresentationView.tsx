"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { BrandBook, PresentationStyle } from "@/lib/content-types";

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

export function buildStyleFromBrandBook(bb: BrandBook): PresentationStyle {
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

interface SavedPresentation {
  id: string;
  title: string;
  createdAt: string;
  slides: PresentationSlide[];
  style: PresentationStyle | null;
  slideCount: number;
}

export function PresentationView({ c, myCompany, taAnalysis, smmAnalysis, brandBook, userId }: {
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
  const primary = sty.colors[0] || "var(--primary)";
  const secondary = sty.colors[1] || "var(--success)";
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
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Бренд-презентация</h1>
          <p style={{ color: "var(--foreground-secondary)", fontSize: 14 }}>Профессиональная презентация за 5 минут из ваших данных</p>
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--card)", borderRadius: 10, padding: 3, border: `1px solid var(--border)` }}>
          {(["create", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: tab === t ? "var(--primary)" : "transparent",
                color: tab === t ? "#fff" : "var(--foreground-secondary)" }}>
              {t === "create" ? "✦ Создать" : `📁 История (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--destructive) 9%, transparent)", color: "var(--destructive)", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 6 }}>Нет сохранённых презентаций</p>
              <p style={{ fontSize: 13 }}>Создайте первую — она автоматически сохранится</p>
              <button onClick={() => setTab("create")} style={{ marginTop: 16, padding: "9px 22px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Создать презентацию</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {history.map(h => {
                const pal = h.style?.colors ?? [];
                return (
                  <div key={h.id} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    {/* Mini slide preview */}
                    <div style={{ aspectRatio: "16/9", background: pal[0] ? `linear-gradient(135deg, ${pal[0]}, ${pal[3] || "#fff"})` : `linear-gradient(135deg, var(--primary), var(--background))`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
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
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
                        {new Date(h.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadFromHistory(h)}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          Открыть
                        </button>
                        <button onClick={() => deleteFromHistory(h.id)}
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer" }}>
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
                background: item.ok ? "color-mix(in oklch, var(--success) 8%, transparent)" : "color-mix(in oklch, var(--destructive) 8%, transparent)", color: item.ok ? "var(--success)" : "var(--destructive)" }}>
                {item.ok ? "✓" : "✗"} {item.label}
              </span>
            ))}
          </div>

          {/* Step 1a: Pick source */}
          {!styleSource && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 14 }}>Шаг 1: Выберите основу стиля</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
                <div onClick={brandBook.colors.length > 0 ? handlePickBrandbook : undefined}
                  style={{ background: "var(--card)", borderRadius: 14, padding: 24, border: `2px solid var(--border)`, cursor: brandBook.colors.length > 0 ? "pointer" : "default",
                    opacity: brandBook.colors.length > 0 ? 1 : 0.4, textAlign: "center", boxShadow: "var(--shadow)", transition: "border-color .15s" }}
                  onMouseEnter={e => brandBook.colors.length > 0 && ((e.currentTarget as HTMLElement).style.borderColor = "var(--primary)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", marginBottom: 4 }}>На основе брендбука</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>Цвета, шрифты и тон из вашего брендбука</div>
                  {brandBook.colors.length > 0 && (
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 10 }}>
                      {brandBook.colors.slice(0,5).map((col, i) => (
                        <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: col, border: `1px solid var(--border)` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div onClick={handlePickPresets}
                  style={{ background: "var(--card)", borderRadius: 14, padding: 24, border: `2px solid var(--border)`, cursor: "pointer",
                    textAlign: "center", boxShadow: "var(--shadow)", transition: "border-color .15s" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--primary)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", marginBottom: 4 }}>Выбрать из каталога</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>6 готовых стилей: минимализм, корпоративный, яркий...</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1b: Pick palette */}
          {styleSource && paletteOptions.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={() => { setStyleSource(null); setPaletteOptions([]); setSelectedStyle(null); }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 12 }}>← Назад</button>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Шаг 2: Выберите палитру</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
                {paletteOptions.map(p => {
                  const isSel = selectedStyle?.id === p.id;
                  return (
                    <div key={p.id} onClick={() => setSelectedStyle(p)}
                      style={{ background: "var(--card)", borderRadius: 12, overflow: "hidden", border: `2px solid ${isSel ? "var(--primary)" : "var(--border)"}`,
                        cursor: "pointer", boxShadow: isSel ? "var(--shadow-lg)" : "var(--shadow)", transition: "all .15s" }}>
                      {renderMiniCover(p)}
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--foreground-secondary)", marginBottom: 8 }}>{p.mood}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {p.colors.slice(0, 5).map((col, i) => (
                            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: col, border: `1px solid var(--border)` }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{p.fontHeader} / {p.fontBody}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedStyle && (
                <button onClick={handleGenerate} disabled={!myCompany} style={{ padding: "14px 36px", borderRadius: 10, border: "none",
                  background: !myCompany ? "var(--muted-foreground)" : "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: !myCompany ? "default" : "pointer" }}>
                  Создать презентацию в стиле «{selectedStyle.name}»
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ━━━ STAGE 2: GENERATING ━━━ */}
      {stage === "generating" && (
        <div style={{ background: "var(--card)", borderRadius: 16, padding: 48, boxShadow: "var(--shadow)", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
          <h3 style={{ color: "var(--foreground)", marginBottom: 8 }}>Генерируем презентацию...</h3>
          <p style={{ color: "var(--foreground-secondary)", fontSize: 13, marginBottom: 24 }}>
            AI создаёт слайды на основе анализа компании, ЦА и выбранного стиля
          </p>
          <div style={{ maxWidth: 400, margin: "0 auto", background: "var(--border)", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, var(--primary), var(--success))`, borderRadius: 8,
              width: `${genProgress}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>{genProgress}%</div>
        </div>
      )}

      {/* ━━━ STAGE 3: REVIEW & EDIT ━━━ */}
      {stage === "review" && slides.length > 0 && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center",
            background: "var(--card)", padding: "12px 16px", borderRadius: 12, border: `1px solid var(--border)`, boxShadow: "var(--shadow)" }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", flex: 1 }}>{presTitle} — {slides.length} слайдов</h3>
            <button onClick={() => setFullscreen(true)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              ▶ Показ
            </button>
            <button onClick={handleExportPdf} disabled={isExportingPdf} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPdf ? "var(--muted-foreground)" : "var(--primary)", color: "#fff", cursor: isExportingPdf ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPdf ? "Экспорт..." : "📄 PDF"}
            </button>
            <button onClick={handleExportPptx} disabled={isExportingPptx} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPptx ? "var(--muted-foreground)" : "#10b981", color: "#fff", cursor: isExportingPptx ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPptx ? "Экспорт..." : "⬇ PPTX"}
            </button>
            <button onClick={handleExportSlidev} disabled={isExportingSlidev} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingSlidev ? "var(--muted-foreground)" : "#7c3aed", color: "#fff", cursor: isExportingSlidev ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingSlidev ? "Экспорт..." : "✦ Slidev .md"}
            </button>
            <button onClick={() => { setStage("style"); setSlides([]); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid var(--border)`,
              background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              🔄 Заново
            </button>
          </div>

          {/* Wish input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={wishText} onChange={e => setWishText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWishUpdate()}
              placeholder="Напишите пожелание: «добавь слайд про команду», «сделай акцент на ценах»..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--card)",
                color: "var(--foreground)", fontSize: 13, outline: "none" }} />
            <button onClick={handleWishUpdate} disabled={isUpdating || !wishText.trim()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: isUpdating ? "var(--muted-foreground)" : "var(--primary)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: isUpdating ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {isUpdating ? "Обновляю..." : "Обновить"}
            </button>
          </div>

          {/* All slides — vertical scroll (Canva-style) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {slides.map((slide, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Slide number label */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: 0.5 }}>
                  СЛАЙД {i + 1} · {slide.type.toUpperCase()} {slide.isEdited && <span style={{ color: "var(--success)", fontSize: 10 }}>✎ изменён</span>}
                </div>
                {/* Slide preview */}
                <div onClick={() => setEditingSlide(editingSlide === i ? null : i)} style={{ cursor: "pointer" }}>
                  {renderSlide(slide, i)}
                </div>
                {/* Inline edit panel */}
                {editingSlide === i && (
                  <div style={{ marginTop: 10, background: "var(--card)", borderRadius: 12, border: `1px solid var(--primary)40`, padding: 16, boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 10 }}>Редактирование слайда {i + 1}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>ЗАГОЛОВОК</label>
                        <input value={slide.title} onChange={e => handleSlideUpdate(i, { title: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>ПОДЗАГОЛОВОК</label>
                        <input value={slide.subtitle || ""} onChange={e => handleSlideUpdate(i, { subtitle: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>ТЕКСТ</label>
                      <textarea value={slide.content || ""} onChange={e => handleSlideUpdate(i, { content: e.target.value })} rows={2}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, resize: "vertical" }} />
                    </div>
                    {(slide.bullets || []).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>ПУНКТЫ (по строке)</label>
                        <textarea value={(slide.bullets || []).join("\n")} rows={Math.min(slide.bullets.length + 1, 6)}
                          onChange={e => handleSlideUpdate(i, { bullets: e.target.value.split("\n") })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
                      </div>
                    )}
                    {slide.note && (
                      <div style={{ fontSize: 11, color: "var(--foreground-secondary)", padding: "6px 10px", background: "var(--background)", borderRadius: 6 }}>
                        🎤 <b>Заметка:</b> {slide.note}
                      </div>
                    )}
                    <button onClick={() => setEditingSlide(null)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1px solid var(--border)`,
                      background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Закрыть</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Watermark */}
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "var(--muted-foreground)" }}>
            Создано в MarketRadar для Company24.pro
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

// Helper: render a single slide as static HTML string for print/PDF
export function renderSlideHtml(slide: PresentationSlide, i: number, total: number, primary: string, secondary: string, bg: string, textColor: string, fontH: string, fontB: string, logoUrl?: string): string {
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

