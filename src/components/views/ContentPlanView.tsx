"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { SMMResult } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, BrandBook, AvatarSettings, ReferenceImage } from "@/lib/content-types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ImageReferencePanel } from "@/components/ui/ImageReferencePanel";
import { BrandBookPanel } from "@/components/ui/BrandBookPanel";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";

// ============================================================
// Content Factory views
// ============================================================

export function ContentEmptyView({ c, onRun, hasSmm }: { c: Colors; onRun: () => void; hasSmm: boolean }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Контент-завод</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 28px" }}>Контент-план ещё не сгенерирован</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>
          {hasSmm ? "Запустите контент-завод" : "Сначала проведите анализ СММ"}
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
          {hasSmm
            ? "На основе вашего СММ-анализа мы создадим контент-план: 12 идей постов и 8 видео-рилсов. Дальше можно сгенерировать готовые посты с картинками и видео с аватарами HeyGen."
            : "Контент-завод работает на основе СММ-анализа — он определяет архетип бренда, тон голоса и боли аудитории, а уже потом строит контент-план."}
        </div>
        <button
          onClick={onRun}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b, #fb923c)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
          {hasSmm ? "🏭 Сгенерировать план" : "📱 Перейти к анализу СММ"}
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
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Контент-завод</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        Сгенерируем контент-план на 30 дней: 12 идей постов и 8 видео-рилсов на основе вашего СММ-анализа. Каждую идею можно превратить в готовый пост с картинкой или видео с аватаром HeyGen.
      </p>

      {smm ? (
        <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ color: c.textMuted, marginBottom: 4 }}>Используем СММ-анализ:</div>
          <div style={{ fontWeight: 600, color: c.textPrimary }}>{smm.brandIdentity.archetype} · {smm.companyName}</div>
          <div style={{ color: c.textSecondary, marginTop: 4 }}>{smm.brandIdentity.positioning}</div>
        </div>
      ) : (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: c.accentRed }}>
          ⚠️ СММ-анализ не найден. Сначала запустите его в разделе «Анализ СММ».
        </div>
      )}

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Уточнение по нише (опционально)
        </label>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Можно дополнить контекст: продукт, ЦА, особенности коммуникации"
          rows={3}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {error && (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: c.accentRed, marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isGenerating || !smm}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isGenerating || !smm ? c.borderLight : "linear-gradient(135deg, #f59e0b, #fb923c)", color: isGenerating || !smm ? c.textMuted : "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating || !smm ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
        {isGenerating ? "⏳ Запускаем завод… (60–90 сек)" : "🏭 Сгенерировать контент-план"}
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
    <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: 14, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#f59e0b15", color: "#f59e0b", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase" }}>{idea.format}</span>
        <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{idea.platform}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>{idea.hook}</div>
      <p style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.45, margin: "0 0 6px" }}>{idea.angle}</p>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Столп:</b> {idea.pillar} · <b>Цель:</b> {idea.goal}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 12 }}><b>CTA:</b> {idea.cta}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #f59e0b, #fb923c)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "⏳ Генерируем…" : "✨ Создать пост с картинкой"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: showPrompt ? "#f59e0b12" : "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #f59e0b50`, background: c.bg, color: c.textPrimary, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>Промпт заменит стандартный при генерации. Ответ должен быть JSON.</div>
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
    <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: 14, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "3px 8px" }}>REEL · {idea.durationSec}s</span>
        <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{idea.pillar}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>🪝 {idea.hook}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Боль:</b> {idea.problem}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Решение:</b> {idea.solution}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 12 }}><b>Результат:</b> {idea.result}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "⏳ Пишем сценарий…" : "🎬 Создать сценарий рилса"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: showPrompt ? "#ec489912" : "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #ec489950`, background: c.bg, color: c.textPrimary, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>Промпт заменит стандартный. Ответ должен быть JSON.</div>
        </div>
      )}
    </div>
  );
}

// ---------- ContentGeneratorBlock ----------

export function ContentGeneratorBlock({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, brandBook }: {
  c: Colors;
  plan: ContentPlan;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  brandBook: BrandBook;
}) {
  const [mode, setMode] = useState<"post" | "reel">("post");
  const [scratchMode, setScratchMode] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  // brief = plain-language instructions from user; prompt = AI-generated full prompt (optional advanced view)
  const [brief, setBrief] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const selectedPost = plan.postIdeas.find(p => p.id === selectedPostId);
  const selectedReel = plan.reelIdeas.find(r => r.id === selectedReelId);

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
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: getExpandTopic(),
          type: mode,
          companyName: plan.companyName,
          bigIdea: plan.bigIdea,
          pillars: plan.pillars ?? [],
          brandBook,
        }),
      });
      const json = await res.json() as { ok: boolean; prompt?: string; error?: string };
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
        hook: brief || "Новый пост", angle: brief, goal: "охват", cta: "", platform: "vk",
      };
      onGeneratePost(idea, customPrompt);
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
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadowLg, marginBottom: 24, overflow: "hidden" }}>
      {/* Header + mode tabs */}
      <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${c.borderLight}`, background: `linear-gradient(135deg, ${c.bgCard} 50%, ${accent}06 100%)` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary, marginBottom: 12 }}>✨ Создать контент</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([["post", "📝 Пост"], ["reel", "🎬 Рилс"]] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedPostId(null); setSelectedReelId(null); setScratchMode(false); setBrief(""); setGeneratedPrompt(""); setShowAdvanced(false); }}
              style={{ padding: "7px 18px", borderRadius: 9, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                background: mode === m ? (m === "reel" ? "#ec4899" : "#f59e0b") : c.bg,
                color: mode === m ? "#fff" : c.textSecondary,
                boxShadow: mode === m ? `0 2px 8px ${m === "reel" ? "#ec489940" : "#f59e0b40"}` : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* Idea chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>
            {mode === "post" ? "ВЫБЕРИТЕ ИДЕЮ ИЗ ПЛАНА" : "ВЫБЕРИТЕ ИДЕЮ РИЛСА"}
            <span style={{ fontWeight: 400, marginLeft: 6 }}>— или создайте с нуля</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "post"
              ? plan.postIdeas.map(idea => {
                  const sel = selectedPostId === idea.id;
                  return (
                    <button key={idea.id} onClick={() => selectPost(idea)}
                      style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : c.border}`,
                        background: sel ? accent + "18" : c.bg, color: sel ? accent : c.textSecondary,
                        fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                        maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                      }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : c.textMuted, marginBottom: 2, textTransform: "uppercase" }}>{idea.format}</div>
                      {idea.hook}
                    </button>
                  );
                })
              : plan.reelIdeas.map(idea => {
                  const sel = selectedReelId === idea.id;
                  return (
                    <button key={idea.id} onClick={() => selectReel(idea)}
                      style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : c.border}`,
                        background: sel ? accent + "18" : c.bg, color: sel ? accent : c.textSecondary,
                        fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                        maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                      }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : c.textMuted, marginBottom: 2 }}>{idea.durationSec}с · {idea.pillar}</div>
                      🪝 {idea.hook}
                    </button>
                  );
                })
            }
            <button onClick={openScratch}
              style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px dashed ${scratchMode ? accent : c.border}`,
                background: scratchMode ? accent + "12" : "transparent", color: scratchMode ? accent : c.textMuted,
                fontSize: 11, fontWeight: scratchMode ? 700 : 500, cursor: "pointer", transition: "all 0.12s",
              }}>
              ✍️ С нуля
            </button>
          </div>
        </div>

        {/* Selected idea details */}
        {!scratchMode && (selectedPost || selectedReel) && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: accent + "0a", borderRadius: 10, border: `1px solid ${accent}20`, fontSize: 11, color: c.textSecondary, lineHeight: 1.6 }}>
            {selectedPost && <><b style={{ color: accent }}>Угол:</b> {selectedPost.angle} · <b style={{ color: accent }}>Цель:</b> {selectedPost.goal} · <b style={{ color: accent }}>CTA:</b> {selectedPost.cta}</>}
            {selectedReel && <><b style={{ color: accent }}>Боль:</b> {selectedReel.problem} · <b style={{ color: accent }}>Решение:</b> {selectedReel.solution} · <b style={{ color: accent }}>CTA:</b> {selectedReel.cta}</>}
          </div>
        )}

        {/* Brief / instructions field */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>
            БРИФ / УТОЧНЕНИЕ
            <span style={{ fontWeight: 400, marginLeft: 6 }}>— необязательно, можно оставить пустым</span>
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={scratchMode
              ? `Например: «напиши ${mode === "post" ? "пост" : "рилс"} о плюсах нашего бизнеса» или «сделай акцент на надёжности и немецком качестве»`
              : `Дополнительные пожелания. Например: «сделай акцент на скорости доставки» или «добавь кейс из практики»`}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${c.border}`,
              background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical",
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
            {isExpandingPrompt ? "⏳ ИИ готовит промпт…" : "🤖 ИИ-помощник: подготовить промпт"}
          </button>
          <div style={{ fontSize: 11, color: c.textMuted, flex: 1 }}>
            {isExpandingPrompt ? "Анализирую компанию и тему…" : "ИИ использует данные компании и сформирует готовый промпт"}
          </div>
          {expandError && <span style={{ fontSize: 11, color: c.accentRed }}>{expandError}</span>}
        </div>

        {/* AI-generated prompt (advanced / editable) */}
        {showAdvanced && generatedPrompt && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>
                ПРОМПТ ОТ ИИ-ПОМОЩНИКА
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно отредактировать</span>
              </label>
              <button onClick={() => { setShowAdvanced(false); setGeneratedPrompt(""); }}
                style={{ fontSize: 10, color: c.textMuted, background: "none", border: "none", cursor: "pointer" }}>✕ скрыть</button>
            </div>
            <textarea
              value={generatedPrompt}
              onChange={e => setGeneratedPrompt(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${accent}40`,
                background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.6, boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>
              Этот промпт будет использован при генерации. При нажатии «Создать» без промпта — ИИ сгенерирует по идее и данным компании автоматически.
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14, cursor: isGenerating ? "not-allowed" : "pointer", transition: "all 0.15s",
            background: isGenerating ? c.borderLight : (mode === "reel" ? "linear-gradient(135deg, #ec4899, #f472b6)" : "linear-gradient(135deg, #f59e0b, #fb923c)"),
            color: isGenerating ? c.textMuted : "#fff",
            boxShadow: isGenerating ? "none" : `0 4px 16px ${accent}50`,
          }}>
          {isGenerating
            ? (busy ? "⏳ Генерируем…" : "⏳ Ожидание…")
            : mode === "reel" ? "🎬 Создать сценарий рилса" : "✨ Создать пост с картинкой"}
        </button>
        {isGenerating && !busy && (
          <div style={{ fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 6 }}>Дождитесь окончания текущей генерации</div>
        )}
      </div>
    </div>
  );
}

export function CalendarDayPanel({ c, dayText, dayIndex, isGeneratingPost, isGeneratingReel, onGeneratePost, onGenerateReel, onClose }: {
  c: Colors;
  dayText: string;
  dayIndex: number;
  isGeneratingPost: boolean;
  isGeneratingReel: boolean;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  onClose: () => void;
}) {
  const isReel = /рилс/i.test(dayText);
  const accentColor = isReel ? "#ec4899" : "#f59e0b";

  const defaultPrompt = isReel
    ? `Напиши сценарий рилса по теме: ${dayText}\n\nСтруктура: крюк (0-3 сек) → интрига → проблема → решение → результат → CTA.\nВерни JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }`
    : `Напиши пост на тему: ${dayText}\n\nИспользуй сильный крючок, тело с конкретикой и призыв к действию.\nВерни JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }`;

  const [prompt, setPrompt] = useState(defaultPrompt);
  const busy = isReel ? isGeneratingReel : isGeneratingPost;

  const fakeIdBase = { id: `cal-${dayIndex}`, pillar: "Календарь", format: "single" as const, hook: dayText, angle: dayText, goal: "охват", cta: "", platform: "instagram" };
  const fakeReelBase = { id: `cal-${dayIndex}`, pillar: "Календарь", hook: dayText, intrigue: "", problem: "", solution: "", result: "", cta: "", durationSec: 30, visualStyle: "", hashtags: [] };

  return (
    <div style={{ marginTop: 14, background: c.bgCard, borderRadius: 12, border: `1.5px solid ${accentColor}40`, padding: 18, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 4, letterSpacing: "0.05em" }}>ДЕНЬ {dayIndex + 1}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{dayText}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: c.textMuted, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>ПРОМПТ ДЛЯ ГЕНЕРАЦИИ (можно редактировать)</label>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={6}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${accentColor}50`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.55, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={() => isReel
            ? onGenerateReel(fakeReelBase, prompt)
            : onGeneratePost(fakeIdBase, prompt)
          }
          disabled={busy}
          style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "none", background: busy ? c.borderLight : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? "⏳ Генерируем…" : isReel ? "🎬 Создать сценарий рилса" : "✨ Создать пост с картинкой"}
        </button>
        <button
          onClick={() => setPrompt(defaultPrompt)}
          style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Сбросить промпт
        </button>
      </div>
    </div>
  );
}

// ---------- ContentPlanView ----------

export function ContentPlanView({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, avatarSettings, onUpdateAvatarSettings, referenceImages, onUpdateReferenceImages, brandBook, onUpdateBrandBook }: {
  c: Colors;
  plan: ContentPlan;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook: BrandBook;
  onUpdateBrandBook: (next: BrandBook) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const generatedDate = new Date(plan.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>🏭 Контент-завод — {plan.companyName}</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{generatedDate} · {plan.postIdeas.length} постов · {plan.reelIdeas.length} рилсов</p>
      </div>

      {/* Big Idea + pillars */}
      <CollapsibleSection c={c} title="💡 Большая идея и контент-столпы">
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${c.bgCard} 60%, #f59e0b08 100%)` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>БОЛЬШАЯ ИДЕЯ</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, lineHeight: 1.5, margin: 0 }}>{plan.bigIdea}</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {plan.pillars?.map((p, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{p.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{p.share}</div>
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, margin: 0 }}>{p.description}</p>
            </Card>
          ))}
        </div>
      </CollapsibleSection>

      {/* Content Generator */}
      <ContentGeneratorBlock
        c={c} plan={plan}
        isGeneratingPost={isGeneratingPost} generatingPostId={generatingPostId}
        isGeneratingReel={isGeneratingReel} generatingReelId={generatingReelId}
        onGeneratePost={onGeneratePost} onGenerateReel={onGenerateReel}
        brandBook={brandBook}
      />

      {/* Brand Book */}
      <BrandBookPanel c={c} brandBook={brandBook} onChange={onUpdateBrandBook} />

      {/* Reference images panel */}
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />

      {/* Avatar settings (affects reel scenarios + video generation) */}
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />

      {/* Post ideas */}
      <CollapsibleSection c={c} title={`📝 Идеи постов (${plan.postIdeas.length})`} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {plan.postIdeas.map(idea => (
            <PostIdeaCard key={idea.id} c={c} idea={idea}
              isGenerating={isGeneratingPost} generatingId={generatingPostId}
              onGenerate={onGeneratePost}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Reel ideas */}
      <CollapsibleSection c={c} title={`🎬 Идеи видео-рилсов (${plan.reelIdeas.length})`} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {plan.reelIdeas.map(idea => (
            <ReelIdeaCard key={idea.id} c={c} idea={idea}
              isGenerating={isGeneratingReel} generatingId={generatingReelId}
              onGenerate={onGenerateReel}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Calendar */}
      <CollapsibleSection c={c} title="📅 Календарь на 30 дней" defaultOpen={false}>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {plan.thirtyDayCalendar?.map((day, i) => {
              const isReel = /рилс/i.test(day);
              const isSelected = selectedDay === i;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : i)}
                  style={{
                    padding: "8px 10px", background: isSelected ? (isReel ? "#ec489918" : "#f59e0b18") : c.bg,
                    borderRadius: 8, border: `1.5px solid ${isSelected ? (isReel ? "#ec4899" : "#f59e0b") : c.borderLight}`,
                    fontSize: 11, color: c.textSecondary, lineHeight: 1.45, cursor: "pointer",
                    transition: "all 0.12s",
                  }}>
                  {day}
                </div>
              );
            })}
          </div>
          {plan.weeklyRhythm && (
            <div style={{ marginTop: 14, padding: 10, background: "#f59e0b08", borderRadius: 8, fontSize: 12, color: c.textSecondary }}>
              <b style={{ color: "#f59e0b" }}>Ритм:</b> {plan.weeklyRhythm}
            </div>
          )}
        </Card>

        {/* Day detail panel */}
        {selectedDay !== null && plan.thirtyDayCalendar?.[selectedDay] && (
          <CalendarDayPanel
            c={c}
            dayText={plan.thirtyDayCalendar[selectedDay]}
            dayIndex={selectedDay}
            isGeneratingPost={isGeneratingPost}
            isGeneratingReel={isGeneratingReel}
            onGeneratePost={onGeneratePost}
            onGenerateReel={onGenerateReel}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </CollapsibleSection>
    </div>
  );
}
