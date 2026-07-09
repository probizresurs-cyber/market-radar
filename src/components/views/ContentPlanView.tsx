"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { SMMResult } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, BrandBook, AvatarSettings, ReferenceImage } from "@/lib/content-types";
import { hrefForNav } from "@/lib/products";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { BrandBookPanel } from "@/components/ui/BrandBookPanel";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";
import { AutoIdeasModal, type ContentIdea } from "@/components/ui/AutoIdeasModal";
import { Factory, Smartphone, Rocket } from "lucide-react";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

// ============================================================
// Content Factory views
// ============================================================

export function ContentEmptyView({ c, onRun, hasSmm }: { c: Colors; onRun: () => void; hasSmm: boolean }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Контент-завод</h1>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 28px" }}>Контент-план ещё не сгенерирован</p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
        <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}><Factory size={48} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>
          {hasSmm ? "Запустите контент-завод" : "Сначала проведите анализ СММ"}
        </div>
        <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
          {hasSmm
            ? "На основе вашего СММ-анализа мы создадим контент-план: 12 идей постов и 8 видео-рилсов. Дальше можно сгенерировать готовые посты с картинками и видео с аватарами HeyGen."
            : "Контент-завод работает на основе СММ-анализа — он определяет архетип бренда, тон голоса и боли аудитории, а уже потом строит контент-план."}
        </div>
        <button
          onClick={onRun}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b, #fb923c)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {hasSmm ? <><Rocket size={16}/> Сгенерировать план</> : <><Smartphone size={16}/> Перейти к анализу СММ</>}
          </span>
        </button>
      </div>
    </div>
  );
}

export function NewContentPlanView({ c, myCompany, smm, isGenerating, onGenerate }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  smm: SMMResult | null;
  isGenerating: boolean;
  onGenerate: (niche: string) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!smm) {
      setError("Сначала проведите анализ СММ — контент-завод работает на его основе");
      return;
    }
    setError(null);
    try {
      await onGenerate(niche.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Контент-завод</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        Сгенерируем контент-план на 30 дней: 12 идей постов и 8 видео-рилсов на основе вашего СММ-анализа. Каждую идею можно превратить в готовый пост с картинкой или видео с аватаром HeyGen.
      </p>

      {smm ? (
        <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ color: "var(--muted-foreground)", marginBottom: 4 }}>Используем СММ-анализ:</div>
          <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{smm.brandIdentity.archetype} · {smm.companyName}</div>
          <div style={{ color: "var(--foreground-secondary)", marginTop: 4 }}>{smm.brandIdentity.positioning}</div>
        </div>
      ) : (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", border: `1px solid var(--destructive)30`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "var(--destructive)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>⚠️ СММ-анализ не найден. Контент-завод работает на его основе.</span>
          <a
            href={hrefForNav("smm-new")}
            style={{
              padding: "7px 16px", borderRadius: 8, background: "var(--destructive)",
              color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Запустить СММ-анализ →
          </a>
        </div>
      )}

      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
          Уточнение по нише (опционально)
        </label>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Можно дополнить контекст: продукт, ЦА, особенности коммуникации"
          rows={3}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {error && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", border: `1px solid var(--destructive)30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "var(--destructive)", marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isGenerating || !smm}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isGenerating || !smm ? "var(--muted)" : "linear-gradient(135deg, #f59e0b, #fb923c)", color: isGenerating || !smm ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating || !smm ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
        {isGenerating ? "Запускаем завод… (60–90 сек)" : "Сгенерировать контент-план"}
      </button>
    </div>
  );
}

// ---------- Idea card helpers ----------

export function buildPostPrompt(idea: ContentPostIdea): string {
  return `Напиши пост для платформы ${idea.platform}.
Формат: ${idea.format}
Крючок (заголовок): ${idea.hook}
Угол подачи: ${idea.angle}
Контент-столп: ${idea.pillar}
Цель: ${idea.goal}
CTA: ${idea.cta}

Верни JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }`;
}

export function buildReelPrompt(idea: ContentReelIdea): string {
  return `Напиши сценарий рилса (${idea.durationSec} сек) по виральной структуре:
Крюк: ${idea.hook}
Интрига: ${idea.intrigue}
Проблема: ${idea.problem}
Решение: ${idea.solution}
Результат: ${idea.result}
CTA: ${idea.cta}
Визуал: ${idea.visualStyle}
Столп: ${idea.pillar}

Верни JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }`;
}

export function PostIdeaCard({ c, idea, isGenerating, generatingId, onGenerate }: {
  c: Colors;
  idea: ContentPostIdea;
  isGenerating: boolean;
  generatingId: string | null;
  onGenerate: (idea: ContentPostIdea, customPrompt?: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");
  const busy = isGenerating && generatingId === idea.id;

  const handleOpenPrompt = () => {
    if (!prompt) setPrompt(buildPostPrompt(idea));
    setShowPrompt(v => !v);
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`, padding: 14, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#f59e0b15", color: "#f59e0b", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase" }}>{idea.format}</span>
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{idea.platform}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.4, marginBottom: 6 }}>{idea.hook}</div>
      <p style={{ fontSize: 11, color: "var(--foreground-secondary)", lineHeight: 1.45, margin: "0 0 6px" }}>{idea.angle}</p>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}><b>Столп:</b> {idea.pillar} · <b>Цель:</b> {idea.goal}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 12 }}><b>CTA:</b> {idea.cta}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? "var(--muted)" : "linear-gradient(135deg, #f59e0b, #fb923c)", color: busy ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "⏳ Генерируем…" : "✨ Создать пост с картинкой"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid var(--border)`, background: showPrompt ? "#f59e0b12" : "transparent", color: "var(--foreground-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #f59e0b50`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>Промпт заменит стандартный при генерации. Ответ должен быть JSON.</div>
        </div>
      )}
    </div>
  );
}

export function ReelIdeaCard({ c, idea, isGenerating, generatingId, onGenerate }: {
  c: Colors;
  idea: ContentReelIdea;
  isGenerating: boolean;
  generatingId: string | null;
  onGenerate: (idea: ContentReelIdea, customPrompt?: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");
  const busy = isGenerating && generatingId === idea.id;

  const handleOpenPrompt = () => {
    if (!prompt) setPrompt(buildReelPrompt(idea));
    setShowPrompt(v => !v);
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`, padding: 14, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "3px 8px" }}>REEL · {idea.durationSec}s</span>
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{idea.pillar}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.4, marginBottom: 6 }}>🪝 {idea.hook}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}><b>Боль:</b> {idea.problem}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}><b>Решение:</b> {idea.solution}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 12 }}><b>Результат:</b> {idea.result}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "Пишем сценарий…" : "Создать сценарий рилса"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid var(--border)`, background: showPrompt ? "#ec489912" : "transparent", color: "var(--foreground-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #ec489950`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>Промпт заменит стандартный. Ответ должен быть JSON.</div>
        </div>
      )}
    </div>
  );
}

// ---------- ContentGeneratorBlock ----------

export function ContentGeneratorBlock({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, brandBook, lockedMode, myCompany, taResult, smmAnalysis }: {
  c: Colors;
  /** План контента. Если null/undefined — блок работает в режиме «с нуля»
   *  (юзер пишет бриф сам, идеи из плана не показываются). Это позволяет
   *  генерировать посты сразу после основного анализа компании, не дожидаясь
   *  пока юзер запустит «План контента» как отдельный шаг. */
  plan?: ContentPlan | null;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (
    idea: ContentPostIdea,
    customPrompt?: string,
    imageOpts?: {
      imagePromptOverride?: string;
      imageStyle?: string;
      imageWithTextOverlay?: boolean;
      imageOverlayText?: string;
    },
  ) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  brandBook: BrandBook;
  /** Когда задан — переключатель Post/Reel скрыт, используется только этот режим.
   *  Нужно когда блок встраивается в специализированный таб (Создать пост / Создать видео). */
  lockedMode?: "post" | "reel";
  /** Контекст для AutoIdeasModal — может быть undefined если блок встроен
   *  на месте где этих данных нет. В таком случае модалку не показываем. */
  myCompany?: AnalysisResult | null;
  taResult?: import("@/lib/ta-types").TAResult | null;
  smmAnalysis?: SMMResult | null;
}) {
  const [mode, setMode] = useState<"post" | "reel">(lockedMode ?? "post");
  // Если плана нет — сразу включаем scratch-mode (юзер пишет бриф вручную,
  // выбирать идеи неоткуда).
  const [scratchMode, setScratchMode] = useState(!plan);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  // Платформа публикации — нужна и для постов (раньше определялась через idea.platform).
  // Это позволяет создавать пост сразу с нуля под VK/TG/Insta без плана контента.
  const [postPlatform, setPostPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  // brief = plain-language instructions from user; prompt = AI-generated full prompt (optional advanced view)
  const [brief, setBrief] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  // ── Раздельные настройки для картинки (опционально, схлопнутая секция) ──
  // showImageBlock — раскрытие секции «Параметры картинки»
  // Остальные — поля передаваемые в API.
  const [showImageBlock, setShowImageBlock] = useState(false);
  const [imageStyle, setImageStyle] = useState<string>("");                  // "" = авто
  const [imagePromptOverride, setImagePromptOverride] = useState<string>("");
  const [imageWithTextOverlay, setImageWithTextOverlay] = useState(false);
  const [imageOverlayText, setImageOverlayText] = useState<string>("");

  const selectedPost = plan?.postIdeas.find(p => p.id === selectedPostId);
  const selectedReel = plan?.reelIdeas.find(r => r.id === selectedReelId);

  const selectPost = (idea: ContentPostIdea) => {
    setScratchMode(false);
    if (selectedPostId === idea.id) { setSelectedPostId(null); setBrief(""); setGeneratedPrompt(""); return; }
    setSelectedPostId(idea.id);
    setBrief("");
    setGeneratedPrompt("");
  };

  const selectReel = (idea: ContentReelIdea) => {
    setScratchMode(false);
    if (selectedReelId === idea.id) { setSelectedReelId(null); setBrief(""); setGeneratedPrompt(""); return; }
    setSelectedReelId(idea.id);
    setBrief("");
    setGeneratedPrompt("");
  };

  const openScratch = () => {
    setScratchMode(true);
    setSelectedPostId(null);
    setSelectedReelId(null);
    setGeneratedPrompt("");
  };

  // Build the topic string for expand-prompt: use idea hook OR brief OR empty (AI will use company context)
  const getExpandTopic = () => {
    if (scratchMode) return brief;
    if (mode === "post") return brief || (selectedPost ? `${selectedPost.hook} — ${selectedPost.angle}` : "");
    return brief || (selectedReel ? selectedReel.hook : "");
  };

  const handleExpandPrompt = async () => {
    setIsExpandingPrompt(true);
    setExpandError(null);
    try {
      // ВАЖНО: companyName всегда берём из текущего myCompany, не из plan.
      // Plan может быть устаревший — для другой компании. Если использовать
      // plan.companyName — image-prompt сгенерирует контент для не той ниши
      // (юзер видела «dentist clinic» для строительной компании).
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: getExpandTopic(),
          type: mode,
          companyName: myCompany?.company.name ?? plan?.companyName ?? "",
          companyUrl: myCompany?.company.url ?? "",
          companyDescription: myCompany?.company.description ?? "",
          bigIdea: plan?.bigIdea ?? "",
          pillars: plan?.pillars ?? [],
          brandBook,
        }),
      });
      const json = await jsonOrThrow<{ ok: boolean; prompt?: string; error?: string }>(res);
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setGeneratedPrompt(json.prompt ?? "");
      setShowAdvanced(true);
    } catch (e) {
      setExpandError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setIsExpandingPrompt(false);
    }
  };

  const handleGenerate = () => {
    // customPrompt: use AI-generated prompt if available (and visible), otherwise use brief as extra instruction
    const customPrompt = showAdvanced && generatedPrompt ? generatedPrompt : undefined;
    if (mode === "post") {
      const idea: ContentPostIdea = selectedPost ?? {
        id: `scratch-${Date.now()}`, pillar: "С нуля", format: "single",
        hook: brief || "Новый пост", angle: brief, goal: "охват", cta: "", platform: postPlatform,
      };
      // Собираем imageOpts — передаём только то что юзер реально задал.
      const hasImageOpts = imageStyle || imagePromptOverride.trim() || imageWithTextOverlay;
      const imageOpts = hasImageOpts
        ? {
            imageStyle: imageStyle || undefined,
            imagePromptOverride: imagePromptOverride.trim() || undefined,
            imageWithTextOverlay: imageWithTextOverlay || undefined,
            imageOverlayText: imageOverlayText.trim() || undefined,
          }
        : undefined;
      onGeneratePost(idea, customPrompt, imageOpts);
    } else {
      const idea: ContentReelIdea = selectedReel ?? {
        id: `scratch-${Date.now()}`, pillar: "С нуля", hook: brief || "Новый рилс",
        intrigue: "", problem: "", solution: "", result: "", cta: "", durationSec: 30, visualStyle: "", hashtags: [],
      };
      onGenerateReel(idea, customPrompt);
    }
  };

  const isGenerating = mode === "post" ? isGeneratingPost : isGeneratingReel;
  const busyId = mode === "post" ? generatingPostId : generatingReelId;
  const selectedId = mode === "post" ? selectedPostId : selectedReelId;
  const busy = isGenerating && (busyId === selectedId || (scratchMode && (busyId?.startsWith("scratch") ?? false)));
  const accent = mode === "post" ? "#f59e0b" : "#ec4899";

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow-lg)", marginBottom: 24, overflow: "hidden" }}>
      {/* Header + mode tabs (tabs hidden when lockedMode forces a single mode) */}
      <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid var(--muted)`, background: `linear-gradient(135deg, var(--card) 50%, ${accent}06 100%)` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", marginBottom: lockedMode ? 0 : 12 }}>
          ✨ {lockedMode === "post" ? "Создать пост" : lockedMode === "reel" ? "Создать видео" : "Создать контент"}
        </div>
        {!lockedMode && (
          <div style={{ display: "flex", gap: 8 }}>
            {([["post", "Пост"], ["reel", "Рилс"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSelectedPostId(null); setSelectedReelId(null); setScratchMode(false); setBrief(""); setGeneratedPrompt(""); setShowAdvanced(false); }}
                style={{ padding: "7px 18px", borderRadius: 9, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                  background: mode === m ? (m === "reel" ? "#ec4899" : "#f59e0b") : "var(--background)",
                  color: mode === m ? "#fff" : "var(--foreground-secondary)",
                  boxShadow: mode === m ? `0 2px 8px ${m === "reel" ? "#ec489940" : "#f59e0b40"}` : "none",
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* Платформа публикации — только для постов. Раньше platform жёстко
            прописывалась "vk" в idea при scratch-режиме, теперь юзер выбирает
            (как в каруселях и сторис). Влияет на длину текста и стиль AI. */}
        {mode === "post" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>
              ПЛАТФОРМА ПУБЛИКАЦИИ
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([
                ["instagram", "📸 Instagram"],
                ["vk", "🔵 ВКонтакте"],
                ["telegram", "✈️ Telegram"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setPostPlatform(val)}
                  style={{
                    padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: postPlatform === val ? accent : "var(--background)",
                    color: postPlatform === val ? "#fff" : "var(--foreground-secondary)",
                    border: postPlatform === val ? `1px solid ${accent}` : "1px solid var(--border)",
                    transition: "all 0.12s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Idea chips — показываем только если есть план контента. Без плана
            юзер сразу пишет бриф с нуля (scratchMode выставлен по умолчанию). */}
        {plan && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>
              {mode === "post" ? "ВЫБЕРИТЕ ИДЕЮ ИЗ ПЛАНА" : "ВЫБЕРИТЕ ИДЕЮ РИЛСА"}
              <span style={{ fontWeight: 400, marginLeft: 6 }}>— или создайте с нуля</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {mode === "post"
                ? plan.postIdeas
                    // Для постов (single/longread) — отсекаем форматы caro/story,
                    // у них свои отдельные табы.
                    .filter(idea => idea.format !== "carousel" && idea.format !== "story")
                    .map(idea => {
                    const sel = selectedPostId === idea.id;
                    return (
                      <button key={idea.id} onClick={() => selectPost(idea)}
                        style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : "var(--border)"}`,
                          background: sel ? accent + "18" : "var(--background)", color: sel ? accent : "var(--foreground-secondary)",
                          fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                          maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                        }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : "var(--muted-foreground)", marginBottom: 2, textTransform: "uppercase" }}>{idea.format}</div>
                        {idea.hook}
                      </button>
                    );
                  })
                : plan.reelIdeas.map(idea => {
                    const sel = selectedReelId === idea.id;
                    return (
                      <button key={idea.id} onClick={() => selectReel(idea)}
                        style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : "var(--border)"}`,
                          background: sel ? accent + "18" : "var(--background)", color: sel ? accent : "var(--foreground-secondary)",
                          fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                          maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                        }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : "var(--muted-foreground)", marginBottom: 2 }}>{idea.durationSec}с · {idea.pillar}</div>
                        🪝 {idea.hook}
                      </button>
                    );
                  })
              }
              <button onClick={openScratch}
                style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px dashed ${scratchMode ? accent : "var(--border)"}`,
                  background: scratchMode ? accent + "12" : "transparent", color: scratchMode ? accent : "var(--muted-foreground)",
                  fontSize: 11, fontWeight: scratchMode ? 700 : 500, cursor: "pointer", transition: "all 0.12s",
                }}>
                ✍️ С нуля
              </button>
            </div>
          </div>
        )}

        {/* Hint when no plan exists — show that creating a content plan unlocks
            idea chips, but generation still works without one. */}
        {!plan && (
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 10,
            background: `${accent}08`, border: `1px dashed ${accent}30`,
            fontSize: 11.5, color: "var(--foreground-secondary)", lineHeight: 1.55,
          }}>
            💡 Создаёте контент с нуля по вашему брифу. Запустите «План контента», чтобы получить готовые идеи под вашу нишу.
          </div>
        )}

        {/* Selected idea details */}
        {!scratchMode && (selectedPost || selectedReel) && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: accent + "0a", borderRadius: 10, border: `1px solid ${accent}20`, fontSize: 11, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
            {selectedPost && <><b style={{ color: accent }}>Угол:</b> {selectedPost.angle} · <b style={{ color: accent }}>Цель:</b> {selectedPost.goal} · <b style={{ color: accent }}>CTA:</b> {selectedPost.cta}</>}
            {selectedReel && <><b style={{ color: accent }}>Боль:</b> {selectedReel.problem} · <b style={{ color: accent }}>Решение:</b> {selectedReel.solution} · <b style={{ color: accent }}>CTA:</b> {selectedReel.cta}</>}
          </div>
        )}

        {/* Brief / instructions field */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
              БРИФ / УТОЧНЕНИЕ
              <span style={{ fontWeight: 400, marginLeft: 6 }}>— необязательно, можно оставить пустым</span>
            </label>
            {/* AI-идеи доступны если у нас есть хотя бы myCompany — без неё
               модалка не сможет построить контекст. Прячем кнопку молча,
               чтобы юзер не разочаровался «нажал — ничего». */}
            {myCompany && (
              <AutoIdeasModal
                format={mode === "post" ? "post" : "reel"}
                myCompany={myCompany}
                taResult={taResult ?? null}
                smmResult={smmAnalysis ?? null}
                brandBook={brandBook}
                accentColor={accent}
                onSelectIdea={(idea: ContentIdea) => {
                  // Подставляем идею в бриф (хук + ангуляция). Юзер может
                  // дальше отредактировать или нажать «Подготовить промпт».
                  setBrief(`${idea.hook}\n\n${idea.summary || idea.angle}`);
                  // Если идея с pillar — переключаемся в scratch (нет привязки к idea.id).
                  setScratchMode(true);
                  setSelectedPostId(null);
                  setSelectedReelId(null);
                  setGeneratedPrompt("");
                }}
              />
            )}
          </div>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={scratchMode
              ? `Например: «напиши ${mode === "post" ? "пост" : "рилс"} о плюсах нашего бизнеса» или «сделай акцент на надёжности и немецком качестве»`
              : `Дополнительные пожелания. Например: «сделай акцент на скорости доставки» или «добавь кейс из практики»`}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid var(--border)`,
              background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", resize: "vertical",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
          />
        </div>

        {/* AI assistant row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleExpandPrompt}
            disabled={isExpandingPrompt}
            style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${accent}50`, background: accent + "0c",
              color: accent, fontSize: 12, fontWeight: 700, cursor: isExpandingPrompt ? "not-allowed" : "pointer",
              opacity: isExpandingPrompt ? 0.6 : 1, transition: "all 0.15s",
            }}>
            {isExpandingPrompt ? "Готовлю промпт…" : "Подготовить промпт"}
          </button>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1 }}>
            {isExpandingPrompt ? "Анализирую компанию и тему…" : "Использует данные компании, чтобы подготовить готовый промпт под акцент"}
          </div>
          {expandError && <span style={{ fontSize: 11, color: "var(--destructive)" }}>{expandError}</span>}
        </div>

        {/* AI-generated prompt (advanced / editable) */}
        {showAdvanced && generatedPrompt && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
                ПРОМПТ-ЗАГОТОВКА
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно отредактировать перед запуском</span>
              </label>
              <button onClick={() => { setShowAdvanced(false); setGeneratedPrompt(""); }}
                style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕ скрыть</button>
            </div>
            <textarea
              value={generatedPrompt}
              onChange={e => setGeneratedPrompt(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${accent}40`,
                background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.6, boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
              Этот промпт пойдёт в работу. Если оставить поле пустым — будет написано по идее и данным компании автоматически.
            </div>
          </div>
        )}

        {/* Параметры картинки — раскрывающийся блок (только для постов).
            Юзер может задать стиль, отдельный image-prompt и текст-оверлей. */}
        {mode === "post" && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setShowImageBlock(v => !v)}
              style={{
                width: "100%", textAlign: "left", padding: "11px 14px",
                background: "var(--background)", border: `1px dashed ${accent}50`,
                borderRadius: 10, cursor: "pointer", color: "var(--foreground)",
                fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span>🎨 Параметры картинки {(imageStyle || imagePromptOverride.trim() || imageWithTextOverlay) && <span style={{ color: accent, marginLeft: 6 }}>· настроено</span>}</span>
              <span>{showImageBlock ? "▲" : "▼"}</span>
            </button>
            {showImageBlock && (
              <div style={{
                marginTop: 10, padding: 14, borderRadius: 10,
                background: `${accent}06`, border: `1px solid ${accent}25`,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {/* Стиль */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>
                    СТИЛЬ КАРТИНКИ
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {([
                      ["", "🤖 Авто"],
                      ["photo", "📷 Фото"],
                      ["illustration", "🎨 Иллюстрация"],
                      ["minimalist", "⬜ Минимализм"],
                      ["3d", "🧊 3D"],
                      ["anime", "🌸 Аниме"],
                      ["sketch", "✏️ Скетч"],
                      ["watercolor", "🖌 Акварель"],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setImageStyle(val)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          background: imageStyle === val ? accent : "var(--card)",
                          color: imageStyle === val ? "#fff" : "var(--foreground)",
                          border: imageStyle === val ? `1px solid ${accent}` : "1px solid var(--border)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Кастомный image-prompt */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>
                    СВОЙ ПРОМПТ ДЛЯ КАРТИНКИ (на английском, опц)
                  </label>
                  <textarea
                    rows={3}
                    value={imagePromptOverride}
                    onChange={e => setImagePromptOverride(e.target.value)}
                    placeholder="A dentist clinic with modern equipment, soft natural lighting, professional photography..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8,
                      background: "var(--background)", border: "1px solid var(--border)",
                      color: "var(--foreground)", fontSize: 12, fontFamily: "ui-monospace, monospace",
                      outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Если пусто — DALL-E получит промпт от GPT-4o, который описывает картинку под текст поста.
                  </div>
                </div>

                {/* Текст-оверлей */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={imageWithTextOverlay}
                      onChange={e => setImageWithTextOverlay(e.target.checked)}
                    />
                    Встроенный текст на картинке (заголовок / ключевая фраза)
                  </label>
                  {imageWithTextOverlay && (
                    <input
                      type="text"
                      value={imageOverlayText}
                      onChange={e => setImageOverlayText(e.target.value)}
                      placeholder="Если пусто — возьмём хук из поста"
                      maxLength={60}
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, marginTop: 8,
                        background: "var(--background)", border: "1px solid var(--border)",
                        color: "var(--foreground)", fontSize: 12, outline: "none", boxSizing: "border-box",
                      }}
                    />
                  )}
                  {imageWithTextOverlay && (
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                      DALL-E будет инструктирован сделать этот текст крупно по центру картинки. Длина до 60 символов — иначе плохо читается.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14, cursor: isGenerating ? "not-allowed" : "pointer", transition: "all 0.15s",
            background: isGenerating ? "var(--muted)" : (mode === "reel" ? "linear-gradient(135deg, #ec4899, #f472b6)" : "linear-gradient(135deg, #f59e0b, #fb923c)"),
            color: isGenerating ? "var(--muted-foreground)" : "#fff",
            boxShadow: isGenerating ? "none" : `0 4px 16px ${accent}50`,
          }}>
          {isGenerating
            ? (busy ? "⏳ Генерируем…" : "⏳ Ожидание…")
            : mode === "reel" ? "Создать сценарий рилса" : "Создать пост с картинкой"}
        </button>
        {isGenerating && !busy && (
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 6 }}>Дождитесь окончания текущей генерации</div>
        )}
      </div>
    </div>
  );
}

// CalendarDayPanel удалён — раньше использовался для 30-дневного календаря
// внутри ContentPlanView. Календарь переехал в отдельный таб ContentCalendarView
// со своим drag-and-drop, поэтому панель никем не импортируется.

// ---------- ContentPlanView ----------

export function ContentPlanView({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, avatarSettings, onUpdateAvatarSettings, referenceImages, onUpdateReferenceImages, brandBook, onUpdateBrandBook, currentCompanyName, onRegenerateForCurrentCompany }: {
  c: Colors;
  plan: ContentPlan;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (
    idea: ContentPostIdea,
    customPrompt?: string,
    imageOpts?: {
      imagePromptOverride?: string;
      imageStyle?: string;
      imageWithTextOverlay?: boolean;
      imageOverlayText?: string;
    },
  ) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook: BrandBook;
  onUpdateBrandBook: (next: BrandBook) => void;
  /** Текущая компания из последнего анализа — нужна чтобы показать warning
   *  если план был для другой компании. */
  currentCompanyName?: string;
  onRegenerateForCurrentCompany?: () => void;
}) {
  const stalePlan = currentCompanyName && plan.companyName && plan.companyName !== currentCompanyName;
  const generatedDate = new Date(plan.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 16, boxShadow: "var(--shadow)", ...style }}>{children}</div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px", color: "var(--foreground)", letterSpacing: -0.5 }}>Контент-завод — {plan.companyName}</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{generatedDate} · {plan.postIdeas.length} постов · {plan.reelIdeas.length} рилсов</p>
      </div>

      {/* Warning если план был для другой компании — например, юзер сделал
          новый анализ для другого бизнеса, а старый план остался в кэше */}
      {stalePlan && (
        <div style={{
          background: "color-mix(in oklch, var(--warning, #f59e0b) 10%, transparent)",
          border: "1px solid color-mix(in oklch, var(--warning, #f59e0b) 35%, var(--border))",
          borderLeft: "4px solid #f59e0b",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
              План для другой компании
            </div>
            <div style={{ fontSize: 13.5, color: "var(--foreground)", lineHeight: 1.55 }}>
              Этот контент-план был сгенерирован для <b>«{plan.companyName}»</b>. Сейчас вы анализируете <b>«{currentCompanyName}»</b>. Создайте новый план под актуальную компанию, чтобы тема и тон совпадали.
            </div>
          </div>
          {onRegenerateForCurrentCompany && (
            <button
              onClick={onRegenerateForCurrentCompany}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: "#f59e0b", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap",
                boxShadow: "0 2px 10px rgba(245,158,11,0.35)",
              }}
            >
              Создать план для «{currentCompanyName}»
            </button>
          )}
        </div>
      )}

      {/* Big Idea + pillars */}
      <CollapsibleSection c={c} title="Большая идея и контент-столпы">
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, var(--card) 60%, #f59e0b08 100%)` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>БОЛЬШАЯ ИДЕЯ</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.5, margin: 0 }}>{plan.bigIdea}</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {plan.pillars?.map((p, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{p.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{p.share}</div>
              </div>
              <p style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5, margin: 0 }}>{p.description}</p>
            </Card>
          ))}
        </div>
      </CollapsibleSection>

      {/* Brand Book */}
      <BrandBookPanel c={c} brandBook={brandBook} onChange={onUpdateBrandBook} />

      {/* Reference images panel */}
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />

      {/* Avatar settings (affects reel scenarios + video generation) */}
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />

      {/* Post ideas — только posts/longread, сторис и карусели исключаем
          (для них есть отдельные табы «Сторис-сценарии» и «Карусель-посты»). */}
      {(() => {
        const postOnlyIdeas = plan.postIdeas.filter(i => i.format !== "carousel" && i.format !== "story");
        return (
          <CollapsibleSection c={c} title={`Идеи постов (${postOnlyIdeas.length})`} defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
              {postOnlyIdeas.map(idea => (
                <PostIdeaCard key={idea.id} c={c} idea={idea}
                  isGenerating={isGeneratingPost} generatingId={generatingPostId}
                  onGenerate={onGeneratePost}
                />
              ))}
            </div>
          </CollapsibleSection>
        );
      })()}

      {/* Reel ideas */}
      <CollapsibleSection c={c} title={`Идеи видео-рилсов (${plan.reelIdeas.length})`} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {plan.reelIdeas.map(idea => (
            <ReelIdeaCard key={idea.id} c={c} idea={idea}
              isGenerating={isGeneratingReel} generatingId={generatingReelId}
              onGenerate={onGenerateReel}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* 30-day календарь убран — переехал в отдельный таб «Календарь публикаций»
          (там drag-and-drop, реальный месячный grid, scheduledFor-поля). */}
      {plan.weeklyRhythm && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>
            РИТМ ПУБЛИКАЦИЙ
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
            {plan.weeklyRhythm}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>
            Готовые посты можно перетянуть на конкретные даты во вкладке «Календарь публикаций».
          </div>
        </Card>
      )}
    </div>
  );
}
