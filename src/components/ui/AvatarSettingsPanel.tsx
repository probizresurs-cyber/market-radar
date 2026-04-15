"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AvatarSettings } from "@/lib/content-types";

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

  const update = (patch: Partial<AvatarSettings>) => onChange({ ...settings, ...patch });

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
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>🎭 Настройки аватара и голоса HeyGen</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
            {settings.avatarId || settings.voiceId
              ? `Avatar: ${settings.avatarId || "—"} · Voice: ${settings.voiceId || "—"}`
              : "Не настроено — будут использованы значения по умолчанию"}
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" }}>HEYGEN AVATAR ID</label>
              <input
                type="text"
                value={settings.avatarId}
                onChange={e => update({ avatarId: e.target.value })}
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
              📱 Вертикально (720×1280)
            </button>
            <button
              onClick={() => update({ aspect: "landscape" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "landscape" ? "var(--primary)" : "var(--border)"}`, background: settings.aspect === "landscape" ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: settings.aspect === "landscape" ? "var(--primary)" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🖥 Горизонтально (1280×720)
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={loadLists}
              disabled={loading}
              style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "⏳ Загружаем…" : showLists ? "🔄 Обновить списки" : "📋 Загрузить доступные аватары и голоса с HeyGen"}
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
                    onClick={() => update({ avatarId: a.id })}
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

