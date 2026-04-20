"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { BrandBook, PresentationStyle } from "@/lib/content-types";

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

export function LandingGeneratorView({ c, myCompany, taAnalysis, smmAnalysis, brandBook, userId }: {
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

  const primary = brandBook.colors?.[0] || "var(--primary)";

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Генератор лендингов</h1>
          <p style={{ color: "var(--foreground-secondary)", fontSize: 14 }}>AI-генерация профессиональных лендингов на основе анализа компании, ЦА и брендбука</p>
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--card)", borderRadius: 10, padding: 3, border: `1px solid var(--border)` }}>
          {(["create", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: tab === t ? "var(--primary)" : "transparent",
                color: tab === t ? "#fff" : "var(--foreground-secondary)" }}>
              {t === "create" ? "✦ Создать" : `📁 История (${landingHistory.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--destructive) 9%, transparent)", color: "var(--destructive)", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {landingHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 6 }}>Нет сохранённых лендингов</p>
              <p style={{ fontSize: 13 }}>Создайте первый — он автоматически сохранится</p>
              <button onClick={() => setTab("create")} style={{ marginTop: 16, padding: "9px 22px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Создать лендинг</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {landingHistory.map(h => {
                const typeIcon = landingTypes.find(l => l.id === h.landingType)?.icon ?? "🌐";
                const presetLabel = STYLE_PRESETS.find(p => p.id === h.stylePreset)?.label ?? h.stylePreset;
                return (
                  <div key={h.id} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    {/* Screenshot */}
                    <div style={{ position: "relative", background: "var(--background)" }}>
                      {/* Browser chrome */}
                      <div style={{ background: "var(--card)", padding: "6px 10px", borderBottom: `1px solid var(--border)`, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                        </div>
                        <div style={{ flex: 1, background: "var(--background)", borderRadius: 4, padding: "2px 8px", fontSize: 9, color: "var(--muted-foreground)" }}>
                          {myCompany?.company.name?.toLowerCase().replace(/\s+/g, "") ?? "landing"}.ru
                        </div>
                      </div>
                      <img src={h.imageUrl} alt={h.title} style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>{h.title}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", fontWeight: 600 }}>{typeIcon} {landingTypes.find(l => l.id === h.landingType)?.label ?? h.landingType}</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--background)", color: "var(--muted-foreground)" }}>{presetLabel}</span>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{new Date(h.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadLanding(h)}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          Открыть
                        </button>
                        <a href={h.htmlUrl} target="_blank" rel="noopener noreferrer"
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}>
                          ⬇
                        </a>
                        <button onClick={() => deleteLanding(h.id)}
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

      {/* ── Data readiness badges ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "Компания", ok: !!myCompany },
          { label: "Брендбук", ok: !!brandBook.brandName || brandBook.colors.length > 0 },
          { label: "ЦА", ok: !!taAnalysis },
          { label: "СММ", ok: !!smmAnalysis },
        ].map((b, i) => (
          <span key={i} style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: b.ok ? "color-mix(in oklch, var(--success) 9%, transparent)" : "color-mix(in oklch, var(--destructive) 7%, transparent)",
            color: b.ok ? "var(--success)" : "var(--muted-foreground)" }}>
            {b.ok ? "✓" : "✗"} {b.label}
          </span>
        ))}
      </div>

      {/* ── Setup form ── */}
      {!result && !isGenerating && (
        <>
          {/* 1. Landing type */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>1. Тип лендинга</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 24 }}>
            {landingTypes.map(lt => (
              <div key={lt.id} onClick={() => setLandingType(lt.id)}
                style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  background: landingType === lt.id ? primary + "12" : "var(--card)",
                  border: `2px solid ${landingType === lt.id ? primary : "var(--border)"}`,
                  boxShadow: landingType === lt.id ? `0 4px 14px ${primary}20` : "none" }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{lt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>{lt.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{lt.desc}</div>
              </div>
            ))}
          </div>

          {/* 2. Style preset */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>2. Стиль и цветовая гамма</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: stylePreset === "custom" ? 12 : 20 }}>
            {STYLE_PRESETS.map(sp => {
              const hasColors = "colors" in sp;
              return (
                <div key={sp.id} onClick={() => setStylePreset(sp.id)}
                  style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    background: stylePreset === sp.id ? primary + "12" : "var(--card)",
                    border: `2px solid ${stylePreset === sp.id ? primary : "var(--border)"}` }}>
                  {/* Color dots preview */}
                  {hasColors && (
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      {(sp as unknown as { colors: string[] }).colors.map((col, ci) => (
                        <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: col, border: "1px solid rgba(0,0,0,0.1)" }} />
                      ))}
                    </div>
                  )}
                  {!hasColors && <div style={{ fontSize: 16, marginBottom: 4 }}>{sp.icon}</div>}
                  <div style={{ fontSize: 12, fontWeight: 700, color: stylePreset === sp.id ? primary : "var(--foreground)", marginBottom: 2 }}>{sp.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.4 }}>{sp.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Custom colors input */}
          {stylePreset === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)", display: "block", marginBottom: 4 }}>
                  Цвета (через запятую)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input value={customColors} onChange={e => setCustomColors(e.target.value)}
                    placeholder="#6366f1, #fff, #1a1a2e"
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", fontSize: 12, outline: "none" }} />
                  {/* Live color dot previews */}
                  <div style={{ display: "flex", gap: 3 }}>
                    {customColors.split(",").map(s => s.trim()).filter(Boolean).slice(0, 5).map((col, i) => (
                      <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: col, border: `1px solid var(--border)` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)", display: "block", marginBottom: 4 }}>
                  Шрифт (Google Fonts)
                </label>
                <input value={customFonts} onChange={e => setCustomFonts(e.target.value)}
                  placeholder="Montserrat, Playfair Display..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}

          {/* 3. Custom prompt */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>
            3. Дополнительные пожелания <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-foreground)" }}>(необязательно)</span>
          </h3>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} rows={3}
              placeholder="Например: Добавь секцию с видео-отзывами. Используй стиль как у Apple — минималистично и продающе. Сделай большой hero с градиентным фоном. Добавь счётчик с цифрами достижений..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid var(--border)`,
                background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none",
                resize: "vertical", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
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
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: col, border: `1px solid var(--border)` }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Цвета из брендбука</span>
              </div>
            )}
          </div>
          {!myCompany && <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}>Сначала выполните анализ компании</p>}
        </>
      )}

      {/* ── Generation progress ── */}
      {isGenerating && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 300, height: 6, borderRadius: 3, background: "var(--border)", margin: "0 auto 16px", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${primary}, var(--success))`, transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{Math.round(progress)}% — Генерация лендинга...</p>
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
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)",
                textDecoration: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              ⬇ Скачать HTML
            </a>
            <button onClick={handleVariants} disabled={isEditing}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)",
                color: "var(--foreground)", cursor: isEditing ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              🎨 Варианты
            </button>
            <button onClick={handleMobile} disabled={isEditing}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)",
                color: "var(--foreground)", cursor: isEditing ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              📱 Мобильная версия
            </button>
            <button onClick={() => { setResult(null); setVariants([]); setProgress(0); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)",
                color: "var(--foreground)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              🔄 Заново
            </button>
          </div>

          {/* Edit prompt */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
              placeholder="Пожелание: сделай хедер темнее, добавь секцию с отзывами..."
              onKeyDown={e => e.key === "Enter" && handleEdit()}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid var(--border)`,
                background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
            <button onClick={handleEdit} disabled={isEditing || !editPrompt.trim()}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: primary,
                color: "#fff", cursor: isEditing || !editPrompt.trim() ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 13, opacity: isEditing || !editPrompt.trim() ? 0.5 : 1 }}>
              {isEditing ? "Обновляю..." : "Изменить"}
            </button>
          </div>

          {/* Preview — screenshot thumbnail with zoom + click-to-open */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid var(--border)`, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", marginBottom: 20 }}>
            {/* Browser chrome bar */}
            <div style={{ background: "var(--card)", padding: "8px 12px", borderBottom: `1px solid var(--border)`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
              </div>
              <div style={{ flex: 1, background: "var(--background)", borderRadius: 5, padding: "3px 10px", fontSize: 11, color: "var(--muted-foreground)" }}>
                {myCompany?.company.name || "landing"}.marketradar.ai
              </div>
              {/* Zoom controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button onClick={() => setImgZoom(z => Math.max(0.3, z - 0.2))} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", minWidth: 36, textAlign: "center" }}>{Math.round(imgZoom * 100)}%</span>
                <button onClick={() => setImgZoom(z => Math.min(3, z + 0.2))} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <button onClick={() => setImgZoom(1)} title="Сбросить" style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 11 }}>↺</button>
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
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>
                Варианты ({variants.length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {variants.map((v, vi) => (
                  <div key={vi} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid var(--border)`, cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => setResult(prev => prev ? { ...prev, screenId: v.screenId, htmlUrl: v.htmlUrl, imageUrl: v.imageUrl, htmlContent: v.htmlContent ?? prev?.htmlContent } : null)}>
                    <img src={v.imageUrl} alt={`Variant ${vi + 1}`} style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "contain", background: "#f8f8f8" }} />
                    <div style={{ padding: "8px 12px", background: "var(--card)", fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

