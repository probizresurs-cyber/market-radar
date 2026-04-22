"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { ContentPlan, GeneratedCarousel, BrandBook, CarouselSlide } from "@/lib/content-types";
import { Layers, Sparkles, Camera, Users, Send, Loader2, RefreshCw, Copy } from "lucide-react";

export function GeneratedCarouselsView({ c, carousels, plan, smmAnalysis, companyName, brandBook, onAdd, onDelete, onUpdate }: {
  c: Colors;
  carousels: GeneratedCarousel[];
  plan: ContentPlan | null;
  smmAnalysis: unknown;
  companyName: string;
  brandBook: BrandBook;
  onAdd: (carousel: GeneratedCarousel) => void;
  onDelete: (id: string) => void;
  onUpdate: (carousel: GeneratedCarousel) => void;
}) {
  const [platform, setPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  const [slidesCount, setSlidesCount] = useState<6 | 7 | 8 | 10>(7);
  const [goal, setGoal] = useState("обучение");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState(plan?.pillars?.[0]?.name ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, platform, slidesCount, goal, brief, pillar, smmAnalysis, brandBook }),
      });
      const json = await res.json() as { ok: boolean; data?: GeneratedCarousel; error?: string };
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
  const accent = "#ec4899";

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}><Layers size={22} /> Карусель-посты</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Серии Instagram-каруселей 6–10 слайдов с обложкой, контентом и CTA</p>
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
                {([6, 7, 8, 10] as const).map(n => (
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
                {["обучение", "прогрев", "продажа", "вовлечение", "экспертность", "анонс", "миф-факт"].map(g => (
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
              placeholder="Например: «5 ошибок при выборе Х», «как мы увеличили Х на 40%», «разбор кейса клиента»"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
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

      {/* List */}
      {carousels.length === 0 ? (
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 40, textAlign: "center", boxShadow: "var(--shadow)" }}>
          <style>{".spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--muted-foreground)" }}><Layers size={40} /></div>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)" }}>Пока нет каруселей. Заполните форму выше и нажмите «Создать».</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {carousels.map(car => (
            <CarouselCard key={car.id} c={c} carousel={car} onDelete={onDelete} onUpdate={onUpdate} brandBook={brandBook} />
          ))}
        </div>
      )}
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
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [generatingBg, setGeneratingBg] = useState<number | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const accent = "#ec4899";

  const handleGenerateBg = async (slideIndex: number) => {
    const slide = carousel.slides[slideIndex];
    if (!slide) return;
    setGeneratingBg(slideIndex);
    setBgError(null);
    try {
      const brandVisual = brandBook?.visualStyle?.trim();
      const brandColors = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
      const prompt = [
        `Instagram carousel slide background for ${carousel.platform}: ${slide.background}.`,
        `Slide type: ${slide.slideType}. Headline: "${slide.headlineText}".`,
        `Mood: ${slide.visualNote}.`,
        brandVisual && `Brand visual style: ${brandVisual}.`,
        brandColors,
        "Square 1:1 format. Clean, modern, space for text overlay at top/center.",
      ].filter(Boolean).join(" ");

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");

      const updatedSlides = carousel.slides.map((s, i) =>
        i === slideIndex ? { ...s, backgroundImageUrl: json.data!.imageUrl } : s,
      );
      onUpdate({ ...carousel, slides: updatedSlides });
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGeneratingBg(null);
    }
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
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expanded ? `1px solid var(--muted)` : "none", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: accent + "15", color: accent, flexShrink: 0 }}>CAROUSEL</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0 }}>{platformLabel}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: "var(--background)", color: "var(--muted-foreground)", flexShrink: 0 }}>{carousel.slides.length} слайдов</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carousel.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{new Date(carousel.generatedAt).toLocaleDateString("ru-RU")}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

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
              {/* Square mockup (Instagram 1:1) */}
              <div style={{
                borderRadius: 14, width: 260, height: 260,
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                boxShadow: "0 6px 20px rgba(0,0,0,0.25)", position: "relative", overflow: "hidden",
                background: slide.backgroundImageUrl ? "transparent" : "#111",
              }}>
                {slide.backgroundImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.backgroundImageUrl} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 100%)", zIndex: 1 }} />

                <div style={{ position: "relative", zIndex: 2, padding: 16, textAlign: "center", width: "100%" }}>
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    fontSize: 8, fontWeight: 800, padding: "3px 6px", borderRadius: 4,
                    background: slideTypeColor(slide.slideType), color: "#fff", letterSpacing: "0.05em",
                  }}>
                    {slide.slideType.toUpperCase()}
                  </div>
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
                  <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                    {activeSlide + 1} / {carousel.slides.length}
                  </div>
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
