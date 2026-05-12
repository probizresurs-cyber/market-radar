"use client";

import React, { useState, useEffect, useRef } from "react";
import { Edit2, Save, Trash2, ClipboardList, Mic, X, Loader2, Film, Sparkles, RefreshCw, Play } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { GeneratedReel, AvatarSettings, BrandBook, BrollClip } from "@/lib/content-types";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";
import { MetricsBlock } from "@/components/views/GeneratedPostsView";
import { OnboardingChecklist, type OnboardingState } from "@/components/ui/OnboardingChecklist";

export function VideoPreview({ c, src }: { c: Colors; src: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      {expanded ? (
        <div>
          <video src={src} controls style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 480 }} />
          <button onClick={() => setExpanded(false)} style={{ marginTop: 6, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer" }}>
            Свернуть
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #ec489940", background: "#ec489910", color: "#ec4899", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          ▶ Смотреть готовое видео
        </button>
      )}
    </div>
  );
}

export function ReelCard({ c, reel, onUpdate, onDelete, onGenerateVideo, generatingVideoFor, brandBook }: {
  c: Colors;
  reel: GeneratedReel;
  onUpdate: (updated: GeneratedReel) => void;
  onDelete: (id: string) => void;
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  brandBook?: BrandBook;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reel.title);
  const [scenario, setScenario] = useState(reel.scenario);
  const [voiceover, setVoiceover] = useState(reel.voiceoverScript);
  const [hashtagsRaw, setHashtagsRaw] = useState(reel.hashtags.join(" "));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = generatingVideoFor === reel.id || reel.videoStatus === "generating";

  const handleSave = () => {
    const tags = hashtagsRaw.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith("#") ? t : "#" + t);
    onUpdate({ ...reel, title, scenario, voiceoverScript: voiceover, hashtags: tags });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(reel.title);
    setScenario(reel.scenario);
    setVoiceover(reel.voiceoverScript);
    setHashtagsRaw(reel.hashtags.join(" "));
    setEditing(false);
  };

  // ── B-roll generation (HeyGen Video Agent / Veo 3.1) ───────────────
  const [brollLoading, setBrollLoading] = useState(false);
  const [brollError, setBrollError] = useState<string | null>(null);
  const [brollProvider, setBrollProvider] = useState<"veo_3_1_fast" | "veo_3_1" | "kling_pro">("veo_3_1_fast");
  const clips = reel.brollClips ?? [];

  // Poll pending clips каждые 8 секунд. Останавливаемся когда все completed/failed.
  useEffect(() => {
    const pending = clips.filter(c => c.status === "pending" && c.executionId);
    if (pending.length === 0) return;
    const id = setInterval(async () => {
      let changed = false;
      const updated = await Promise.all(
        (reel.brollClips ?? []).map(async (c) => {
          if (c.status !== "pending" || !c.executionId) return c;
          try {
            const r = await fetch(`/api/heygen-broll-status?executionId=${encodeURIComponent(c.executionId)}`);
            const j = await r.json();
            const s = j?.data?.status;
            if (s === "completed" && j?.data?.videoUrl) {
              changed = true;
              return { ...c, status: "completed" as const, videoUrl: j.data.videoUrl, thumbnailUrl: j.data.thumbnailUrl };
            }
            if (s === "failed") {
              changed = true;
              return { ...c, status: "failed" as const, error: j?.data?.error ?? "HeyGen failed" };
            }
            return c;
          } catch {
            return c;
          }
        }),
      );
      if (changed) onUpdate({ ...reel, brollClips: updated });
    }, 8000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.map(c => `${c.id}:${c.status}`).join(",")]);

  const handleGenerateBrollPrompts = async () => {
    setBrollLoading(true);
    setBrollError(null);
    try {
      // Шаг 1: Claude генерирует 3 b-roll промпта из сценария
      const r = await fetch("/api/generate-broll-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reel.title,
          scenario: reel.scenario,
          voiceoverScript: reel.voiceoverScript,
          brandBook,
          count: 3,
        }),
      });
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.prompts)) throw new Error(j.error ?? "Не удалось получить промпты");

      // Шаг 2: для каждого промпта запускаем HeyGen execution
      const fresh: BrollClip[] = [];
      for (const p of j.prompts) {
        const r2 = await fetch("/api/heygen-broll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: p.prompt,
            aspectRatio: "9:16",
            provider: brollProvider,
          }),
        });
        const j2 = await r2.json();
        fresh.push({
          id: `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: p.prompt,
          motionHint: p.motionHint || "B-roll",
          position: (["opener", "support", "transition", "closer"].includes(p.position) ? p.position : "support") as BrollClip["position"],
          executionId: j2.ok ? j2.executionId : undefined,
          status: j2.ok ? "pending" : "failed",
          provider: brollProvider,
          error: j2.ok ? undefined : (j2.error ?? "HeyGen error"),
          createdAt: new Date().toISOString(),
        });
      }
      onUpdate({ ...reel, brollClips: [...clips, ...fresh] });
    } catch (e) {
      setBrollError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBrollLoading(false);
    }
  };

  const handleRetryClip = async (clip: BrollClip) => {
    setBrollError(null);
    try {
      const r = await fetch("/api/heygen-broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: clip.prompt,
          aspectRatio: "9:16",
          provider: clip.provider ?? brollProvider,
        }),
      });
      const j = await r.json();
      const updated: BrollClip = j.ok
        ? { ...clip, executionId: j.executionId, status: "pending", error: undefined, createdAt: new Date().toISOString() }
        : { ...clip, status: "failed", error: j.error ?? "HeyGen error" };
      onUpdate({ ...reel, brollClips: clips.map(c => c.id === clip.id ? updated : c) });
    } catch (e) {
      setBrollError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleDeleteClip = (id: string) => {
    onUpdate({ ...reel, brollClips: clips.filter(c => c.id !== id) });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1.5px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 14, outline: "none",
    lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box",
  };
  const editLabelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)",
    marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase",
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `2px solid ${editing ? "#ec489960" : "var(--border)"}`, padding: 18, boxShadow: "var(--shadow)", transition: "border-color 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, background: "#ec489918", color: "#ec4899", borderRadius: 8, padding: "5px 11px" }}>REEL · {reel.durationSec}s</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{new Date(reel.generatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Edit2 size={12}/> Редактировать
            </button>
          )}
        </div>
      </div>

      {/* Finished video — compact toggle */}
      {reel.videoUrl && reel.videoStatus === "ready" && (
        <VideoPreview c={c} src={reel.videoUrl} />
      )}

      {editing ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={editLabelStyle}>Название</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={editLabelStyle}>Раскадровка</label>
            <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={editLabelStyle}>Текст для озвучки <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)" }}>(отправляется в HeyGen)</span></label>
            <textarea value={voiceover} onChange={e => setVoiceover(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>После правки можно заново сгенерировать видео с обновлённым текстом</div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={editLabelStyle}>Хэштеги</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button onClick={handleSave} style={{ padding: "11px 20px", borderRadius: 9, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, minHeight: 42 }}>
              <Save size={15}/> Сохранить
            </button>
            <button onClick={handleCancel} style={{ padding: "11px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 42 }}>
              Отмена
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {confirmDelete ? (
                <>
                  <button onClick={() => onDelete(reel.id)} style={{ padding: "11px 18px", borderRadius: 9, border: "none", background: "var(--destructive)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 42 }}>Удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "11px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", fontSize: 14, cursor: "pointer", minHeight: 42 }}>Нет</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} title="Удалить рилс" style={{ padding: "11px 14px", borderRadius: 9, border: "1px solid color-mix(in oklch, var(--destructive) 30%, var(--border))", background: "transparent", color: "var(--destructive)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 42 }}>
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.3, marginBottom: 14, letterSpacing: -0.2 }}>{reel.title}</div>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><ClipboardList size={14}/> Раскадровка</summary>
            <pre style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--background)", padding: 14, borderRadius: 10, border: "1px solid var(--muted)" }}>{reel.scenario}</pre>
          </details>

          <details style={{ marginBottom: 14 }}>
            <summary style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Mic size={14}/> Текст для озвучки</summary>
            <p style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: "10px 0 0", background: "var(--background)", padding: 14, borderRadius: 10, border: "1px solid var(--muted)" }}>{reel.voiceoverScript}</p>
          </details>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {reel.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
            ))}
          </div>

          {reel.videoStatus === "failed" && reel.videoError && (
            <div style={{ background: "color-mix(in oklch, var(--destructive) 8%, transparent)", color: "var(--destructive)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><X size={14}/> {reel.videoError}</div>
          )}

          {reel.videoStatus !== "ready" && (
            <button
              onClick={() => onGenerateVideo(reel.id)}
              disabled={busy}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: busy ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}>
              {reel.videoStatus === "generating"
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> HeyGen рендерит видео… (~2-5 мин)</>
                : busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Запускаем HeyGen…</>
                : reel.videoStatus === "failed" ? "🔄 Повторить генерацию"
                : "🎥 Сгенерировать видео с аватаром"}
            </button>
          )}

          {/* ── B-roll section (HeyGen Video Agent / Veo 3.1) ─────────── */}
          <div style={{
            marginTop: 14, padding: "14px 16px", borderRadius: 12,
            background: "color-mix(in oklch, #ec4899 5%, transparent)",
            border: "1px dashed #ec489955",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Film size={15} style={{ color: "#ec4899" }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#ec4899", letterSpacing: "-0.01em" }}>
                  B-roll кадры
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  · HeyGen Video Agent · ~$0.17/клип
                </span>
              </div>
              {clips.length === 0 && (
                <select
                  value={brollProvider}
                  onChange={e => setBrollProvider(e.target.value as typeof brollProvider)}
                  disabled={brollLoading}
                  style={{
                    fontSize: 11, padding: "4px 8px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--background)",
                    color: "var(--foreground)", fontFamily: "inherit",
                  }}
                >
                  <option value="veo_3_1_fast">Veo 3.1 Fast (дешевле)</option>
                  <option value="veo_3_1">Veo 3.1 (премиум)</option>
                  <option value="kling_pro">Kling Pro</option>
                </select>
              )}
            </div>

            {clips.length === 0 ? (
              <>
                <p style={{ fontSize: 12, color: "var(--foreground-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  AI прочитает сценарий и сгенерирует 3 кинематографичных кадра, которые можно вставить между планами с аватаром. Длина ~5 сек, 9:16. Готовится 1-3 минуты.
                </p>
                <button
                  onClick={handleGenerateBrollPrompts}
                  disabled={brollLoading || !reel.voiceoverScript}
                  style={{
                    padding: "9px 18px", borderRadius: 9, border: "none",
                    background: brollLoading || !reel.voiceoverScript ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)",
                    color: brollLoading || !reel.voiceoverScript ? "var(--muted-foreground)" : "#fff",
                    fontSize: 13, fontWeight: 700, cursor: brollLoading ? "wait" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 7, minHeight: 38,
                    fontFamily: "inherit",
                  }}
                >
                  {brollLoading ? <Loader2 size={13} className="mr-spin" /> : <Sparkles size={13} />}
                  {brollLoading ? "Генерирую промпты и запускаю HeyGen…" : "Сгенерировать 3 b-roll кадра"}
                </button>
              </>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                  marginBottom: 10,
                }}>
                  {clips.map((clip) => (
                    <div key={clip.id} style={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: 10, position: "relative",
                    }}>
                      <button
                        onClick={() => handleDeleteClip(clip.id)}
                        aria-label="Удалить кадр"
                        style={{
                          position: "absolute", top: 6, right: 6,
                          background: "rgba(0,0,0,0.5)", color: "#fff", border: "none",
                          borderRadius: 6, padding: "2px 6px", cursor: "pointer",
                          fontSize: 11, zIndex: 2,
                        }}
                      >
                        <X size={11} />
                      </button>
                      {clip.status === "completed" && clip.videoUrl ? (
                        <video
                          src={clip.videoUrl}
                          poster={clip.thumbnailUrl}
                          controls
                          playsInline
                          style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 6, background: "#000", objectFit: "cover", marginBottom: 6 }}
                        />
                      ) : clip.status === "failed" ? (
                        <div style={{
                          width: "100%", aspectRatio: "9 / 16", borderRadius: 6,
                          background: "color-mix(in oklch, var(--destructive) 10%, var(--background))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--destructive)", padding: 8, textAlign: "center", marginBottom: 6,
                        }}>
                          <div>
                            <X size={20} style={{ marginBottom: 4 }} />
                            <div style={{ fontSize: 10, fontWeight: 700 }}>Ошибка</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          width: "100%", aspectRatio: "9 / 16", borderRadius: 6,
                          background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#ec4899", padding: 8, textAlign: "center", marginBottom: 6,
                          border: "1px dashed #ec489940",
                        }}>
                          <div>
                            <Loader2 size={20} className="mr-spin" style={{ marginBottom: 4 }} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--foreground-secondary)" }}>Veo рендерит…</div>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ec4899", letterSpacing: "0.04em", marginBottom: 3, textTransform: "uppercase" }}>
                        {clip.position}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3, marginBottom: 4 }}>
                        {clip.motionHint}
                      </div>
                      <div title={clip.prompt} style={{
                        fontSize: 10.5, color: "var(--muted-foreground)", lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {clip.prompt}
                      </div>
                      {clip.status === "failed" && (
                        <button
                          onClick={() => handleRetryClip(clip)}
                          style={{
                            marginTop: 6, width: "100%", padding: "5px 8px",
                            borderRadius: 6, border: "1px solid var(--border)",
                            background: "transparent", color: "var(--foreground-secondary)",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                            fontFamily: "inherit",
                          }}
                        >
                          <RefreshCw size={11} /> Повторить
                        </button>
                      )}
                      {clip.status === "completed" && clip.videoUrl && (
                        <a
                          href={clip.videoUrl}
                          download={`broll-${clip.id}.mp4`}
                          style={{
                            marginTop: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                            width: "100%", padding: "5px 8px", borderRadius: 6,
                            border: "1px solid var(--border)", background: "transparent",
                            color: "var(--foreground-secondary)", fontSize: 11, fontWeight: 600,
                            textDecoration: "none", boxSizing: "border-box",
                          }}
                        >
                          <Play size={11} /> Скачать
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleGenerateBrollPrompts}
                  disabled={brollLoading}
                  style={{
                    padding: "7px 14px", borderRadius: 8, border: "1px dashed #ec489960",
                    background: "transparent", color: "#ec4899",
                    fontSize: 12, fontWeight: 700, cursor: brollLoading ? "wait" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}
                >
                  {brollLoading ? <Loader2 size={11} className="mr-spin" /> : <Sparkles size={11} />}
                  Ещё 3 кадра
                </button>
              </>
            )}

            {brollError && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 8,
                background: "color-mix(in oklch, var(--destructive) 10%, transparent)",
                color: "var(--destructive)", fontSize: 12,
              }}>
                {brollError}
              </div>
            )}
          </div>

          <MetricsBlock c={c} kind="reel" metrics={reel.metrics} onChange={m => onUpdate({ ...reel, metrics: m })} />
        </>
      )}
    </div>
  );
}

export function GeneratedReelsView({ c, reels, onGenerateVideo, generatingVideoFor, avatarSettings, onUpdateAvatarSettings, onUpdateReel, onDeleteReel, onboardingState, brandBook }: {
  c: Colors;
  reels: GeneratedReel[];
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  onUpdateReel: (updated: GeneratedReel) => void;
  onDeleteReel: (id: string) => void;
  onboardingState?: OnboardingState;
  brandBook?: BrandBook;
}) {
  if (reels.length === 0) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Готовые видео</h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 28px" }}>Настройте аватара, потом сгенерируйте сценарии в «Плане контента».</p>

        {onboardingState && (
          <OnboardingChecklist
            state={onboardingState}
            onNavigate={(nav) => { window.location.href = `/?nav=${nav}`; }}
          />
        )}

        <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
        <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "44px 28px", textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "color-mix(in srgb, #ec4899 12%, transparent)", color: "#ec4899", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 32 }}>🎬</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>Пока нет сценариев</div>
          <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px" }}>
            Перейдите в «План контента» и нажмите «Создать сценарий рилса» на любой идее.
          </div>
          <a href="/?nav=content-plan" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            План контента →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--foreground)", letterSpacing: -0.5 }}>Готовые видео</h1>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", padding: "4px 12px", borderRadius: 20, background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
          {reels.length}
        </span>
      </div>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 6 }}>
        Кликните <Edit2 size={14}/> для правки сценария и текста озвучки.
      </p>
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {reels.map(reel => (
          <ReelCard key={reel.id} c={c} reel={reel} onUpdate={onUpdateReel} onDelete={onDeleteReel} onGenerateVideo={onGenerateVideo} generatingVideoFor={generatingVideoFor} brandBook={brandBook} />
        ))}
      </div>
    </div>
  );
}
