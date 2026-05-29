"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { Review, ReviewAnalysis } from "@/lib/review-types";
import { DataBadge } from "@/components/ui/DataBadge";
import { AISummary } from "@/components/ui/AISummary";
import { SentimentTimeline } from "@/components/ui/SentimentTimeline";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

export function ReviewsView({ c, companyName, domain, niche }: {
  c: Colors;
  companyName: string;
  /** Домен компании — улучшает результат search-maps (URL + name-derivative). */
  domain?: string;
  /** Ниша/описание — добавляется как ключ к запросу. */
  niche?: string;
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
  // Сколько отзывов тянуть с каждой платформы. По умолчанию 20.
  const [limit, setLimit] = useState<number>(20);

  const runAutoFetch = async (name: string, address?: string) => {
    setAutoFetchStatus("loading");
    const log: string[] = [];
    const fetched: Review[] = [];

    // АВТО-ДЕТЕКТ URL: если в name/address пользователь вставил ссылку на
    // Yandex Maps или 2GIS — извлекаем orgId/firmId и ходим напрямую по нему,
    // а текстовый адрес чистим. Это спасает от типовой ошибки:
    // «вставил URL в Адрес → search-maps ничего не нашёл».
    const all = `${name} ${address ?? ""}`;
    const yandexUrlMatch = all.match(/yandex\.(?:ru|com)\/maps\/(?:org\/)?(?:[\w-]+\/)?(\d{6,})/i);
    const gisUrlMatch = all.match(/2gis\.[a-z]+\/[\w-]+\/firm\/(\d+)/i);
    const yandexOrgId = yandexUrlMatch?.[1];
    const gisFirmUrl = gisUrlMatch ? `https://2gis.ru/firm/${gisUrlMatch[1]}` : "";
    // Если ввёл URL в адрес — убираем его из текста чтобы не путал search
    const cleanAddress = (address ?? "")
      .replace(/https?:\/\/[^\s]+/g, "")
      .trim() || undefined;
    const cleanName = name.replace(/https?:\/\/[^\s]+/g, "").trim() || companyName;

    // Google Places — лимит API: максимум 5 отзывов на place (это ограничение Google,
    // не наше). Если юзер выбрал больше — всё равно вернётся не больше 5.
    try {
      const res = await fetch("/api/fetch-reviews-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: cleanName, address: cleanAddress, limit, domain, niche }),
      });
      const json = await jsonOrThrow(res);
      if (json.ok && json.data.reviews.length > 0) {
        fetched.push(...json.data.reviews);
        const placeName = json.data.placeName ? ` «${json.data.placeName}»` : "";
        const note = json.data.reviewCount > json.data.reviews.length
          ? ` из ${json.data.reviewCount} на платформе (Google API отдаёт максимум 5)`
          : "";
        log.push(`Google Maps${placeName}: ${json.data.reviews.length} отзывов (${json.data.rating}★)${note}`);
      } else if (json.ok && json.data.reviewCount > 0) {
        log.push(`Google Maps: найдено (${json.data.reviewCount} отзывов на платформе, но тексты недоступны)`);
      } else {
        log.push("Google Maps: не найдено");
      }
    } catch {
      log.push("Google Maps: ошибка загрузки");
    }

    // Яндекс.Карты — через публичный виджет
    try {
      const res = await fetch("/api/fetch-reviews-yandex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: cleanName, address: cleanAddress, limit, domain, niche,
          // Если в адрес/имя вставили URL Яндекс.Карт — берём orgId прямо из URL,
          // минуя поиск (он самый частый source 8 промахов).
          orgId: yandexOrgId,
        }),
      });
      const json = await jsonOrThrow(res);
      if (json.ok && json.data.reviews.length > 0) {
        fetched.push(...json.data.reviews);
        log.push(`Яндекс.Карты: ${json.data.reviews.length} отзывов (${json.data.rating}★)`);
      } else if (json.ok && json.data.note) {
        log.push(`Яндекс.Карты: ${json.data.note}`);
      } else {
        log.push("Яндекс.Карты: не найдено");
      }
    } catch {
      log.push("Яндекс.Карты: ошибка загрузки");
    }

    // 2GIS by name+address
    try {
      const res = await fetch("/api/fetch-reviews-2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: cleanName, address: cleanAddress, limit, domain, niche,
          // Прямой 2GIS-URL — даёт идеальный матчинг без поиска по имени.
          url: gisFirmUrl || undefined,
        }),
      });
      const json = await jsonOrThrow(res);
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
      const json = await jsonOrThrow(res);
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
      const json = await jsonOrThrow(res);
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
      const json = await jsonOrThrow(res);
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
      const json = await jsonOrThrow(res);
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
    rating >= 4 ? "var(--success)" : rating >= 3 ? "var(--warning)" : "var(--destructive)";

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? starColor(rating) : "var(--border)", fontSize: 14 }}>★</span>
    ));

  // --- TABS ---
  const tabs = [
    { id: "input" as const, label: "Добавить отзывы", icon: "+" },
    { id: "reviews" as const, label: `Отзывы (${reviews.length})`, icon: "💬" },
    { id: "analysis" as const, label: "Анализ", icon: "📊" },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--foreground)", margin: "0 0 8px", letterSpacing: -0.5 }}>Анализ отзывов</h1>
      <p style={{ color: "var(--muted-foreground)", margin: "0 0 24px", fontSize: 15, lineHeight: 1.5 }}>
        Собирайте отзывы клиентов с Яндекс.Карт, 2ГИС и Google Places, получайте AI-разбор тем, тональности и шаблоны ответов.
      </p>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 20px", borderRadius: 10, border: `1.5px solid ${tab === t.id ? "var(--primary)" : "var(--border)"}`,
            background: tab === t.id ? "var(--primary)" : "var(--card)", color: tab === t.id ? "#fff" : "var(--foreground)",
            minHeight: 40,
            cursor: "pointer", fontWeight: tab === t.id ? 700 : 600, fontSize: 14, transition: "all .15s",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        {reviews.length > 0 && (
          <button onClick={handleAnalyze} disabled={isAnalyzing} style={{
            marginLeft: "auto", padding: "8px 20px", borderRadius: 8, border: "none",
            background: isAnalyzing ? "var(--muted-foreground)" : "var(--success)", color: "#fff",
            cursor: isAnalyzing ? "wait" : "pointer", fontWeight: 700, fontSize: 13,
          }}>
            {isAnalyzing ? "Анализирую..." : `🧠 Анализировать (${reviews.length})`}
          </button>
        )}
      </div>

      {/* Auto-fetch status banner */}
      {autoFetchStatus === "loading" && (
        <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--primary) 7%, transparent)", color: "var(--primary)", marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid var(--primary)40`, borderTop: `2px solid var(--primary)`, borderRadius: "50%", animation: "mr-spin 1s linear infinite" }} />
          Загружаю отзывы с Google Maps и 2ГИС...
        </div>
      )}
      {autoFetchStatus === "done" && autoFetchLog.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--success) 7%, transparent)", color: "var(--foreground-secondary)", marginBottom: 16, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: "var(--success)" }}>✓ Автозагрузка:</span>
          {autoFetchLog.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklch, var(--destructive) 9%, transparent)", color: "var(--destructive)", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ===== INPUT TAB ===== */}
      {tab === "input" && (
        <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>

          {/* ── Address-based search ── */}
          <div style={{ background: "color-mix(in oklch, var(--primary) 3%, transparent)", borderRadius: 12, padding: 18, border: `1px solid var(--primary)25`, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>Поиск по адресу (точнее)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={addressSearchName}
                onChange={e => setAddressSearchName(e.target.value)}
                placeholder="Название компании"
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, outline: "none" }}
              />
              <input
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                placeholder="Адрес (город, улица, дом) ИЛИ ссылка yandex.ru/maps/org/... / 2gis.ru/.../firm/..."
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, outline: "none" }}
              />
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: -4, lineHeight: 1.5 }}>
                💡 Если автопоиск не нашёл организацию — найдите её вручную на Яндекс.Картах или 2ГИС, скопируйте URL карточки и вставьте сюда. Мы извлечём id и пойдём по нему напрямую.
              </div>

              {/* Лимит отзывов на платформу */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Сколько тянуть:
                </span>
                {[5, 10, 20, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => setLimit(n)}
                    style={{
                      padding: "5px 12px", borderRadius: 7,
                      border: `1.5px solid ${limit === n ? "var(--primary)" : "var(--border)"}`,
                      background: limit === n ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                      color: limit === n ? "var(--primary)" : "var(--foreground-secondary)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {n}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  с каждой платформы. Google API отдаёт максимум 5.
                </span>
              </div>

              <button
                onClick={() => runAutoFetch(addressSearchName || companyName, addressInput.trim() || undefined)}
                disabled={autoFetchStatus === "loading"}
                style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: autoFetchStatus === "loading" ? "var(--muted-foreground)" : "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: autoFetchStatus === "loading" ? "wait" : "pointer", alignSelf: "flex-start" }}
              >
                {autoFetchStatus === "loading" ? "Ищу отзывы..." : `Найти отзывы (Google, Яндекс, 2ГИС)`}
              </button>
            </div>
          </div>

          {/* Input mode selector */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.04em" }}>ИЛИ ДОБАВЬТЕ ВРУЧНУЮ</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([
              { id: "paste" as const, label: "📋 Вставить текст", desc: "Скопируйте отзывы с любой платформы" },
              { id: "screenshot" as const, label: "📸 Скриншот", desc: "Загрузите скрин страницы отзывов" },
              { id: "2gis" as const, label: "🗺️ 2ГИС (ссылка)", desc: "Прямая ссылка на организацию в 2ГИС" },
            ] as const).map(mode => (
              <button key={mode.id} onClick={() => setInputMode(mode.id)} style={{
                flex: 1, padding: 16, borderRadius: 12, border: `2px solid ${inputMode === mode.id ? "var(--primary)" : "var(--border)"}`,
                background: inputMode === mode.id ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "transparent",
                cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", marginBottom: 4 }}>{mode.label}</div>
                <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>{mode.desc}</div>
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
                  width: "100%", minHeight: 200, padding: 16, borderRadius: 12, border: `1px solid var(--border)`,
                  background: "var(--background)", color: "var(--foreground)", fontSize: 14, fontFamily: "inherit", resize: "vertical",
                }}
              />
              <button
                onClick={handleExtractFromText}
                disabled={isExtracting || !pasteText.trim()}
                style={{
                  marginTop: 12, padding: "10px 24px", borderRadius: 8, border: "none",
                  background: isExtracting ? "var(--muted-foreground)" : "var(--primary)", color: "#fff",
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
              <p style={{ color: "var(--foreground-secondary)", fontSize: 13, marginBottom: 12 }}>
                Сделайте скриншот страницы отзывов на Яндекс.Картах, Отзовике, Авито или любой другой платформе.
                AI распознает платформу и извлечёт все отзывы.
              </p>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: 40, borderRadius: 12, border: `2px dashed var(--border)`,
                background: "var(--background)", cursor: "pointer", color: "var(--foreground-secondary)", fontSize: 14,
              }}>
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{ display: "none" }} />
                {isExtracting ? "Распознаю..." : "📸 Нажмите или перетащите скриншот"}
              </label>
            </div>
          )}

          {/* 2GIS mode */}
          {inputMode === "2gis" && (
            <div>
              <p style={{ color: "var(--foreground-secondary)", fontSize: 13, marginBottom: 12 }}>
                Вставьте ссылку на организацию в 2ГИС. Отзывы загрузятся автоматически через открытый API.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={gisUrl}
                  onChange={e => setGisUrl(e.target.value)}
                  placeholder="https://2gis.ru/moscow/firm/70000001012345678"
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, border: `1px solid var(--border)`,
                    background: "var(--background)", color: "var(--foreground)", fontSize: 14,
                  }}
                />
                <button
                  onClick={handleFetch2GIS}
                  disabled={isExtracting || !gisUrl.trim()}
                  style={{
                    padding: "10px 24px", borderRadius: 8, border: "none",
                    background: isExtracting ? "var(--muted-foreground)" : "var(--primary)", color: "#fff",
                    cursor: isExtracting ? "wait" : "pointer", fontWeight: 700, fontSize: 14,
                  }}
                >
                  {isExtracting ? "Загружаю..." : "Загрузить"}
                </button>
              </div>
            </div>
          )}

          {/* Platform hints */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "var(--background)", border: `1px solid var(--border)` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", marginBottom: 8 }}>Поддерживаемые платформы:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { name: "2ГИС", method: "Авто (ссылка)", color: "var(--success)" },
                { name: "Яндекс.Карты", method: "Скриншот / текст", color: "var(--warning)" },
                { name: "Google Maps", method: "Скриншот / текст", color: "var(--primary)" },
                { name: "Отзовик", method: "Скриншот / текст", color: "var(--warning)" },
                { name: "Авито", method: "Скриншот / текст", color: "var(--destructive)" },
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
            <div style={{ textAlign: "center", padding: 60, color: "var(--muted-foreground)" }}>
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
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--card)", border: `1px solid var(--border)`, fontSize: 13 }}>
                        <b>{reviews.length}</b> отзывов
                      </div>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--card)", border: `1px solid var(--border)`, fontSize: 13 }}>
                        Средняя оценка: <b style={{ color: starColor(Math.round(avg)) }}>{avg.toFixed(1)} ★</b>
                      </div>
                      {platforms.map(p => (
                        <div key={p} style={{ padding: "8px 14px", borderRadius: 8, background: "color-mix(in oklch, var(--primary) 7%, transparent)", fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                          {platformLabel(p)}: {reviews.filter(r => r.platform === p).length}
                        </div>
                      ))}
                      <button onClick={handleClearAll} style={{
                        marginLeft: "auto", padding: "8px 14px", borderRadius: 8, border: `1px solid var(--destructive)33`,
                        background: "transparent", color: "var(--destructive)", fontSize: 12, cursor: "pointer",
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
                    background: "var(--card)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow)",
                    borderLeft: `3px solid ${starColor(rev.rating)}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{rev.author}</span>
                        <span>{renderStars(rev.rating)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "2px 6px", borderRadius: 4, background: "color-mix(in oklch, var(--primary) 7%, transparent)" }}>
                          {platformLabel(rev.platform)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {rev.date && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{rev.date}</span>}
                        <button onClick={() => handleDeleteReview(rev.id)} style={{
                          background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16, padding: 2,
                        }}>
                          ×
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.5, margin: 0 }}>{rev.text}</p>
                    {rev.reply && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--background)", fontSize: 13, color: "var(--foreground-secondary)" }}>
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
            <div style={{ textAlign: "center", padding: 60, color: "var(--muted-foreground)" }}>
              {reviews.length === 0
                ? "Сначала добавьте отзывы"
                : "Нажмите «Анализировать» чтобы запустить AI-анализ"
              }
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* AI-summary по отзывам */}
              <AISummary
                dashboard="reviews"
                title={`${companyName} · ${reviews.length} отзывов`}
                data={{
                  company: companyName,
                  totalReviews: analysis.totalReviews,
                  avgRating: analysis.avgRating,
                  summary: analysis.summary,
                  sentiment: analysis.sentimentSummary,
                  strengths: analysis.strengths?.slice(0, 3),
                  weaknesses: analysis.weaknesses?.slice(0, 3),
                  topRecommendations: analysis.recommendations?.slice(0, 3),
                }}
              />

              {/* Sentiment timeline — динамика по месяцам */}
              <SentimentTimeline reviews={reviews} />

              {/* Summary */}
              <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: "var(--foreground)" }}>Общий вердикт</h3>
                    <DataBadge variant="ai" title="Тональность, темы и рекомендации — анализ AI по реальным отзывам из Google/2GIS/Яндекс.Карт." />
                  </div>
                  {analysis.analyzedAt && (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      Актуализировано: {new Date(analysis.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 15, color: "var(--foreground)", lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
              </div>

              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Отзывов", value: analysis.totalReviews.toString(), color: "var(--primary)" },
                  { label: "Средняя оценка", value: `${analysis.avgRating.toFixed(1)} ★`, color: starColor(Math.round(analysis.avgRating)) },
                  { label: "Позитивные", value: `${analysis.sentimentSummary.positive}`, color: "var(--success)" },
                  { label: "Негативные", value: `${analysis.sentimentSummary.negative}`, color: "var(--destructive)" },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background: "var(--card)", borderRadius: 12, padding: 16, textAlign: "center",
                    boxShadow: "var(--shadow)", borderTop: `3px solid ${kpi.color}`,
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginTop: 4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Rating distribution */}
              <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--foreground)" }}>Распределение оценок</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = analysis.ratingDistribution[star] ?? 0;
                    const pct = analysis.totalReviews > 0 ? (count / analysis.totalReviews) * 100 : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{star}★</span>
                        <div style={{ flex: 1, height: 20, borderRadius: 6, background: "var(--background)", overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", borderRadius: 6,
                            background: star >= 4 ? "var(--success)" : star >= 3 ? "var(--warning)" : "var(--destructive)",
                            transition: "width .3s",
                          }} />
                        </div>
                        <span style={{ width: 40, fontSize: 12, color: "var(--foreground-secondary)", textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Topics */}
              {analysis.topics.length > 0 && (
                <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--foreground)" }}>Темы отзывов</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {analysis.topics.map((topic, i) => {
                      const total = topic.positive + topic.negative + topic.neutral;
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: "var(--background)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{topic.topic}</span>
                            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{total} упоминаний</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--success)" }}>+{topic.positive}</span>
                            <span style={{ fontSize: 12, color: "var(--warning)" }}>{topic.neutral} нейтр.</span>
                            <span style={{ fontSize: 12, color: "var(--destructive)" }}>-{topic.negative}</span>
                          </div>
                          {topic.keyQuotes.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {topic.keyQuotes.map((q, qi) => (
                                <div key={qi} style={{
                                  fontSize: 12, color: "var(--foreground-secondary)", fontStyle: "italic",
                                  padding: "4px 8px", borderRadius: 6, background: "var(--card)",
                                  borderLeft: `2px solid var(--primary)`,
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
                <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--success)" }}>Сильные стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: 14, color: "var(--foreground)" }}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--destructive)" }}>Слабые стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} style={{ fontSize: 14, color: "var(--foreground)" }}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--foreground)" }}>Рекомендации</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 10, background: "color-mix(in oklch, var(--primary) 6%, transparent)",
                      fontSize: 14, color: "var(--foreground)", borderLeft: `3px solid var(--primary)`,
                    }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Templates */}
              {analysis.responseTemplates.length > 0 && (
                <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--foreground)" }}>Шаблоны ответов на отзывы</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {analysis.responseTemplates.map((tpl, i) => {
                      const typeLabel = tpl.type === "positive" ? "Позитивный" : tpl.type === "negative" ? "Негативный" : "Нейтральный";
                      const typeColor = tpl.type === "positive" ? "var(--success)" : tpl.type === "negative" ? "var(--destructive)" : "var(--warning)";
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: "var(--background)", borderLeft: `3px solid ${typeColor}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, marginBottom: 6 }}>{typeLabel} отзыв</div>
                          <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0, lineHeight: 1.5 }}>{tpl.template}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(tpl.template)}
                            style={{
                              marginTop: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid var(--border)`,
                              background: "transparent", color: "var(--foreground-secondary)", cursor: "pointer", fontSize: 11,
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

