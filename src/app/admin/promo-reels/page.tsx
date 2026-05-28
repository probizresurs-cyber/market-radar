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

import { useEffect, useState } from "react";
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
  name: "images" | "screencast" | "voiceover" | "render";
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
  includeBroll: false,
  includeVoiceover: false,
  voiceId: "",
  voiceoverScript: "",
  musicUrl: "",
  scenarioId: "marketing-tour",
  imageQuality: "medium" as "low" | "medium" | "high",
};

export default function PromoReelsAdminPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<StepReport[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [history, setHistory] = useState<ReelHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  async function generate() {
    setError(null);
    setResult(null);
    setProgress([
      { name: "images", status: "skipped", ms: 0 },
      { name: "screencast", status: "skipped", ms: 0 },
      { name: "voiceover", status: "skipped", ms: 0 },
      { name: "render", status: "skipped", ms: 0 },
    ]);
    setBusy(true);
    setElapsedSec(0);

    try {
      const r = await fetch("/api/generate-promo-reel-full", {
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
          includeBroll: form.includeBroll,
          includeVoiceover: form.includeVoiceover,
          voiceId: form.voiceId || undefined,
          voiceoverScript: form.voiceoverScript || undefined,
          musicUrl: form.musicUrl || undefined,
          scenarioId: form.scenarioId,
          imageQuality: form.imageQuality,
        }),
      });
      const data = (await r.json()) as PipelineResponse;
      setResult(data);

      // Прогресс лежит в РАЗНЫХ местах ответа:
      //  - при ok: true → data.data.progress (внутри payload'а)
      //  - при ok: false → data.progress (на верхнем уровне рядом с error)
      // UI читает оба варианта чтобы шаги всегда показывались корректно.
      const progressFromResp = data.data?.progress ?? data.progress;
      if (progressFromResp && progressFromResp.length > 0) setProgress(progressFromResp);

      if (data.ok && data.data) {
        saveHistory({
          id: data.data.jobId,
          createdAt: new Date().toISOString(),
          url: data.data.url,
          hookText: form.hookText,
          problemText: form.problemText,
          ctaText: form.ctaText,
          brandName: form.brandName,
          sizeBytes: data.data.sizeBytes,
          totalMs: data.data.totalMs,
          progress: data.data.progress,
        });
      } else if (data.error) {
        setError(data.error);
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

            <label style={S.label}>Хук (0-5 сек)</label>
            <textarea
              style={S.textarea}
              value={form.hookText}
              onChange={(e) => saveForm({ ...form, hookText: e.target.value })}
              placeholder="Цепляющий вопрос или утверждение"
            />

            <label style={S.label}>Проблема (5-25 сек)</label>
            <textarea
              style={S.textarea}
              value={form.problemText}
              onChange={(e) => saveForm({ ...form, problemText: e.target.value })}
              placeholder="Что мучает целевую аудиторию"
            />

            <label style={S.label}>Призыв (25-30 сек)</label>
            <textarea
              style={S.textarea}
              value={form.ctaText}
              onChange={(e) => saveForm({ ...form, ctaText: e.target.value })}
              placeholder="Что предлагает бренд"
            />

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
                id="incBR"
                checked={form.includeBroll}
                onChange={(e) => saveForm({ ...form, includeBroll: e.target.checked })}
              />
              <label htmlFor="incBR" style={S.checkboxLabel}>
                B-roll картинки в углах (+3 картинки, +30 сек)
              </label>
            </div>

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
              <>
                <label style={S.label}>Voice ID (опц, по умолчанию Charlotte)</label>
                <input
                  style={S.input}
                  value={form.voiceId}
                  onChange={(e) => saveForm({ ...form, voiceId: e.target.value })}
                  placeholder="XB0fDUnXU5powFXDhCwa"
                />

                <label style={S.label}>
                  Полный voice-скрипт (опц, ~75 слов на 30 сек)
                </label>
                <textarea
                  style={{ ...S.textarea, minHeight: 120 }}
                  value={form.voiceoverScript}
                  onChange={(e) => saveForm({ ...form, voiceoverScript: e.target.value })}
                  placeholder="Если пусто — голос собирается из 3 верхних блоков (~7-10 сек). Напиши тут полный текст ~70-80 слов чтобы голос звучал все 30 секунд."
                />
                <div style={S.hint}>
                  ElevenLabs говорит ~3 слова/сек. 30 сек видео = ~75-90 слов. Сейчас:{" "}
                  {form.voiceoverScript
                    ? `${form.voiceoverScript.trim().split(/\s+/).length} слов ≈ ${Math.round(
                        form.voiceoverScript.trim().split(/\s+/).length / 3,
                      )} сек`
                    : "пусто → авто-сборка из верхних блоков"}
                </div>
              </>
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

            <button
              style={{ ...S.btnPrimary, ...(busy ? S.btnDisabled : {}) }}
              onClick={generate}
              disabled={busy}
            >
              {busy ? `Идёт сборка… ${elapsedSec}с` : "Сгенерить ролик"}
            </button>

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
                  const label =
                    step.name === "images" ? "AI-картинки" :
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
