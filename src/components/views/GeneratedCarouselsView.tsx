"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { ContentPlan, GeneratedCarousel, BrandBook, CarouselSlide } from "@/lib/content-types";
import { Layers, Sparkles, Camera, Users, Send, Loader2, RefreshCw, Copy, Maximize2 } from "lucide-react";
import { ImagePromptEditor } from "@/components/ui/ImagePromptEditor";
import { OnboardingChecklist, type OnboardingState } from "@/components/ui/OnboardingChecklist";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { StatusTabs, computeStatus, type ContentStatus } from "@/components/ui/StatusTabs";
import { AutoIdeasModal, type ContentIdea } from "@/components/ui/AutoIdeasModal";
import { IMAGE_STYLE_OPTIONS, stylePhraseFor, runWithConcurrency, type ImageStyleKey } from "@/lib/image-style";
import { MetricsBlock } from "@/components/views/GeneratedPostsView";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

export function GeneratedCarouselsView({ c, carousels, plan, smmAnalysis, myCompany, taResult, companyName, brandBook, onAdd, onDelete, onUpdate, onboardingState }: {
  c: Colors;
  carousels: GeneratedCarousel[];
  plan: ContentPlan | null;
  smmAnalysis: unknown;
  myCompany?: import("@/lib/types").AnalysisResult | null;
  taResult?: import("@/lib/ta-types").TAResult | null;
  companyName: string;
  brandBook: BrandBook;
  onAdd: (carousel: GeneratedCarousel) => void;
  onDelete: (id: string) => void;
  onUpdate: (carousel: GeneratedCarousel) => void;
  onboardingState?: OnboardingState;
}) {
  const [platform, setPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  const [slidesCount, setSlidesCount] = useState<number>(7);
  const [goal, setGoal] = useState("обучение");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState(plan?.pillars?.[0]?.name ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Если ON — при рендере фонов каждого слайда чекбокс «Встроить текст»
  // будет уже включен по умолчанию (text-on-image).
  const [embedTextDefault, setEmbedTextDefault] = useState(false);
  const [bgProgress, setBgProgress] = useState<{ ready: number; attempted: number; total: number; carouselId: string; lastError?: string } | null>(null);
  const [statusTab, setStatusTab] = useState<ContentStatus>("drafts");
  // Параметры картинки — пресет стиля + кастомный английский промпт.
  const [showImageBlock, setShowImageBlock] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyleKey>("");
  const [customImagePrompt, setCustomImagePrompt] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, platform, slidesCount, goal, brief, pillar, smmAnalysis, brandBook }),
      });
      const json = await jsonOrThrow<{ ok: boolean; data?: GeneratedCarousel; error?: string }>(res);
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");
      // hasEmbeddedText ставим в autoGenerateCarouselBackgrounds ТОЛЬКО
      // после успешной генерации фона со встроенным текстом. Раньше мы
      // помечали все слайды как hasEmbeddedText=true заранее → если фон
      // не сгенерировался, CSS-оверлей скрывался (см. !slide.hasEmbeddedText
      // условие в рендере) и слайд оставался пустым.
      const result: GeneratedCarousel = json.data!;
      // 1. Сначала добавляем серию — юзер сразу видит превью.
      onAdd(result);
      setBrief("");

      // 2. Параллельно догружаем фоны для всех слайдов в фоне (как в сториз).
      void autoGenerateCarouselBackgrounds(result, embedTextDefault, imageStyle, customImagePrompt.trim());
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  /** Авто-генерация фонов для всех слайдов карусели с concurrency=2.
   *
   *  Раньше Promise.all запускал 7-10 параллельных gpt-image-2 → часть
   *  упиралась в rate-limit OpenAI или 60-сек таймаут роута. Юзер видел
   *  только 2-3 картинки. Concurrency=2 решает эту проблему.
   *  Использует массив results[] (как в сториз) чтобы избежать race condition. */
  const autoGenerateCarouselBackgrounds = async (
    carousel: GeneratedCarousel,
    embedText: boolean,
    style: ImageStyleKey,
    customPrompt: string,
  ) => {
    const brandVisual = brandBook?.visualStyle?.trim();
    const brandColorsLine = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
    const stylePhrase = stylePhraseFor(style);

    setBgProgress({ ready: 0, attempted: 0, total: carousel.slides.length, carouselId: carousel.id });
    type SlideResult = { imageUrl: string; hasEmbeddedText: boolean } | null;
    const results: SlideResult[] = new Array(carousel.slides.length).fill(null);

    await runWithConcurrency(carousel.slides, 2, async (slide, i) => {
      try {
        const slideText = embedText
          ? [slide.headlineText?.trim(), slide.bodyText?.trim(), ...(slide.bulletPoints ?? [])].filter(Boolean).join("\n")
          : "";
        const seed = `${carousel.id.slice(-4)}-slide-${i + 1}`;
        const baseScene = customPrompt
          ? `${customPrompt} (variation for slide ${i + 1}: ${slide.background})`
          : `Carousel slide for ${carousel.platform}: ${slide.background}.`;
        const prompt = [
          baseScene,
          slide.visualNote && `Mood: ${slide.visualNote}.`,
          `Variation: ${seed}.`,
          stylePhrase,
          brandVisual && `Brand visual style: ${brandVisual}.`,
          brandColorsLine,
          embedText
            ? "Vertical 9:16 format. Leave clean space for typography."
            : "Vertical 9:16 format. No text overlay. Clean composition.",
        ].filter(Boolean).join(" ");

        const res = await fetch("/api/generate-image-anthropic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postText: prompt,
            format: "сторис",
            platform: carousel.platform,
            brandColors: brandBook?.colors ?? [],
            brandStyle: brandBook?.visualStyle ?? "",
            embedText: slideText || undefined,
          }),
        });
        // Защита от HTML-ответа (воркер-прокси / Next.js error page) —
        // см. аналогичный комментарий в StoriesView. JSON.parse на HTML
        // падает с «Unexpected token '<'», юзер видит кашу.
        const rawText = await res.text();
        let j: { ok: boolean; data?: { imageUrl: string }; error?: string };
        try {
          j = JSON.parse(rawText);
        } catch {
          const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
          const friendly = titleMatch?.[1]?.trim()
            || (res.status >= 500 ? "Сервер вернул HTML-ошибку вместо JSON (прокси/Next.js упали)"
                : `HTTP ${res.status}: ${rawText.slice(0, 100)}`);
          j = { ok: false, error: friendly };
        }
        if (j.ok && j.data?.imageUrl) {
          results[i] = { imageUrl: j.data.imageUrl, hasEmbeddedText: !!slideText };
          // Прогрессивно обновляем — каждый завершившийся слайд виден сразу
          const partialSlides = carousel.slides.map((s, idx) => {
            const r = results[idx];
            return r ? { ...s, backgroundImageUrl: r.imageUrl, hasEmbeddedText: r.hasEmbeddedText } : s;
          });
          onUpdate({ ...carousel, slides: partialSlides });
          setBgProgress(p => p && p.carouselId === carousel.id ? { ...p, ready: p.ready + 1, attempted: p.attempted + 1 } : p);
        } else {
          // ok=false — сохраняем текст ошибки чтобы юзер видел причину
          // вместо тихого «0 из N».
          const errText = j.error ?? `HTTP ${res.status}`;
          console.error(`[carousel-bg] slide ${i + 1} failed:`, errText);
          setBgProgress(p => p && p.carouselId === carousel.id ? { ...p, attempted: p.attempted + 1, lastError: errText } : p);
        }
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err);
        console.error(`[carousel-bg] slide ${i + 1} exception:`, errText);
        setBgProgress(p => p && p.carouselId === carousel.id ? { ...p, attempted: p.attempted + 1, lastError: errText } : p);
      }
    });

    // Только при полном успехе скрываем через 5 сек. При ошибках —
    // баннер остаётся пока юзер не закроет (×), чтобы успеть прочитать.
    if (results.every(r => r != null)) {
      setTimeout(() => setBgProgress(null), 5000);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)",
    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const accent = "#ec4899";

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 12, letterSpacing: -0.5 }}>
          <Layers size={26} /> Карусель-посты
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
          Серии Instagram-каруселей: 6–10 слайдов с обложкой, контентом и CTA. Фоны генерируются по запросу.
        </p>
      </div>

      {/* Generator form */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow-lg)", marginBottom: 24, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid var(--muted)`, background: `linear-gradient(135deg, var(--card) 50%, ${accent}08 100%)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={16} /> Создать карусель</div>
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

            {/* Slides count — теперь ручной ввод, 3-15 */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                КОЛ-ВО СЛАЙДОВ ({slidesCount})
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range" min={3} max={15} step={1}
                  value={slidesCount}
                  onChange={e => setSlidesCount(Number(e.target.value))}
                  style={{ flex: 1, accentColor: accent }}
                />
                <input
                  type="number" min={3} max={15}
                  value={slidesCount}
                  onChange={e => {
                    const n = Math.max(3, Math.min(15, Number(e.target.value) || 7));
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
                {["обучение", "прогрев", "продажа", "вовлечение", "экспертность", "анонс", "миф-факт"].map(g => (
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
                format="carousel"
                myCompany={myCompany}
                taResult={taResult}
                smmResult={smmAnalysis as import("@/lib/smm-types").SMMResult | null}
                brandBook={brandBook}
                accentColor="#ec4899"
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
              placeholder="Например: «5 ошибок при выборе Х», «как мы увеличили Х на 40%», «разбор кейса клиента»"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {/* Чекбокс «Встроить текст в картинку» — глобально для всех слайдов */}
          <label style={{
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none",
            marginBottom: 14, padding: "10px 12px", borderRadius: 9,
            background: embedTextDefault ? `${accent}10` : "transparent",
            border: `1.5px dashed ${embedTextDefault ? accent : "var(--border)"}`,
          }}>
            <input
              type="checkbox"
              checked={embedTextDefault}
              onChange={e => setEmbedTextDefault(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: accent, cursor: "pointer", flexShrink: 0 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                Встроить текст в каждый слайд
                <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: accent, color: "#fff", marginLeft: 5 }}>NEW</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                gpt-image-2 нарисует текст слайдов прямо на изображениях. Промпт каждого слайда можно отредактировать перед запуском.
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
                    placeholder="Modern infographic design with clean typography, gradient background, professional editorial style..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8,
                      background: "var(--background)", border: "1px solid var(--border)",
                      color: "var(--foreground)", fontSize: 12, fontFamily: "ui-monospace, monospace",
                      outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Если пусто — AI сам опишет каждый слайд. Если заполнено — этот промпт станет базой для всех слайдов карусели (с вариацией).
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
              background: generating ? "var(--muted)" : `linear-gradient(135deg, #ec4899, #f472b6)`,
              color: generating ? "var(--muted-foreground)" : "#fff",
              boxShadow: generating ? "none" : `0 4px 16px ${accent}40` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {generating ? <><Loader2 size={16} className="spin" /> Генерируем карусель…</> : <><Layers size={16} /> Создать карусель</>}
            </span>
          </button>
        </div>
      </div>

      {/* Auto-bg progress banner — синхронизирован со стилем сториз:
         спокойный pink-вариант пока идёт работа, красный warning если
         часть слайдов не получилась. */}
      {bgProgress && (bgProgress.attempted < bgProgress.total || bgProgress.ready < bgProgress.total) && (() => {
        const inProgress = bgProgress.attempted < bgProgress.total;
        const failed = bgProgress.total - bgProgress.ready;
        return (
          <div style={{
            marginBottom: 16,
            padding: "12px 18px",
            background: inProgress
              ? "color-mix(in oklch, #ec4899 8%, var(--card))"
              : "color-mix(in oklch, var(--destructive) 8%, var(--card))",
            border: `1.5px solid ${inProgress
              ? "color-mix(in oklch, #ec4899 35%, var(--border))"
              : "color-mix(in oklch, var(--destructive) 35%, var(--border))"}`,
            borderRadius: 12,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: inProgress
                ? "color-mix(in oklch, #ec4899 18%, transparent)"
                : "color-mix(in oklch, var(--destructive) 18%, transparent)",
              color: inProgress ? "#ec4899" : "var(--destructive)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {inProgress
                ? <Loader2 size={18} className="spin" />
                : <span style={{ fontSize: 16 }}>⚠️</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "var(--foreground)" }}>
                {inProgress
                  ? `Рисую фоны слайдов: ${bgProgress.ready} / ${bgProgress.total}`
                  : `Нарисовано ${bgProgress.ready} из ${bgProgress.total} — ${failed} не вышло`}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                {inProgress
                  ? "Каждый слайд получит уникальную картинку. Можно продолжать работу."
                  : "Откройте карусель и нажмите «Перегенерировать фон» на пустых слайдах."}
              </div>
              {/* Реальный текст ошибки — раньше глоталось молча. */}
              {!inProgress && bgProgress.lastError && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8,
                  background: "color-mix(in oklch, var(--destructive) 12%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--destructive) 30%, transparent)",
                  fontSize: 11.5, color: "var(--destructive)", fontFamily: "ui-monospace, monospace",
                  wordBreak: "break-word",
                }}>
                  Ошибка: {bgProgress.lastError.slice(0, 280)}
                </div>
              )}
            </div>
            {!inProgress && (
              <button
                onClick={() => setBgProgress(null)}
                style={{
                  background: "transparent", border: "none",
                  color: "var(--muted-foreground)", cursor: "pointer",
                  fontSize: 18, padding: 4, lineHeight: 1, flexShrink: 0,
                }}
                title="Скрыть"
              >×</button>
            )}
          </div>
        );
      })()}

      {/* List */}
      {carousels.length === 0 ? (
        <>
          {onboardingState && (
            <OnboardingChecklist
              state={onboardingState}
              onNavigate={(nav) => { window.location.href = `/?nav=${nav}`; }}
            />
          )}
          <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "44px 28px", textAlign: "center", boxShadow: "var(--shadow)" }}>
            <style>{".spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "color-mix(in srgb, #ec4899 12%, transparent)", color: "#ec4899", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Layers size={30} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>Пока нет каруселей</div>
            <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
              Заполните форму выше — карусель из 5-7 слайдов с текстом и фонами появится через 30-60 секунд.
            </div>
          </div>
        </>
      ) : (() => {
        const counts = {
          drafts: carousels.filter(c => computeStatus(c) === "drafts").length,
          scheduled: carousels.filter(c => computeStatus(c) === "scheduled").length,
          published: carousels.filter(c => computeStatus(c) === "published").length,
        };
        const filtered = carousels.filter(c => computeStatus(c) === statusTab);
        return (
          <>
            <StatusTabs value={statusTab} onChange={setStatusTab} counts={counts} />
            {filtered.length === 0 ? (
              <div style={{ padding: "28px 24px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14, background: "var(--card)", borderRadius: 14, border: "1px dashed var(--border)" }}>
                В этой вкладке пока пусто
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filtered.map(car => (
                  <CarouselCard key={car.id} c={c} carousel={car} onDelete={onDelete} onUpdate={onUpdate} brandBook={brandBook} />
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function CarouselCard({ c, carousel, onDelete, onUpdate, brandBook }: {
  c: Colors;
  carousel: GeneratedCarousel;
  onDelete: (id: string) => void;
  onUpdate: (updated: GeneratedCarousel) => void;
  brandBook?: BrandBook;
}) {
  // По умолчанию свёрнуто — см. комментарий в StoryCard.
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  // Какому слайду открыли промпт-редактор. null = не открыт.
  const [promptEditorSlide, setPromptEditorSlide] = useState<number | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Включён ли режим «текст внутри картинки» (gpt-image-2). По умолчанию off:
  // CSS-оверлей идеально читаем, gpt-image-2 жжёт квоту и иногда ошибается в
  // спеллинге. Пользователь включает осознанно для премиальных каруселей.
  const [embedTextMode, setEmbedTextMode] = useState(false);
  const accent = "#ec4899";

  // Хелпер для построения seed-параметров: его съест ImagePromptEditor чтобы
  // запросить у Claude стартовый промпт под конкретный слайд (учитывая
  // headline, slideType и общий vibe карусели).
  const promptParamsForSlide = (slide: CarouselSlide) => ({
    postText: [
      `Carousel slide background. Slide type: ${slide.slideType}.`,
      `Background description: ${slide.background}.`,
      slide.visualNote && `Mood: ${slide.visualNote}.`,
    ].filter(Boolean).join(" "),
    hook: slide.headlineText,
    // "сторис" → Claude напишет промпт сразу под vertical 9:16, чтобы превью
    // не выглядело как растянутый square.
    format: "сторис",
    platform: carousel.platform,
    brandColors: brandBook?.colors ?? [],
    brandStyle: brandBook?.visualStyle ?? "",
  });

  // Собирает «вшиваемый» в картинку текст слайда: заголовок + буллеты/тело.
  // Только когда включён embedTextMode и слайд их имеет.
  const buildEmbedText = (s: CarouselSlide): string => {
    const lines: string[] = [];
    if (s.headlineText) lines.push(s.headlineText.trim());
    if (s.bulletPoints && s.bulletPoints.length > 0) {
      for (const b of s.bulletPoints) {
        const t = b.trim();
        if (t) lines.push(`• ${t}`);
      }
    } else if (s.bodyText) {
      lines.push(s.bodyText.trim());
    }
    return lines.join("\n");
  };

  const handleGenerateBgWithPrompt = async (slideIndex: number, userPrompt: string) => {
    setBgError(null);
    const targetSlide = carousel.slides[slideIndex];
    const embedText = embedTextMode && targetSlide ? buildEmbedText(targetSlide) : "";
    const res = await fetch("/api/generate-image-anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postText: "carousel slide", // пустышка, реальный промпт идёт в userPrompt
        // Используем "сторис" чтобы DALL-E рендерил вертикальный 9:16 кадр —
        // карусели у нас показываются в сторис-формате, картинки должны совпадать.
        format: "сторис",
        platform: carousel.platform,
        brandColors: brandBook?.colors ?? [],
        brandStyle: brandBook?.visualStyle ?? "",
        userPrompt,
        // Когда задан — gpt-image-2 нарисует ЭТО прямо на картинке;
        // оверлей с текстом скроется (см. рендер ниже).
        embedText: embedText || undefined,
      }),
    });
    const json = await jsonOrThrow<{ ok: boolean; data?: { imageUrl: string }; error?: string }>(res);
    if (!json.ok) {
      const msg = json.error ?? "Ошибка генерации";
      setBgError(msg);
      throw new Error(msg);
    }
    const updatedSlides = carousel.slides.map((s, i) =>
      i === slideIndex
        ? { ...s, backgroundImageUrl: json.data!.imageUrl, hasEmbeddedText: !!embedText }
        : s,
    );
    onUpdate({ ...carousel, slides: updatedSlides });
    setPromptEditorSlide(null);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText([carousel.caption, "", carousel.hashtags.join(" ")].join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const platformLabel = {
    instagram: <><Camera size={11} style={{ marginRight: 4 }} />Instagram</>,
    vk: <><Users size={11} style={{ color: "#4a76a8", marginRight: 4 }} />VK</>,
    telegram: <><Send size={11} style={{ color: "#229ED9", marginRight: 4 }} />Telegram</>,
  }[carousel.platform];

  const slide: CarouselSlide | undefined = carousel.slides[activeSlide];
  const slideTypeColor = (t: CarouselSlide["slideType"]) =>
    t === "cover" ? "#f59e0b" : t === "cta" ? "#10b981" : "#6366f1";

  return (
    <div style={{ background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expanded ? "1px solid var(--muted)" : "none", cursor: "pointer", gap: 12, flexWrap: "wrap" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8, background: accent + "18", color: accent, flexShrink: 0 }}>Карусель</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0, textTransform: "capitalize" }}>{platformLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0 }}>{carousel.slides.length} слайдов</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.2 }}>{carousel.title}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <select
            value={carousel.manualStatus ?? (carousel.publishStatus?.vk?.ok || carousel.publishStatus?.telegram?.ok ? "published" : (carousel.scheduledFor && new Date(carousel.scheduledFor) > new Date() ? "scheduled" : "drafts"))}
            onChange={e => onUpdate({ ...carousel, manualStatus: e.target.value as "drafts" | "scheduled" | "published" })}
            style={{
              padding: "5px 10px", borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--background)", color: "var(--foreground-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <option value="drafts">📝 Черновик</option>
            <option value="scheduled">📅 Запланирован</option>
            <option value="published">✅ Опубликован</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{new Date(carousel.generatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</span>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {/* Compact preview — миниатюры слайдов + заголовок cover-слайда. */}
      {!expanded && (
        <div
          style={{
            padding: "12px 22px 14px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            cursor: "pointer",
            background: "color-mix(in oklch, var(--muted) 30%, var(--card))",
          }}
          onClick={() => setExpanded(true)}
        >
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {carousel.slides.slice(0, 6).map((s, i) => (
              <div
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: s.backgroundImageUrl
                    ? `url(${s.backgroundImageUrl}) center/cover`
                    : `linear-gradient(135deg, ${slideTypeColor(s.slideType)}30, ${slideTypeColor(s.slideType)}10)`,
                  border: `1px solid ${slideTypeColor(s.slideType)}40`,
                  flexShrink: 0,
                }}
              />
            ))}
            {carousel.slides.length > 6 && (
              <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: "var(--background)",
                border: `1px solid var(--border)`,
                fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>+{carousel.slides.length - 6}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {carousel.slides[0]?.headlineText || "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {carousel.goal} · {carousel.hashtags.slice(0, 3).join(" ")}
            </div>
          </div>
          <div style={{ fontSize: 12, color: accent, fontWeight: 600, whiteSpace: "nowrap" }}>
            Развернуть →
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {/* Slide navigator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {carousel.slides.map((s, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${activeSlide === i ? slideTypeColor(s.slideType) : "var(--border)"}`,
                  background: activeSlide === i ? slideTypeColor(s.slideType) : "var(--background)", color: activeSlide === i ? "#fff" : "var(--foreground-secondary)",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {i + 1}
              </button>
            ))}
          </div>

          {/* Active slide */}
          {slide && (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
              {/* Story-format mockup (9:16) — 260×462 */}
              <div
                onClick={() => slide.backgroundImageUrl && setLightboxUrl(slide.backgroundImageUrl)}
                title={slide.backgroundImageUrl ? "Открыть на весь экран" : undefined}
                style={{
                  borderRadius: 14, width: 260, height: 462,
                  display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.25)", position: "relative", overflow: "hidden",
                  background: slide.backgroundImageUrl ? "transparent" : "#111",
                  cursor: slide.backgroundImageUrl ? "zoom-in" : "default",
                }}
              >
                {slide.backgroundImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.backgroundImageUrl} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                )}
                {/* Иконка-индикатор клика для увеличения */}
                {slide.backgroundImageUrl && (
                  <div style={{
                    position: "absolute", top: 8, right: 8, zIndex: 3,
                    background: "rgba(0,0,0,0.55)", borderRadius: 7,
                    padding: 5, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", pointerEvents: "none",
                    backdropFilter: "blur(6px)",
                  }}>
                    <Maximize2 size={12} />
                  </div>
                )}
                {/* Затемнение и оверлей-текст скрываем, если текст уже вшит
                    в саму картинку через gpt-image-2 — иначе будет дубль. */}
                {!slide.hasEmbeddedText && (
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 100%)", zIndex: 1 }} />
                )}

                <div style={{ position: "relative", zIndex: 2, padding: 16, textAlign: "center", width: "100%" }}>
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    fontSize: 8, fontWeight: 800, padding: "3px 6px", borderRadius: 4,
                    background: slideTypeColor(slide.slideType), color: "#fff", letterSpacing: "0.05em",
                  }}>
                    {slide.slideType.toUpperCase()}
                  </div>
                  {!slide.hasEmbeddedText && (
                    <>
                      <div style={{
                        fontSize: slide.slideType === "cover" ? 20 : 15,
                        fontWeight: 900, color: "#fff", lineHeight: 1.25,
                        marginBottom: 10, textShadow: "0 2px 6px rgba(0,0,0,0.85)",
                      }}>{slide.headlineText}</div>
                      {slide.bodyText && (
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", lineHeight: 1.45, marginBottom: 6, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{slide.bodyText}</div>
                      )}
                      {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                        <div style={{ textAlign: "left", display: "inline-block" }}>
                          {slide.bulletPoints.map((b, i) => (
                            <div key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.95)", marginBottom: 3, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                              • {b}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                    {activeSlide + 1} / {carousel.slides.length}
                  </div>
                </div>
              </div>

              {/* Slide details */}
              <div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, textTransform: "uppercase" }}>Фон</div>
                    <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.55, marginBottom: 10 }}>{slide.background}</div>

                    {/* Toggle: текст внутри картинки (gpt-image-2). По умолчанию выключен.
                        При включении следующая генерация фона «впечёт» заголовок и буллеты
                        прямо в изображение, оверлей скроется. */}
                    <label
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "9px 12px", marginBottom: 10,
                        borderRadius: 9, border: `1.5px dashed ${embedTextMode ? accent : "var(--border)"}`,
                        background: embedTextMode ? accent + "08" : "transparent",
                        cursor: "pointer", userSelect: "none",
                      }}
                      title="AI нарисует заголовок и буллеты прямо на картинке вместо CSS-оверлея"
                    >
                      <input
                        type="checkbox"
                        checked={embedTextMode}
                        onChange={e => setEmbedTextMode(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: accent, cursor: "pointer", flexShrink: 0 }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                          Встроить текст в картинку <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: accent, color: "#fff", marginLeft: 4, verticalAlign: "middle" }}>NEW</span>
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                          gpt-image-2 нарисует заголовок и буллеты в типографике (медленнее, дороже, но смотрится как дизайн).
                        </span>
                      </div>
                    </label>

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
                        title="Промпт для фона слайда"
                        generateLabel={slide.backgroundImageUrl ? "Перегенерировать фон" : "Сгенерировать фон"}
                        onGenerate={(p) => handleGenerateBgWithPrompt(activeSlide, p)}
                        onCancel={() => setPromptEditorSlide(null)}
                      />
                    )}
                  </div>
                  <Field label="Тип слайда" value={slide.slideType} accent={slideTypeColor(slide.slideType)} bold />
                  <Field label="Заголовок" value={slide.headlineText} bold />
                  {slide.bodyText && <Field label="Текст" value={slide.bodyText} />}
                  {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 2 }}>ТЕЗИСЫ</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
                        {slide.bulletPoints.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}
                  {(slide.backgroundRu || slide.background) && (
                    <Field label="🎨 Что будет на картинке" value={slide.backgroundRu || slide.background} muted />
                  )}
                  <Field label="Режиссёрская пометка" value={slide.visualNote} muted />
                </div>
                {/* Nav arrows */}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0}
                    style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600, cursor: activeSlide === 0 ? "not-allowed" : "pointer", opacity: activeSlide === 0 ? 0.4 : 1 }}>
                    ← Назад
                  </button>
                  <button onClick={() => setActiveSlide(Math.min(carousel.slides.length - 1, activeSlide + 1))} disabled={activeSlide === carousel.slides.length - 1}
                    style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600, cursor: activeSlide === carousel.slides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide === carousel.slides.length - 1 ? 0.4 : 1 }}>
                    Вперёд →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Caption */}
          {carousel.caption && (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: "var(--background)", border: `1px solid var(--border)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>ТЕКСТ ПОСТА ПОД КАРУСЕЛЬЮ</div>
                <button onClick={copyCaption}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: accent, background: "transparent", border: `1px solid ${accent}40`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>
                  <Copy size={12} /> {copied ? "Скопировано" : "Копировать"}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{carousel.caption}</div>
            </div>
          )}

          {/* Метрики карусели — те же поля что и у поста. */}
          <MetricsBlock
            c={c}
            kind="carousel"
            metrics={carousel.metrics}
            onChange={next => onUpdate({ ...carousel, metrics: next })}
            locked={carousel.manualStatus !== "published" && !(carousel.publishStatus?.vk?.ok || carousel.publishStatus?.telegram?.ok)}
          />

          {/* Hashtags + delete */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {carousel.hashtags.map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {confirmDelete ? (
                <>
                  <button onClick={() => onDelete(carousel.id)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "var(--destructive)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
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
          filename={`carousel-${carousel.id}-slide-${activeSlide + 1}.png`}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}

function Field({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: accent ?? (muted ? "var(--muted-foreground)" : "var(--foreground-secondary)"), fontWeight: bold ? 700 : 400, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
