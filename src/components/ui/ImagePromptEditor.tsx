"use client";

/**
 * ImagePromptEditor — inline-панель «отредактируй промпт перед генерацией».
 *
 * Поведение:
 * 1. На монтировании вызывает `/api/image-prompt-suggest` — Claude Haiku пишет
 *    стартовый промпт по контексту (postText/hook/format/brand).
 * 2. Промпт попадает в textarea. Пользователь может его редактировать или
 *    нажать «Перегенерировать промпт» — Claude напишет новый вариант.
 * 3. При нажатии «Сгенерировать» — вызывается `onGenerate(prompt)` с актуальным
 *    содержимым textarea. Дальше caller рисует через
 *    `/api/generate-image-anthropic` с `userPrompt` (тот эндпоинт пропустит
 *    шаг Claude и сразу отдаст промпт в DALL-E).
 *
 * Используется в PostCard / CarouselCard / StoryCard как inline-блок
 * под кнопками действий — без модалок.
 */

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Wand2, X, Image as ImageIcon } from "lucide-react";

interface SuggestParams {
  postText?: string;
  hook?: string;
  format?: string;       // "пост" | "карусель" | "рилс" | "сторис"
  platform?: string;
  brandColors?: string[];
  brandStyle?: string;
}

export interface ImagePromptEditorProps {
  params: SuggestParams;
  /** Подпись на кнопке «Сгенерировать». По умолчанию «Сгенерировать фото». */
  generateLabel?: string;
  /** Заголовок панели. По умолчанию «Промпт для AI-генератора». */
  title?: string;
  /** Вызывается при сабмите. Должен вернуть Promise — пока он не разрешится,
   *  кнопка показывает спиннер. Если бросит — мы покажем ошибку и оставим панель. */
  onGenerate: (prompt: string) => Promise<void>;
  onCancel: () => void;
}

export function ImagePromptEditor({ params, generateLabel = "Сгенерировать фото", title = "Промпт для AI-генератора", onGenerate, onCancel }: ImagePromptEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [suggesting, setSuggesting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Стабилизируем зависимости — params может быть новым объектом каждый рендер
  // у родителя, нам важны только значения. Сериализуем в строку для useEffect.
  const paramsKey = JSON.stringify({
    postText: params.postText ?? "",
    hook: params.hook ?? "",
    format: params.format ?? "",
    platform: params.platform ?? "",
    brandColors: params.brandColors ?? [],
    brandStyle: params.brandStyle ?? "",
  });

  const fetchSuggestion = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const r = await fetch("/api/image-prompt-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: paramsKey,
      });
      // Если сервер вернул HTML (proxy 502, nginx fallback, и т.п.) —
      // r.json() кинет SyntaxError. Сначала читаем text(), пытаемся распарсить.
      const raw = await r.text();
      let j: { ok: boolean; prompt?: string; error?: string };
      try {
        j = JSON.parse(raw);
      } catch {
        // HTML или мусор от прокси — показываем понятное сообщение
        if (r.status === 502 || r.status === 504) {
          throw new Error("Сервис AI временно недоступен — повторите через 30 секунд.");
        }
        throw new Error(
          "Сервер вернул HTML вместо JSON. Скорее всего временный сбой Cloudflare-прокси — повторите запрос.",
        );
      }
      if (!j.ok) throw new Error(j.error ?? "Не удалось подобрать промпт");
      setPrompt(j.prompt ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSuggesting(false);
    }
  };

  useEffect(() => {
    fetchSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const handleSubmit = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await onGenerate(prompt.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  const disabled = suggesting || generating;

  return (
    <div style={{
      marginTop: 14,
      padding: 18,
      borderRadius: 14,
      background: "color-mix(in oklch, var(--primary) 6%, var(--card))",
      border: "1.5px solid color-mix(in oklch, var(--primary) 30%, var(--border))",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>
          <Wand2 size={16} /> {title}
        </div>
        <button
          onClick={onCancel}
          disabled={generating}
          title="Отмена"
          style={{ background: "transparent", border: "none", cursor: generating ? "not-allowed" : "pointer", color: "var(--muted-foreground)", padding: 4, borderRadius: 6 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
        Готовый промпт — ниже. <strong>Можно использовать как есть, отредактировать
        или попросить новый вариант.</strong> На английском генератор работает точнее.
      </div>

      {/* Textarea */}
      <div style={{ position: "relative" }}>
        {suggesting && !prompt && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "color-mix(in oklch, var(--card) 70%, transparent)",
            borderRadius: 10, zIndex: 1, pointerEvents: "none",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Пишу промпт…
            </span>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={5}
          placeholder="A cinematic wide-angle shot of…"
          disabled={generating}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "var(--background)",
            color: "var(--foreground)",
            fontSize: 14,
            lineHeight: 1.55,
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
            minHeight: 110,
          }}
        />
      </div>

      {error && (
        <div style={{
          fontSize: 13,
          color: "var(--destructive)",
          padding: "10px 14px",
          background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
          borderRadius: 10,
          lineHeight: 1.45,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div>{error}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={fetchSuggestion}
              disabled={suggesting}
              style={{
                padding: "6px 12px", borderRadius: 7, border: "1px solid var(--destructive)",
                background: "transparent", color: "var(--destructive)",
                fontSize: 12, fontWeight: 700,
                cursor: suggesting ? "wait" : "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {suggesting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={11} />}
              Повторить
            </button>
            <span style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>
              или впишите промпт сами в поле выше — кнопка «{generateLabel}» сработает на нём.
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleSubmit}
          disabled={disabled || !prompt.trim()}
          style={{
            padding: "11px 20px",
            borderRadius: 10,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: (disabled || !prompt.trim()) ? "not-allowed" : "pointer",
            opacity: (disabled || !prompt.trim()) ? 0.55 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            boxShadow: "0 4px 12px color-mix(in oklch, var(--primary) 30%, transparent)",
          }}
        >
          {generating
            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Рисую картинку…</>
            : <><ImageIcon size={15}/> {generateLabel}</>}
        </button>

        <button
          onClick={fetchSuggestion}
          disabled={disabled}
          title="Сгенерировать другой вариант промпта"
          style={{
            padding: "11px 16px",
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "transparent",
            color: "var(--foreground-secondary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <RefreshCw size={14} style={suggesting ? { animation: "spin 1s linear infinite" } : {}}/>
          Перегенерировать промпт
        </button>

        <button
          onClick={onCancel}
          disabled={generating}
          style={{
            padding: "11px 16px",
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "transparent",
            color: "var(--muted-foreground)",
            fontSize: 14,
            fontWeight: 600,
            cursor: generating ? "not-allowed" : "pointer",
            minHeight: 44,
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
