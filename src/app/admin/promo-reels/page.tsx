/**
 * /admin/promo-reels
 *
 * Тестовая среда для пайплайна генерации промо-рилсов.
 * Под капотом — оркестратор /api/generate-promo-reel-full который:
 *  1. (опц) генерит AI-картинки через gpt-image-2
 *  2. (опц) пишет mobile-скринкаст платформы через Playwright
 *  3. рендерит финальный MP4 через Remotion с phone-frame и всем добром
 *
 * Дольше всех тяжёлых операций на платформе — полный пайплайн занимает
 * 4-5 минут. UI показывает прогресс по шагам + финальный плеер.
 *
 * История роликов хранится в localStorage по ключу mr_admin_promo_reels.
 * Сейчас admin-only, потом если зайдёт — будем рисковать выпускать
 * для всех premium-юзеров с понятным прогресс-баром.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import AdminNav from "../components/AdminNav";

interface ReelHistoryItem {
  id: string;
  createdAt: string;
  url: string;
  thumbnail?: string;
  hookText: string;
  problemText: string;
  ctaText: string;
  brandName: string;
  sizeBytes: number;
  totalMs: number;
  progress: StepReport[];
}

interface StepReport {
  name: "images" | "screencast" | "voiceover" | "stock-videos" | "animated-broll" | "render";
  status: "ok" | "failed" | "skipped";
  ms: number;
  error?: string;
}

interface PipelineResponse {
  ok: boolean;
  data?: {
    url: string;
    jobId: string;
    sizeBytes: number;
    totalMs: number;
    progress?: StepReport[];
    imagesData?: { hookBgImageUrl: string | null; ctaBgImageUrl: string | null; brollImageUrls: string[] };
    screencastData?: { url: string };
  };
  error?: string;
  progress?: StepReport[];
  totalMs?: number;
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" } as React.CSSProperties,
  header: {
    background: "#1a1f2e",
    borderBottom: "1px solid #2d3748",
    padding: "0 32px",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 28, fontWeight: 800, marginBottom: 6, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#7c3aed", marginBottom: 16, textTransform: "uppercase" as const, letterSpacing: "0.05em" } as React.CSSProperties,
  label: { fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "block" } as React.CSSProperties,
  input: {
    width: "100%",
    background: "#131720",
    border: "1px solid #2d3748",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    marginBottom: 14,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    background: "#131720",
    border: "1px solid #2d3748",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    marginBottom: 14,
    resize: "vertical" as const,
    minHeight: 70,
  } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 } as React.CSSProperties,
  checkbox: { width: 18, height: 18, accentColor: "#7c3aed", cursor: "pointer" } as React.CSSProperties,
  checkboxLabel: { fontSize: 13, color: "#cbd5e1", cursor: "pointer" } as React.CSSProperties,
  hint: { fontSize: 11, color: "#64748b", marginTop: -8, marginBottom: 14 } as React.CSSProperties,
  btnPrimary: {
    background: "linear-gradient(90deg, #7c3aed 0%, #22d3ee 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 32px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
    width: "100%",
    boxShadow: "0 8px 24px rgba(124,58,237,0.3)",
  } as React.CSSProperties,
  btnDisabled: {
    background: "#1e2737",
    color: "#475569",
    cursor: "not-allowed",
    boxShadow: "none",
  } as React.CSSProperties,
  progressBox: { background: "#131720", border: "1px solid #2d3748", borderRadius: 10, padding: 20, marginTop: 16 } as React.CSSProperties,
  step: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #1e2737" } as React.CSSProperties,
  stepDot: (color: string) => ({ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 } as React.CSSProperties),
  stepName: { fontSize: 13, fontWeight: 600, color: "#cbd5e1", minWidth: 120 } as React.CSSProperties,
  stepTime: { fontSize: 12, color: "#64748b", marginLeft: "auto" } as React.CSSProperties,
  videoBox: { background: "#000", borderRadius: 16, overflow: "hidden", border: "2px solid #22d3ee", boxShadow: "0 0 60px rgba(34,211,238,0.4)" } as React.CSSProperties,
  historyItem: { background: "#131720", border: "1px solid #2d3748", borderRadius: 10, padding: 14, marginBottom: 10, display: "flex", gap: 12, alignItems: "center" } as React.CSSProperties,
  historyText: { flex: 1, fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" } as React.CSSProperties),
  errorBox: { background: "#7f1d1d22", border: "1px solid #dc2626", borderRadius: 8, padding: 14, color: "#fca5a5", fontSize: 13, marginTop: 16, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const } as React.CSSProperties,
};

const HISTORY_KEY = "mr_admin_promo_reels";
const FORM_KEY = "mr_admin_promo_reel_form";

const DEFAULT_FORM = {
  hookText: "Вы тратите 40 часов в месяц на маркетинг?",
  problemText: "Анализ конкурентов, контент-план, отчёты — всё вручную.",
  ctaText: "MarketRadar делает это за 5 минут",
  brandName: "MarketRadar",
  niche: "B2B SaaS аналитика для маркетологов",
  accentColor: "#22d3ee",
  includeImages: true,
  includeScreencast: true,
  // includeBroll → теперь разнесён на 2 раздельных чекбокса:
  //   Corners — 3 угла-картинки поверх phone-frame (только со screencast)
  //   Fullscreen — N картинок занимают весь кадр в demo-сцене
  // Если активны оба + screencast — углы поверх phone-сегментов,
  // fullscreen чередуется через один. Если активны вместе со stocks,
  // fullscreen-слоты делятся между ними.
  includeBrollCorners: false,
  includeBrollFullscreen: false,
  includeVoiceover: false,
  voiceId: "",
  voiceoverScript: "",
  // ElevenLabs тонкие настройки
  elevenModel: "eleven_multilingual_v2" as string,
  elevenStability: 0.35,
  elevenSimilarity: 0.85,
  elevenStyle: 0.55,
  elevenSpeakerBoost: true,
  useStockVideos: false,
  stockVideoQuery: "",
  useAnimatedBroll: false,
  animatedBrollTheme: "",
  // Ручной порядок сегментов в demo-сцене. Когда включён — юзер задаёт
  // последовательность из элементов customDemoSequence. Когда выключен —
  // оркестратор сам авто-распределяет/чередует источники.
  // Элементы: "screencast" | "video" (AI-видео или сток) | "image" (AI-картинка)
  useCustomDemoSequence: false,
  customDemoSequence: ["video", "image", "video", "image"] as ("screencast" | "video" | "image")[],
  musicUrl: "",
  scenarioId: "marketing-tour",
  imageQuality: "medium" as "low" | "medium" | "high",
  videoDurationSec: 30 as 15 | 30 | 45 | 60,
};

/**
 * Считает: сколько секунд займёт произнесение этого текста.
 * Дефолтный темп — 3 слова/сек (ElevenLabs eleven_multilingual_v2,
 * стандартные voice-settings). Возвращает приближённую целую цифру.
 */
function estimateSpeechSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 3);
}

// ─── ElevenLabs voice picker ──────────────────────────────────────────────────

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

function VoicePicker({ selectedId, onChange }: {
  selectedId: string;
  onChange: (id: string, name: string) => void;
}) {
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showShared, setShowShared] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = async (type: "my" | "shared") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/elevenlabs-voices?type=${type}&search=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (json.ok) setVoices(json.voices ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const handleOpen = () => {
    if (!loaded) load("my");
  };

  const playPreview = (url: string, voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === voiceId) { setPlayingId(null); return; }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(voiceId);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
  };

  const filtered = voices.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.labels?.language ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedVoice = voices.find(v => v.voice_id === selectedId);
  const displayName = selectedVoice?.name ?? (selectedId ? `ID: ${selectedId.slice(0, 12)}…` : "Charlotte (по умолчанию)");

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.label}>Голос</label>
      <div style={{ position: "relative" }}>
        {/* Trigger */}
        <button
          type="button"
          onClick={handleOpen}
          style={{ ...S.input, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}
        >
          <span style={{ fontSize: 13, color: selectedId ? "#e2e8f0" : "#64748b" }}>{displayName}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>▼</span>
        </button>

        {/* Dropdown */}
        {loaded && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxHeight: 380, overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {/* Search + tabs */}
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #2d3748", flexShrink: 0 }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по имени или языку…"
                style={{ ...S.input, marginBottom: 6, padding: "6px 10px", fontSize: 12 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button"
                  onClick={() => { setShowShared(false); if (!loaded || showShared) load("my"); }}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: !showShared ? "#7c3aed" : "#2d3748", color: "#e2e8f0", fontWeight: 600 }}>
                  Мои голоса
                </button>
                <button type="button"
                  onClick={() => { setShowShared(true); load("shared"); }}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: showShared ? "#7c3aed" : "#2d3748", color: "#e2e8f0", fontWeight: 600 }}>
                  Библиотека ElevenLabs
                </button>
                <button type="button"
                  onClick={() => { setLoaded(false); setVoices([]); onChange("", ""); }}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: "#2d3748", color: "#94a3b8", marginLeft: "auto" }}>
                  ✕ Закрыть
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loading && <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 13 }}>Загружаем…</div>}
              {!loading && filtered.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 13 }}>Голоса не найдены</div>}
              {!loading && filtered.map(v => {
                const isSelected = v.voice_id === selectedId;
                const lang = v.labels?.language ?? v.labels?.accent ?? "";
                const gender = v.labels?.gender ?? "";
                const useCase = v.labels?.use_case ?? v.category ?? "";
                return (
                  <div
                    key={v.voice_id}
                    onClick={() => { onChange(v.voice_id, v.name); setLoaded(false); setVoices([]); setSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                      cursor: "pointer", borderBottom: "1px solid #131720",
                      background: isSelected ? "#7c3aed20" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isSelected ? "#7c3aed30" : "#ffffff08")}
                    onMouseLeave={e => (e.currentTarget.style.background = isSelected ? "#7c3aed20" : "transparent")}
                  >
                    {/* Play preview */}
                    {v.preview_url ? (
                      <button type="button"
                        onClick={e => playPreview(v.preview_url!, v.voice_id, e)}
                        style={{ width: 28, height: 28, borderRadius: "50%", border: "none", flexShrink: 0,
                          background: playingId === v.voice_id ? "#7c3aed" : "#2d3748",
                          color: "#e2e8f0", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {playingId === v.voice_id ? "■" : "▶"}
                      </button>
                    ) : <div style={{ width: 28 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: "#e2e8f0",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.name} {isSelected && "✓"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {lang && <span>{lang}</span>}
                        {gender && <span>· {gender}</span>}
                        {useCase && <span>· {useCase}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{v.voice_id.slice(0, 8)}…</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {selectedId && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
          Voice ID: <code style={{ background: "#131720", padding: "1px 4px", borderRadius: 3 }}>{selectedId}</code>
        </div>
      )}
    </div>
  );
}

export default function PromoReelsAdminPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<StepReport[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [history, setHistory] = useState<ReelHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Превью голоса
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voicePreviewBusy, setVoicePreviewBusy] = useState(false);
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);
  const [voicePreviewScript, setVoicePreviewScript] = useState<string>(""); // итоговый скрипт из превью

  // Восстанавливаем форму и историю из localStorage
  useEffect(() => {
    try {
      const savedForm = localStorage.getItem(FORM_KEY);
      if (savedForm) setForm({ ...DEFAULT_FORM, ...JSON.parse(savedForm) });
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch {
      // невалидный JSON в localStorage — игнорируем
    }
  }, []);

  // Тикаем elapsed-таймер пока идёт рендер — даём юзеру ощущение что
  // система живая, а не зависла. 4-5 минут без обратной связи — это смерть.
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function saveForm(next: typeof DEFAULT_FORM) {
    setForm(next);
    localStorage.setItem(FORM_KEY, JSON.stringify(next));
  }

  function saveHistory(item: ReelHistoryItem) {
    const next = [item, ...history].slice(0, 20); // храним 20 последних
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  // Генерация превью голоса: озвучивает скрипт и показывает плеер + итоговый текст.
  async function generateVoicePreview() {
    setVoicePreviewBusy(true);
    setVoicePreviewError(null);
    setVoicePreviewUrl(null);
    setVoicePreviewScript("");
    try {
      const res = await fetch("/api/generate-promo-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hookText: form.hookText,
          problemText: form.problemText,
          ctaText: form.ctaText,
          voiceId: form.voiceId || undefined,
          voiceoverScript: form.voiceoverScript || undefined,
          elevenModel: form.elevenModel,
          stability: form.elevenStability,
          similarity: form.elevenSimilarity,
          style: form.elevenStyle,
          speakerBoost: form.elevenSpeakerBoost,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setVoicePreviewError(json.error ?? "Ошибка генерации превью");
        return;
      }
      setVoicePreviewUrl(json.data.url);
      // Показываем итоговый скрипт (либо кастомный, либо авто-склеенный)
      const autoScript = [form.hookText, form.problemText, form.ctaText].filter(Boolean).join(".. ");
      setVoicePreviewScript(form.voiceoverScript || autoScript);
    } catch (e) {
      setVoicePreviewError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setVoicePreviewBusy(false);
    }
  }

  async function generate() {
    setError(null);
    setResult(null);
    setProgress([
      { name: "images", status: "skipped", ms: 0 },
      { name: "animated-broll", status: "skipped", ms: 0 },
      { name: "stock-videos", status: "skipped", ms: 0 },
      { name: "screencast", status: "skipped", ms: 0 },
      { name: "voiceover", status: "skipped", ms: 0 },
      { name: "render", status: "skipped", ms: 0 },
    ]);
    setBusy(true);
    setElapsedSec(0);

    try {
      // 1. POST на orchestrator — мгновенно возвращает {jobId}
      const submitR = await fetch("/api/generate-promo-reel-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hookText: form.hookText,
          problemText: form.problemText,
          ctaText: form.ctaText,
          brandName: form.brandName,
          niche: form.niche,
          accentColor: form.accentColor,
          includeImages: form.includeImages,
          includeScreencast: form.includeScreencast,
          includeBrollCorners: form.includeBrollCorners,
          includeBrollFullscreen: form.includeBrollFullscreen,
          includeVoiceover: form.includeVoiceover,
          voiceId: form.voiceId || undefined,
          voiceoverScript: form.voiceoverScript || undefined,
          elevenModel: form.elevenModel,
          stability: form.elevenStability,
          similarity: form.elevenSimilarity,
          style: form.elevenStyle,
          speakerBoost: form.elevenSpeakerBoost,
          useStockVideos: form.useStockVideos,
          stockVideoQuery: form.stockVideoQuery || undefined,
          useAnimatedBroll: form.useAnimatedBroll,
          animatedBrollTheme: form.animatedBrollTheme || undefined,
          customDemoSequence: form.useCustomDemoSequence ? form.customDemoSequence : undefined,
          musicUrl: form.musicUrl || undefined,
          scenarioId: form.scenarioId,
          imageQuality: form.imageQuality,
          videoDurationSec: form.videoDurationSec,
        }),
      });
      const submitData = (await submitR.json()) as {
        ok: boolean;
        error?: string;
        data?: { jobId: string; statusUrl: string };
      };

      if (!submitData.ok || !submitData.data) {
        setError(submitData.error ?? "Не удалось создать задачу");
        setBusy(false);
        return;
      }

      const jobId = submitData.data.jobId;

      // 2. Polling статуса каждые 3 сек. Каждый запрос быстрый, не зависит
      //    от Cloudflare/nginx таймаутов.
      let pollData: {
        status: string;
        progress: StepReport[];
        result: { url: string; jobId: string; sizeBytes: number; totalMs: number } | null;
        error: string | null;
      } | null = null;

      const POLL_INTERVAL_MS = 3000;
      const MAX_POLL_MS = 25 * 60 * 1000; // 25 мин hard limit на стороне клиента
      const startedAt = Date.now();

      while (Date.now() - startedAt < MAX_POLL_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        try {
          const statusR = await fetch(`/api/promo-job-status/${jobId}`);
          const statusJson = await statusR.json();
          if (!statusJson.ok) {
            setError(`Status poll error: ${statusJson.error ?? "unknown"}`);
            break;
          }
          pollData = statusJson.data;
          if (pollData?.progress) setProgress(pollData.progress);

          if (pollData?.status === "done" || pollData?.status === "failed") break;
        } catch (e) {
          // Сетевой fail на одном poll — продолжаем попытки
          console.warn("[promo] poll failed", e);
        }
      }

      if (!pollData) {
        setError("Polling timed out — задача может ещё идти на сервере, проверь /admin/promo-reels позже");
      } else if (pollData.status === "done" && pollData.result) {
        // Формируем ответ в формате PipelineResponse для setResult
        const data: PipelineResponse = {
          ok: true,
          data: {
            url: pollData.result.url,
            jobId: pollData.result.jobId,
            sizeBytes: pollData.result.sizeBytes,
            totalMs: pollData.result.totalMs,
            progress: pollData.progress,
          },
        };
        setResult(data);
        saveHistory({
          id: pollData.result.jobId,
          createdAt: new Date().toISOString(),
          url: pollData.result.url,
          hookText: form.hookText,
          problemText: form.problemText,
          ctaText: form.ctaText,
          brandName: form.brandName,
          sizeBytes: pollData.result.sizeBytes,
          totalMs: pollData.result.totalMs,
          progress: pollData.progress,
        });
      } else if (pollData.status === "failed") {
        setError(pollData.error ?? "Pipeline упал без описания");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Network: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    if (!confirm("Удалить всю историю промо-рилсов?")) return;
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.logo}>MarketRadar Admin</div>
      </div>
      <AdminNav current="/admin/promo-reels" />

      <main style={S.main}>
        <h1 style={S.h1}>Промо-рилсы</h1>
        <div style={S.sub}>
          Тестовая среда для пайплайна Remotion + AI-картинки + mobile-скринкаст. Один полный
          ролик собирается 4-5 минут. Результат — 30-секундный MP4 1080×1920 готовый к
          выкладке в reels/shorts/TikTok.
        </div>

        <div style={S.grid}>
          {/* Левая колонка — форма */}
          <div style={S.card}>
            <div style={S.cardTitle}>Параметры ролика</div>

            {/* Длина итогового ролика. Сцены пропорционально пересчитываются:
                15→3/9/3, 30→5/20/5, 45→8/29/8, 60→10/40/10. */}
            <label style={S.label}>Длина ролика</label>
            <select
              style={S.input}
              value={form.videoDurationSec}
              onChange={(e) =>
                saveForm({ ...form, videoDurationSec: Number(e.target.value) as 15 | 30 | 45 | 60 })
              }
            >
              <option value={15}>15 сек — короткий хук (TikTok / Stories)</option>
              <option value={30}>30 сек — классика (Reels / Shorts)</option>
              <option value={45}>45 сек — больше деталей</option>
              <option value={60}>60 сек — полноценное промо</option>
            </select>

            {(() => {
              // Расчёт хронометража сцен под выбранную длительность —
              // зеркало calcSceneDurations() из PromoReel.tsx.
              const total = form.videoDurationSec;
              const hookSec = Math.max(3, Math.round(total * 0.17));
              const ctaSec = Math.max(3, Math.round(total * 0.17));
              const demoSec = Math.max(5, total - hookSec - ctaSec);
              return (
                <div style={{ ...S.hint, marginTop: -6, marginBottom: 14 }}>
                  Хук {hookSec} сек · Демо {demoSec} сек · CTA {ctaSec} сек
                </div>
              );
            })()}

            {(() => {
              const total = form.videoDurationSec;
              const hookSec = Math.max(3, Math.round(total * 0.17));
              const demoSec = Math.max(5, total - hookSec - Math.max(3, Math.round(total * 0.17)));
              const ctaSec = Math.max(3, Math.round(total * 0.17));
              return (
                <>
                  <label style={S.label}>Хук (0–{hookSec} сек)</label>
                  <textarea
                    style={S.textarea}
                    value={form.hookText}
                    onChange={(e) => saveForm({ ...form, hookText: e.target.value })}
                    placeholder="Цепляющий вопрос или утверждение"
                  />
                  <div style={S.hint}>
                    {form.hookText.trim().split(/\s+/).filter(Boolean).length} слов ≈{" "}
                    {estimateSpeechSec(form.hookText)} сек речи · слот {hookSec} сек
                  </div>

                  <label style={S.label}>Проблема ({hookSec}–{hookSec + demoSec} сек)</label>
                  <textarea
                    style={S.textarea}
                    value={form.problemText}
                    onChange={(e) => saveForm({ ...form, problemText: e.target.value })}
                    placeholder="Что мучает целевую аудиторию"
                  />
                  <div style={S.hint}>
                    {form.problemText.trim().split(/\s+/).filter(Boolean).length} слов ≈{" "}
                    {estimateSpeechSec(form.problemText)} сек речи · слот {demoSec} сек
                  </div>

                  <label style={S.label}>
                    Призыв ({hookSec + demoSec}–{total} сек)
                  </label>
                  <textarea
                    style={S.textarea}
                    value={form.ctaText}
                    onChange={(e) => saveForm({ ...form, ctaText: e.target.value })}
                    placeholder="Что предлагает бренд"
                  />
                  <div style={S.hint}>
                    {form.ctaText.trim().split(/\s+/).filter(Boolean).length} слов ≈{" "}
                    {estimateSpeechSec(form.ctaText)} сек речи · слот {ctaSec} сек
                  </div>
                </>
              );
            })()}

            <label style={S.label}>Имя бренда</label>
            <input
              style={S.input}
              value={form.brandName}
              onChange={(e) => saveForm({ ...form, brandName: e.target.value })}
            />

            <label style={S.label}>Ниша (для AI-картинок)</label>
            <input
              style={S.input}
              value={form.niche}
              onChange={(e) => saveForm({ ...form, niche: e.target.value })}
              placeholder="B2B SaaS, EdTech, e-commerce..."
            />

            <label style={S.label}>Акцентный цвет (hex)</label>
            <input
              style={S.input}
              value={form.accentColor}
              onChange={(e) => saveForm({ ...form, accentColor: e.target.value })}
              placeholder="#22d3ee"
            />

            <div style={S.cardTitle}>Что включить</div>

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="incImg"
                checked={form.includeImages}
                onChange={(e) => saveForm({ ...form, includeImages: e.target.checked })}
              />
              <label htmlFor="incImg" style={S.checkboxLabel}>
                AI-картинки фон для hook + CTA (gpt-image-2, +60 сек)
              </label>
            </div>

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="incScr"
                checked={form.includeScreencast}
                onChange={(e) => saveForm({ ...form, includeScreencast: e.target.checked })}
              />
              <label htmlFor="incScr" style={S.checkboxLabel}>
                Mobile-скринкаст в phone-frame (Playwright, +30 сек)
              </label>
            </div>

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="incBrCorners"
                checked={form.includeBrollCorners}
                onChange={(e) => saveForm({ ...form, includeBrollCorners: e.target.checked })}
                disabled={!form.includeScreencast}
              />
              <label
                htmlFor="incBrCorners"
                style={{
                  ...S.checkboxLabel,
                  opacity: form.includeScreencast ? 1 : 0.4,
                }}
              >
                B-roll AI-картинки <b>в углах phone-frame</b> (+3 картинки, +30 сек){" "}
                {!form.includeScreencast ? "— нужен скринкаст" : ""}
              </label>
            </div>

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="incBrFull"
                checked={form.includeBrollFullscreen}
                onChange={(e) => saveForm({ ...form, includeBrollFullscreen: e.target.checked })}
              />
              <label htmlFor="incBrFull" style={S.checkboxLabel}>
                B-roll AI-картинки <b>fullscreen в demo</b> (+N картинок, +30-60 сек)
              </label>
            </div>
            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="useStock"
                checked={form.useStockVideos}
                onChange={(e) => saveForm({ ...form, useStockVideos: e.target.checked })}
              />
              <label htmlFor="useStock" style={S.checkboxLabel}>
                Стоковые видео из Pexels {form.includeBroll ? "(микс 50/50 с b-roll)" : "(заменяет b-roll)"}
              </label>
            </div>

            {form.useStockVideos ? (
              <>
                <label style={S.label}>Поисковый запрос (английский)</label>
                <input
                  style={S.input}
                  value={form.stockVideoQuery}
                  onChange={(e) => saveForm({ ...form, stockVideoQuery: e.target.value })}
                  placeholder="например: business analytics, marketing dashboard, data visualization"
                />
                <div style={S.hint}>
                  Pexels плохо понимает русский — пиши на английском. Возьмёт portrait-видео
                  с подходящей продолжительностью. Заменяет AI-картинки в full-broll режиме.
                </div>
              </>
            ) : null}

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="useAnim"
                checked={form.useAnimatedBroll}
                onChange={(e) => saveForm({ ...form, useAnimatedBroll: e.target.checked })}
              />
              <label htmlFor="useAnim" style={S.checkboxLabel}>
                AI-видео b-roll (Replicate / Seedance Pro) — ~$0.40/клип, +1-2 мин
              </label>
            </div>

            {form.useAnimatedBroll ? (
              <>
                <label style={S.label}>Тема для видео (английский)</label>
                <input
                  style={S.input}
                  value={form.animatedBrollTheme}
                  onChange={(e) => saveForm({ ...form, animatedBrollTheme: e.target.value })}
                  placeholder="например: competitive intelligence analyst dark office, OR оставь пустым → возьмёт ниши"
                />
                <div style={S.hint}>
                  Seedance Pro генерит 5-сек 1080p клипы нативно в 9:16 (text-to-video).
                  Если пусто — берёт «Ниша для AI-картинок» сверху. На 30-сек ролике = 4 клипа =
                  ~$1.6. Нужен REPLICATE_API_TOKEN в env (replicate.com/account/api-tokens).
                  <br />
                  💡 Сменить модель: <code>REPLICATE_VIDEO_MODEL=minimax/hailuo-02</code> в .env.local
                </div>
              </>
            ) : null}

            {/* Подсказка о том как сочетаются выбранные источники визуала.
                Логика: corners (углы) — только когда есть screencast. Fullscreen
                источники (broll-fullscreen + stocks) автоматически чередуются
                друг с другом. Если screencast тоже on — phone и fullscreen
                сменяются через один. */}
            {(form.includeBrollCorners || form.includeBrollFullscreen || form.useStockVideos || form.useAnimatedBroll) ? (() => {
              const total = form.videoDurationSec;
              const hookSec = Math.max(3, Math.round(total * 0.17));
              const ctaSec = Math.max(3, Math.round(total * 0.17));
              const demoSec = Math.max(5, total - hookSec - ctaSec);
              const totalSlots = Math.max(1, Math.min(8, Math.ceil(demoSec / 5)));

              // Кто из fullscreen-источников активен (broll / stocks / animated)
              const fsSources: string[] = [];
              if (form.useAnimatedBroll) fsSources.push("AI-видео (Replicate)");
              if (form.useStockVideos) fsSources.push("стоковые видео");
              if (form.includeBrollFullscreen) fsSources.push("AI-картинки");

              // Распределение fullscreen-слотов между активными источниками
              const fsTotal = fsSources.length === 0 ? 0 : totalSlots;
              const baseShare = fsSources.length === 0 ? 0 : Math.floor(fsTotal / fsSources.length);
              const remainder = fsTotal - baseShare * fsSources.length;

              // Углы — только если есть screencast (overlay над phone-frame)
              const cornersActive = form.includeBrollCorners && form.includeScreencast;
              const cornerCount = cornersActive ? 3 : 0;

              // Какой режим в итоге
              const lines: string[] = [];
              if (cornersActive) {
                lines.push(`${cornerCount} AI-картинки в углах phone-frame`);
              }
              if (fsSources.length > 0) {
                const shares = fsSources.map((_, i) => baseShare + (i < remainder ? 1 : 0));
                const fsLabels = fsSources.map((s, i) => `${shares[i]} ${s}`).join(" + ");
                const secPerSlot = form.includeScreencast
                  ? (demoSec / (fsTotal * 2)).toFixed(1)  // alternate = 2N сегментов
                  : (demoSec / fsTotal).toFixed(1);
                const where = form.includeScreencast
                  ? `чередуются с phone-frame (${fsTotal * 2} сегментов × ${secPerSlot} сек)`
                  : `full-screen (по ${secPerSlot} сек на кадр)`;
                lines.push(`${fsLabels} ${where}`);
              }

              if (lines.length === 0) return null;

              return (
                <div style={{ ...S.hint, color: "#22d3ee", marginTop: -8, lineHeight: 1.5 }}>
                  💡 {lines.join(" · ")}
                </div>
              );
            })() : null}

            {form.includeBrollCorners && !form.includeScreencast ? (
              <div style={{ ...S.hint, color: "#f59e0b", marginTop: -4 }}>
                ⚠️ «В углах» нужен скринкаст в центре. Включи скринкаст или выбери fullscreen.
              </div>
            ) : null}

            {/* Конструктор ручного порядка сегментов в demo-сцене.
                Показывается когда у юзера активно >=2 разных источника визуала
                (тогда есть смысл выбирать кто куда). Слотов столько же сколько
                totalSlots по длине ролика (1 на 5 сек demo). */}
            {(() => {
              const total = form.videoDurationSec;
              const hookSec = Math.max(3, Math.round(total * 0.17));
              const ctaSec = Math.max(3, Math.round(total * 0.17));
              const demoSec = Math.max(5, total - hookSec - ctaSec);
              const totalSlots = Math.max(1, Math.min(8, Math.ceil(demoSec / 5)));
              const segmentSec = demoSec / totalSlots;

              // Какие типы доступны (юзер их включил)
              const availableTypes: { value: "screencast" | "video" | "image"; label: string }[] = [];
              if (form.includeScreencast) availableTypes.push({ value: "screencast", label: "📱 Скринкаст" });
              if (form.useAnimatedBroll || form.useStockVideos) availableTypes.push({ value: "video", label: "🎬 AI/сток видео" });
              if (form.includeBrollFullscreen) availableTypes.push({ value: "image", label: "🖼 AI-картинка" });

              // Если меньше 2 типов — конструктор не имеет смысла, не показываем
              if (availableTypes.length < 2) return null;

              // Синхронизируем длину customDemoSequence с totalSlots
              // (при смене длины ролика подгоняем массив)
              const seq = form.customDemoSequence.slice(0, totalSlots);
              while (seq.length < totalSlots) {
                seq.push(availableTypes[seq.length % availableTypes.length].value);
              }

              return (
                <div
                  style={{
                    background: "#131720",
                    border: "1px solid #2d3748",
                    borderRadius: 8,
                    padding: 14,
                    marginTop: 4,
                    marginBottom: 14,
                  }}
                >
                  <div style={S.row}>
                    <input
                      type="checkbox"
                      style={S.checkbox}
                      id="useCustomSeq"
                      checked={form.useCustomDemoSequence}
                      onChange={(e) => saveForm({ ...form, useCustomDemoSequence: e.target.checked, customDemoSequence: seq })}
                    />
                    <label htmlFor="useCustomSeq" style={S.checkboxLabel}>
                      <b>Ручной порядок сегментов в demo</b> ({totalSlots} слотов × {segmentSec.toFixed(1)} сек)
                    </label>
                  </div>

                  {form.useCustomDemoSequence ? (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {seq.map((type, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 12, color: "#64748b", minWidth: 30 }}>#{i + 1}</div>
                          <div style={{ fontSize: 11, color: "#475569", minWidth: 78 }}>
                            {(i * segmentSec).toFixed(1)}–{((i + 1) * segmentSec).toFixed(1)} сек
                          </div>
                          <select
                            style={{ ...S.input, marginBottom: 0, flex: 1 }}
                            value={type}
                            onChange={(e) => {
                              const next = [...seq];
                              next[i] = e.target.value as "screencast" | "video" | "image";
                              saveForm({ ...form, customDemoSequence: next });
                            }}
                          >
                            {availableTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <div style={{ ...S.hint, marginTop: 4 }}>
                        💡 Подсчитай сколько каждого типа — это и будет сгенерировано в шаге
                        AI-картинки / AI-видео b-roll. Скринкаст переиспользуется на всех его сегментах
                        (с правильным offset'ом).
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...S.hint, marginTop: 4 }}>
                      Без галки оркестратор сам распределит источники (alternate / interleave).
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={S.row}>
              <input
                type="checkbox"
                style={S.checkbox}
                id="incVO"
                checked={form.includeVoiceover}
                onChange={(e) => saveForm({ ...form, includeVoiceover: e.target.checked })}
              />
              <label htmlFor="incVO" style={S.checkboxLabel}>
                Озвучка через ElevenLabs (+15 сек)
              </label>
            </div>

            {form.includeVoiceover ? (
              <div style={{ marginTop: 8, padding: 16, background: "#131720", borderRadius: 10, border: "1px solid #2d3748" }}>

                {/* ── Голос ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em", marginBottom: 12 }}>ГОЛОС</div>

                {/* Picker — заменяет голое поле Voice ID */}
                <VoicePicker
                  selectedId={form.voiceId}
                  onChange={(id) => saveForm({ ...form, voiceId: id })}
                />

                {/* ── Модель ── */}
                <label style={S.label}>Модель</label>
                <select
                  style={{ ...S.input, cursor: "pointer" }}
                  value={form.elevenModel}
                  onChange={(e) => saveForm({ ...form, elevenModel: e.target.value })}
                >
                  <option value="eleven_multilingual_v2">eleven_multilingual_v2 — основная, поддерживает русский</option>
                  <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 — быстрее (latency), чуть хуже качество</option>
                  <option value="eleven_turbo_v2">eleven_turbo_v2 — turbo v2 (legacy)</option>
                  <option value="eleven_monolingual_v1">eleven_monolingual_v1 — только английский, высокое качество</option>
                  <option value="eleven_multilingual_v1">eleven_multilingual_v1 — v1 мультиязычная (legacy)</option>
                </select>
                <div style={{ ...S.hint, marginBottom: 16 }}>
                  Для русского языка — только <b>multilingual</b> модели. Turbo быстрее но качество чуть ниже.
                </div>

                {/* ── Слайдеры ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em", marginBottom: 12 }}>НАСТРОЙКИ ГОЛОСА</div>

                {/* Stability */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...S.label, marginBottom: 0 }}>Стабильность (Stability)</label>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700 }}>{form.elevenStability.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={form.elevenStability}
                    onChange={(e) => saveForm({ ...form, elevenStability: parseFloat(e.target.value) })}
                    style={{ width: "100%", accentColor: "#7c3aed" }}
                  />
                  <div style={S.hint}>0 = максимальные интонации (нестабильно), 1 = монотон. Оптимально для промо: 0.30–0.45</div>
                </div>

                {/* Similarity */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...S.label, marginBottom: 0 }}>Схожесть с оригиналом (Similarity Boost)</label>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700 }}>{form.elevenSimilarity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={form.elevenSimilarity}
                    onChange={(e) => saveForm({ ...form, elevenSimilarity: parseFloat(e.target.value) })}
                    style={{ width: "100%", accentColor: "#7c3aed" }}
                  />
                  <div style={S.hint}>Чем выше — тем ближе к оригинальному голосу. При низкой stability держи &ge;0.80 чтобы голос не «уплыл».</div>
                </div>

                {/* Style exaggeration */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...S.label, marginBottom: 0 }}>Выразительность (Style Exaggeration)</label>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700 }}>{form.elevenStyle.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={form.elevenStyle}
                    onChange={(e) => saveForm({ ...form, elevenStyle: parseFloat(e.target.value) })}
                    style={{ width: "100%", accentColor: "#7c3aed" }}
                  />
                  <div style={S.hint}>0 = нейтрально, 1 = максимальная эмоциональная окраска. Для промо: 0.40–0.65. Только v2+ модели.</div>
                </div>

                {/* Speaker boost */}
                <div style={{ ...S.row, marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    style={S.checkbox}
                    id="speakerBoost"
                    checked={form.elevenSpeakerBoost}
                    onChange={(e) => saveForm({ ...form, elevenSpeakerBoost: e.target.checked })}
                  />
                  <label htmlFor="speakerBoost" style={S.checkboxLabel}>
                    Speaker Boost — усиливает характеристики голоса (рекомендуется)
                  </label>
                </div>

                {/* ── Скрипт ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em", marginBottom: 12 }}>СКРИПТ</div>
                <label style={S.label}>Полный voice-скрипт (~75 слов на 30 сек)</label>
                <textarea
                  style={{ ...S.textarea, minHeight: 120 }}
                  value={form.voiceoverScript}
                  onChange={(e) => saveForm({ ...form, voiceoverScript: e.target.value })}
                  placeholder="Если пусто — голос собирается из 3 блоков выше (~7-10 сек). Напиши тут полный текст ~70-80 слов чтобы голос звучал все 30 секунд."
                />
                <div style={S.hint}>
                  ElevenLabs ~3 слова/сек. 30 сек = ~75-90 слов. Сейчас:{" "}
                  {form.voiceoverScript
                    ? `${form.voiceoverScript.trim().split(/\s+/).length} слов ≈ ${Math.round(form.voiceoverScript.trim().split(/\s+/).length / 3)} сек`
                    : "пусто → авто-сборка из верхних блоков (~7-10 сек)"}
                </div>

                {/* ── Превью голоса ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em", margin: "18px 0 10px" }}>ПРЕВЬЮ</div>
                <button
                  type="button"
                  onClick={generateVoicePreview}
                  disabled={voicePreviewBusy}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: "none",
                    background: voicePreviewBusy ? "#2d3748" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: voicePreviewBusy ? "#64748b" : "#fff",
                    fontWeight: 700, fontSize: 13, cursor: voicePreviewBusy ? "wait" : "pointer",
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                  }}
                >
                  {voicePreviewBusy ? (
                    <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span> Генерирую…</>
                  ) : "🎙 Сгенерировать превью голоса"}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                {voicePreviewError && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "#ef444420", color: "#f87171", fontSize: 13, marginBottom: 10 }}>
                    ⚠ {voicePreviewError}
                  </div>
                )}

                {voicePreviewUrl && (
                  <div style={{ background: "#131720", borderRadius: 10, border: "1px solid #2d3748", padding: 16, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                      ✓ Превью готово — слушай и при необходимости правь скрипт ниже
                    </div>

                    {/* Аудиоплеер */}
                    <audio
                      key={voicePreviewUrl}
                      controls
                      style={{ width: "100%", borderRadius: 6, marginBottom: 12 }}
                    >
                      <source src={voicePreviewUrl} type="audio/mpeg" />
                    </audio>

                    {/* Редактируемый итоговый скрипт */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em", marginBottom: 6 }}>
                      ТЕКСТ ОЗВУЧКИ (можешь отредактировать → нажать «Превью» снова)
                    </div>
                    <textarea
                      style={{ ...S.textarea, minHeight: 100, borderColor: "#4f46e5" }}
                      value={voicePreviewScript}
                      onChange={(e) => {
                        setVoicePreviewScript(e.target.value);
                        // Синхронизируем с основным полем скрипта
                        saveForm({ ...form, voiceoverScript: e.target.value });
                      }}
                    />
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {voicePreviewScript.trim().split(/\s+/).filter(Boolean).length} слов ≈ {Math.round(voicePreviewScript.trim().split(/\s+/).filter(Boolean).length / 3)} сек. Изменения автоматически сохраняются в поле «Скрипт» выше.
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <label style={S.label}>Фоновая музыка (URL до MP3, опц)</label>
            <input
              style={S.input}
              value={form.musicUrl}
              onChange={(e) => saveForm({ ...form, musicUrl: e.target.value })}
              placeholder="https://... или /api/static-asset/music/track.mp3"
            />
            <div style={S.hint}>
              Если voiceover есть, музыка играет на 15% громкости (фоном). Без voiceover — 50%.
            </div>

            {(() => {
              // Валидация: стоки включены без query = nope, оркестратор
              // вернёт 400. Не даём юзеру даже жмякнуть.
              const stocksNeedQuery = form.useStockVideos && !form.stockVideoQuery.trim();
              const disabled = busy || stocksNeedQuery;
              return (
                <>
                  <button
                    style={{ ...S.btnPrimary, ...(disabled ? S.btnDisabled : {}) }}
                    onClick={generate}
                    disabled={disabled}
                  >
                    {busy
                      ? `Идёт сборка… ${elapsedSec}с`
                      : stocksNeedQuery
                        ? "Заполни поисковый запрос Pexels →"
                        : "Сгенерить ролик"}
                  </button>
                  {stocksNeedQuery ? (
                    <div style={{ ...S.hint, color: "#f59e0b", marginTop: 8 }}>
                      ⚠️ Чекбокс «Стоковые видео» включён, но не указан поисковый запрос.
                      Заполни поле выше (на английском) или выключи чекбокс.
                    </div>
                  ) : null}
                </>
              );
            })()}

            {error ? <div style={S.errorBox}>{error}</div> : null}
          </div>

          {/* Правая колонка — прогресс + видео */}
          <div style={S.card}>
            <div style={S.cardTitle}>Прогресс пайплайна</div>

            {progress.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Жми «Сгенерить ролик» — здесь появится прогресс по шагам и финальный плеер.
              </div>
            ) : (
              <div style={S.progressBox}>
                {progress.map((step, i) => {
                  const color =
                    step.status === "ok" ? "#10b981" :
                    step.status === "failed" ? "#dc2626" :
                    step.status === "skipped" ? "#475569" :
                    "#7c3aed";
                  // Label для images шага — динамически показываем что в нём
                  // запросили (hook/CTA фон, b-roll, или оба). Иначе юзер
                  // не понимает где конкретно отработал/упал b-roll.
                  const imagesLabel = (() => {
                    const parts: string[] = [];
                    if (form.includeImages) parts.push("hook+CTA фон");
                    if (form.includeBrollCorners && form.includeScreencast) parts.push("3 углов");
                    if (form.includeBrollFullscreen) parts.push("fullscreen b-roll");
                    return parts.length > 0
                      ? `AI-картинки (${parts.join(" + ")})`
                      : "AI-картинки";
                  })();
                  const label =
                    step.name === "images" ? imagesLabel :
                    step.name === "animated-broll" ? "AI-видео b-roll (Replicate)" :
                    step.name === "stock-videos" ? "Стоковые видео (Pexels)" :
                    step.name === "screencast" ? "Скринкаст" :
                    step.name === "voiceover" ? "Озвучка" :
                    step.name === "render" ? "Рендер видео" : step.name;
                  return (
                    <div key={i}>
                      <div style={S.step}>
                        <div style={S.stepDot(color)} />
                        <div style={S.stepName}>{label}</div>
                        <div style={S.badge(color)}>{step.status}</div>
                        <div style={S.stepTime}>{(step.ms / 1000).toFixed(1)}s</div>
                      </div>
                      {step.error ? (
                        <div
                          style={{
                            background: "#7f1d1d22",
                            border: "1px solid #dc262644",
                            borderRadius: 6,
                            padding: "10px 12px",
                            color: "#fca5a5",
                            fontSize: 11,
                            margin: "6px 0 10px 22px",
                            fontFamily: "ui-monospace, monospace",
                            whiteSpace: "pre-wrap" as const,
                            wordBreak: "break-word" as const,
                            maxHeight: 200,
                            overflowY: "auto" as const,
                          }}
                        >
                          {step.error}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {result?.ok && result.data ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ ...S.cardTitle, marginBottom: 12 }}>Готовый ролик</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <video
                    src={result.data.url}
                    controls
                    autoPlay
                    style={{ ...S.videoBox, width: 280, height: 498 }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 12, textAlign: "center" }}>
                  {(result.data.sizeBytes / 1024 / 1024).toFixed(1)} MB · собрано за{" "}
                  {(result.data.totalMs / 1000).toFixed(0)}с ·{" "}
                  <a
                    href={result.data.url}
                    download={`promo-${result.data.jobId}.mp4`}
                    style={{ color: "#22d3ee" }}
                  >
                    Скачать
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* История */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div style={S.cardTitle}>История ({history.length})</div>
            {history.length > 0 ? (
              <button
                onClick={clearHistory}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  color: "#dc2626",
                  border: "1px solid #dc262644",
                  borderRadius: 6,
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Очистить
              </button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64748b" }}>Пока пусто. Сгенерируй первый ролик.</div>
          ) : (
            <div>
              {history.map((h) => (
                <div key={h.id} style={S.historyItem}>
                  <div style={{ fontSize: 28 }}>🎬</div>
                  <div style={S.historyText} title={h.hookText}>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{h.hookText}</div>
                    <div>
                      {new Date(h.createdAt).toLocaleString("ru")} · {(h.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      · {(h.totalMs / 1000).toFixed(0)}с
                    </div>
                  </div>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#22d3ee",
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 14px",
                      border: "1px solid #22d3ee44",
                      borderRadius: 6,
                    }}
                  >
                    Открыть
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
