"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AvatarSettings, CustomAvatar, CustomVoice } from "@/lib/content-types";
import { Sparkles, Smartphone, Monitor, Loader2, RefreshCw, ClipboardList, Upload, Mic, ImagePlus, Trash2 } from "lucide-react";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

export function AvatarSettingsPanel({ c, settings, onChange, defaultOpen }: {
  c: Colors;
  settings: AvatarSettings;
  onChange: (next: AvatarSettings) => void;
  /** Когда true — панель открыта по умолчанию (например, в табе «Аватары»). */
  defaultOpen?: boolean;
}) {
  // Открыто если:
  //   - принудительно через defaultOpen (используется в табе «Аватары»);
  //   - НЕТ ни одного кастомного аватара (юзер только начинает).
  const initialOpen =
    defaultOpen ??
    ((settings.customAvatars?.length ?? 0) === 0);
  const [open, setOpen] = useState(initialOpen);
  // Когда defaultOpen приходит true (юзер пришёл на таб «Аватары»),
  // принудительно раскрываем панель даже если она была закрыта раньше.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const [loading, setLoading] = useState(false);
  const [avatars, setAvatars] = useState<Array<{ id: string; name: string; gender: string; previewImage: string }>>([]);
  const [voices, setVoices] = useState<Array<{ id: string; name: string; language: string; gender: string; previewAudio: string }>>([]);
  const [showLists, setShowLists] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState("ru");
  const [error, setError] = useState<string | null>(null);

  // Пресеты ElevenLabs — голос НАШЕГО видео-движка (broll-режим). Раньше
  // единственным видимым каталогом голосов в этой панели был список HeyGen,
  // из-за чего юзер выбирал голос, который на наш рендер не влияет вовсе —
  // тот слушает elevenlabsVoiceId, а не HeyGen voiceId.
  const [voicePresets, setVoicePresets] = useState<Record<string, { voiceId: string; label: string; previewUrl: string | null }> | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);
  useEffect(() => {
    if (!open || voicePresets || loadingPresets) return;
    setLoadingPresets(true);
    fetch("/api/elevenlabs-voice-previews")
      .then(jsonOrThrow)
      .then((json: { ok: boolean; data?: Record<string, { voiceId: string; label: string; previewUrl: string | null }> }) => {
        if (json.ok && json.data) setVoicePresets(json.data);
      })
      .catch(() => { /* превью — необязательная опция, тихо пропускаем */ })
      .finally(() => setLoadingPresets(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Custom avatar / voice upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [pendingAvatarName, setPendingAvatarName] = useState("");
  const [pendingVoiceName, setPendingVoiceName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  // Digital Twin (video avatar), флоу HeyGen v3:
  //   1. training-видео ≥2 мин → asset → POST /v3/avatars (только оно!)
  //   2. согласие — ОТДЕЛЬНЫЙ шаг: POST /v3/avatars/{group}/consent даёт
  //      ссылку на хостед-страницу HeyGen, где человек записывает согласие
  //      с вебкамеры (анти-дипфейк). Готовый ролик-согласие принимают
  //      только enterprise-аккаунты — для остальных это лишь опция с
  //      автооткатом на ссылку.
  const trainingInputRef = useRef<HTMLInputElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);
  type UploadedAsset = { assetId: string; assetUrl?: string; fileName: string; file: File };
  const [trainingAsset, setTrainingAsset] = useState<UploadedAsset | null>(null);
  const [consentAsset, setConsentAsset] = useState<UploadedAsset | null>(null);
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const [uploadingConsent, setUploadingConsent] = useState(false);
  const [creatingTwin, setCreatingTwin] = useState(false);
  const [pendingVideoName, setPendingVideoName] = useState("");
  // Согласие (consent) для digital twin: ссылка на хостед-страницу HeyGen,
  // где человек записывает согласие с вебкамеры. url пуст, если согласие
  // ушло заранее записанным роликом (Level 2, enterprise).
  const [consentInfo, setConsentInfo] = useState<{ groupId: string; url?: string; note?: string } | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [checkingStatusFor, setCheckingStatusFor] = useState<string | null>(null);

  const customAvatars = settings.customAvatars ?? [];
  const customVoices = settings.customVoices ?? [];

  const update = (patch: Partial<AvatarSettings>) => onChange({ ...settings, ...patch });

  const handleUploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    setUploadError(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ");
      if (!file.type.startsWith("image/")) throw new Error("Нужно изображение JPG / PNG");
      const name = pendingAvatarName.trim() || file.name.replace(/\.[^.]+$/, "") || "Мой аватар";
      // FormData вместо JSON+base64 — обходит ~10 МБ лимит JSON-парсера Next.js.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name);
      const res = await fetch("/api/heygen-upload-photo", { method: "POST", body: fd });
      // Защита от HTML-ответа (Next.js OOM при больших файлах, Cloudflare 502,
      // nginx 413 Payload Too Large) — иначе JSON.parse падает с
      // криптическим «Unexpected token '<'».
      const rawText = await res.text();
      let json: { ok: boolean; data?: { heygenAvatarId: string; previewUrl: string; name: string }; error?: string };
      try { json = JSON.parse(rawText); }
      catch {
        const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
        const friendly = res.status === 413 ? "Фото больше серверного лимита 150 МБ. Сожмите через любой фоторедактор"
          : res.status >= 500 ? "Сервер вернул HTML-ошибку — возможно, упал из-за размера файла"
          : titleMatch?.[1]?.trim() || `HTTP ${res.status}: ${rawText.slice(0, 100)}`;
        json = { ok: false, error: friendly };
      }
      if (!json.ok) throw new Error(json.error ?? "Ошибка загрузки");

      const newAvatar: CustomAvatar = {
        id: `custom-av-${Date.now()}`,
        name: json.data!.name,
        heygenAvatarId: json.data!.heygenAvatarId,
        status: "ready",
        previewUrl: json.data!.previewUrl || URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
      };
      const nextAvatars = [newAvatar, ...customAvatars];
      update({
        customAvatars: nextAvatars,
        avatarId: newAvatar.heygenAvatarId!,
        avatarType: "talking_photo",
      });
      setPendingAvatarName("");
      setUploadSuccess(`Аватар «${newAvatar.name}» добавлен в библиотеку — можно создавать ещё или сразу снимать видео.`);
      // Авто-скрытие через 6 секунд
      setTimeout(() => setUploadSuccess(null), 6000);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // Универсальный загрузчик одного видео-asset'а в HeyGen — возвращает
  // assetId. Используется для training И consent video.
  const uploadVideoAsset = async (file: File, kind: "training" | "consent"): Promise<UploadedAsset> => {
    if (file.size > 100 * 1024 * 1024) throw new Error("Файл больше 100 МБ");
    if (!file.type.startsWith("video/")) throw new Error("Нужен видео-файл MP4 / MOV / WebM");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", kind);
    const res = await fetch("/api/heygen-upload-video", { method: "POST", body: fd });
    const rawText = await res.text();
    let json: { ok: boolean; data?: { assetId: string; assetUrl?: string }; error?: string };
    try { json = JSON.parse(rawText); }
    catch {
      const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
      const friendly = res.status === 413 ? "Видео больше серверного лимита 150 МБ"
        : res.status >= 500 ? "Сервер вернул HTML-ошибку — возможно, видео слишком тяжёлое"
        : titleMatch?.[1]?.trim() || `HTTP ${res.status}: ${rawText.slice(0, 100)}`;
      json = { ok: false, error: friendly };
    }
    if (!json.ok || !json.data?.assetId) throw new Error(json.error ?? "Ошибка загрузки");
    return { assetId: json.data.assetId, assetUrl: json.data.assetUrl, fileName: file.name, file };
  };

  const handleUploadTrainingVideo = async (file: File) => {
    setUploadingTraining(true);
    setUploadError(null);
    try {
      const asset = await uploadVideoAsset(file, "training");
      setTrainingAsset(asset);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUploadingTraining(false);
      if (trainingInputRef.current) trainingInputRef.current.value = "";
    }
  };

  const handleUploadConsentVideo = async (file: File) => {
    setUploadingConsent(true);
    setUploadError(null);
    try {
      const asset = await uploadVideoAsset(file, "consent");
      setConsentAsset(asset);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setUploadingConsent(false);
      if (consentInputRef.current) consentInputRef.current.value = "";
    }
  };

  // Запрос согласия для группы аватара. Основной путь — Level 1: HeyGen
  // возвращает ссылку на СВОЮ страницу, где человек записывает согласие с
  // вебкамеры (доступно всем тарифам, ссылка живёт 24 часа). Если юзер
  // загрузил заранее записанный ролик — пробуем Level 2 (enterprise-only),
  // бэк сам откатится на ссылку при отказе HeyGen.
  const requestConsentLink = async (groupId: string, opts?: { assetId?: string; assetUrl?: string }) => {
    setConsentBusy(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/heygen-avatar-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, consentAssetId: opts?.assetId, consentAssetUrl: opts?.assetUrl }),
      });
      const json = await jsonOrThrow(res) as { ok: boolean; data?: { mode: "webcam" | "video"; consentUrl?: string; consentStatus?: string; note?: string }; error?: string };
      if (!json.ok || !json.data) throw new Error(json.error ?? "Не удалось запросить согласие");
      if (json.data.mode === "video") {
        setConsentInfo({ groupId, note: "Ролик-согласие принят, HeyGen проверяет его. Нажмите «Проверить статус» через пару минут." });
      } else {
        setConsentInfo({ groupId, url: json.data.consentUrl, note: json.data.note });
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setConsentBusy(false);
    }
  };

  // «Проверить статус» — тренировка идёт 5-15 минут, согласие пишет живой
  // человек; поллить бесконечно нет смысла, проверяем по кнопке.
  const checkAvatarStatus = async (a: CustomAvatar) => {
    if (!a.heygenGroupId) return;
    setCheckingStatusFor(a.id);
    setUploadError(null);
    try {
      const res = await fetch(`/api/heygen-avatar-consent?groupId=${encodeURIComponent(a.heygenGroupId)}`);
      const json = await jsonOrThrow(res) as { ok: boolean; data?: { consentStatus: string | null; trainStatus: string | null }; error?: string };
      if (!json.ok || !json.data) throw new Error(json.error ?? "Не удалось получить статус");
      const { consentStatus, trainStatus } = json.data;
      const status: CustomAvatar["status"] =
        trainStatus === "completed" ? "ready"
        : trainStatus === "failed" ? "failed"
        : trainStatus === "pending_consent" ? "pending_consent"
        : a.status === "pending_consent" ? "pending_consent"
        : "processing";
      update({ customAvatars: customAvatars.map(av => av.id === a.id ? { ...av, status } : av) });
      setUploadSuccess(
        status === "ready"
          ? `«${a.name}» готов — можно записывать видео!`
          : `«${a.name}»: тренировка — ${trainStatus ?? "в очереди"}, согласие — ${consentStatus ?? "не записано"}.`,
      );
      setTimeout(() => setUploadSuccess(null), 8000);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCheckingStatusFor(null);
    }
  };

  // Создание Digital Twin по контракту HeyGen v3: в /v3/avatars уходит
  // ТОЛЬКО тренировочное видео. Согласие — отдельный шаг после создания
  // (POST /v3/avatars/{group}/consent), старый вариант «оба видео сразу»
  // HeyGen никогда не поддерживал — из-за этого создание и ломалось.
  const handleCreateDigitalTwin = async () => {
    if (!trainingAsset) return;
    setCreatingTwin(true);
    setUploadError(null);
    setConsentInfo(null);
    try {
      const name = pendingVideoName.trim() || trainingAsset.fileName.replace(/\.[^.]+$/, "") || "Видео-аватар";
      const res = await fetch("/api/heygen-create-digital-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trainingAssetId: trainingAsset.assetId,
          trainingAssetUrl: trainingAsset.assetUrl,
        }),
      });
      const rawText = await res.text();
      let json: { ok: boolean; data?: { heygenAvatarId: string; groupId: string | null; name: string; status: string; previewUrl?: string | null }; error?: string; debug?: string };
      try { json = JSON.parse(rawText); }
      catch {
        json = { ok: false, error: `HTTP ${res.status}: ${rawText.slice(0, 150)}` };
      }
      if (!json.ok) {
        const fullErr = json.debug
          ? `${json.error ?? "Ошибка"} | RAW: ${json.debug.slice(0, 300)}`
          : (json.error ?? "Ошибка создания аватара");
        throw new Error(fullErr);
      }

      const d = json.data!;
      const newAvatar: CustomAvatar = {
        id: `custom-av-${Date.now()}`,
        name: d.name,
        heygenAvatarId: d.heygenAvatarId,
        heygenGroupId: d.groupId ?? undefined,
        // Digital twin без согласия HeyGen в видео не пустит — поэтому
        // дефолтный статус нового аватара «ждёт согласия», а не «готовится».
        status: d.status === "completed" ? "ready" : d.status === "failed" ? "failed" : "pending_consent",
        previewUrl: d.previewUrl || "",
        createdAt: new Date().toISOString(),
      };
      update({
        customAvatars: [newAvatar, ...customAvatars],
        avatarId: newAvatar.heygenAvatarId!,
        avatarType: "preset",
      });
      setTrainingAsset(null);
      setPendingVideoName("");
      setUploadSuccess(`Аватар «${newAvatar.name}» создан. Остался шаг согласия — без него HeyGen не разрешит генерацию видео.`);
      setTimeout(() => setUploadSuccess(null), 10000);

      // Сразу запрашиваем согласие: если юзер загрузил ролик — пробуем его,
      // иначе (и при отказе HeyGen) получаем ссылку на запись с вебкамеры.
      if (d.groupId) {
        await requestConsentLink(d.groupId, consentAsset ? { assetId: consentAsset.assetId, assetUrl: consentAsset.assetUrl } : undefined);
        setConsentAsset(null);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCreatingTwin(false);
    }
  };

  const handleUploadVoice = async (file: File) => {
    setUploadingVoice(true);
    setUploadError(null);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Файл больше 15 МБ");
      if (!file.type.startsWith("audio/")) throw new Error("Нужен аудио-файл MP3 / WAV / M4A");
      const name = pendingVoiceName.trim() || file.name.replace(/\.[^.]+$/, "") || "Мой голос";
      // Клонируем через ElevenLabs (HeyGen voice-clone API отдаёт 404 HTML).
      // Полученный elevenlabsVoiceId далее используется в /api/generate-reel-video.
      // FormData вместо JSON+base64 — обходит ~10 МБ лимит JSON-парсера Next.js.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name);
      const res = await fetch("/api/elevenlabs-clone-voice", { method: "POST", body: fd });
      // Та же защита от HTML-ответа (nginx 413, Next.js 500, прокси 502).
      const rawText = await res.text();
      let json: { ok: boolean; data?: { elevenlabsVoiceId: string; name: string }; error?: string };
      try { json = JSON.parse(rawText); }
      catch {
        const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
        const friendly = res.status === 413 ? "Аудио-сэмпл слишком большой для сервера (попробуйте сжать до 10 МБ)"
          : res.status >= 500 ? "Сервер вернул HTML-ошибку — возможно, файл слишком тяжёлый"
          : titleMatch?.[1]?.trim() || `HTTP ${res.status}: ${rawText.slice(0, 100)}`;
        json = { ok: false, error: friendly };
      }
      if (!json.ok) throw new Error(json.error ?? "Ошибка клонирования");

      const newVoice: CustomVoice = {
        id: `custom-v-${Date.now()}`,
        name: json.data!.name,
        provider: "elevenlabs",
        elevenlabsVoiceId: json.data!.elevenlabsVoiceId,
        status: "ready",
        previewAudioUrl: URL.createObjectURL(file),
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
      const json = await jsonOrThrow(res);
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
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display:"inline-flex", alignItems:"center", gap:6 }}><Sparkles size={14}/>Настройки аватара и голоса</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
            {settings.avatarId || settings.voiceId || settings.elevenlabsVoiceId
              ? `Avatar: ${settings.avatarId || "—"} · Voice: ${
                  settings.voiceProvider === "elevenlabs" && settings.elevenlabsVoiceId
                    ? `${voicePresets ? (Object.values(voicePresets).find(p => p.voiceId === settings.elevenlabsVoiceId)?.label ?? settings.elevenlabsVoiceId) : settings.elevenlabsVoiceId} (ElevenLabs)`
                    : `${settings.voiceId || "—"} (HeyGen, только режим «видео через HeyGen»)`
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
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4, letterSpacing: -0.2 }}>
              <Upload size={15} /> Создать нового аватара
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14, lineHeight: 1.5 }}>
              Введите имя и загрузите фото (быстро) или видео (качественнее, но дольше). Голос озвучки выбирается ниже — свой клон или пресет ElevenLabs.
            </div>

            {/* Единое поле имени аватара */}
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--muted-foreground)", marginBottom: 6,
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                Имя аватара
              </label>
              <input
                type="text"
                value={pendingAvatarName}
                onChange={e => {
                  setPendingAvatarName(e.target.value);
                  // Синхронизируем с pendingVideoName чтобы видео-аватар
                  // тоже использовал это имя если юзер выберет видео.
                  setPendingVideoName(e.target.value);
                }}
                placeholder="Например: «Основатель», «Эксперт», «Я говорящий»"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: `1.5px solid var(--border)`, background: "var(--background)",
                  color: "var(--foreground)", fontSize: 14, outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Два способа загрузки — стороной */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {/* Photo upload */}
              <div style={{ background: "var(--card)", borderRadius: 10, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ImagePlus size={14} /> Фото
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.4 }}>
                  Быстро: talking-photo за минуту. Светлый фон, лицо в кадре.
                </div>
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
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "none",
                    background: uploadingPhoto ? "var(--muted)" : "var(--primary)",
                    color: "#fff",
                    fontSize: 13, fontWeight: 700,
                    cursor: uploadingPhoto ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    fontFamily: "inherit",
                  }}>
                  {uploadingPhoto
                    ? <><Loader2 size={14} className="mr-spin" /> Сохраняем…</>
                    : <><Upload size={14} /> Сохранить как фото-аватара</>}
                </button>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 6 }}>JPG/PNG, до 10 МБ</div>
              </div>

              {/* Video upload — Digital Twin (2 видео: training + consent) */}
              <div style={{ background: "var(--card)", borderRadius: 10, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Upload size={14} /> Видео-аватар (Digital Twin)
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#22c55e", color: "#fff" }}>NEW</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>
                  Качественный footage-аватар с lip-sync. Три шага: загрузите видео → создайте аватара → запишите согласие по ссылке HeyGen.
                </div>
                <div style={{
                  fontSize: 10.5, color: "#22c55e", fontWeight: 700,
                  padding: "6px 10px", marginBottom: 12, borderRadius: 6,
                  background: "color-mix(in oklch, #22c55e 8%, transparent)",
                  border: "1px solid color-mix(in oklch, #22c55e 30%, transparent)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  ⚠ Только MP4. HeyGen не принимает MOV (iPhone). Конвертация: QuickTime → File → Export As → 1080p, или CapCut → Export.
                </div>

                {/* Шаг 1: training video */}
                <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: trainingAsset ? "color-mix(in oklch, #22c55e 8%, var(--background))" : "var(--background)", border: `1px solid ${trainingAsset ? "#22c55e60" : "var(--border)"}` }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
                    1. Тренировочное видео {trainingAsset && <span style={{ color: "#22c55e", marginLeft: 4 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>
                    Минимум 2 минуты, 720p+, чёткое лицо говорящего. Расскажите о себе, продукте, ответьте на 3 вопроса.
                  </div>
                  <input
                    ref={trainingInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadTrainingVideo(f); }}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => trainingInputRef.current?.click()}
                    disabled={uploadingTraining || creatingTwin}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 7,
                      border: "1px solid var(--border)",
                      background: trainingAsset ? "transparent" : "var(--background)",
                      color: trainingAsset ? "#22c55e" : "var(--foreground)",
                      fontSize: 12, fontWeight: 600,
                      cursor: (uploadingTraining || creatingTwin) ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      fontFamily: "inherit",
                    }}>
                    {uploadingTraining
                      ? <><Loader2 size={12} className="mr-spin" /> Загружаем…</>
                      : trainingAsset
                        ? <>📹 {trainingAsset.fileName.slice(0, 30)} — заменить</>
                        : <><Upload size={12} /> Выбрать тренировочное видео</>}
                  </button>
                </div>

                {/* Шаг 2: создание аватара — нужно ТОЛЬКО тренировочное видео.
                    Согласие — следующий шаг, после создания (контракт HeyGen v3). */}
                <button
                  onClick={handleCreateDigitalTwin}
                  disabled={!trainingAsset || creatingTwin}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "none",
                    background: (!trainingAsset || creatingTwin) ? "var(--muted)" : "#22c55e",
                    color: (!trainingAsset || creatingTwin) ? "var(--muted-foreground)" : "#fff",
                    fontSize: 13, fontWeight: 700,
                    cursor: (!trainingAsset || creatingTwin) ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    fontFamily: "inherit",
                  }}>
                  {creatingTwin
                    ? <><Loader2 size={14} className="mr-spin" /> Создаём аватар…</>
                    : <><Sparkles size={14} /> 2. Создать видео-аватар</>}
                </button>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "6px 0 10px" }}>
                  MP4, до 100 МБ · тренировка аватара 5-15 мин после создания
                </div>

                {/* Шаг 3: согласие. Основной путь — ссылка HeyGen: человек в
                    кадре сам записывает согласие с вебкамеры на их странице.
                    Загрузка готового ролика (ниже) работает только на
                    enterprise-тарифах HeyGen — бэк пробует и сам откатывается
                    на ссылку. */}
                <div style={{ padding: "10px 12px", borderRadius: 8, background: consentInfo ? "color-mix(in oklch, var(--primary) 6%, var(--background))" : "var(--background)", border: `1px solid ${consentInfo ? "color-mix(in oklch, var(--primary) 40%, var(--border))" : "var(--border)"}` }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
                    3. Согласие на использование внешности
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>
                    Обязательный шаг HeyGen (защита от дипфейков): человек из видео записывает короткое согласие
                    с вебкамеры на странице HeyGen. Ссылка появится после создания аватара и действует 24 часа.
                  </div>
                  {consentInfo?.note && (
                    <div style={{ fontSize: 10.5, color: "#f59e0b", marginBottom: 8, lineHeight: 1.4 }}>{consentInfo.note}</div>
                  )}
                  {consentInfo?.url ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <a
                        href={consentInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: "1 1 auto", padding: "9px 12px", borderRadius: 7, border: "none",
                          background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700,
                          textAlign: "center", textDecoration: "none",
                        }}>
                        Открыть страницу согласия →
                      </a>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(consentInfo.url!); setUploadSuccess("Ссылка скопирована — отправьте её человеку из видео."); setTimeout(() => setUploadSuccess(null), 5000); }}
                        style={{
                          padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border)",
                          background: "var(--background)", color: "var(--foreground)", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>
                        Скопировать
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input
                        ref={consentInputRef}
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadConsentVideo(f); }}
                        style={{ display: "none" }}
                      />
                      <button
                        onClick={() => consentInputRef.current?.click()}
                        disabled={uploadingConsent || creatingTwin || consentBusy}
                        title="Работает только на enterprise-тарифах HeyGen; в остальных случаях всё равно понадобится запись по ссылке"
                        style={{
                          flex: "1 1 auto", padding: "8px 12px", borderRadius: 7,
                          border: "1px solid var(--border)",
                          background: consentAsset ? "transparent" : "var(--background)",
                          color: consentAsset ? "#22c55e" : "var(--muted-foreground)",
                          fontSize: 11.5, fontWeight: 600,
                          cursor: (uploadingConsent || creatingTwin || consentBusy) ? "not-allowed" : "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                          fontFamily: "inherit",
                        }}>
                        {uploadingConsent
                          ? <><Loader2 size={12} className="mr-spin" /> Загружаем…</>
                          : consentAsset
                            ? <>📹 {consentAsset.fileName.slice(0, 26)} — заменить</>
                            : <><Upload size={12} /> Есть готовый ролик-согласие (enterprise)</>}
                      </button>
                      {consentBusy && <span style={{ alignSelf: "center", fontSize: 11, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4 }}><Loader2 size={11} className="mr-spin" /> Запрашиваем ссылку…</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {uploadError && (
              <div style={{ marginTop: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", color: "var(--destructive)", padding: "8px 12px", borderRadius: 7, fontSize: 11 }}>
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div style={{
                marginTop: 10,
                background: "color-mix(in oklch, #22c55e 12%, transparent)",
                color: "#16a34a",
                padding: "10px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: 1.5,
                border: "1px solid color-mix(in oklch, #22c55e 35%, transparent)",
              }}>
                ✓ {uploadSuccess}
              </div>
            )}

            {/* Библиотека «Мои аватары» переехала в самый низ панели —
                после всех настроек HeyGen avatar/voice ID и формата. */}

            {/* ────── Голос озвучки (ElevenLabs) — реально звучит в роликах ──────
                Это ГЛАВНЫЙ выбор голоса для нашего движка. Список HeyGen-голосов
                ниже (в «HEYGEN VOICE ID» и загружаемом каталоге) относится ТОЛЬКО
                к легаси-режиму «видео с аватаром через HeyGen-агента» — тот
                рендер целиком собирает сам HeyGen, включая озвучку. */}
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--card)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 3, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Mic size={13} /> Голос озвучки (ElevenLabs)
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.4 }}>
                Этот голос реально звучит в готовых роликах — свой клон сверху или один из пресетов ниже.
                Список «Голоса» из каталога HeyGen дальше в панели используется только в режиме «видео целиком через HeyGen».
              </div>
              {loadingPresets && !voicePresets ? (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={12} className="mr-spin" /> Загружаем пресеты…
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {Object.values(voicePresets ?? {}).map(p => {
                    const selected = settings.voiceProvider === "elevenlabs" && settings.elevenlabsVoiceId === p.voiceId;
                    return (
                      <div key={p.voiceId}
                        onClick={() => update({ voiceProvider: "elevenlabs", elevenlabsVoiceId: p.voiceId })}
                        style={{ cursor: "pointer", border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`, borderRadius: 7, padding: "8px 10px", background: selected ? "color-mix(in oklch, var(--primary) 6%, transparent)" : "var(--background)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--foreground)" }}>{p.label}</div>
                        {p.previewUrl && (
                          <audio src={p.previewUrl} controls style={{ width: "100%", height: 26, marginTop: 5 }} onClick={e => e.stopPropagation()} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 10 }}>
                Ничего не выбрано? Арт-директор подберёт голос под тему ролика автоматически (или используется голос бренда, если задан администратором).
              </div>
            </div>

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
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Smartphone size={12}/>Вертикально (1080×1920 Full HD)</span>
            </button>
            <button
              onClick={() => update({ aspect: "landscape" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "landscape" ? "var(--primary)" : "var(--border)"}`, background: settings.aspect === "landscape" ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: settings.aspect === "landscape" ? "var(--primary)" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Monitor size={12}/>Горизонтально (1920×1080 Full HD)</span>
            </button>
          </div>

          {/* ─── Voice quality knobs ───
             Раньше пользователь не мог настраивать эмоцию/темп голоса — HeyGen
             озвучивал плоско. Эти 3 контрола пробрасываются в /api/generate-reel-video
             → voice_settings.{ emotion, speed, pitch } для HeyGen v3.
             Дефолты подобраны под русскую речь: speed=0.95 (чуть медленнее
             для разборчивости), emotion=friendly, pitch=0. */}
          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "color-mix(in oklch, var(--primary) 3%, var(--background))" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
              КАЧЕСТВО ГОЛОСА (HeyGen v3)
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              {/* Emotion */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)" }}>Эмоция:</label>
                <select
                  value={settings.voiceEmotion ?? "friendly"}
                  onChange={e => update({ voiceEmotion: e.target.value as AvatarSettings["voiceEmotion"] })}
                  style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
                >
                  <option value="friendly">😊 Дружелюбная</option>
                  <option value="professional">💼 Профессиональная</option>
                  <option value="happy">🙂 Радостная</option>
                  <option value="excited">🤩 Энергичная</option>
                  <option value="calm">😌 Спокойная</option>
                  <option value="serious">😐 Серьёзная</option>
                </select>
              </div>
              {/* Speed */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)" }}>
                  Темп: <span style={{ color: "var(--primary)", fontWeight: 700 }}>{(settings.voiceSpeed ?? 0.95).toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5" max="1.5" step="0.05"
                  value={settings.voiceSpeed ?? 0.95}
                  onChange={e => update({ voiceSpeed: Number(e.target.value) })}
                  style={{ width: 110 }}
                />
              </div>
              {/* Pitch */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)" }}>
                  Питч: <span style={{ color: "var(--primary)", fontWeight: 700 }}>{(settings.voicePitch ?? 0) > 0 ? "+" : ""}{settings.voicePitch ?? 0}</span>
                </label>
                <input
                  type="range"
                  min="-6" max="6" step="1"
                  value={settings.voicePitch ?? 0}
                  onChange={e => update({ voicePitch: Number(e.target.value) })}
                  style={{ width: 90 }}
                />
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.45 }}>
              Дефолты подобраны под рус. речь: темп 0.95 для разборчивости, дружелюбная эмоция. Меняйте под тон ролика — для серьёзных тем «Профессиональная» или «Серьёзная», для рекламы — «Энергичная».
            </div>
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
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>
                Этот каталог — голоса HeyGen для режима «видео целиком через HeyGen» (кнопка «Сгенерировать видео с аватаром»). Для обычной сборки видео голос выбирается в блоке «Голос озвучки (ElevenLabs)» выше.
              </div>
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

          {/* ─── «Сохранить аватара» — кнопка в самом конце настроек ─── */}
          <div style={{
            marginTop: 24, paddingTop: 18,
            borderTop: "1px solid var(--muted)",
          }}>
            <button
              onClick={() => {
                const name = pendingAvatarName.trim();
                const avId = settings.avatarId?.trim();
                if (!avId) {
                  alert("Сначала выберите аватара (загрузите своё фото/видео ИЛИ выберите из готовых HeyGen-аватаров)");
                  return;
                }
                if (!name) {
                  alert("Введите имя аватара в поле «Имя аватара» вверху");
                  return;
                }
                // Если такой avatarId уже есть в библиотеке — переименовать.
                const existing = customAvatars.find(a => a.heygenAvatarId === avId);
                if (existing) {
                  if (existing.name === name) {
                    setUploadSuccess(`Аватар «${name}» уже в библиотеке.`);
                  } else {
                    const next = customAvatars.map(a => a.heygenAvatarId === avId ? { ...a, name } : a);
                    update({ customAvatars: next });
                    setUploadSuccess(`Аватар переименован в «${name}».`);
                  }
                  setTimeout(() => setUploadSuccess(null), 5000);
                  return;
                }
                // Найти preview из HeyGen-списка если выбран из списка готовых.
                const preset = avatars.find(a => a.id === avId);
                const newAvatar: CustomAvatar = {
                  id: `custom-av-${Date.now()}`,
                  name,
                  heygenAvatarId: avId,
                  status: "ready",
                  previewUrl: preset?.previewImage ?? "",
                  createdAt: new Date().toISOString(),
                };
                update({ customAvatars: [newAvatar, ...customAvatars] });
                setPendingAvatarName("");
                setUploadSuccess(`Аватар «${name}» сохранён в библиотеку.`);
                setTimeout(() => setUploadSuccess(null), 5000);
              }}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 70%, white))",
                color: "#fff", fontSize: 14, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px color-mix(in oklch, var(--primary) 30%, transparent)",
              }}
            >
              Сохранить как моего аватара
            </button>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
              Возьмёт текущий <strong>HEYGEN AVATAR ID</strong> и сохранит его в библиотеку «Мои аватары» под именем из поля «Имя аватара» выше.
            </div>
          </div>
        </div>
      )}

      {/* ─── Отдельный блок «Мои аватары» — ниже панели настроек ─── */}
      {customAvatars.length > 0 && (
        <div style={{
          marginTop: 16,
          background: "var(--card)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          padding: "18px 20px",
        }}>
          <div style={{
            fontSize: 16, fontWeight: 800, color: "var(--foreground)",
            marginBottom: 12, letterSpacing: -0.3,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            Мои аватары
            <span style={{
              background: "color-mix(in oklch, var(--primary) 18%, transparent)",
              color: "var(--primary)",
              padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 800,
            }}>{customAvatars.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {customAvatars.map(a => {
                  const selected = settings.avatarId === a.heygenAvatarId;
                  // pending_consent тоже блокирует выбор: HeyGen не пустит такой
                  // аватар в генерацию видео, пока согласие не записано.
                  const isProcessing = a.status === "processing" || a.status === "pending_consent";
                  return (
                    <div key={a.id}
                      onClick={() => !isProcessing && selectCustomAvatar(a)}
                      style={{
                        cursor: isProcessing ? "default" : "pointer",
                        border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 12, padding: 0, overflow: "hidden",
                        background: selected ? "color-mix(in oklch, var(--primary) 8%, var(--card))" : "var(--card)",
                        position: "relative",
                        boxShadow: selected ? "0 4px 14px color-mix(in oklch, var(--primary) 25%, transparent)" : "none",
                        transition: "all 0.15s",
                        opacity: isProcessing ? 0.7 : 1,
                      }}>
                      <div style={{ position: "relative", aspectRatio: "1/1", background: "var(--background)" }}>
                        {a.previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={a.previewUrl} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                            <Upload size={28} />
                          </div>
                        )}
                        {selected && (
                          <div style={{
                            position: "absolute", top: 8, left: 8,
                            background: "var(--primary)", color: "#fff",
                            fontSize: 10, fontWeight: 800,
                            padding: "3px 8px", borderRadius: 5,
                            letterSpacing: "0.05em",
                          }}>
                            ВЫБРАН
                          </div>
                        )}
                        {isProcessing && (
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(0,0,0,0.5)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 11, fontWeight: 700,
                            flexDirection: "column", gap: 4,
                          }}>
                            <Loader2 size={20} className="mr-spin" />
                            <span>{a.status === "pending_consent" ? "Ждёт согласия" : "Готовится"}</span>
                          </div>
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const newName = prompt("Новое название аватара:", a.name);
                            if (newName && newName.trim() && newName !== a.name) {
                              const next = customAvatars.map(av => av.id === a.id ? { ...av, name: newName.trim() } : av);
                              update({ customAvatars: next });
                            }
                          }}
                          title="Переименовать"
                          style={{
                            position: "absolute", top: 8, right: 36,
                            background: "rgba(0,0,0,0.55)", border: "none",
                            borderRadius: 5, color: "#fff",
                            padding: "4px 6px", cursor: "pointer",
                            display: "inline-flex", alignItems: "center",
                          }}>
                          <ImagePlus size={11} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm(`Удалить «${a.name}»?`)) deleteCustomAvatar(a.id); }}
                          title="Удалить"
                          style={{
                            position: "absolute", top: 8, right: 8,
                            background: "rgba(0,0,0,0.55)", border: "none",
                            borderRadius: 5, color: "#fff",
                            padding: "4px 6px", cursor: "pointer",
                            display: "inline-flex", alignItems: "center",
                          }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                          {a.heygenAvatarId?.slice(0, 16)}…
                        </div>
                        {/* Digital twin в процессе: кнопки дожима — обновить
                            статус тренировки/согласия и перевыпустить ссылку
                            на запись согласия (старая живёт 24 часа). */}
                        {a.heygenGroupId && a.status !== "ready" && (
                          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                            <button
                              onClick={e => { e.stopPropagation(); checkAvatarStatus(a); }}
                              disabled={checkingStatusFor === a.id}
                              style={{
                                flex: 1, padding: "5px 6px", borderRadius: 6, border: "1px solid var(--border)",
                                background: "var(--background)", color: "var(--foreground)", fontSize: 10, fontWeight: 700,
                                cursor: checkingStatusFor === a.id ? "default" : "pointer", fontFamily: "inherit",
                                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
                              }}>
                              {checkingStatusFor === a.id ? <Loader2 size={10} className="mr-spin" /> : <RefreshCw size={10} />} Статус
                            </button>
                            {a.status === "pending_consent" && (
                              <button
                                onClick={e => { e.stopPropagation(); requestConsentLink(a.heygenGroupId!); }}
                                disabled={consentBusy}
                                style={{
                                  flex: 1, padding: "5px 6px", borderRadius: 6, border: "none",
                                  background: "var(--primary)", color: "#fff", fontSize: 10, fontWeight: 700,
                                  cursor: consentBusy ? "default" : "pointer", fontFamily: "inherit",
                                }}>
                                Согласие
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
        </div>
      )}
    </div>
  );
}

