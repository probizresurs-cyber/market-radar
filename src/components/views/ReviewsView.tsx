"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { Review, ReviewAnalysis } from "@/lib/review-types";

export function ReviewsView({ c, companyName }: {
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

