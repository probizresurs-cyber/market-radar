"use client";

import React, { useState, useEffect, useRef } from "react";
import { Edit2, Save, Trash2, ClipboardList, Mic, X, Loader2 } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { GeneratedReel, AvatarSettings, BrandBook } from "@/lib/content-types";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";
import { MetricsBlock } from "@/components/views/GeneratedPostsView";

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

export function ReelCard({ c, reel, onUpdate, onDelete, onGenerateVideo, generatingVideoFor }: {
  c: Colors;
  reel: GeneratedReel;
  onUpdate: (updated: GeneratedReel) => void;
  onDelete: (id: string) => void;
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
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

          <MetricsBlock c={c} kind="reel" metrics={reel.metrics} onChange={m => onUpdate({ ...reel, metrics: m })} />
        </>
      )}
    </div>
  );
}

export function GeneratedReelsView({ c, reels, onGenerateVideo, generatingVideoFor, avatarSettings, onUpdateAvatarSettings, onUpdateReel, onDeleteReel }: {
  c: Colors;
  reels: GeneratedReel[];
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  onUpdateReel: (updated: GeneratedReel) => void;
  onDeleteReel: (id: string) => void;
}) {
  if (reels.length === 0) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Готовые видео</h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 28px" }}>Настройте аватара, потом сгенерируйте сценарии в «Плане контента».</p>
        <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
        <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "56px 32px", textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎬</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 10 }}>Пока нет сценариев</div>
          <div style={{ fontSize: 15, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 24px" }}>
            Перейдите в «План контента» и нажмите «Создать сценарий рилса» на любой идее.
          </div>
          <a href="/?nav=content-plan" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
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
          <ReelCard key={reel.id} c={c} reel={reel} onUpdate={onUpdateReel} onDelete={onDeleteReel} onGenerateVideo={onGenerateVideo} generatingVideoFor={generatingVideoFor} />
        ))}
      </div>
    </div>
  );
}
