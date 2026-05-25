"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { ContentPlan, GeneratedStory, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import { Smartphone, Sparkles, Camera, Users, Send, Loader2, RefreshCw, Maximize2 } from "lucide-react";
import { ImagePromptEditor } from "@/components/ui/ImagePromptEditor";
import { OnboardingChecklist, type OnboardingState } from "@/components/ui/OnboardingChecklist";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { StatusTabs, computeStatus, type ContentStatus } from "@/components/ui/StatusTabs";
import { AutoIdeasModal, type ContentIdea } from "@/components/ui/AutoIdeasModal";
import { IMAGE_STYLE_OPTIONS, stylePhraseFor, runWithConcurrency, type ImageStyleKey } from "@/lib/image-style";
import { MetricsBlock } from "@/components/views/GeneratedPostsView";

export function StoriesView({ c, stories, plan, smmAnalysis, myCompany, taResult, companyName, brandBook, onAdd, onDelete, onUpdate, onboardingState }: {
  c: Colors;
  stories: GeneratedStory[];
  plan: ContentPlan | null;
  smmAnalysis: unknown;
  /** Анализ компании — нужен для авто-генерации идей AI. */
  myCompany?: import("@/lib/types").AnalysisResult | null;
  /** ЦА — для авто-генерации идей. */
  taResult?: import("@/lib/ta-types").TAResult | null;
  companyName: string;
  brandBook: BrandBook;
  onAdd: (story: GeneratedStory) => void;
  onDelete: (id: string) => void;
  onUpdate: (story: GeneratedStory) => void;
  onboardingState?: OnboardingState;
}) {
  const [platform, setPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  // Кол-во слайдов — теперь свободный ввод 2-10 (как в каруселях),
  // чтобы пользователь мог сделать короткую серию из 2 слайдов или
  // длинную из 8-10, не ограничиваясь фиксированными 3/5/7.
  const [slidesCount, setSlidesCount] = useState<number>(5);
  const [goal, setGoal] = useState("прогрев");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState(plan?.pillars?.[0]?.name ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Глобальный флаг — встроить текст слайдов в каждое изображение через gpt-image-2.
  const [embedTextDefault, setEmbedTextDefault] = useState(false);
  // Прогресс авто-генерации фонов для серии: { ready, total, storyId }
  // ready — успешно сгенерированные, attempted — отработавшие (ok или err);
  // total — сколько всего слайдов. Если в конце attempted === total, но
  // ready < total — пользователь видит «нарисовали 3 из 5, остальные не вышли».
  const [bgProgress, setBgProgress] = useState<{ ready: number; attempted: number; total: number; storyId: string } | null>(null);
  const [statusTab, setStatusTab] = useState<ContentStatus>("drafts");
  // Параметры картинки — как в «Создать пост».
  const [showImageBlock, setShowImageBlock] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyleKey>("");
  const [customImagePrompt, setCustomImagePrompt] = useState("");

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
      const story = json.data!;
      // Сначала добавляем серию в список — пользователь сразу видит превью с текстом.
      onAdd(story);
      setBrief("");

      // Затем параллельно генерируем фоны для всех слайдов в фоне.
      // Каждый успешный bg прокидываем через onUpdate, чтобы UI прогрессивно обновлялся.
      void autoGenerateBackgrounds(story, embedTextDefault, imageStyle, customImagePrompt.trim());
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  // Авто-генерация фонов для всех слайдов серии с ограничением concurrency=2.
  //
  // Раньше использовали Promise.all — все 5-7 запросов уходили в OpenAI
  // одновременно. На gpt-image-2 quality=high это упирается в rate-limit
  // или 60-секундный timeout каждой Next.js-route, и часть запросов
  // возвращалась с ok=false. Юзер видел только 2 картинки из 5.
  // Concurrency=2 — золотая середина: быстро (две параллельно) и стабильно.
  const autoGenerateBackgrounds = async (
    story: GeneratedStory,
    embedText: boolean,
    style: ImageStyleKey,
    customPrompt: string,
  ) => {
    const brandVisual = brandBook?.visualStyle?.trim();
    const brandColors = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
    const stylePhrase = stylePhraseFor(style);

    setBgProgress({ ready: 0, attempted: 0, total: story.slides.length, storyId: story.id });

    // КРИТИЧНО: раньше использовалась общая переменная `working`, которую
    // каждый параллельный промис читал в начале → race condition →
    // только результат последнего завершившегося промиса сохранялся.
    // Исправляем — собираем результаты в массив (по индексу), потом ОДИН
    // финальный onUpdate с уже мерджнутыми результатами.
    type SlideResult = { imageUrl: string; hasEmbeddedText: boolean } | null;
    const results: SlideResult[] = new Array(story.slides.length).fill(null);

    await runWithConcurrency(story.slides, 2, async (slide, i) => {
      try {
        const slideTextLines = [
          slide.headlineText?.trim() ?? "",
          slide.bodyText?.trim() ?? "",
        ].filter(Boolean);
        const embeddedText = embedText ? slideTextLines.join("\n") : "";

        // Делаем prompt уникальнее: добавляем индекс слайда + случайный seed,
        // чтобы не получить identical image при одинаковом slide.background.
        const seed = `${story.id.slice(-4)}-slide-${i + 1}`;
        // Если юзер вписал свой английский промпт — он становится базой
        // (как в «Создать пост»). Если пусто — берём AI-описание слайда.
        const baseScene = customPrompt
          ? `${customPrompt} (variation for slide ${i + 1}: ${slide.background})`
          : `Story background for ${story.platform}: ${slide.background}.`;
        const prompt = [
          baseScene,
          slide.visualNote && `Mood: ${slide.visualNote}.`,
          `Variation: ${seed}.`,
          stylePhrase,
          brandVisual && `Brand visual style: ${brandVisual}.`,
          brandColors,
          embedText
            ? "Vertical 9:16 format. Leave clean space for typography."
            : "Vertical 9:16 format. No text overlay. Clean, atmospheric.",
        ].filter(Boolean).join(" ");

        const res = await fetch("/api/generate-image-anthropic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postText: prompt,
            format: "сторис",
            platform: story.platform,
            brandColors: brandBook?.colors ?? [],
            brandStyle: brandBook?.visualStyle ?? "",
            embedText: embeddedText || undefined,
          }),
        });
        const j = await res.json() as { ok: boolean; data?: { imageUrl: string } };
        if (j.ok && j.data?.imageUrl) {
          results[i] = { imageUrl: j.data.imageUrl, hasEmbeddedText: !!embeddedText };
          // Прогрессивно обновляем UI — каждый завершившийся слайд сразу
          // виден. Сборка делается из results[], не из stale `working`.
          const partialSlides = story.slides.map((s, idx) => {
            const r = results[idx];
            return r ? { ...s, backgroundImageUrl: r.imageUrl, hasEmbeddedText: r.hasEmbeddedText } : s;
          });
          onUpdate({ ...story, slides: partialSlides });
          setBgProgress(p => p && p.storyId === story.id ? { ...p, ready: p.ready + 1, attempted: p.attempted + 1 } : p);
        } else {
          // API ответил ok=false (квота/rate-limit/etc) — счётчик attempts++,
          // но ready не растёт. Юзер увидит «3 из 5» в финальном баннере.
          setBgProgress(p => p && p.storyId === story.id ? { ...p, attempted: p.attempted + 1 } : p);
        }
      } catch {
        setBgProgress(p => p && p.storyId === story.id ? { ...p, attempted: p.attempted + 1 } : p);
      }
    });

    // Если всё успешно — через 3 сек убираем баннер. Если есть сбои —
    // оставляем на 8 сек, чтобы юзер успел прочитать и нажать «Перегенерировать».
    setTimeout(() => setBgProgress(null), results.every(r => r != null) ? 3000 : 8000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)",
    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const accent = "#a855f7";

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 12, letterSpacing: -0.5 }}>
          <Smartphone size={26} /> Сторис-сценарии
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
          Серии сторис с поэкранной структурой, стикерами и CTA. Фоны генерируются автоматически.
        </p>
      </div>

      {/* Generator form */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow-lg)", marginBottom: 24, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid var(--muted)`, background: `linear-gradient(135deg, var(--card) 50%, ${accent}06 100%)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={16} /> Создать серию сторис</div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
            {/* Platform */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>ПЛАТФОРМА</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["instagram", "vk", "telegram"] as const).map(p => (
                  <button key={p} onClick={() => setPlatform(p)}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 9, border: `1.5px solid ${platform === p ? accent : "var(--border)"}`,
                      background: platform === p ? accent + "15" : "var(--background)", color: platform === p ? accent : "var(--foreground-secondary)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 38 }}>
                    {p === "instagram" ? <><Camera size={14}/> Insta</> : p === "vk" ? <><Users size={14} style={{ color: "#4a76a8" }} /> VK</> : <><Send size={14} style={{ color: "#229ED9" }} /> TG</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Slides count — ручной ввод 2-10. Раньше было фикс. 3/5/7,
               но для коротких серий (анонс, миф-факт) нужно 2; для длинных
               прогревов — 8-10. */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                КОЛ-ВО СЛАЙДОВ ({slidesCount})
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range" min={2} max={10} step={1}
                  value={slidesCount}
                  onChange={e => setSlidesCount(Number(e.target.value))}
                  style={{ flex: 1, accentColor: accent }}
                />
                <input
                  type="number" min={2} max={10}
                  value={slidesCount}
                  onChange={e => {
                    const n = Math.max(2, Math.min(10, Number(e.target.value) || 5));
                    setSlidesCount(n);
                  }}
                  style={{
                    width: 60, padding: "8px 10px", borderRadius: 8,
                    border: `1.5px solid ${accent}`, background: "var(--background)",
                    color: accent, fontSize: 14, fontWeight: 700, textAlign: "center",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Goal */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>ЦЕЛЬ</label>
              <select value={goal} onChange={e => setGoal(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {["прогрев", "продажа", "охват", "вовлечение", "обучение", "анонс", "доверие"].map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Pillar */}
            {plan?.pillars?.length ? (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>КОНТЕНТ-СТОЛП</label>
                <select value={pillar} onChange={e => setPillar(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— свободная тема —</option>
                  {plan.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {/* Brief + AI-идеи */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                ТЕМА / БРИФ
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно оставить пустым, ИИ придумает по столпу</span>
              </label>
              <AutoIdeasModal
                format="story"
                myCompany={myCompany}
                taResult={taResult}
                smmResult={smmAnalysis as import("@/lib/smm-types").SMMResult | null}
                brandBook={brandBook}
                accentColor="#a855f7"
                onSelectIdea={(idea: ContentIdea) => {
                  setBrief(`${idea.hook}\n\n${idea.summary || idea.angle}`);
                  if (idea.pillar) setPillar(idea.pillar);
                }}
              />
            </div>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={2}
              placeholder="Например: «серия про наш процесс производства», «3 мифа о нашей нише», «анонс акции 20%»"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {/* Чекбокс «Встроить текст в картинку» */}
          <label style={{
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none",
            marginBottom: 14, padding: "10px 12px", borderRadius: 9,
            background: embedTextDefault ? "#a855f710" : "transparent",
            border: `1.5px dashed ${embedTextDefault ? "#a855f7" : "var(--border)"}`,
          }}>
            <input
              type="checkbox"
              checked={embedTextDefault}
              onChange={e => setEmbedTextDefault(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#a855f7", cursor: "pointer", flexShrink: 0 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                Встроить текст в каждый слайд
                <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#a855f7", color: "#fff", marginLeft: 5 }}>NEW</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                gpt-image-2 нарисует заголовок прямо на картинке вместо CSS-оверлея.
              </span>
            </div>
          </label>

          {/* Параметры картинки — стиль + кастомный промпт (как в «Создать пост») */}
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setShowImageBlock(v => !v)}
              style={{
                width: "100%", textAlign: "left", padding: "11px 14px",
                background: "var(--background)", border: `1px dashed ${accent}50`,
                borderRadius: 10, cursor: "pointer", color: "var(--foreground)",
                fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span>🎨 Параметры картинки {(imageStyle || customImagePrompt.trim()) && <span style={{ color: accent, marginLeft: 6 }}>· настроено</span>}</span>
              <span>{showImageBlock ? "▲" : "▼"}</span>
            </button>
            {showImageBlock && (
              <div style={{
                marginTop: 10, padding: 14, borderRadius: 10,
                background: `${accent}06`, border: `1px solid ${accent}25`,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>
                    СТИЛЬ КАРТИНКИ
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {IMAGE_STYLE_OPTIONS.map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
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

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>
                    СВОЙ ПРОМПТ ДЛЯ КАРТИНКИ (на английском, опц)
                  </label>
                  <textarea
                    rows={3}
                    value={customImagePrompt}
                    onChange={e => setCustomImagePrompt(e.target.value)}
                    placeholder="A modern office interior with warm evening lighting, woman looking at laptop, cinematic photography..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8,
                      background: "var(--background)", border: "1px solid var(--border)",
                      color: "var(--foreground)", fontSize: 12, fontFamily: "ui-monospace, monospace",
                      outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Если пусто — AI сам опишет фон под каждый слайд. Если заполнено — этот промпт станет базой для всех слайдов (с вариацией).
                  </div>
                </div>
              </div>
            )}
          </div>

          {genError && <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", color: "var(--destructive)", padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 12 }}>❌ {genError}</div>}

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14,
              cursor: generating ? "not-allowed" : "pointer",
              background: generating ? "var(--muted)" : `linear-gradient(135deg, #a855f7, #c084fc)`,
              color: generating ? "var(--muted-foreground)" : "#fff",
              boxShadow: generating ? "none" : `0 4px 16px #a855f740` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {generating ? <><Loader2 size={16} className="spin" /> Генерируем сценарий…</> : <><Smartphone size={16} /> Создать серию сторис</>}
            </span>
          </button>
        </div>
      </div>

      {/* BG generation progress banner. Показываем пока attempted < total
         (ещё в процессе) ИЛИ когда всё закончилось, но часть слайдов
         упала (ready < total) — тогда красным предупреждением. */}
      {bgProgress && (bgProgress.attempted < bgProgress.total || bgProgress.ready < bgProgress.total) && (() => {
        const inProgress = bgProgress.attempted < bgProgress.total;
        const failed = bgProgress.total - bgProgress.ready;
        return (
          <div style={{
            marginBottom: 18,
            padding: "16px 20px",
            background: inProgress
              ? "color-mix(in oklch, #a855f7 8%, var(--card))"
              : "color-mix(in oklch, var(--destructive) 8%, var(--card))",
            border: `1.5px solid ${inProgress
              ? "color-mix(in oklch, #a855f7 35%, var(--border))"
              : "color-mix(in oklch, var(--destructive) 35%, var(--border))"}`,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: inProgress
                ? "color-mix(in oklch, #a855f7 18%, transparent)"
                : "color-mix(in oklch, var(--destructive) 18%, transparent)",
              color: inProgress ? "#a855f7" : "var(--destructive)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {inProgress
                ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }}/>
                : <span style={{ fontSize: 18 }}>⚠️</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>
                {inProgress
                  ? `Рисую фоны слайдов: ${bgProgress.ready} / ${bgProgress.total}`
                  : `Нарисовано ${bgProgress.ready} из ${bgProgress.total} — ${failed} не вышло`}
              </div>
              <div style={{ height: 6, background: "var(--background)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(bgProgress.ready / bgProgress.total) * 100}%`,
                  background: inProgress
                    ? "linear-gradient(90deg, #a855f7, #c084fc)"
                    : "var(--destructive)",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}/>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
                {inProgress
                  ? "Серия уже сохранена с текстом — фоны догружаются по мере готовности."
                  : "Откройте серию и нажмите «Перегенерировать фон» на пустых слайдах."}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stories list — с табами статусов как в постах */}
      {stories.length === 0 ? (
        <>
          {onboardingState && (
            <OnboardingChecklist
              state={onboardingState}
              onNavigate={(nav) => { window.location.href = `/?nav=${nav}`; }}
            />
          )}
          <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "44px 28px", textAlign: "center", boxShadow: "var(--shadow)" }}>
            <style>{".spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "color-mix(in srgb, #a855f7 12%, transparent)", color: "#a855f7", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Smartphone size={30} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>Пока нет серий сторис</div>
            <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
              Заполните форму выше — серия из 5 слайдов с фонами появится через 30-60 секунд.
            </div>
          </div>
        </>
      ) : (() => {
        const counts = {
          drafts: stories.filter(s => computeStatus(s) === "drafts").length,
          scheduled: stories.filter(s => computeStatus(s) === "scheduled").length,
          published: stories.filter(s => computeStatus(s) === "published").length,
        };
        const filtered = stories.filter(s => computeStatus(s) === statusTab);
        return (
          <>
            <StatusTabs value={statusTab} onChange={setStatusTab} counts={counts} />
            {filtered.length === 0 ? (
              <div style={{ padding: "28px 24px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14, background: "var(--card)", borderRadius: 14, border: "1px dashed var(--border)" }}>
                В этой вкладке пока пусто
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filtered.map(story => (
                  <StoryCard key={story.id} c={c} story={story} onDelete={onDelete} onUpdate={onUpdate} brandBook={brandBook} />
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

export function StoryCard({ c, story, onDelete, onUpdate, brandBook }: {
  c: Colors;
  story: GeneratedStory;
  onDelete: (id: string) => void;
  onUpdate: (updated: GeneratedStory) => void;
  brandBook?: BrandBook;
}) {
  // По умолчанию серия СВЁРНУТА — в библиотеке из 10+ серий открытые
  // карточки делают 5000px скролла. Юзер сам кликает шапку чтобы
  // развернуть. Удобнее видеть всё списком и выбирать нужное.
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  // Какому слайду открыли промпт-редактор. null = не открыт.
  const [promptEditorSlide, setPromptEditorSlide] = useState<number | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const accent = "#a855f7";

  const promptParamsForSlide = (slide: typeof story.slides[number]) => ({
    postText: [
      `Story background. Background description: ${slide.background}.`,
      slide.visualNote && `Mood: ${slide.visualNote}.`,
    ].filter(Boolean).join(" "),
    hook: slide.headlineText,
    format: "сторис",
    platform: story.platform,
    brandColors: brandBook?.colors ?? [],
    brandStyle: brandBook?.visualStyle ?? "",
  });

  const handleGenerateBgWithPrompt = async (slideIndex: number, userPrompt: string) => {
    setBgError(null);
    const res = await fetch("/api/generate-image-anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postText: "story slide", // placeholder
        format: "сторис",
        platform: story.platform,
        brandColors: brandBook?.colors ?? [],
        brandStyle: brandBook?.visualStyle ?? "",
        userPrompt,
      }),
    });
    const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
    if (!json.ok) {
      const msg = json.error ?? "Ошибка генерации";
      setBgError(msg);
      throw new Error(msg);
    }
    const updatedSlides = story.slides.map((s, i) =>
      i === slideIndex ? { ...s, backgroundImageUrl: json.data!.imageUrl } : s,
    );
    onUpdate({ ...story, slides: updatedSlides });
    setPromptEditorSlide(null);
  };

  const platformLabel = {
    instagram: <><Camera size={11} style={{ marginRight: 4 }} />Instagram</>,
    vk: <><Users size={11} style={{ color: "#4a76a8", marginRight: 4 }} />VK</>,
    telegram: <><Send size={11} style={{ color: "#229ED9", marginRight: 4 }} />Telegram</>,
  }[story.platform];

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expanded ? `1px solid var(--muted)` : "none", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: accent + "15", color: accent, flexShrink: 0 }}>STORIES</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0 }}>{platformLabel}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0 }}>{story.slides.length} слайдов</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{story.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {/* Dropdown статуса — двигаем серию между табами Черновики/Запл/Опубл */}
          <select
            value={story.manualStatus ?? (story.publishStatus?.vk?.ok || story.publishStatus?.telegram?.ok ? "published" : (story.scheduledFor && new Date(story.scheduledFor) > new Date() ? "scheduled" : "drafts"))}
            onChange={e => onUpdate({ ...story, manualStatus: e.target.value as "drafts" | "scheduled" | "published" })}
            style={{
              padding: "4px 8px", borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--background)", color: "var(--foreground-secondary)",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <option value="drafts">📝 Черновик</option>
            <option value="scheduled">📅 Запланирован</option>
            <option value="published">✅ Опубликован</option>
          </select>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{new Date(story.generatedAt).toLocaleDateString("ru-RU")}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {/* Сompact preview когда свёрнуто — горизонтальная лента миниатюр
         + первая headline. Кликом по миниатюре — раскрываем и сразу
         показываем нужный слайд. */}
      {!expanded && (
        <div
          style={{
            padding: "10px 18px 12px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            cursor: "pointer",
            background: "color-mix(in oklch, var(--muted) 30%, var(--card))",
          }}
          onClick={() => setExpanded(true)}
        >
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {story.slides.slice(0, 5).map((s, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 50,
                  borderRadius: 4,
                  background: s.backgroundImageUrl
                    ? `url(${s.backgroundImageUrl}) center/cover`
                    : `linear-gradient(135deg, ${accent}30, ${accent}10)`,
                  border: `1px solid ${accent}30`,
                  flexShrink: 0,
                }}
              />
            ))}
            {story.slides.length > 5 && (
              <div style={{
                width: 28, height: 50, borderRadius: 4,
                background: "var(--background)",
                border: `1px solid var(--border)`,
                fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>+{story.slides.length - 5}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {story.slides[0]?.headlineText || "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {story.goal} · {story.hashtags.slice(0, 3).join(" ")}
            </div>
          </div>
          <div style={{ fontSize: 11, color: accent, fontWeight: 600, whiteSpace: "nowrap" }}>
            Развернуть →
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {/* Slide navigator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {story.slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${activeSlide === i ? accent : "var(--border)"}`,
                  background: activeSlide === i ? accent : "var(--background)", color: activeSlide === i ? "#fff" : "var(--foreground-secondary)",
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
                {/* Phone mockup — точный 9:16 (200×355) */}
                <div
                  onClick={() => slide.backgroundImageUrl && setLightboxUrl(slide.backgroundImageUrl)}
                  title={slide.backgroundImageUrl ? "Открыть на весь экран" : undefined}
                  style={{
                    borderRadius: 16, padding: 12, width: 200, height: 355,
                    display: "flex", flexDirection: "column",
                    justifyContent: "space-between", boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    position: "relative", overflow: "hidden",
                    background: slide.backgroundImageUrl ? "transparent" : "#0f0f0f",
                    cursor: slide.backgroundImageUrl ? "zoom-in" : "default",
                  }}
                >
                  {/* Background image */}
                  {slide.backgroundImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={slide.backgroundImageUrl} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                  )}
                  {/* Fullscreen indicator */}
                  {slide.backgroundImageUrl && (
                    <div style={{
                      position: "absolute", top: 8, right: 8, zIndex: 3,
                      background: "rgba(0,0,0,0.55)", borderRadius: 7, padding: 5,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", pointerEvents: "none",
                      backdropFilter: "blur(6px)",
                    }}>
                      <Maximize2 size={12} />
                    </div>
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
                      {/* Если текст уже «вшит» в backgroundImageUrl через gpt-image-2 —
                         не рисуем CSS-оверлей чтобы не было дубля. Stickers/CTA
                         всё равно показываем — они интерактивные элементы, не текст. */}
                      {!slide.hasEmbeddedText && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.3, marginBottom: 8, textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>{slide.headlineText}</div>
                          {slide.bodyText && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, marginBottom: 8, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{slide.bodyText}</div>}
                        </>
                      )}
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, textTransform: "uppercase" }}>Фон</div>
                      <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.55, marginBottom: 10 }}>{slide.background}</div>
                      <button
                        onClick={() => { setPromptEditorSlide(promptEditorSlide === activeSlide ? null : activeSlide); setBgError(null); }}
                        style={{
                          padding: "9px 14px", borderRadius: 9,
                          border: `1.5px solid ${accent}50`, background: accent + "12",
                          color: accent, fontSize: 13, fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 7,
                          minHeight: 38,
                        }}>
                        {promptEditorSlide === activeSlide
                          ? <>Закрыть</>
                          : slide.backgroundImageUrl
                            ? <><RefreshCw size={14} /> Перегенерировать фон</>
                            : <><Sparkles size={14} /> Сгенерировать фон</>}
                      </button>
                      {bgError && promptEditorSlide !== activeSlide && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--destructive)", padding: "8px 12px", background: "color-mix(in oklch, var(--destructive) 8%, transparent)", borderRadius: 8 }}>❌ {bgError}</div>
                      )}
                      {promptEditorSlide === activeSlide && (
                        <ImagePromptEditor
                          params={promptParamsForSlide(slide)}
                          title="Промпт для фона сторис"
                          generateLabel={slide.backgroundImageUrl ? "Перегенерировать фон" : "Сгенерировать фон"}
                          onGenerate={(p) => handleGenerateBgWithPrompt(activeSlide, p)}
                          onCancel={() => setPromptEditorSlide(null)}
                        />
                      )}
                    </div>
                    <Field c={c} label="Заголовок" value={slide.headlineText} bold />
                    {slide.bodyText && <Field c={c} label="Текст" value={slide.bodyText} />}
                    {slide.sticker && <Field c={c} label="Стикер / интерактив" value={slide.sticker} accent={accent} />}
                    {slide.cta && <Field c={c} label="CTA" value={slide.cta} accent={accent} />}
                    {(slide.backgroundRu || slide.background) && (
                      <Field c={c} label="🎨 Что будет на картинке" value={slide.backgroundRu || slide.background} muted />
                    )}
                    <Field c={c} label="Режиссёрская пометка" value={slide.visualNote} muted />
                  </div>
                  {/* Nav arrows */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600, cursor: activeSlide === 0 ? "not-allowed" : "pointer", opacity: activeSlide === 0 ? 0.4 : 1 }}>
                      ← Назад
                    </button>
                    <button onClick={() => setActiveSlide(Math.min(story.slides.length - 1, activeSlide + 1))} disabled={activeSlide === story.slides.length - 1}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600, cursor: activeSlide === story.slides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide === story.slides.length - 1 ? 0.4 : 1 }}>
                      Вперёд →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Метрики серии — те же поля что и у поста (reach/likes/leads/...).
             Заблокированы пока серия в draft/scheduled; разблокируются когда
             юзер ставит статус «Опубликован» вручную или autopublisher. */}
          <MetricsBlock
            c={c}
            kind="story"
            metrics={story.metrics}
            onChange={next => onUpdate({ ...story, metrics: next })}
            locked={story.manualStatus !== "published" && !(story.publishStatus?.vk?.ok || story.publishStatus?.telegram?.ok)}
          />

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
                  <button onClick={() => onDelete(story.id)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "var(--destructive)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 11, cursor: "pointer" }}>Нет</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid var(--destructive)40`, background: "transparent", color: "var(--destructive)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Удалить</button>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          filename={`story-${story.id}-slide.png`}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}

export function Field({ c, label, value, bold, muted, accent }: { c: Colors; label: string; value: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: accent ?? (muted ? "var(--muted-foreground)" : "var(--foreground-secondary)"), fontWeight: bold ? 700 : 400, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

