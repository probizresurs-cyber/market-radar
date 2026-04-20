"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { BrandBook, PresentationStyle } from "@/lib/content-types";
import {
  X, Sparkles, Folder, ClipboardList, Trash2, Check, Palette,
  MessageCircle, Brain, FileText, RefreshCw, Pencil, Mic,
} from "lucide-react";

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
  { id: "minimalist", name: "Минимализм", colors: ["#1a1a2e", "#6366f1", "#6366f1", "#ffffff", "#1a1a2e"], fontHeader: "Inter", fontBody: "Inter", mood: "Чистый, воздушный, элегантный" },
  { id: "corporate", name: "Корпоративный", colors: ["#0f2b46", "#c7985e", "#2563eb", "#f8f9fc", "#1e293b"], fontHeader: "Georgia", fontBody: "Inter", mood: "Надёжный, солидный, деловой" },
  { id: "bright", name: "Яркий", colors: ["#7c3aed", "#f59e0b", "#10b981", "#ffffff", "#18181b"], fontHeader: "Montserrat", fontBody: "Montserrat", mood: "Энергичный, современный, динамичный" },
  { id: "warm", name: "Тёплый", colors: ["#92400e", "#d97706", "#b45309", "#fffbeb", "#422006"], fontHeader: "Merriweather", fontBody: "Inter", mood: "Уютный, натуральный, человечный" },
  { id: "dark", name: "Премиум", colors: ["#18181b", "#a855f7", "#22d3ee", "#111111", "#f1f5f9"], fontHeader: "Playfair Display", fontBody: "Inter", mood: "Элитный, технологичный, стильный" },
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

  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState("");

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
          customPrompt: customPrompt.trim() || undefined,
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

    // ── Color helpers ───────────────────────────────────────
    const hexToRgb = (hex: string) => {
      const h = (hex || "#6366f1").replace("#", "").padEnd(6, "0");
      return { r: parseInt(h.slice(0,2),16)||0, g: parseInt(h.slice(2,4),16)||0, b: parseInt(h.slice(4,6),16)||0 };
    };
    const rgba = (hex: string, a: number) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
    const darken = (hex: string, amt: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `#${[r,g,b].map(v => Math.max(0,Math.round(v*(1-amt))).toString(16).padStart(2,"0")).join("")}`;
    };
    const lighten = (hex: string, amt: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `#${[r,g,b].map(v => Math.min(255,Math.round(v+(255-v)*amt)).toString(16).padStart(2,"0")).join("")}`;
    };

    const dp = darken(primary, 0.32);
    const lp = lighten(primary, 0.93);
    const accents = [primary, secondary, "#f59e0b", "#10b981", "#e11d48", "#0ea5e9"];

    const base: React.CSSProperties = {
      width: "100%", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden",
      position: "relative",
      boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
      fontFamily: `'${fontB}', system-ui, sans-serif`,
    };

    // Dot grid pattern (subtle texture)
    const dotGrid = (opacity = 0.05, size = 24) =>
      `radial-gradient(circle, rgba(255,255,255,${opacity}) 1px, transparent 1px)`;
    const dotGridStyle = (opacity?: number, size?: number): React.CSSProperties => ({
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: dotGrid(opacity, size),
      backgroundSize: `${size ?? 24}px ${size ?? 24}px`,
    });

    // Slide counter
    const pg = (light: boolean) => (
      <div style={{ position: "absolute", bottom: 16, right: 20, fontSize: 10,
        fontWeight: 700, letterSpacing: 2, color: light ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.14)" }}>
        {String(idx+1).padStart(2,"0")} / {String(total).padStart(2,"0")}
      </div>
    );

    // ── COVER ─────────────────────────────────────────────────────────────
    if (type === "cover") {
      return (
        <div key={idx} style={{ ...base,
          background: `linear-gradient(135deg, ${dp} 0%, ${primary} 58%, ${lighten(primary,0.14)} 100%)`,
          display: "flex" }}>
          {/* Ambient orbs */}
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-35%", right:"-8%", width:"58%", paddingBottom:"58%",
              borderRadius:"50%", background: rgba(secondary, 0.18), filter:"blur(70px)" }} />
            <div style={{ position:"absolute", bottom:"-25%", left:"15%", width:"40%", paddingBottom:"40%",
              borderRadius:"50%", background: rgba(secondary, 0.09), filter:"blur(50px)" }} />
            <div style={dotGridStyle(0.045, 26)} />
            {/* Decorative rings */}
            <div style={{ position:"absolute", right:"-10%", top:"-20%", width:"55%", paddingBottom:"55%",
              borderRadius:"50%", border:"1px solid rgba(255,255,255,0.06)" }} />
            <div style={{ position:"absolute", right:"-2%", top:"-8%", width:"36%", paddingBottom:"36%",
              borderRadius:"50%", border:"1px solid rgba(255,255,255,0.04)" }} />
          </div>

          {/* Left accent stripe */}
          <div style={{ width:7, flexShrink:0,
            background:`linear-gradient(180deg,${secondary},${rgba(secondary,0.25)})` }} />

          {/* Content */}
          <div style={{ flex:1, display:"flex", flexDirection:"column",
            justifyContent:"space-between", padding:"34px 48px 28px 34px", position:"relative", zIndex:2 }}>
            {/* Logo + brand name */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {brandBook.logoDataUrl
                ? <img src={brandBook.logoDataUrl} alt="logo" style={{ width:38, height:38, objectFit:"contain",
                    borderRadius:9, background:"rgba(255,255,255,0.12)", padding:4 }} />
                : <div style={{ width:38, height:38, borderRadius:9, background:"rgba(255,255,255,0.12)",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:18, height:18, borderRadius:5, background:secondary }} />
                  </div>
              }
              <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)",
                letterSpacing:2.5, textTransform:"uppercase" }}>
                {brandBook.brandName || myCompany?.company?.name || "Brand"}
              </span>
            </div>

            {/* Main title block */}
            <div>
              {slide.subtitle && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:9, marginBottom:16 }}>
                  <div style={{ width:24, height:2.5, background:secondary, borderRadius:2 }} />
                  <span style={{ fontSize:11, fontWeight:700, color:secondary,
                    letterSpacing:2.5, textTransform:"uppercase" }}>{slide.subtitle}</span>
                </div>
              )}
              <h1 style={{ fontSize:42, fontWeight:900, color:"#ffffff", margin:"0 0 16px",
                lineHeight:1.08, fontFamily:`'${fontH}', Georgia, serif`,
                letterSpacing:"-0.5px", textShadow:"0 2px 24px rgba(0,0,0,0.25)", maxWidth:520 }}>
                {slide.title}
              </h1>
              {slide.content && (
                <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.62)",
                  margin:"0 0 22px", lineHeight:1.72, maxWidth:430 }}>{slide.content}</p>
              )}
              {(slide.bullets||[]).length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(slide.bullets||[]).slice(0,5).map((b,bi) => (
                    <span key={bi} style={{ padding:"5px 14px", borderRadius:20,
                      background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.9)",
                      fontSize:11, fontWeight:600, border:"1px solid rgba(255,255,255,0.2)" }}>{b}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Year */}
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.22)", letterSpacing:1.5 }}>
              {new Date().getFullYear()}
            </div>
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── CTA ───────────────────────────────────────────────────────────────
    if (type === "cta") {
      return (
        <div key={idx} style={{ ...base,
          background:`linear-gradient(140deg,${dp} 0%,${primary} 55%,${lighten(primary,0.1)} 100%)`,
          display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-30%", left:"-10%", width:"60%", paddingBottom:"60%",
              borderRadius:"50%", background:rgba(secondary,0.12), filter:"blur(70px)" }} />
            <div style={{ position:"absolute", bottom:"-20%", right:"10%", width:"45%", paddingBottom:"45%",
              borderRadius:"50%", background:rgba(secondary,0.08), filter:"blur(50px)" }} />
            <div style={dotGridStyle(0.04, 26)} />
          </div>
          <div style={{ position:"relative", zIndex:2, maxWidth:"72%",
            display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:3.5, borderRadius:2, background:secondary }} />
            <h2 style={{ fontSize:40, fontWeight:900, color:"#fff", margin:0, lineHeight:1.08,
              fontFamily:`'${fontH}', Georgia, serif`, letterSpacing:"-0.5px",
              textShadow:"0 2px 24px rgba(0,0,0,0.25)" }}>{slide.title}</h2>
            {slide.subtitle && (
              <p style={{ fontSize:15, color:"rgba(255,255,255,0.7)", margin:0,
                lineHeight:1.55, fontWeight:500 }}>{slide.subtitle}</p>
            )}
            {slide.content && (
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.48)", margin:0,
                lineHeight:1.7, maxWidth:400 }}>{slide.content}</p>
            )}
            {(slide.bullets||[]).length > 0 && (
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", marginTop:4 }}>
                {(slide.bullets||[]).map((b,bi) => (
                  <span key={bi} style={{ padding:"9px 22px", borderRadius:26,
                    background: bi===0 ? secondary : "rgba(255,255,255,0.12)",
                    color:"#fff", fontSize:12, fontWeight:700,
                    border: bi===0 ? "none" : "1px solid rgba(255,255,255,0.22)" }}>{b}</span>
                ))}
              </div>
            )}
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    if (type === "stats") {
      const stats = slide.stats || [];
      const nums = stats.map(s => ({ ...s, n: parseFloat(s.value.replace(/[^0-9.]/g,""))||0 }));
      const maxN = Math.max(...nums.map(s => s.n), 1);
      return (
        <div key={idx} style={{ ...base, display:"flex", flexDirection:"column", background:"#ffffff" }}>
          {/* Top gradient accent */}
          <div style={{ height:5, background:`linear-gradient(90deg,${primary},${secondary})`, flexShrink:0 }} />
          {/* Header */}
          <div style={{ padding:"18px 36px 12px", display:"flex", alignItems:"center",
            gap:14, flexShrink:0, borderBottom:`1px solid ${rgba(primary,0.08)}` }}>
            <div style={{ width:3.5, height:34, borderRadius:2, background:primary, flexShrink:0 }} />
            <div>
              <h3 style={{ fontSize:22, fontWeight:800, color:"#0f172a", margin:0,
                fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
              {slide.subtitle && (
                <p style={{ fontSize:11, color:"#94a3b8", margin:"3px 0 0", letterSpacing:0.3 }}>{slide.subtitle}</p>
              )}
            </div>
          </div>
          {/* Cards */}
          <div style={{ flex:1, display:"grid",
            gridTemplateColumns:`repeat(${Math.min(stats.length||1,4)},1fr)`,
            gap:12, padding:"14px 26px 18px" }}>
            {stats.map((s,si) => {
              const col = accents[si % accents.length];
              return (
                <div key={si} style={{ background:rgba(col,0.04), borderRadius:14,
                  border:`1px solid ${rgba(col,0.14)}`, padding:"18px 14px 14px",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:7,
                  position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:4,
                    background:`linear-gradient(90deg,${col},${lighten(col,0.35)})` }} />
                  {/* Big number */}
                  <div style={{ fontSize:54, fontWeight:900, color:col, lineHeight:1,
                    fontFamily:`'${fontH}', Georgia, serif`, letterSpacing:"-2px" }}>{s.value}</div>
                  {/* Mini progress bar */}
                  <div style={{ width:"64%", height:3.5, borderRadius:2, background:rgba(col,0.14) }}>
                    <div style={{ height:"100%", borderRadius:2, background:col, minWidth:6,
                      width:`${nums[si].n > 0 ? (nums[si].n/maxN)*100 : 100}%` }} />
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", textAlign:"center",
                    lineHeight:1.4, maxWidth:120 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
          {slide.content && (
            <div style={{ padding:"0 26px 14px", fontSize:11, color:"#94a3b8", lineHeight:1.6 }}>{slide.content}</div>
          )}
          {pg(false)}
        </div>
      );
    }

    // ── QUOTE ─────────────────────────────────────────────────────────────
    if (type === "quote") {
      return (
        <div key={idx} style={{ ...base,
          background:`linear-gradient(148deg,${dp} 0%,${darken(primary,0.14)} 100%)`,
          display:"flex", alignItems:"center" }}>
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-20%", right:"-5%", width:"45%", paddingBottom:"45%",
              borderRadius:"50%", background:rgba(secondary,0.12), filter:"blur(55px)" }} />
            <div style={dotGridStyle(0.035, 24)} />
          </div>
          {/* Giant decorative quote */}
          <div style={{ position:"absolute", top:"6%", left:"4%", fontSize:200, lineHeight:1,
            fontFamily:"Georgia,serif", fontWeight:900, color:"rgba(255,255,255,0.05)",
            userSelect:"none", pointerEvents:"none" }}>&ldquo;</div>
          {/* Content */}
          <div style={{ position:"relative", zIndex:2, flex:1,
            padding:"40px 68px 40px 56px", display:"flex", flexDirection:"column",
            justifyContent:"center", gap:20 }}>
            <div style={{ width:44, height:3.5, background:secondary, borderRadius:2 }} />
            {slide.quote && (
              <p style={{ fontSize:20, fontStyle:"italic", color:"rgba(255,255,255,0.92)",
                lineHeight:1.68, margin:0, fontFamily:`'${fontH}', Georgia, serif`, fontWeight:400 }}>
                &ldquo;{slide.quote}&rdquo;
              </p>
            )}
            {slide.content && (
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.42)", margin:0, lineHeight:1.65 }}>{slide.content}</p>
            )}
            <div style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
              <div style={{ width:28, height:1.5, background:secondary, opacity:0.55 }} />
              <span style={{ fontSize:11, fontWeight:700, color:secondary,
                letterSpacing:2.5, textTransform:"uppercase" }}>{slide.title}</span>
            </div>
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── GRID ──────────────────────────────────────────────────────────────
    if (type === "grid") {
      const items = slide.items || (slide.bullets||[]).map(b => {
        const ci = b.indexOf(": ");
        return ci > 0 ? { title: b.slice(0,ci), description: b.slice(ci+2) } : { title: b, description: "" };
      });
      return (
        <div key={idx} style={{ ...base, display:"flex", flexDirection:"column", background:lp }}>
          <div style={{ height:5, background:`linear-gradient(90deg,${primary},${secondary})`, flexShrink:0 }} />
          {/* Header */}
          <div style={{ padding:"14px 28px 10px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              <div style={{ width:3.5, height:28, borderRadius:2, background:primary, flexShrink:0 }} />
              <div>
                <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:0,
                  fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
                {slide.subtitle && <p style={{ fontSize:11, color:"#64748b", margin:"2px 0 0" }}>{slide.subtitle}</p>}
              </div>
            </div>
            {slide.content && (
              <p style={{ fontSize:12, color:"#64748b", margin:"8px 0 0 14px", lineHeight:1.55 }}>{slide.content}</p>
            )}
          </div>
          {/* Cards */}
          <div style={{ flex:1, display:"grid",
            gridTemplateColumns:`repeat(${Math.min(Math.max(items.length,1),3)},1fr)`,
            gap:10, padding:"8px 20px 18px" }}>
            {items.slice(0,6).map((item,ii) => {
              const col = accents[ii % accents.length];
              return (
                <div key={ii} style={{ background:"#fff", borderRadius:13,
                  border:"1px solid rgba(0,0,0,0.055)",
                  boxShadow:"0 2px 14px rgba(0,0,0,0.055)",
                  padding:"14px 14px 12px",
                  display:"flex", flexDirection:"column", gap:8,
                  position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:3.5, background:col }} />
                  {/* Icon */}
                  <div style={{ width:34, height:34, borderRadius:10,
                    background:rgba(col,0.12), display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:13, height:13, borderRadius:4, background:col }} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1e293b", lineHeight:1.3,
                    fontFamily:`'${fontH}', serif` }}>{item.title}</div>
                  {item.description && (
                    <div style={{ fontSize:10.5, color:"#64748b", lineHeight:1.55 }}>{item.description}</div>
                  )}
                </div>
              );
            })}
          </div>
          {pg(false)}
        </div>
      );
    }

    // ── TWO-COLUMN ────────────────────────────────────────────────────────
    if (type === "two-column") {
      const half = Math.ceil((slide.bullets||[]).length / 2);
      const leftB = (slide.bullets||[]).slice(0, half);
      const rightB = (slide.bullets||[]).slice(half);
      const leftTxt = slide.leftContent || null;
      const rightTxt = slide.rightContent || null;
      return (
        <div key={idx} style={{ ...base, display:"flex", background:"#fff" }}>
          {/* Left — gradient */}
          <div style={{ width:"47%", flexShrink:0,
            background:`linear-gradient(162deg,${primary} 0%,${dp} 100%)`,
            display:"flex", flexDirection:"column", justifyContent:"space-between",
            padding:"30px 28px 24px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", bottom:"-25%", right:"-20%", width:"80%",
              paddingBottom:"80%", borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
            <div style={dotGridStyle(0.04, 20)} />
            <div style={{ position:"relative", zIndex:2 }}>
              <div style={{ width:30, height:3, background:secondary, borderRadius:2, marginBottom:16 }} />
              <h3 style={{ fontSize:20, fontWeight:800, color:"#fff", margin:"0 0 8px",
                lineHeight:1.2, fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
              {slide.subtitle && (
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.48)", margin:0, lineHeight:1.55 }}>{slide.subtitle}</p>
              )}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, position:"relative", zIndex:2 }}>
              {(leftTxt ? [leftTxt] : leftB).map((b,bi) => (
                <div key={bi} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                    background:"rgba(255,255,255,0.14)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontWeight:800, color:secondary }}>
                    {leftTxt ? "→" : bi+1}
                  </div>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.86)", lineHeight:1.55 }}>{b}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:52, fontWeight:900, color:"rgba(255,255,255,0.05)",
              lineHeight:1, fontFamily:`'${fontH}', serif`, position:"relative", zIndex:2 }}>
              {String(idx+1).padStart(2,"0")}
            </div>
          </div>
          {/* Right — light */}
          <div style={{ flex:1, background:lp,
            display:"flex", flexDirection:"column", justifyContent:"center", padding:"26px 24px" }}>
            {rightTxt && (
              <p style={{ fontSize:13, color:"#374151", lineHeight:1.72, marginBottom:14 }}>{rightTxt}</p>
            )}
            {rightB.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {rightB.map((b,bi) => (
                  <div key={bi} style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"9px 14px", borderRadius:11, background:"#fff",
                    boxShadow:"0 1px 6px rgba(0,0,0,0.06)",
                    border:"1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:primary, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:10, fontWeight:800, color:"#fff" }}>{bi+1}</div>
                    <span style={{ fontSize:12, color:"#1e293b", lineHeight:1.45, fontWeight:500 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
            {!rightTxt && rightB.length===0 && slide.content && (
              <p style={{ fontSize:13, color:"#374151", lineHeight:1.72 }}>{slide.content}</p>
            )}
          </div>
          {pg(false)}
        </div>
      );
    }

    // ── BULLETS (default) ─────────────────────────────────────────────────
    return (
      <div key={idx} style={{ ...base, display:"flex", background:"#ffffff" }}>
        {/* Left sidebar */}
        <div style={{ width:"27%", flexShrink:0,
          background:`linear-gradient(175deg,${primary} 0%,${darken(primary,0.26)} 100%)`,
          display:"flex", flexDirection:"column", justifyContent:"space-between",
          padding:"28px 22px 20px", position:"relative", overflow:"hidden" }}>
          <div style={dotGridStyle(0.04, 20)} />
          <div style={{ position:"absolute", bottom:"-22%", left:"-22%", width:"90%",
            paddingBottom:"90%", borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />
          <div style={{ position:"relative", zIndex:2 }}>
            <div style={{ width:26, height:3, background:secondary, borderRadius:2, marginBottom:14 }} />
            <h3 style={{ fontSize:17, fontWeight:800, color:"#fff", margin:0, lineHeight:1.3,
              fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
            {slide.subtitle && (
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.48)", margin:"8px 0 0", lineHeight:1.55 }}>{slide.subtitle}</p>
            )}
          </div>
          {(slide.stats||[]).length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:6, position:"relative", zIndex:2 }}>
              {(slide.stats||[]).slice(0,3).map((s,si) => (
                <div key={si} style={{ background:"rgba(255,255,255,0.1)", borderRadius:8,
                  padding:"7px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.58)" }}>{s.label}</span>
                  <span style={{ fontSize:15, fontWeight:900, color:"#fff",
                    fontFamily:`'${fontH}', serif` }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize:50, fontWeight:900, color:"rgba(255,255,255,0.055)",
            lineHeight:1, fontFamily:`'${fontH}', serif`, position:"relative", zIndex:2 }}>
            {String(idx+1).padStart(2,"0")}
          </div>
        </div>
        {/* Right content */}
        <div style={{ flex:1, padding:"24px 28px 20px", display:"flex", flexDirection:"column" }}>
          <div style={{ height:3.5, background:`linear-gradient(90deg,${primary},${rgba(primary,0)})`,
            borderRadius:2, marginBottom:14 }} />
          {slide.content && (
            <p style={{ fontSize:12.5, color:"#475569", margin:"0 0 14px", lineHeight:1.72 }}>{slide.content}</p>
          )}
          {(slide.bullets||[]).length > 0 && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
              {(slide.bullets||[]).map((b,bi) => (
                <div key={bi} style={{ display:"flex", alignItems:"flex-start", gap:12,
                  padding:"8px 12px", borderRadius:10,
                  background: bi%2===0 ? rgba(primary,0.042) : "transparent",
                  border:`1px solid ${bi%2===0 ? rgba(primary,0.08) : "transparent"}` }}>
                  <div style={{ width:26, height:26, borderRadius:9, flexShrink:0,
                    background:accents[bi % accents.length],
                    boxShadow:`0 3px 8px ${rgba(accents[bi % accents.length],0.38)}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:"#fff" }}>
                    {bi+1}
                  </div>
                  <span style={{ fontSize:13, color:"#1e293b", lineHeight:1.55, fontWeight:500 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          {pg(false)}
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
          border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", borderRadius: 8, padding: "8px 14px", display: "inline-flex", alignItems: "center" }}><X size={16} /></button>
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
        <button onClick={() => setTab(tab === "history" ? "create" : "history")}
          style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid var(--border)`, cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === "history" ? "var(--primary)" : "var(--card)",
            color: tab === "history" ? "#fff" : "var(--foreground-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Folder size={12} />
            {tab === "history" ? "← Назад" : `История (${history.length})`}
          </span>
        </button>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--destructive) 9%, transparent)", color: "var(--destructive)", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
              <div style={{ marginBottom: 12, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}><ClipboardList size={40} /></div>
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
                          aria-label="Удалить"
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                          <Trash2 size={14} />
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{item.ok ? <Check size={11} /> : <X size={11} />} {item.label}</span>
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
                  <div style={{ marginBottom: 8, color: "var(--primary)", display: "flex", justifyContent: "center" }}><Palette size={32} /></div>
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
                  <div style={{ marginBottom: 8, color: "var(--primary)", display: "flex", justifyContent: "center" }}><Sparkles size={32} /></div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={12} /> КАСТОМНЫЙ ПРОМПТ (необязательно)</div>
                    <textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="Укажите тематику, акценты или пожелания по содержанию — например: «Сделай упор на кейсы клиентов и ROI», «Добавь слайд про конкурентов», «Аудитория — инвесторы»..."
                      rows={3}
                      style={{ width: "100%", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", padding: "10px 14px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  <button onClick={handleGenerate} disabled={!myCompany} style={{ alignSelf: "flex-start", padding: "14px 36px", borderRadius: 10, border: "none",
                    background: !myCompany ? "var(--muted-foreground)" : "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: !myCompany ? "default" : "pointer" }}>
                    Создать презентацию в стиле «{selectedStyle.name}»
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ━━━ STAGE 2: GENERATING ━━━ */}
      {stage === "generating" && (
        <div style={{ background: "var(--card)", borderRadius: 16, padding: 48, boxShadow: "var(--shadow)", textAlign: "center" }}>
          <div style={{ marginBottom: 16, color: "var(--primary)", display: "flex", justifyContent: "center" }}><Brain size={36} /></div>
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FileText size={12} /> {isExportingPdf ? "Экспорт..." : "PDF"}</span>
            </button>
            <button onClick={handleExportPptx} disabled={isExportingPptx} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPptx ? "var(--muted-foreground)" : "#10b981", color: "#fff", cursor: isExportingPptx ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPptx ? "Экспорт..." : "⬇ PPTX"}
            </button>
            <button onClick={handleExportSlidev} disabled={isExportingSlidev} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingSlidev ? "var(--muted-foreground)" : "#7c3aed", color: "#fff", cursor: isExportingSlidev ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={12} /> {isExportingSlidev ? "Экспорт..." : "Slidev .md"}</span>
            </button>
            <button onClick={() => { setStage("style"); setSlides([]); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid var(--border)`,
              background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={12} /> Заново</span>
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
                  СЛАЙД {i + 1} · {slide.type.toUpperCase()} {slide.isEdited && <span style={{ color: "var(--success)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}><Pencil size={10} /> изменён</span>}
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mic size={11} /> <b>Заметка:</b> {slide.note}</span>
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
  const pg = (light: boolean) => `<div style="position:absolute;bottom:16px;right:20px;font-size:10px;font-weight:700;letter-spacing:2px;color:${light ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.15)"}">${i+1} / ${total}</div>`;
  const base = `width:960px;height:540px;position:relative;overflow:hidden;box-sizing:border-box;font-family:'${fontB}',system-ui,sans-serif;`;

  // Color helpers
  const hexToRgb = (hex: string) => { const h=(hex||"#000").replace("#","").padEnd(6,"0"); return{r:parseInt(h.slice(0,2),16)||0,g:parseInt(h.slice(2,4),16)||0,b:parseInt(h.slice(4,6),16)||0}; };
  const rgba = (hex: string, a: number) => { const{r,g,b}=hexToRgb(hex); return`rgba(${r},${g},${b},${a})`; };
  const darken = (hex: string, amt: number) => { const{r,g,b}=hexToRgb(hex); return`#${[r,g,b].map(v=>Math.max(0,Math.round(v*(1-amt))).toString(16).padStart(2,"0")).join("")}`; };
  const dp = darken(primary, 0.32);
  const accents = [primary, secondary, "#f59e0b", "#10b981", "#e11d48", "#0ea5e9"];

  if (type === "cover" || type === "cta") {
    return `<div class="slide" style="${base}background:linear-gradient(135deg,${dp} 0%,${primary} 58%);display:flex;align-items:center;justify-content:flex-start;">
      <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px);background-size:24px 24px"></div>
      <div style="position:absolute;top:-35%;right:-8%;width:55%;padding-bottom:55%;border-radius:50%;background:${rgba(secondary,0.14)};filter:blur(60px)"></div>
      <div style="width:7px;height:100%;background:linear-gradient(180deg,${secondary},${rgba(secondary,0.2)});flex-shrink:0"></div>
      <div style="flex:1;padding:34px 48px 28px 32px;position:relative;z-index:2;display:flex;flex-direction:column;justify-content:space-between;height:100%;box-sizing:border-box">
        ${logoUrl ? `<img src="${logoUrl}" style="width:38px;height:38px;object-fit:contain;border-radius:9px;background:rgba(255,255,255,0.12);padding:4px">` : `<div style="display:flex;gap:6px"><div style="width:28px;height:3px;border-radius:2px;background:${secondary}"></div></div>`}
        <div>
          ${slide.subtitle ? `<div style="display:flex;align-items:center;gap:9px;margin-bottom:16px"><div style="width:24px;height:2px;background:${secondary};border-radius:2px"></div><span style="font-size:11px;font-weight:700;color:${secondary};letter-spacing:2.5px;text-transform:uppercase">${slide.subtitle}</span></div>` : ""}
          <h1 style="font-size:42px;font-weight:900;color:#fff;margin:0 0 16px;line-height:1.08;font-family:'${fontH}',Georgia,serif;letter-spacing:-0.5px;text-shadow:0 2px 24px rgba(0,0,0,0.25);max-width:520px">${slide.title}</h1>
          ${slide.content ? `<p style="font-size:13px;color:rgba(255,255,255,0.62);margin:0;line-height:1.7;max-width:430px">${slide.content}</p>` : ""}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.22);letter-spacing:1.5px">${new Date().getFullYear()}</div>
      </div>
      ${pg(true)}
    </div>`;
  }

  if (type === "stats") {
    const nums = (slide.stats||[]).map(s=>({ ...s, n: parseFloat(s.value.replace(/[^0-9.]/g,""))||0 }));
    const maxN = Math.max(...nums.map(s=>s.n),1);
    const cols = Math.min((slide.stats||[]).length||1,4);
    const statsHtml = (slide.stats||[]).map((s,si) => {
      const col = accents[si % accents.length];
      const pct = nums[si].n > 0 ? (nums[si].n/maxN)*100 : 100;
      return `<div style="flex:1;border-radius:14px;background:${rgba(col,0.05)};border:1px solid ${rgba(col,0.14)};padding:18px 14px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${col}"></div>
        <div style="font-size:54px;font-weight:900;color:${col};line-height:1;font-family:'${fontH}',Georgia,serif;letter-spacing:-2px">${s.value}</div>
        <div style="width:64%;height:3px;border-radius:2px;background:${rgba(col,0.15)}"><div style="height:100%;width:${pct}%;border-radius:2px;background:${col}"></div></div>
        <div style="font-size:11px;color:#64748b;text-align:center;line-height:1.4;max-width:120px">${s.label}</div>
      </div>`;
    }).join("");
    return `<div class="slide" style="${base}background:#ffffff;display:flex;flex-direction:column;">
      <div style="height:5px;background:linear-gradient(90deg,${primary},${secondary});flex-shrink:0"></div>
      <div style="padding:18px 36px 12px;display:flex;align-items:center;gap:14px;border-bottom:1px solid ${rgba(primary,0.08)}">
        <div style="width:3px;height:34px;border-radius:2px;background:${primary};flex-shrink:0"></div>
        <div>
          <h3 style="font-size:22px;font-weight:800;color:#0f172a;margin:0;font-family:'${fontH}',Georgia,serif">${slide.title}</h3>
          ${slide.subtitle ? `<p style="font-size:11px;color:#94a3b8;margin:3px 0 0">${slide.subtitle}</p>` : ""}
        </div>
      </div>
      <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;padding:14px 26px 18px">${statsHtml}</div>
      ${slide.content ? `<div style="padding:0 26px 14px;font-size:11px;color:#94a3b8;line-height:1.6">${slide.content}</div>` : ""}
      ${pg(false)}
    </div>`;
  }

  if (type === "quote") {
    return `<div class="slide" style="${base}background:linear-gradient(148deg,${dp} 0%,${darken(primary,0.14)} 100%);display:flex;align-items:center;">
      <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px);background-size:24px 24px"></div>
      <div style="position:absolute;top:6%;left:4%;font-size:200px;line-height:1;font-family:Georgia,serif;font-weight:900;color:rgba(255,255,255,0.05)">&ldquo;</div>
      <div style="position:relative;z-index:2;flex:1;padding:40px 68px 40px 56px;display:flex;flex-direction:column;gap:20px;justify-content:center">
        <div style="width:44px;height:3px;background:${secondary};border-radius:2px"></div>
        ${slide.quote ? `<p style="font-size:20px;font-style:italic;color:rgba(255,255,255,0.92);line-height:1.68;margin:0;font-family:'${fontH}',Georgia,serif">&ldquo;${slide.quote}&rdquo;</p>` : ""}
        ${slide.content ? `<p style="font-size:12px;color:rgba(255,255,255,0.42);margin:0;line-height:1.65">${slide.content}</p>` : ""}
        <div style="display:flex;align-items:center;gap:10px"><div style="width:28px;height:1px;background:${secondary};opacity:0.55"></div><span style="font-size:11px;font-weight:700;color:${secondary};letter-spacing:2.5px;text-transform:uppercase">${slide.title}</span></div>
      </div>
      ${pg(true)}
    </div>`;
  }

  // Bullets / two-column / grid / default
  const bulletsHtml = (slide.bullets||[]).map((b,bi) => {
    const col = accents[bi % accents.length];
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:8px 12px;border-radius:10px;background:${bi%2===0 ? rgba(primary,0.042) : "transparent"}">
      <div style="width:26px;height:26px;border-radius:9px;background:${col};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff">${bi+1}</div>
      <span style="font-size:13px;color:#1e293b;line-height:1.55;font-weight:500">${b}</span>
    </div>`;
  }).join("");

  return `<div class="slide" style="${base}background:#ffffff;display:flex;">
    <div style="width:27%;flex-shrink:0;background:linear-gradient(175deg,${primary} 0%,${dp} 100%);display:flex;flex-direction:column;justify-content:space-between;padding:28px 22px 20px;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px);background-size:20px 20px"></div>
      <div style="position:relative;z-index:2">
        <div style="width:26px;height:3px;background:${secondary};border-radius:2px;margin-bottom:14px"></div>
        <h3 style="font-size:17px;font-weight:800;color:#fff;margin:0;line-height:1.3;font-family:'${fontH}',Georgia,serif">${slide.title}</h3>
        ${slide.subtitle ? `<p style="font-size:10px;color:rgba(255,255,255,0.48);margin:8px 0 0;line-height:1.55">${slide.subtitle}</p>` : ""}
      </div>
      <div style="font-size:50px;font-weight:900;color:rgba(255,255,255,0.055);line-height:1;font-family:'${fontH}',serif;position:relative;z-index:2">${String(i+1).padStart(2,"0")}</div>
    </div>
    <div style="flex:1;padding:24px 28px 20px;display:flex;flex-direction:column">
      <div style="height:3px;background:linear-gradient(90deg,${primary},transparent);border-radius:2px;margin-bottom:14px"></div>
      ${slide.content ? `<p style="font-size:12px;color:#475569;margin:0 0 14px;line-height:1.72">${slide.content}</p>` : ""}
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">${bulletsHtml}</div>
    </div>
    ${pg(false)}
  </div>`;
}

// ============================================================
// Reviews Analysis View
// ============================================================

