"use client";

import React, { useState, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { AvatarSettings, CustomAvatar, CustomVoice } from "@/lib/content-types";
import { Sparkles, Smartphone, Monitor, Loader2, RefreshCw, ClipboardList, Upload, Mic, ImagePlus, Trash2 } from "lucide-react";

export function AvatarSettingsPanel({ c, settings, onChange }: {
  c: Colors;
  settings: AvatarSettings;
  onChange: (next: AvatarSettings) => void;
}) {
  const [open, setOpen] = useState(!settings.avatarId && !settings.voiceId);
  const [loading, setLoading] = useState(false);
  const [avatars, setAvatars] = useState<Array<{ id: string; name: string; gender: string; previewImage: string }>>([]);
  const [voices, setVoices] = useState<Array<{ id: string; name: string; language: string; gender: string; previewAudio: string }>>([]);
  const [showLists, setShowLists] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState("ru");
  const [error, setError] = useState<string | null>(null);

  // Custom avatar / voice upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAvatarName, setPendingAvatarName] = useState("");
  const [pendingVoiceName, setPendingVoiceName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const customAvatars = settings.customAvatars ?? [];
  const customVoices = settings.customVoices ?? [];

  const update = (patch: Partial<AvatarSettings>) => onChange({ ...settings, ...patch });

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });

  const handleUploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    setUploadError(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ");
      if (!file.type.startsWith("image/")) throw new Error("Нужно изображение JPG / PNG");
      const dataUrl = await readFileAsDataUrl(file);
      const name = pendingAvatarName.trim() || file.name.replace(/\.[^.]+$/, "") || "Мой аватар";
      const res = await fetch("/api/heygen-upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, mimeType: file.type, name }),
      });
      const json = await res.json() as { ok: boolean; data?: { heygenAvatarId: string; previewUrl: string; name: string }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка загрузки");

      const newAvatar: CustomAvatar = {
        id: `custom-av-${Date.now()}`,
        name: json.data!.name,
        heygenAvatarId: json.data!.heygenAvatarId,
        status: "ready",
        previewUrl: json.data!.previewUrl || dataUrl,
        createdAt: new Date().toISOString(),
      };
      const nextAvatars = [newAvatar, ...customAvatars];
      update({
        customAvatars: nextAvatars,
        avatarId: newAvatar.heygenAvatarId!,
        avatarType: "talking_photo",
      });
      setPendingAvatarName("");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleUploadVoice = async (file: File) => {
    setUploadingVoice(true);
    setUploadError(null);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Файл больше 15 МБ");
      if (!file.type.startsWith("audio/")) throw new Error("Нужен аудио-файл MP3 / WAV / M4A");
      const dataUrl = await readFileAsDataUrl(file);
      const name = pendingVoiceName.trim() || file.name.replace(/\.[^.]+$/, "") || "Мой голос";
      // Клонируем через ElevenLabs (HeyGen voice-clone API отдаёт 404 HTML).
      // Полученный elevenlabsVoiceId далее используется в /api/generate-reel-video:
      // там ElevenLabs синтезирует MP3 → MP3 заливается в HeyGen как asset →
      // HeyGen генерит видео с lip-sync на этом аудио.
      const res = await fetch("/api/elevenlabs-clone-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, mimeType: file.type, name }),
      });
      const json = await res.json() as { ok: boolean; data?: { elevenlabsVoiceId: string; name: string }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка клонирования");

      const newVoice: CustomVoice = {
        id: `custom-v-${Date.now()}`,
        name: json.data!.name,
        provider: "elevenlabs",
        elevenlabsVoiceId: json.data!.elevenlabsVoiceId,
        status: "ready",
        previewAudioUrl: dataUrl,
        createdAt: new Date().toISOString(),
      };
      const nextVoices = [newVoice, ...customVoices];
      update({
        customVoices: nextVoices,
        voiceProvider: "elevenlabs",
        elevenlabsVoiceId: newVoice.elevenlabsVoiceId!,
      });
      setPendingVoiceName("");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUploadingVoice(false);
      if (voiceInputRef.current) voiceInputRef.current.value = "";
    }
  };

  const selectCustomAvatar = (av: CustomAvatar) => {
    if (!av.heygenAvatarId) return;
    update({ avatarId: av.heygenAvatarId, avatarType: "talking_photo" });
  };

  const selectCustomVoice = (v: CustomVoice) => {
    // ElevenLabs-голос: сохраняем elevenlabsVoiceId + provider, voiceId не трогаем
    // (он остаётся HeyGen-овым для обратной совместимости, но игнорируется на сервере
    // когда voiceProvider = elevenlabs).
    if (v.provider === "elevenlabs" && v.elevenlabsVoiceId) {
      update({ voiceProvider: "elevenlabs", elevenlabsVoiceId: v.elevenlabsVoiceId });
      return;
    }
    if (v.heygenVoiceId) {
      update({ voiceProvider: "heygen", voiceId: v.heygenVoiceId, elevenlabsVoiceId: undefined });
    }
  };

  const deleteCustomAvatar = (id: string) => {
    const next = customAvatars.filter(a => a.id !== id);
    update({ customAvatars: next });
  };

  const deleteCustomVoice = (id: string) => {
    const next = customVoices.filter(v => v.id !== id);
    update({ customVoices: next });
  };

  const loadLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/heygen-list");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      setAvatars(json.data.avatars);
      setVoices(json.data.voices);
      setShowLists(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const filteredVoices = voiceFilter
    ? voices.filter(v => v.language?.toLowerCase().includes(voiceFilter.toLowerCase()) || v.name?.toLowerCase().includes(voiceFilter.toLowerCase()))
    : voices;

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, boxShadow: "var(--shadow)", marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid var(--muted)` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display:"inline-flex", alignItems:"center", gap:6 }}><Sparkles size={14}/>Настройки аватара и голоса HeyGen</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
            {settings.avatarId || settings.voiceId || settings.elevenlabsVoiceId
              ? `Avatar: ${settings.avatarId || "—"} · Voice: ${
                  settings.voiceProvider === "elevenlabs" && settings.elevenlabsVoiceId
                    ? `${settings.elevenlabsVoiceId} (ElevenLabs)`
                    : settings.voiceId || "—"
                }`
              : "Не настроено — будут использованы значения по умолчанию"}
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          {/* ────── Свои аватары / голоса ────── */}
          <div style={{
            background: "color-mix(in oklch, var(--primary) 5%, transparent)",
            border: `1px dashed color-mix(in oklch, var(--primary) 30%, transparent)`,
            borderRadius: 10, padding: "14px 16px", marginBottom: 18,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Upload size={13} /> Свой аватар и голос
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
              Загрузите своё фото — получите персонального аватара (HeyGen talking-photo). Загрузите семпл голоса (20–60 сек чистой речи) — получите клон через <b>ElevenLabs</b>, который автоматически подставляется в видео HeyGen как audio-asset.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {/* Photo upload */}
              <div style={{ background: "var(--card)", borderRadius: 8, padding: 12, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <ImagePlus size={12} /> Фото для аватара
                </div>
                <input
                  type="text"
                  value={pendingAvatarName}
                  onChange={e => setPendingAvatarName(e.target.value)}
                  placeholder="Название (например: «Основатель»)"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, outline: "none", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); }}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1.5px solid var(--primary)`, background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", fontSize: 11, fontWeight: 700, cursor: uploadingPhoto ? "not-allowed" : "pointer" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {uploadingPhoto ? <><Loader2 size={12} className="mr-spin" /> Загружаем…</> : <><Upload size={12} /> Загрузить фото (JPG/PNG, до 10 МБ)</>}
                  </span>
                </button>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.4 }}>
                  Лучше всего: светлый нейтральный фон, лицо в кадре, смотрите в камеру, высокое качество.
                </div>
              </div>

              {/* Voice upload */}
              <div style={{ background: "var(--card)", borderRadius: 8, padding: 12, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Mic size={12} /> Семпл голоса
                </div>
                <input
                  type="text"
                  value={pendingVoiceName}
                  onChange={e => setPendingVoiceName(e.target.value)}
                  placeholder="Название (например: «Мой голос»)"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, outline: "none", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <input
                  ref={voiceInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/mp4"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadVoice(f); }}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => voiceInputRef.current?.click()}
                  disabled={uploadingVoice}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1.5px solid var(--primary)`, background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", fontSize: 11, fontWeight: 700, cursor: uploadingVoice ? "not-allowed" : "pointer" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {uploadingVoice ? <><Loader2 size={12} className="mr-spin" /> Клонируем голос…</> : <><Upload size={12} /> Загрузить семпл (MP3/WAV, 20–180 сек)</>}
                  </span>
                </button>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.4 }}>
                  Лучше всего: тихая комната, 30–60 сек чистой речи, без музыки на фоне, нормальная громкость.
                </div>
              </div>
            </div>

            {uploadError && (
              <div style={{ marginTop: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", color: "var(--destructive)", padding: "8px 12px", borderRadius: 7, fontSize: 11 }}>
                ❌ {uploadError}
              </div>
            )}

            {/* My avatars */}
            {customAvatars.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>МОИ АВАТАРЫ ({customAvatars.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {customAvatars.map(a => {
                    const selected = settings.avatarId === a.heygenAvatarId && settings.avatarType === "talking_photo";
                    return (
                      <div key={a.id}
                        onClick={() => selectCustomAvatar(a)}
                        style={{ cursor: "pointer", border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`, borderRadius: 8, padding: 6, background: selected ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "var(--card)", position: "relative" }}>
                        {a.previewUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={a.previewUrl} alt={a.name} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 5, marginBottom: 4 }} />
                        )}
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                        <button
                          onClick={e => { e.stopPropagation(); deleteCustomAvatar(a.id); }}
                          title="Удалить"
                          style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 4, color: "#fff", padding: "2px 4px", cursor: "pointer", display: "inline-flex" }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* My voices */}
            {customVoices.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>МОИ ГОЛОСА ({customVoices.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {customVoices.map(v => {
                    const selected =
                      v.provider === "elevenlabs"
                        ? settings.voiceProvider === "elevenlabs" &&
                          settings.elevenlabsVoiceId === v.elevenlabsVoiceId
                        : settings.voiceId === v.heygenVoiceId &&
                          settings.voiceProvider !== "elevenlabs";
                    return (
                      <div key={v.id}
                        onClick={() => selectCustomVoice(v)}
                        style={{ cursor: "pointer", border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`, borderRadius: 7, padding: "8px 10px", background: selected ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "var(--card)", position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3, background: v.provider === "elevenlabs" ? "color-mix(in oklch, var(--primary) 14%, transparent)" : "color-mix(in oklch, var(--foreground) 8%, transparent)", color: v.provider === "elevenlabs" ? "var(--primary)" : "var(--muted-foreground)", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                              {v.provider === "elevenlabs" ? "11LABS" : "HEYGEN"}
                            </span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteCustomVoice(v.id); }}
                            title="Удалить"
                            style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", padding: 2, cursor: "pointer", display: "inline-flex" }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {v.previewAudioUrl && (
                          <audio src={v.previewAudioUrl} controls style={{ width: "100%", height: 24, marginTop: 4 }} onClick={e => e.stopPropagation()} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" }}>HEYGEN AVATAR ID</label>
              <input
                type="text"
                value={settings.avatarId}
                onChange={e => update({ avatarId: e.target.value, avatarType: "preset" })}
                placeholder="например: Daisy-inskirt-20220818"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" }}>HEYGEN VOICE ID</label>
              <input
                type="text"
                value={settings.voiceId}
                onChange={e => update({ voiceId: e.target.value })}
                placeholder="ID голоса из HeyGen"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" }}>КАК ВЫГЛЯДИТ АВАТАР</label>
              <textarea
                value={settings.avatarDescription}
                onChange={e => update({ avatarDescription: e.target.value })}
                placeholder="Например: молодой эксперт мужчина 30-35 лет, деловой стиль, дружелюбное лицо, профессиональный фон"
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>Используется в подсказке для генерации сценария — чтобы стиль сценария совпадал с внешним видом ведущего</div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" }}>КАКИМ ДОЛЖЕН БЫТЬ ГОЛОС</label>
              <textarea
                value={settings.voiceDescription}
                onChange={e => update({ voiceDescription: e.target.value })}
                placeholder="Например: уверенный мужской баритон, средний темп, дружелюбный, с лёгкой улыбкой в голосе, без формальностей"
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>Скрипт для озвучки будет адаптирован под этот тон и манеру речи</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>ФОРМАТ:</label>
            <button
              onClick={() => update({ aspect: "portrait" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "portrait" ? "var(--primary)" : "var(--border)"}`, background: settings.aspect === "portrait" ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: settings.aspect === "portrait" ? "var(--primary)" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Smartphone size={12}/>Вертикально (720×1280)</span>
            </button>
            <button
              onClick={() => update({ aspect: "landscape" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "landscape" ? "var(--primary)" : "var(--border)"}`, background: settings.aspect === "landscape" ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: settings.aspect === "landscape" ? "var(--primary)" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Monitor size={12}/>Горизонтально (1280×720)</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={loadLists}
              disabled={loading}
              style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Loader2 size={12} className="mr-spin"/>Загружаем…</span> : showLists ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}><RefreshCw size={12}/>Обновить списки</span> : <span style={{display:"inline-flex",alignItems:"center",gap:6}}><ClipboardList size={12}/>Загрузить доступные аватары и голоса с HeyGen</span>}
            </button>
          </div>

          {error && (
            <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", color: "var(--destructive)", padding: "8px 12px", borderRadius: 8, fontSize: 11, marginTop: 12 }}>{error}</div>
          )}

          {showLists && avatars.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>АВАТАРЫ ({avatars.length}) — кликни, чтобы выбрать</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, maxHeight: 320, overflowY: "auto", padding: 4 }}>
                {avatars.map(a => (
                  <div
                    key={a.id}
                    onClick={() => update({ avatarId: a.id, avatarType: "preset" })}
                    style={{ cursor: "pointer", border: `2px solid ${settings.avatarId === a.id ? "var(--primary)" : "var(--border)"}`, borderRadius: 8, padding: 6, background: settings.avatarId === a.id ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "transparent" }}>
                    {a.previewImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.previewImage} alt={a.name} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 5, marginBottom: 4 }} />
                    )}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.id}</div>
                    {a.gender && <div style={{ fontSize: 9, color: "var(--muted-foreground)" }}>{a.gender}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLists && voices.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>ГОЛОСА ({filteredVoices.length} из {voices.length})</div>
                <input
                  type="text"
                  value={voiceFilter}
                  onChange={e => setVoiceFilter(e.target.value)}
                  placeholder="фильтр (ru, en, female...)"
                  style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, outline: "none", width: 180 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto", padding: 4 }}>
                {filteredVoices.slice(0, 100).map(v => (
                  <div
                    key={v.id}
                    onClick={() => update({ voiceId: v.id })}
                    style={{ cursor: "pointer", border: `1.5px solid ${settings.voiceId === v.id ? "var(--primary)" : "var(--border)"}`, borderRadius: 7, padding: "8px 10px", background: settings.voiceId === v.id ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "transparent" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name || v.id}</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{v.language} · {v.gender}</div>
                    {v.previewAudio && (
                      <audio src={v.previewAudio} controls style={{ width: "100%", height: 24, marginTop: 4 }} onClick={e => e.stopPropagation()} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

