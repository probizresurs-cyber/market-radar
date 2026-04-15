"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { TAResult } from "@/lib/ta-types";
import type { BrandBook } from "@/lib/content-types";

export function BrandSuggestionsView({ c, taData, brandSuggestions, setBrandSuggestions, brandBook, onUpdateBrandBook }: {
  c: Colors;
  taData: TAResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brandSuggestions: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBrandSuggestions: (v: any) => void;
  brandBook: BrandBook;
  onUpdateBrandBook: (next: BrandBook) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const segments = taData.segments.map(s => ({
        segmentName: s.segmentName,
        demographics: s.demographics,
        worldview: s.worldview,
        topEmotions: s.topEmotions,
        topFears: s.topFears,
      }));
      const res = await fetch("/api/suggest-brandbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: taData.companyName, niche: taData.niche, segments }),
      });
      const json = await res.json();
      if (json.ok) setBrandSuggestions(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const applyToBrandBook = () => {
    if (!brandSuggestions) return;
    const cp = brandSuggestions.colorPalette ?? {};
    const typo = brandSuggestions.typography ?? {};
    const tov = brandSuggestions.toneOfVoice ?? {};
    const colors: string[] = [];
    if (cp.primary?.startsWith("#")) colors.push(cp.primary);
    if (cp.secondary?.startsWith("#")) colors.push(cp.secondary);
    if (cp.accent?.startsWith("#")) colors.push(cp.accent);
    if (cp.background?.startsWith("#")) colors.push(cp.background);
    if (cp.text?.startsWith("#")) colors.push(cp.text);
    onUpdateBrandBook({
      ...brandBook,
      colors: colors.length > 0 ? colors : brandBook.colors,
      fontHeader: typo.headerFont || brandBook.fontHeader,
      fontBody: typo.bodyFont || brandBook.fontBody,
      toneOfVoice: tov.adjectives?.length ? tov.adjectives : brandBook.toneOfVoice,
      goodPhrases: tov.goodPhrases?.length ? tov.goodPhrases : brandBook.goodPhrases,
      forbiddenWords: tov.forbiddenPhrases?.length ? tov.forbiddenPhrases : brandBook.forbiddenWords,
      visualStyle: brandSuggestions.aesthetics?.style || brandBook.visualStyle,
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, ...style }}>{children}</div>
  );
  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? c.accent) + "15", color: color ?? c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Рекомендации по брендбуку</h1>
      <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 24 }}>
        AI предлагает цвета, шрифты, тон голоса и визуальный стиль на основе портрета вашей ЦА.
        После генерации нажмите «Применить к брендбуку» — данные перенесутся в план контента.
      </p>

      {!brandSuggestions && !loading && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
          <h3 style={{ color: c.textPrimary, margin: "0 0 8px" }}>Сгенерировать рекомендации</h3>
          <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
            На основе {taData.segments.length} сегментов ЦА для «{taData.companyName}»
          </p>
          <button onClick={load} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Сгенерировать рекомендации
          </button>
        </Card>
      )}

      {loading && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ color: c.accent, fontSize: 14 }}>⏳ Генерирую рекомендации по брендбуку...</div>
        </Card>
      )}

      {brandSuggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Apply button + regenerate */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={applyToBrandBook} style={{ padding: "10px 24px", borderRadius: 10, border: "none",
              background: applied ? c.accentGreen : c.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "background .3s" }}>
              {applied ? "✓ Применено к брендбуку!" : "✅ Применить к брендбуку"}
            </button>
            <button onClick={load} disabled={loading} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${c.border}`,
              background: c.bgCard, color: c.textPrimary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              🔄 Перегенерировать
            </button>
            <span style={{ fontSize: 12, color: c.textMuted }}>Данные сохраняются автоматически</span>
          </div>

          {/* Summary */}
          <Card style={{ borderLeft: `4px solid ${c.accent}` }}>
            <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{brandSuggestions.summary}</p>
          </Card>

          {/* Color Palette */}
          {brandSuggestions.colorPalette && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ЦВЕТОВАЯ ПАЛИТРА</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                {(["primary", "secondary", "accent", "background", "text"] as const).map(key => {
                  const hexVal = brandSuggestions.colorPalette[key];
                  if (!hexVal || !hexVal.startsWith("#")) return null;
                  return (
                    <div key={key} style={{ textAlign: "center" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 12, background: hexVal, border: `2px solid ${c.border}`, marginBottom: 4 }} />
                      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{key}</div>
                      <div style={{ fontSize: 10, color: c.textSecondary }}>{hexVal}</div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.colorPalette.reasoning}</p>
            </Card>
          )}

          {/* Typography */}
          {brandSuggestions.typography && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ТИПОГРАФИКА</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: 12, borderRadius: 8, background: c.bg }}>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>Заголовки</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.textPrimary }}>{brandSuggestions.typography.headerFont}</div>
                </div>
                <div style={{ flex: 1, padding: 12, borderRadius: 8, background: c.bg }}>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>Основной текст</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.textPrimary }}>{brandSuggestions.typography.bodyFont}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.typography.reasoning}</p>
            </Card>
          )}

          {/* Aesthetics */}
          {brandSuggestions.aesthetics && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ВИЗУАЛЬНЫЙ СТИЛЬ</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.accent, marginBottom: 8 }}>{brandSuggestions.aesthetics.style}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.aesthetics.moodKeywords ?? []).map((kw: string, i: number) => (
                  <Tag key={i} text={kw} color={c.accentGreen} />
                ))}
              </div>
              {(brandSuggestions.aesthetics.avoidKeywords ?? []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: c.accentRed, fontWeight: 600 }}>Избегать:</span>
                  {brandSuggestions.aesthetics.avoidKeywords.map((kw: string, i: number) => (
                    <Tag key={i} text={kw} color={c.accentRed} />
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.aesthetics.reasoning}</p>
            </Card>
          )}

          {/* Tone of Voice */}
          {brandSuggestions.toneOfVoice && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ТОН ГОЛОСА</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {(brandSuggestions.toneOfVoice.adjectives ?? []).map((a: string, i: number) => (
                  <Tag key={i} text={a} />
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>{brandSuggestions.toneOfVoice.communicationStyle}</div>
              {(brandSuggestions.toneOfVoice.goodPhrases ?? []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 4 }}>Хорошие фразы:</div>
                  {brandSuggestions.toneOfVoice.goodPhrases.map((p: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, paddingLeft: 10, borderLeft: `2px solid ${c.accentGreen}30`, marginBottom: 4 }}>«{p}»</div>
                  ))}
                </div>
              )}
              {(brandSuggestions.toneOfVoice.forbiddenPhrases ?? []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 4 }}>Запрещённые фразы:</div>
                  {brandSuggestions.toneOfVoice.forbiddenPhrases.map((p: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, paddingLeft: 10, borderLeft: `2px solid ${c.accentRed}30`, marginBottom: 4 }}>«{p}»</div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.toneOfVoice.reasoning}</p>
            </Card>
          )}

          {/* Social Media */}
          {brandSuggestions.socialMedia && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>СОЦСЕТИ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.socialMedia.bestPlatforms ?? []).map((p: string, i: number) => (
                  <Tag key={i} text={p} color={c.accent} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6 }}>
                Частота: <b>{brandSuggestions.socialMedia.postingFrequency}</b>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.socialMedia.contentTypes ?? []).map((ct: string, i: number) => (
                  <Tag key={i} text={ct} color={c.accentGreen} />
                ))}
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.socialMedia.reasoning}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
