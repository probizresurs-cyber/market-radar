"use client";

import React, { useState, useEffect, useRef } from "react";
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
          <video src={src} controls style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 400 }} />
          <button onClick={() => setExpanded(false)} style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 10, cursor: "pointer" }}>
            Свернуть
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid #ec489940`, background: "#ec489910", color: "#ec4899", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
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
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${c.accent}50`, background: c.bg,
    color: c.textPrimary, fontSize: 12, outline: "none",
    lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `2px solid ${editing ? "#ec489960" : c.border}`, padding: 18, boxShadow: c.shadow, transition: "border-color 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "3px 8px" }}>REEL · {reel.durationSec}s</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(reel.generatedAt).toLocaleString("ru-RU")}</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ✏️ Редактировать
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
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>НАЗВАНИЕ</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>РАСКАДРОВКА</label>
            <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>ТЕКСТ ДЛЯ ОЗВУЧКИ (отправляется в HeyGen)</label>
            <textarea value={voiceover} onChange={e => setVoiceover(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>После правки можно заново сгенерировать видео с обновлённым текстом</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>ХЭШТЕГИ</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              💾 Сохранить
            </button>
            <button onClick={handleCancel} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Отмена
            </button>
            {confirmDelete ? (
              <>
                <button onClick={() => onDelete(reel.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: c.accentRed, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, cursor: "pointer" }}>Нет</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🗑 Удалить
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 12 }}>{reel.title}</div>

          <details style={{ marginBottom: 10 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary, cursor: "pointer" }}>📋 Раскадровка</summary>
            <pre style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.55, margin: "8px 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", background: c.bg, padding: 12, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>{reel.scenario}</pre>
          </details>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary, cursor: "pointer" }}>🎙 Текст для озвучки</summary>
            <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: "8px 0 0", background: c.bg, padding: 12, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>{reel.voiceoverScript}</p>
          </details>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {reel.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
            ))}
          </div>

          {reel.videoStatus === "failed" && reel.videoError && (
            <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 10 }}>❌ {reel.videoError}</div>
          )}

          {reel.videoStatus !== "ready" && (
            <button
              onClick={() => onGenerateVideo(reel.id)}
              disabled={busy}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}>
              {reel.videoStatus === "generating"
                ? "⏳ HeyGen генерирует видео… (~2-5 мин)"
                : busy ? "⏳ Запускаем HeyGen…"
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
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые видео</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Настройте аватара, потом сгенерируйте сценарии в «План контента»</p>
        <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 14, color: c.textSecondary }}>Пока нет сценариев. Перейдите в «План контента» и нажмите «Создать сценарий рилса» на любой идее.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые видео ({reels.length})</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Кликните ✏️ для правки сценария и текста озвучки</p>
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {reels.map(reel => (
          <ReelCard key={reel.id} c={c} reel={reel} onUpdate={onUpdateReel} onDelete={onDeleteReel} onGenerateVideo={onGenerateVideo} generatingVideoFor={generatingVideoFor} />
        ))}
      </div>
    </div>
  );
}
