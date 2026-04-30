"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Job {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  log: string[];
  outputFiles: string[];
  error?: string;
  durationSec: number;
}

const S = {
  page: { minHeight: "100vh", background: "#0a0b0f", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "rgba(15,17,26,0.97)", borderBottom: "1px solid #1e2737", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 },
  logo: { fontSize: 18, fontWeight: 800, color: "#7c3aed", letterSpacing: "-0.02em" } as React.CSSProperties,
  main: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "24px 28px" } as React.CSSProperties,
  h2: { fontSize: 18, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 18 } as React.CSSProperties,
  label: { fontSize: 11, color: "#94a3b8", marginBottom: 6, display: "block", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const },
  input: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 9, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
  textarea: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 9, color: "#e2e8f0", padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" as const, minHeight: 80, resize: "vertical" as const, fontFamily: "system-ui" } as React.CSSProperties,
  select: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 9, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", cursor: "pointer", boxSizing: "border-box" as const },
  btn: { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", letterSpacing: "-0.01em" } as React.CSSProperties,
  styleCard: (active: boolean) => ({
    border: `2px solid ${active ? "#7c3aed" : "#1e2737"}`,
    borderRadius: 10, padding: "10px 12px", cursor: "pointer",
    background: active ? "#7c3aed11" : "#0a0b0f", flex: 1, fontSize: 12, textAlign: "center" as const, transition: "all 0.15s",
  } as React.CSSProperties),
  logLine: { fontSize: 12, color: "#64748b", padding: "3px 0", fontFamily: "ui-monospace, monospace", borderLeft: "2px solid transparent", paddingLeft: 8 } as React.CSSProperties,
  logLineLast: { fontSize: 12, color: "#22d3ee", padding: "3px 0", fontFamily: "ui-monospace, monospace", borderLeft: "2px solid #22d3ee", paddingLeft: 8 } as React.CSSProperties,
  badge: (color: string) => ({ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: color + "22", color, letterSpacing: "0.05em" }),
};

const STYLES = [
  { id: "premium-dark", label: "Premium Dark", desc: "Linear / Stripe" },
  { id: "minimal", label: "Minimal", desc: "Notion / Airbnb" },
  { id: "corporate", label: "Corporate", desc: "B2B классика" },
  { id: "bold-startup", label: "Bold", desc: "Дерзкий стартап" },
  { id: "custom", label: "Кастом", desc: "Только мой промпт" },
];

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  queued: { color: "#94a3b8", label: "В очереди" },
  running: { color: "#22d3ee", label: "Генерация..." },
  succeeded: { color: "#4ade80", label: "Готово" },
  failed: { color: "#ef4444", label: "Ошибка" },
};

export default function AIPresentationPage() {
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [dataJson, setDataJson] = useState("");
  const [style, setStyle] = useState("premium-dark");
  const [customDesignNotes, setCustomDesignNotes] = useState("");
  const [slides, setSlides] = useState(10);
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [refFiles, setRefFiles] = useState<File[]>([]);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll job status
  useEffect(() => {
    if (!jobId || !job || job.status === "succeeded" || job.status === "failed") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/agent/job/${jobId}`);
      const d = await r.json();
      if (d.ok) setJob(d.job);
    }, 3000);
    return () => clearInterval(t);
  }, [jobId, job]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.log]);

  async function submit() {
    if (!companyName.trim()) { setError("Укажите название компании"); return; }
    setSubmitting(true);
    setError("");
    setJob(null);
    setJobId(null);

    const fd = new FormData();
    fd.set("companyName", companyName);
    fd.set("niche", niche);
    fd.set("data", dataJson || "{}");
    fd.set("style", style);
    fd.set("customDesignNotes", customDesignNotes);
    fd.set("slides", String(slides));
    fd.set("model", model);
    refFiles.forEach(f => fd.append("references", f));

    const r = await fetch("/api/agent/generate-presentation", { method: "POST", body: fd });
    const d = await r.json();
    if (d.ok) {
      setJobId(d.jobId);
      setJob({ id: d.jobId, status: "queued", log: [], outputFiles: [], durationSec: 0 });
    } else {
      setError(d.error || "Ошибка запуска");
    }
    setSubmitting(false);
  }

  function onDropImages(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    setRefFiles(prev => [...prev, ...newFiles].slice(0, 8));
  }

  const pptxFile = job?.outputFiles.find(f => f.endsWith(".pptx"));
  const slideFiles = job?.outputFiles.filter(f => f.match(/^slides\/slide-\d+\.png$/)).sort() || [];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
        <div style={{ fontSize: 13, color: "#64748b" }}>AI-Presentation Studio</div>
      </header>

      <main style={S.main}>
        {/* LEFT — Form */}
        <div style={S.card}>
          <div style={S.h2}>Параметры презентации</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Компания *</label>
              <input style={S.input} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="MarketRadar" />
            </div>
            <div>
              <label style={S.label}>Ниша</label>
              <input style={S.input} value={niche} onChange={e => setNiche(e.target.value)} placeholder="SaaS для маркетинга" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Данные (JSON) — опционально</label>
            <textarea
              style={{ ...S.textarea, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={dataJson}
              onChange={e => setDataJson(e.target.value)}
              placeholder={`{\n  "mission": "...",\n  "competitors": [...],\n  "target_audience": "...",\n  "metrics": {...}\n}`}
            />
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
              Можно вставить результат анализа из MarketRadar или оставить пустым — Claude сгенерирует контент сам
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Стиль дизайна</label>
            <div style={{ display: "flex", gap: 6 }}>
              {STYLES.map(s => (
                <div key={s.id} style={S.styleCard(style === s.id)} onClick={() => setStyle(s.id)}>
                  <div style={{ fontWeight: 700, color: style === s.id ? "#a78bfa" : "#94a3b8" }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Доп. инструкции по дизайну</label>
            <textarea
              style={S.textarea}
              value={customDesignNotes}
              onChange={e => setCustomDesignNotes(e.target.value)}
              placeholder="Например: используй палитру с лавандовым акцентом, заголовки в Playfair Display, сделай слайды визуально как у Stripe..."
            />
          </div>

          {/* Reference images */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Визуальные референсы (до 8 изображений)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropImages(e.dataTransfer.files); }}
              style={{
                border: "2px dashed #2d3748", borderRadius: 10, padding: 18,
                textAlign: "center", cursor: "pointer", color: "#64748b", fontSize: 13,
                background: "#0a0b0f", transition: "border-color 0.15s",
              }}
            >
              {refFiles.length === 0
                ? "Перетащите сюда изображения или нажмите для выбора"
                : `Загружено: ${refFiles.length}`}
            </div>
            <input
              ref={fileInputRef} type="file" multiple accept="image/*"
              style={{ display: "none" }}
              onChange={e => onDropImages(e.target.files)}
            />
            {refFiles.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {refFiles.map((f, i) => (
                  <div key={i} style={{ position: "relative", width: 70, height: 70 }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid #2d3748" }} />
                    <button
                      onClick={() => setRefFiles(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, lineHeight: 1, fontWeight: 700 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={S.label}>Слайдов</label>
              <input type="number" style={S.input} min={6} max={20} value={slides} onChange={e => setSlides(Number(e.target.value))} />
            </div>
            <div>
              <label style={S.label}>Модель</label>
              <select style={S.select} value={model} onChange={e => setModel(e.target.value)}>
                <option value="claude-sonnet-4-5">Sonnet 4.5 (быстро, ~₽30)</option>
                <option value="claude-opus-4-1">Opus 4.1 (премиум, ~₽200)</option>
              </select>
            </div>
          </div>

          {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "#ef444411", borderRadius: 8 }}>{error}</div>}

          <button style={{ ...S.btn, opacity: submitting || (job?.status === "running") ? 0.6 : 1 }} onClick={submit} disabled={submitting || job?.status === "running"}>
            {submitting ? "Запуск..." : job?.status === "running" ? "Генерация в процессе..." : "Сгенерировать презентацию →"}
          </button>
        </div>

        {/* RIGHT — Output */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={S.h2}>Прогресс</div>
            {job && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={S.badge(STATUS_BADGE[job.status].color)}>{STATUS_BADGE[job.status].label}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>{job.durationSec}s</span>
              </div>
            )}
          </div>

          {!job ? (
            <div style={{ textAlign: "center", padding: 48, color: "#334155" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
              <div style={{ fontSize: 14 }}>Заполните форму слева и нажмите «Сгенерировать»</div>
              <div style={{ fontSize: 11, color: "#1e293b", marginTop: 8 }}>Генерация занимает 3–7 минут</div>
            </div>
          ) : (
            <>
              {/* Log */}
              <div style={{ background: "#0a0b0f", border: "1px solid #1e2737", borderRadius: 10, padding: "14px 16px", maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
                {job.log.map((line, i) => (
                  <div key={i} style={i === job.log.length - 1 ? S.logLineLast : S.logLine}>{line}</div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Slide thumbnails */}
              {slideFiles.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10, letterSpacing: "0.04em" }}>ПРЕВЬЮ ({slideFiles.length})</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {slideFiles.map(f => (
                      <a key={f} href={`/api/agent/file/${jobId}?path=${encodeURIComponent(f)}`} target="_blank" rel="noopener noreferrer">
                        <img src={`/api/agent/file/${jobId}?path=${encodeURIComponent(f)}`} alt="" style={{ width: "100%", borderRadius: 6, border: "1px solid #1e2737" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Download */}
              {pptxFile && job.status === "succeeded" && (
                <a
                  href={`/api/agent/file/${jobId}?path=${encodeURIComponent(pptxFile)}`}
                  download
                  style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", background: "linear-gradient(135deg, #4ade80, #16a34a)", color: "#0a0b0f" }}
                >
                  ⬇ Скачать .pptx
                </a>
              )}

              {job.status === "failed" && job.error && (
                <div style={{ background: "#ef444411", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171" }}>
                  {job.error}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
