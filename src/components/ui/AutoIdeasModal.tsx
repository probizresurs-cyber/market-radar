"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, X, Check } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { BrandBook } from "@/lib/content-types";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  pillar: string;
  targetSegment: string;
  format: "post" | "story" | "carousel" | "reel";
  summary: string;
}

interface Props {
  format: "post" | "story" | "carousel" | "reel";
  myCompany?: AnalysisResult | null;
  taResult?: TAResult | null;
  smmResult?: SMMResult | null;
  brandBook?: BrandBook | null;
  /** Юзер выбрал идею — родитель должен заполнить форму создания. */
  onSelectIdea: (idea: ContentIdea) => void;
  /** Цвет акцента — зависит от платформы (карусели=розовый, сториз=пурпурный...). */
  accentColor?: string;
}

/**
 * Универсальная модалка автогенерации идей контента.
 * Используется в Posts/Stories/Carousels/Reels — один UX.
 *
 * Поведение:
 *   1. Кнопка «Сгенерировать N идей» открывает модалку с лоадером
 *   2. POST /api/content/auto-ideas-batch с myCompany+taResult+smmResult+brandBook
 *   3. Показывает 5-10 карточек идей с hook + angle + segment
 *   4. Клик «Использовать» → onSelectIdea(idea) → закрывает модалку →
 *      родитель должен autofill свою форму
 */
export function AutoIdeasModal({ format, myCompany, taResult, smmResult, brandBook, onSelectIdea, accentColor = "var(--primary)" }: Props) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const formatLabel = ({
    post: "поста", story: "сториз", carousel: "карусели", reel: "рилса",
  } as const)[format];

  const generate = async () => {
    setLoading(true);
    setErr(null);
    setIdeas(null);
    try {
      const res = await fetch("/api/content/auto-ideas-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, count, myCompany, taResult, smmResult, brandBook }),
      });
      const json = await jsonOrThrow<{ ok: boolean; ideas?: ContentIdea[]; error?: string }>(res);
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");
      setIdeas(json.ideas ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (!ideas && !loading) generate(); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "9px 16px", borderRadius: 10,
          border: `1.5px solid ${accentColor}`,
          background: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
          color: accentColor, fontWeight: 700, fontSize: 13, cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Sparkles size={14} /> AI-идеи для {formatLabel}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", borderRadius: 16,
            maxWidth: 720, width: "100%", maxHeight: "85vh",
            display: "flex", flexDirection: "column",
            border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 22px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={18} style={{ color: accentColor }} /> Идеи контента для {formatLabel}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  На основе анализа вашей компании, ЦА и бренда
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Controls */}
            <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)" }}>Кол-во идей:</label>
              <input
                type="number" min={3} max={10}
                value={count}
                onChange={e => setCount(Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
                style={{
                  width: 60, padding: "6px 10px", borderRadius: 6,
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 13, fontFamily: "inherit", textAlign: "center",
                }}
              />
              <button
                onClick={generate}
                disabled={loading}
                style={{
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: loading ? "var(--muted)" : accentColor,
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: loading ? "default" : "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {loading ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Генерируем…</> : <>🔄 Перегенерировать</>}
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1 }}>
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
                  <Loader2 size={32} style={{ color: accentColor, animation: "spin 1s linear infinite", marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>AI генерирует {count} идей для {formatLabel}…</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>20-40 секунд</div>
                </div>
              )}
              {err && (
                <div style={{ padding: "14px 16px", background: "color-mix(in oklch, var(--destructive) 10%, transparent)", color: "var(--destructive)", borderRadius: 10, fontSize: 13 }}>
                  {err}
                </div>
              )}
              {ideas && ideas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ideas.map((idea, i) => (
                    <div key={idea.id || `idea-${i}`} style={{
                      padding: 14, borderRadius: 12,
                      background: "var(--background)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)", marginBottom: 6, lineHeight: 1.35 }}>
                        💡 {idea.hook}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 8, lineHeight: 1.55 }}>
                        {idea.summary || idea.angle}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {idea.pillar && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${accentColor}15`, color: accentColor }}>📌 {idea.pillar}</span>}
                        {idea.targetSegment && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "var(--muted)", color: "var(--muted-foreground)" }}>🎯 {idea.targetSegment}</span>}
                      </div>
                      <button
                        onClick={() => { onSelectIdea(idea); setOpen(false); }}
                        style={{
                          padding: "7px 14px", borderRadius: 8, border: "none",
                          background: accentColor, color: "#fff",
                          fontWeight: 700, fontSize: 12, cursor: "pointer",
                          fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                      >
                        <Check size={12} /> Использовать эту идею
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
