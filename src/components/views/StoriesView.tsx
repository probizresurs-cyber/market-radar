"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { ContentPlan, GeneratedStory, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import { Smartphone, Sparkles, Camera, Users, Send, Loader2, RefreshCw } from "lucide-react";

export function StoriesView({ c, stories, plan, smmAnalysis, companyName, brandBook, onAdd, onDelete, onUpdate }: {
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
    border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)",
    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const accent = "#a855f7";

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}><Smartphone size={22} /> Сторис-сценарии</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Серии сторис с поэкранной структурой, стикерами и CTA</p>
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
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ПЛАТФОРМА</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["instagram", "vk", "telegram"] as const).map(p => (
                  <button key={p} onClick={() => setPlatform(p)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${platform === p ? accent : "var(--border)"}`,
                      background: platform === p ? accent + "15" : "var(--background)", color: platform === p ? accent : "var(--foreground-secondary)",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                    {p === "instagram" ? <><Camera size={13} style={{ marginRight: 4 }} />Insta</> : p === "vk" ? <><Users size={13} style={{ color: "#4a76a8", marginRight: 4 }} />VK</> : <><Send size={13} style={{ color: "#229ED9", marginRight: 4 }} />TG</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Slides count */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>КОЛ-ВО СЛАЙДОВ</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([3, 5, 7] as const).map(n => (
                  <button key={n} onClick={() => setSlidesCount(n)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${slidesCount === n ? accent : "var(--border)"}`,
                      background: slidesCount === n ? accent + "15" : "var(--background)", color: slidesCount === n ? accent : "var(--foreground-secondary)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕЛЬ</label>
              <select value={goal} onChange={e => setGoal(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {["прогрев", "продажа", "охват", "вовлечение", "обучение", "анонс", "доверие"].map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Pillar */}
            {plan?.pillars?.length ? (
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>КОНТЕНТ-СТОЛП</label>
                <select value={pillar} onChange={e => setPillar(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— свободная тема —</option>
                  {plan.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {/* Brief */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>
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

      {/* Stories list */}
      {stories.length === 0 ? (
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 40, textAlign: "center", boxShadow: "var(--shadow)" }}>
          <style>{".spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--muted-foreground)" }}><Smartphone size={40} /></div>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)" }}>Пока нет сгенерированных сторис. Заполните форму выше и нажмите «Создать».</div>
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

export function StoryCard({ c, story, onDelete, onUpdate, brandBook }: {
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{new Date(story.generatedAt).toLocaleDateString("ru-RU")}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

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
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 4 }}>ФОН</div>
                      <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5, marginBottom: 6 }}>{slide.background}</div>
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {generatingBg === activeSlide
                            ? <><Loader2 size={13} className="spin" /> Генерируем…</>
                            : slide.backgroundImageUrl
                              ? <><RefreshCw size={13} /> Перегенерировать фон</>
                              : <><Sparkles size={13} /> Сгенерировать фон</>}
                        </span>
                      </button>
                      {bgError && <div style={{ marginTop: 4, fontSize: 10, color: "var(--destructive)" }}>❌ {bgError}</div>}
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

