"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Edit2, Save, Trash2, ClipboardList, Mic, X, Loader2, Film, Sparkles, RefreshCw, Play } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { GeneratedReel, AvatarSettings, BrandBook, BrollClip, ContentPlan, ContentReelIdea } from "@/lib/content-types";
import { AvatarSettingsPanel } from "@/components/ui/AvatarSettingsPanel";
import { MetricsBlock } from "@/components/views/GeneratedPostsView";
import { OnboardingChecklist, type OnboardingState } from "@/components/ui/OnboardingChecklist";
import { ContentGeneratorBlock } from "@/components/views/ContentPlanView";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

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

export function ReelCard({ c, reel, onUpdate, onDelete, onGenerateVideo, generatingVideoFor, brandBook, alwaysExpanded = false, onRowClick, onRowDelete, companyName, companyNiche, avatarSettings }: {
  c: Colors;
  reel: GeneratedReel;
  onUpdate: (updated: GeneratedReel) => void;
  onDelete: (id: string) => void;
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  brandBook?: BrandBook;
  alwaysExpanded?: boolean;
  onRowClick?: (reel: GeneratedReel) => void;
  onRowDelete?: (reel: GeneratedReel) => void;
  /** Имя компании и описание ниши для контекстных b-roll промптов.
   *  Без них Claude генерит абстрактные кадры (или хуже — про конкурента из старого брендбука). */
  companyName?: string;
  companyNiche?: string;
  /** Чтобы дать селектор аватара из библиотеки customAvatars прямо на карточке рилса. */
  avatarSettings?: AvatarSettings;
}) {
  const [collapsed, setCollapsed] = useState(true);
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
  // brollProvider больше не используется — провайдер выбирается video-agent'ом
  const clips = reel.brollClips ?? [];

  // Стабильный ключ зависимости — пересчитываем только когда у клипа
  // меняется id/status. Раньше зависимость считалась через `.map().join()`
  // прямо в массиве deps useEffect: при каждом рендере получалась новая
  // строка → React не успевал понять что dep не изменился → setInterval
  // пересоздавался каждые 16мс и DDOS-ил наш /api/heygen-broll-status.
  const clipsPollKey = useMemo(
    () => clips.map(c => `${c.id}:${c.status}`).join(","),
    [clips],
  );

  // Poll pending clips. Раньше всегда 8 сек, но при N открытых reel'ах
  // с pending clips это давало N*clips fetch'ей каждые 8 сек.
  // Адаптивный интервал: больше клипов в очереди = реже poll, чтобы
  // не DDOS-ить HeyGen API. Floor 8s, ceil 30s.
  useEffect(() => {
    const pending = clips.filter(c => c.status === "pending" && c.executionId);
    if (pending.length === 0) return;
    // Адаптивный интервал: 8s base + 1s на каждый pending клип сверх первого.
    const intervalMs = Math.min(30_000, 8_000 + (pending.length - 1) * 1_000);
    // Используем in-flight guard: предыдущий poll должен закончиться
    // прежде чем стартует новый. Без него при медленной сети накапливаются
    // одновременные запросы.
    let inFlight = false;
    const id = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        let changed = false;
        const updated = await Promise.all(
          (reel.brollClips ?? []).map(async (c) => {
            if (c.status !== "pending" || !c.executionId) return c;
            try {
              const r = await fetch(`/api/heygen-broll-status?executionId=${encodeURIComponent(c.executionId)}`);
              const j = await jsonOrThrow(r);
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
      } finally {
        inFlight = false;
      }
    }, intervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipsPollKey]);

  const handleGenerateBrollPrompts = async () => {
    setBrollLoading(true);
    setBrollError(null);
    try {
      // Claude пишет описания сцен — НЕ рендерит их отдельно. Эти сцены
      // пойдут в prompt /v3/video-agents и встроятся в финальное видео.
      const r = await fetch("/api/generate-broll-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reel.title,
          scenario: reel.scenario,
          voiceoverScript: reel.voiceoverScript,
          brandBook,
          count: 3,
          companyName,
          companyNiche,
        }),
      });
      const j = await jsonOrThrow(r);
      if (!j.ok || !Array.isArray(j.prompts)) throw new Error(j.error ?? "Не удалось получить сцены");

      const fresh: BrollClip[] = j.prompts.map((p: { prompt: string; motionHint?: string; position?: string }) => ({
        id: `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        prompt: p.prompt,
        motionHint: p.motionHint || "B-roll",
        position: (["opener", "support", "transition", "closer"].includes(p.position ?? "") ? p.position : "support") as BrollClip["position"],
        status: "planned" as const,
        createdAt: new Date().toISOString(),
      }));
      onUpdate({ ...reel, brollClips: [...clips.filter(c => c.status === "planned"), ...fresh] });
    } catch (e) {
      setBrollError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBrollLoading(false);
    }
  };

  // Редактирование текста конкретной сцены (планируемого b-roll).
  const handleEditScene = (id: string, patch: Partial<BrollClip>) => {
    onUpdate({ ...reel, brollClips: clips.map(c => c.id === id ? { ...c, ...patch } : c) });
  };

  // Добавить пустую сцену вручную.
  const handleAddScene = () => {
    const newScene: BrollClip = {
      id: `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: "",
      motionHint: "Dolly in",
      position: "support",
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...reel, brollClips: [...clips, newScene] });
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

  // === Свёрнутая строка списка ===
  if (!alwaysExpanded && collapsed && !editing) {
    const dateObj = new Date(reel.generatedAt);
    const dayStr = dateObj.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
    const timeStr = dateObj.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    // Цвет полосы + статус-бейдж в зависимости от состояния видео
    const statusColor = reel.videoStatus === "ready" ? "#22c55e"
      : reel.videoStatus === "generating" ? "#8b5cf6"
      : reel.videoStatus === "failed" ? "#ef4444"
      : "#ec4899";
    const statusLabel = reel.videoStatus === "ready" ? "Готово"
      : reel.videoStatus === "generating" ? "В работе"
      : reel.videoStatus === "failed" ? "Ошибка"
      : "Идея";

    const handleClick = () => {
      if (onRowClick) onRowClick(reel);
      else setCollapsed(false);
    };
    const handleDel = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRowDelete) onRowDelete(reel);
      else if (confirm("Удалить видео-сценарий безвозвратно?")) onDelete(reel.id);
    };

    return (
      <div
        onClick={handleClick}
        style={{
          background: "var(--card)",
          borderRadius: 10,
          border: "1px solid var(--border)",
          borderLeft: `3px solid ${statusColor}`,
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer", minHeight: 56,
          transition: "background 0.12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklch, var(--card) 92%, var(--primary) 4%)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
      >
        {/* Thumb 40×40 — кадр видео или иконка */}
        <div style={{
          width: 40, height: 40, borderRadius: 7,
          background: `linear-gradient(135deg, ${statusColor}30, ${statusColor}10)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}>
          {reel.videoUrl && reel.videoStatus === "ready" ? (
            <video src={reel.videoUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : reel.videoStatus === "generating" ? (
            <Loader2 size={16} style={{ color: statusColor, animation: "spin 1s linear infinite" }} />
          ) : (
            <Film size={16} style={{ color: statusColor, opacity: 0.7 }} />
          )}
        </div>

        {/* Status chip */}
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
          background: `${statusColor}18`, color: statusColor,
          borderRadius: 4, padding: "2px 7px",
          flexShrink: 0,
        }}>{statusLabel}</span>

        {/* Title — занимает всё */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 13.5, fontWeight: 600, color: "var(--foreground)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>
          {reel.title || "Без названия"}
        </div>

        {/* Duration small */}
        <span style={{
          fontSize: 10.5, fontWeight: 700,
          background: "color-mix(in oklch, var(--foreground) 8%, transparent)",
          color: "var(--muted-foreground)",
          borderRadius: 4, padding: "2px 6px",
          flexShrink: 0,
        }}>{reel.durationSec}s</span>

        {/* Дата (2 строки) */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          flexShrink: 0, minWidth: 56, lineHeight: 1.15,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{dayStr}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{timeStr}</span>
        </div>

        {/* Delete */}
        <button
          onClick={handleDel}
          title="Удалить рилс"
          style={{
            background: "transparent", border: "none",
            padding: 6, cursor: "pointer",
            color: "var(--muted-foreground)",
            borderRadius: 6,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "color-mix(in oklch, var(--destructive) 12%, transparent)";
            e.currentTarget.style.color = "var(--destructive)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--muted-foreground)";
          }}
        >
          <Trash2 size={15}/>
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `2px solid ${editing ? "#ec489960" : "var(--border)"}`, padding: 18, boxShadow: "var(--shadow)", transition: "border-color 0.15s" }}>
      {/* Кнопка свернуть обратно — только когда карточка не в модалке */}
      {!alwaysExpanded && !editing && (
        <button
          onClick={() => setCollapsed(true)}
          title="Свернуть"
          style={{
            position: "absolute", marginLeft: "auto",
            float: "right",
            padding: "5px 10px", borderRadius: 7,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600,
            cursor: "pointer",
          }}
        >▲</button>
      )}
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

          {/* ── B-roll: план сцен для video-agent ─────────────────
              Не рендерится отдельно — описания сцен идут в prompt основной
              генерации видео и встраиваются в финальный клип за один заход. */}
          <div style={{
            marginBottom: 14, padding: "12px 14px", borderRadius: 10,
            background: "color-mix(in oklch, #ec4899 5%, transparent)",
            border: "1px dashed #ec489955",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Film size={15} style={{ color: "#ec4899" }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#ec4899" }}>
                  B-roll сцены (опционально)
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  · вставятся в финальное видео
                </span>
              </div>
            </div>

            {(() => {
              const planned = clips.filter(c => c.status === "planned");
              if (planned.length === 0) {
                return (
                  <>
                    <p style={{ fontSize: 12, color: "var(--foreground-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                      Если оставить пустым — video-agent сам решит какие b-roll вставить. Чтобы зафиксировать конкретные сцены, сгенерируйте их или добавьте вручную — они уйдут в prompt вместе с основным видео.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={handleGenerateBrollPrompts}
                        disabled={brollLoading || !reel.voiceoverScript}
                        style={{
                          padding: "8px 14px", borderRadius: 8, border: "none",
                          background: brollLoading || !reel.voiceoverScript ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)",
                          color: brollLoading || !reel.voiceoverScript ? "var(--muted-foreground)" : "#fff",
                          fontSize: 12.5, fontWeight: 700, cursor: brollLoading ? "wait" : "pointer",
                          display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                        }}
                      >
                        {brollLoading ? <Loader2 size={12} className="mr-spin" /> : <Sparkles size={12} />}
                        {brollLoading ? "Пишу сцены…" : "Подобрать 3 сцены"}
                      </button>
                      <button
                        onClick={handleAddScene}
                        style={{
                          padding: "8px 14px", borderRadius: 8,
                          border: "1px dashed #ec489960", background: "transparent",
                          color: "#ec4899", fontSize: 12.5, fontWeight: 700,
                          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                          fontFamily: "inherit",
                        }}
                      >
                        + Добавить вручную
                      </button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    {planned.map((scene, i) => (
                      <div key={scene.id} style={{
                        background: "var(--card)", border: "1px solid var(--border)",
                        borderRadius: 8, padding: 10, position: "relative",
                        display: "flex", flexDirection: "column", gap: 6,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: "#ec4899",
                            background: "#ec489918", padding: "2px 7px", borderRadius: 4,
                            letterSpacing: "0.05em",
                          }}>
                            СЦЕНА {i + 1}
                          </span>
                          <select
                            value={scene.position}
                            onChange={e => handleEditScene(scene.id, { position: e.target.value as BrollClip["position"] })}
                            style={{
                              fontSize: 11, padding: "3px 7px", borderRadius: 5,
                              border: "1px solid var(--border)", background: "var(--background)",
                              color: "var(--foreground)", fontFamily: "inherit",
                            }}
                          >
                            <option value="opener">Opener (начало)</option>
                            <option value="support">Support (по тексту)</option>
                            <option value="transition">Transition (переход)</option>
                            <option value="closer">Closer (финал)</option>
                          </select>
                          <input
                            type="text"
                            value={scene.motionHint}
                            onChange={e => handleEditScene(scene.id, { motionHint: e.target.value })}
                            placeholder="Камера: Dolly in / Drone / Orbit…"
                            style={{
                              flex: 1, minWidth: 140,
                              fontSize: 11, padding: "3px 8px", borderRadius: 5,
                              border: "1px solid var(--border)", background: "var(--background)",
                              color: "var(--foreground)", fontFamily: "inherit", outline: "none",
                            }}
                          />
                          <button
                            onClick={() => handleDeleteClip(scene.id)}
                            title="Удалить сцену"
                            style={{
                              background: "transparent", border: "none", padding: 3, cursor: "pointer",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <textarea
                          value={scene.prompt}
                          onChange={e => handleEditScene(scene.id, { prompt: e.target.value })}
                          rows={2}
                          placeholder="Опишите кадр на английском: что в кадре, освещение, фон, действие"
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 6,
                            border: "1px solid var(--border)", background: "var(--background)",
                            color: "var(--foreground)", fontSize: 12, lineHeight: 1.45,
                            outline: "none", resize: "vertical", fontFamily: "inherit",
                            boxSizing: "border-box",
                          }}
                        />
                        {/* Опц референс-фото — оживляется в кадр (image-to-video) */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {scene.referenceImageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={scene.referenceImageUrl}
                                alt={scene.referenceImageName || "ref"}
                                style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }}
                              />
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {scene.referenceImageName || "Референс"}
                              </span>
                              <button
                                onClick={() => handleEditScene(scene.id, { referenceImageUrl: undefined, referenceImageName: undefined })}
                                style={{
                                  padding: "3px 8px", borderRadius: 5,
                                  border: "1px solid var(--border)", background: "transparent",
                                  color: "var(--muted-foreground)", fontSize: 10.5, fontWeight: 600,
                                  cursor: "pointer", fontFamily: "inherit",
                                }}
                              >Убрать</button>
                            </>
                          ) : (
                            <label style={{
                              padding: "5px 10px", borderRadius: 6,
                              border: "1px dashed #ec489950", background: "transparent",
                              color: "#ec4899", fontSize: 11, fontWeight: 700,
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                              fontFamily: "inherit",
                            }}>
                              📎 Прикрепить фото-референс
                              <input
                                type="file" accept="image/*" style={{ display: "none" }}
                                onChange={async e => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  if (f.size > 4 * 1024 * 1024) {
                                    alert("Файл больше 4 МБ");
                                    return;
                                  }
                                  const dataUrl = await new Promise<string>((res, rej) => {
                                    const r = new FileReader();
                                    r.onload = () => res(r.result as string);
                                    r.onerror = () => rej(r.error);
                                    r.readAsDataURL(f);
                                  });
                                  handleEditScene(scene.id, { referenceImageUrl: dataUrl, referenceImageName: f.name });
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                          <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                            фото оживёт в кадр (image-to-video)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={handleAddScene}
                      style={{
                        padding: "6px 12px", borderRadius: 7,
                        border: "1px dashed #ec489960", background: "transparent",
                        color: "#ec4899", fontSize: 11.5, fontWeight: 700,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                        fontFamily: "inherit",
                      }}
                    >
                      + Сцена
                    </button>
                    <button
                      onClick={handleGenerateBrollPrompts}
                      disabled={brollLoading}
                      style={{
                        padding: "6px 12px", borderRadius: 7,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 600,
                        cursor: brollLoading ? "wait" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit",
                      }}
                    >
                      {brollLoading ? <Loader2 size={11} className="mr-spin" /> : <RefreshCw size={11} />}
                      Перегенерировать
                    </button>
                  </div>
                </>
              );
            })()}

            {brollError && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 7,
                background: "color-mix(in oklch, var(--destructive) 10%, transparent)",
                color: "var(--destructive)", fontSize: 12, lineHeight: 1.5,
              }}>
                {brollError}
              </div>
            )}
          </div>

          {/* Основная генерация видео — единый all-in-one через v3/video-agents */}
          {/* Настройки финального видео: длительность, сабтитры, выбор аватара */}
          {reel.videoStatus !== "ready" && (
            <div style={{
              marginBottom: 12, padding: "12px 14px", borderRadius: 10,
              background: "var(--background)",
              border: "1px solid var(--border)",
              display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end",
            }}>
              {/* Длительность */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Длительность
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {([5, 10, 15, 30, 60] as const).map(sec => {
                    const cur = reel.targetDurationSec ?? reel.durationSec ?? 30;
                    const active = cur === sec;
                    return (
                      <button
                        key={sec}
                        onClick={() => onUpdate({ ...reel, targetDurationSec: sec })}
                        style={{
                          padding: "5px 10px", borderRadius: 6,
                          border: `1.5px solid ${active ? "#ec4899" : "var(--border)"}`,
                          background: active ? "#ec489918" : "transparent",
                          color: active ? "#ec4899" : "var(--foreground-secondary)",
                          fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                          minWidth: 36,
                        }}
                      >{sec}s</button>
                    );
                  })}
                </div>
              </div>

              {/* Режим финального видео */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Режим
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {([
                    { id: "mixed" as const, label: "Аватар + B-roll" },
                    { id: "avatar-only" as const, label: "Только аватар" },
                    { id: "broll-only" as const, label: "Только B-roll" },
                  ]).map(m => {
                    const active = (reel.videoMode ?? "mixed") === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onUpdate({ ...reel, videoMode: m.id })}
                        style={{
                          padding: "5px 10px", borderRadius: 6,
                          border: `1.5px solid ${active ? "#ec4899" : "var(--border)"}`,
                          background: active ? "#ec489918" : "transparent",
                          color: active ? "#ec4899" : "var(--foreground-secondary)",
                          fontSize: 11.5, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}>{m.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Сабтитры */}
              <label style={{
                display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none",
                fontSize: 12.5, fontWeight: 600, color: "var(--foreground)",
              }}>
                <input
                  type="checkbox"
                  checked={reel.subtitles !== false}
                  onChange={e => onUpdate({ ...reel, subtitles: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "#ec4899", cursor: "pointer" }}
                />
                Субтитры
              </label>

              {/* Селектор аватара из библиотеки (если есть кастомные) */}
              {avatarSettings?.customAvatars && avatarSettings.customAvatars.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Аватар
                  </label>
                  <select
                    value={reel.selectedAvatarId || avatarSettings.avatarId || ""}
                    onChange={e => onUpdate({ ...reel, selectedAvatarId: e.target.value || undefined })}
                    style={{
                      padding: "6px 10px", borderRadius: 7,
                      border: "1px solid var(--border)", background: "var(--card)",
                      color: "var(--foreground)", fontSize: 12.5, fontFamily: "inherit",
                      outline: "none", cursor: "pointer",
                    }}
                  >
                    <option value="">— по умолчанию —</option>
                    {avatarSettings.customAvatars.map(av => (
                      <option key={av.id} value={av.heygenAvatarId ?? av.id}>
                        {av.name}{av.status !== "ready" ? " (готовится)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {reel.videoStatus !== "ready" && (
            <button
              onClick={() => onGenerateVideo(reel.id)}
              disabled={busy}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: busy ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}>
              {reel.videoStatus === "generating"
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> HeyGen рендерит видео… (~2-5 мин)</>
                : busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Запускаем HeyGen…</>
                : reel.videoStatus === "failed" ? "Повторить генерацию"
                : "Сгенерировать видео с аватаром"}
            </button>
          )}

          <MetricsBlock
            c={c} kind="reel"
            metrics={reel.metrics}
            onChange={m => onUpdate({ ...reel, metrics: m })}
            // Для рилса статус published = videoStatus 'ready' (видео уже снято).
            // Метрики до этого вносить нельзя.
            locked={reel.videoStatus !== "ready"}
          />
        </>
      )}
    </div>
  );
}

export function GeneratedReelsView({
  c, reels, onGenerateVideo, generatingVideoFor,
  avatarSettings, onUpdateAvatarSettings,
  onUpdateReel, onDeleteReel, onboardingState, brandBook,
  // Доп. пропсы — для встроенного блока «Создать видео»:
  plan, isGeneratingReel, generatingReelId, onGenerateReelScenario,
  // Контекст компании — пробрасывается в ReelCard → /api/generate-broll-prompts
  companyName, companyNiche,
  // Контекст для AutoIdeasModal внутри ContentGeneratorBlock
  myCompany, taResult, smmAnalysis,
}: {
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
  plan?: ContentPlan | null;
  isGeneratingReel?: boolean;
  generatingReelId?: string | null;
  /** Колбек генерации СЦЕНАРИЯ рилса (потом из готового сценария рендерится видео). */
  onGenerateReelScenario?: (idea: ContentReelIdea, customPrompt?: string) => void;
  companyName?: string;
  companyNiche?: string;
  myCompany?: import("@/lib/types").AnalysisResult | null;
  taResult?: import("@/lib/ta-types").TAResult | null;
  smmAnalysis?: import("@/lib/smm-types").SMMResult | null;
}) {
  // Главный sub-tab: «Аватары» (создать/выбрать) или «Видео» (генератор сценариев + список).
  // Если у юзера ещё нет ни одного аватара — стартуем сразу на «Аватары».
  const hasAnyAvatar = !!avatarSettings.avatarId || (avatarSettings.customAvatars?.length ?? 0) > 0;
  const [subTab, setSubTab] = useState<"avatars" | "videos">(hasAnyAvatar ? "videos" : "avatars");
  const [statusTab, setStatusTab] = useState<"idea" | "working" | "ready">("idea");
  const [openReelId, setOpenReelId] = useState<string | null>(null);

  const reelStatus = (r: GeneratedReel): "idea" | "working" | "ready" => {
    if (r.videoStatus === "ready" && r.videoUrl) return "ready";
    if (r.videoStatus === "generating") return "working";
    return "idea";
  };
  const statusCounts = {
    idea: reels.filter(r => reelStatus(r) === "idea").length,
    working: reels.filter(r => reelStatus(r) === "working").length,
    ready: reels.filter(r => reelStatus(r) === "ready").length,
  };
  const openReel = openReelId ? reels.find(r => r.id === openReelId) ?? null : null;

  if (reels.length === 0) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>Создать видео</h1>
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
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--foreground)", letterSpacing: -0.5 }}>Создать видео</h1>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", padding: "4px 12px", borderRadius: 20, background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
          {reels.length}
        </span>
      </div>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 18px", display: "flex", alignItems: "center", gap: 6 }}>
        Сначала создайте аватара (можно несколько) — потом снимайте с ним видео без повторной загрузки.
      </p>

      {/* Sub-tab навигация */}
      <div style={{
        display: "flex", gap: 4,
        marginBottom: 18,
        borderBottom: "1px solid var(--border)",
      }}>
        {([
          { id: "avatars" as const, label: "Аватары", count: (avatarSettings.customAvatars?.length ?? 0), color: "#8b5cf6" },
          { id: "videos" as const, label: "Видео", count: reels.length, color: "#ec4899" },
        ]).map(t => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: "11px 18px",
                border: "none", background: "transparent",
                color: active ? t.color : "var(--muted-foreground)",
                fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                borderBottom: `2.5px solid ${active ? t.color : "transparent"}`,
                marginBottom: -1,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}>
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 800,
                padding: "1px 7px", borderRadius: 8,
                background: active ? `${t.color}20` : "color-mix(in oklch, var(--foreground) 8%, transparent)",
                color: active ? t.color : "var(--muted-foreground)",
                minWidth: 18, textAlign: "center",
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* === Sub-tab: Аватары === */}
      {subTab === "avatars" && (
        <>
          <div style={{
            padding: "12px 16px", borderRadius: 11, marginBottom: 16,
            background: "color-mix(in oklch, #8b5cf6 6%, var(--card))",
            border: "1px solid color-mix(in oklch, #8b5cf6 22%, var(--border))",
            fontSize: 13.5, color: "var(--foreground-secondary)", lineHeight: 1.5,
          }}>
            Загрузите фото и образец голоса — это и будет ваш аватар.
            Можно создать несколько (разные люди, разные стили) и выбирать в табе «Видео».
            После загрузки рекомендуется снять тестовый ролик на 5-10 секунд.
          </div>
          <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} defaultOpen />
          {hasAnyAvatar && (
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSubTab("videos")}
                style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: "var(--primary)", color: "#fff",
                  fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 7,
                  fontFamily: "inherit",
                }}
              >
                Снять видео с аватаром →
              </button>
            </div>
          )}
        </>
      )}

      {/* === Sub-tab: Видео === */}
      {subTab === "videos" && (
      <>
      {!hasAnyAvatar && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 16,
          background: "color-mix(in oklch, #8b5cf6 8%, var(--card))",
          border: "1px dashed color-mix(in oklch, #8b5cf6 35%, var(--border))",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13.5, color: "var(--foreground-secondary)" }}>
            Сначала создайте аватара — он будет говорящим лицом для всех ваших видео.
          </span>
          <button
            onClick={() => setSubTab("avatars")}
            style={{
              padding: "7px 14px", borderRadius: 8,
              background: "#8b5cf6", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
              fontFamily: "inherit",
            }}>
            Перейти к аватарам →
          </button>
        </div>
      )}

      {/* Встроенный блок «Создать видео» — генератор сценариев рилса */}
      {plan && onGenerateReelScenario ? (
        <ContentGeneratorBlock
          c={c}
          plan={plan}
          isGeneratingPost={false}
          generatingPostId={null}
          isGeneratingReel={!!isGeneratingReel}
          generatingReelId={generatingReelId ?? null}
          onGeneratePost={() => {}}
          onGenerateReel={onGenerateReelScenario}
          brandBook={brandBook as BrandBook}
          lockedMode="reel"
          myCompany={myCompany}
          taResult={taResult}
          smmAnalysis={smmAnalysis}
        />
      ) : (
        <div style={{
          padding: "14px 18px", borderRadius: 12,
          background: "color-mix(in oklch, var(--primary) 5%, transparent)",
          border: "1px dashed color-mix(in oklch, var(--primary) 30%, transparent)",
          marginBottom: 16, fontSize: 13.5, color: "var(--foreground-secondary)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <span>Чтобы создавать видео, сначала сгенерируйте план контента.</span>
          <a href="/?nav=content-plan" style={{
            padding: "7px 14px", borderRadius: 8,
            background: "var(--primary)", color: "#fff",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>План контента →</a>
        </div>
      )}

      {/* Статус-табы */}
      <div style={{
        display: "flex", gap: 4,
        marginBottom: 14, marginTop: 6,
        borderBottom: "1px solid var(--border)",
      }}>
        {([
          { id: "idea" as const, label: "Идеи", color: "#ec4899" },
          { id: "working" as const, label: "В работе", color: "#8b5cf6" },
          { id: "ready" as const, label: "Готовые", color: "#22c55e" },
        ]).map(t => {
          const active = statusTab === t.id;
          const count = statusCounts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id)}
              style={{
                padding: "10px 16px",
                border: "none", background: "transparent",
                color: active ? t.color : "var(--muted-foreground)",
                fontSize: 13.5, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                borderBottom: `2.5px solid ${active ? t.color : "transparent"}`,
                marginBottom: -1,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}>
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 800,
                padding: "1px 7px", borderRadius: 8,
                background: active ? `${t.color}20` : "color-mix(in oklch, var(--foreground) 8%, transparent)",
                color: active ? t.color : "var(--muted-foreground)",
                minWidth: 18, textAlign: "center",
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {(() => {
        const filtered = reels.filter(r => reelStatus(r) === statusTab);
        if (filtered.length === 0) {
          const empty: Record<typeof statusTab, string> = {
            idea: "Нет идей без видео. Сгенерируйте новый сценарий из плана контента.",
            working: "Ничего не генерируется прямо сейчас.",
            ready: "Готовых видео пока нет — нажмите «Сгенерировать видео» на любом сценарии.",
          };
          return (
            <div style={{
              padding: "32px 20px", borderRadius: 12,
              background: "var(--card)", border: "1px dashed var(--border)",
              textAlign: "center", color: "var(--muted-foreground)", fontSize: 14,
            }}>
              {empty[statusTab]}
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(reel => (
              <ReelCard
                key={reel.id}
                c={c}
                reel={reel}
                onUpdate={onUpdateReel}
                onDelete={onDeleteReel}
                onGenerateVideo={onGenerateVideo}
                generatingVideoFor={generatingVideoFor}
                brandBook={brandBook}
                onRowClick={() => setOpenReelId(reel.id)}
                companyName={companyName}
                companyNiche={companyNiche}
                avatarSettings={avatarSettings}
              />
            ))}
          </div>
        );
      })()}

      {/* Полноэкранная модалка с раскрытой ReelCard */}
      {openReel && (
        <ReelDetailModal
          c={c}
          reel={openReel}
          brandBook={brandBook}
          onClose={() => setOpenReelId(null)}
          onUpdate={onUpdateReel}
          onDelete={onDeleteReel}
          onGenerateVideo={onGenerateVideo}
          generatingVideoFor={generatingVideoFor}
          companyName={companyName}
          companyNiche={companyNiche}
          avatarSettings={avatarSettings}
        />
      )}
      </>
      )}
    </div>
  );
}

// ─── Reel detail modal ─────────────────────────────────────────────────────
function ReelDetailModal({
  c, reel, brandBook, onClose, onUpdate, onDelete, onGenerateVideo, generatingVideoFor,
  companyName, companyNiche, avatarSettings,
}: {
  c: Colors;
  reel: GeneratedReel;
  brandBook?: BrandBook;
  onClose: () => void;
  onUpdate: (updated: GeneratedReel) => void;
  onDelete: (id: string) => void;
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  companyName?: string;
  companyNiche?: string;
  avatarSettings?: AvatarSettings;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const downloadVideo = () => {
    if (!reel.videoUrl) return;
    const a = document.createElement("a");
    a.href = reel.videoUrl;
    const safe = (reel.title || "reel").replace(/[^a-zа-я0-9-_ ]/gi, "").slice(0, 40).trim() || "reel";
    a.download = `${safe}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--background)",
          borderRadius: 18,
          maxWidth: 920, width: "100%",
          maxHeight: "calc(100vh - 48px)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          background: "var(--card)", flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reel.title || "Видео"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {reel.videoUrl && reel.videoStatus === "ready" && (
              <button
                onClick={downloadVideo}
                title="Скачать видео (MP4)"
                style={{
                  padding: "8px 14px", borderRadius: 9,
                  border: "1.5px solid var(--primary)",
                  background: "color-mix(in oklch, var(--primary) 10%, transparent)",
                  color: "var(--primary)", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                <Save size={14}/> Скачать видео
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("Удалить видео-сценарий безвозвратно?")) {
                  onDelete(reel.id);
                  onClose();
                }
              }}
              title="Удалить"
              style={{
                padding: 8, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Trash2 size={15}/>
            </button>
            <button
              onClick={onClose}
              title="Закрыть (Esc)"
              style={{
                padding: 8, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={15}/>
            </button>
          </div>
        </div>
        <div style={{ overflow: "auto", padding: 18, flex: 1 }}>
          <ReelCard
            c={c}
            reel={reel}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onGenerateVideo={onGenerateVideo}
            generatingVideoFor={generatingVideoFor}
            brandBook={brandBook}
            alwaysExpanded
            companyName={companyName}
            companyNiche={companyNiche}
            avatarSettings={avatarSettings}
          />
        </div>
      </div>
    </div>
  );
}
