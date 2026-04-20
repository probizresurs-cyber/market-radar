"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { BrandBook } from "@/lib/content-types";
import { BookOpen } from "lucide-react";

const POPULAR_FONTS = [
  "Inter", "Manrope", "Montserrat", "Roboto", "Open Sans", "Lato", "Poppins",
  "Raleway", "Nunito", "Playfair Display", "Merriweather", "PT Sans", "PT Serif",
  "Oswald", "Ubuntu", "Rubik", "Source Sans 3", "Work Sans", "DM Sans", "DM Serif Display",
  "Bebas Neue", "Josefin Sans", "Cormorant Garamond", "Libre Baskerville", "Lora",
  "Fira Sans", "IBM Plex Sans", "IBM Plex Serif", "Space Grotesk", "Archivo",
];

export function BrandBookPanel({ c, brandBook, onChange }: {
  c: Colors;
  brandBook: BrandBook;
  onChange: (next: BrandBook) => void;
}) {
  const isEmpty = !brandBook.brandName && !brandBook.tagline && brandBook.colors.length === 0;
  const [open, setOpen] = useState(isEmpty);
  const [pickerColor, setPickerColor] = useState("#f59e0b");

  const update = (patch: Partial<BrandBook>) => onChange({ ...brandBook, ...patch });

  const updateList = (key: "colors" | "toneOfVoice" | "forbiddenWords" | "goodPhrases", raw: string) => {
    const arr = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    onChange({ ...brandBook, [key]: arr });
  };

  const addColor = (col: string) => {
    const hex = col.toLowerCase();
    if (brandBook.colors.includes(hex)) return;
    onChange({ ...brandBook, colors: [...brandBook.colors, hex] });
  };

  const removeColor = (col: string) => {
    onChange({ ...brandBook, colors: brandBook.colors.filter(x => x !== col) });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update({ logoDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5, letterSpacing: "0.05em" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const taStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", lineHeight: 1.5 };
  const hintStyle: React.CSSProperties = { fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 };

  const summary = brandBook.brandName
    ? `${brandBook.brandName}${brandBook.tagline ? " · " + brandBook.tagline : ""}`
    : "Не заполнено — контент будет генерироваться без брендовых правил";

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, boxShadow: "var(--shadow)", marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid var(--muted)` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display:"inline-flex", alignItems:"center", gap:6 }}><BookOpen size={14}/>Брендбук</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{summary}</div>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14, lineHeight: 1.5 }}>
            Все поля передаются в генерацию постов, рилсов и промптов ИИ-помощника. Чем полнее заполнен брендбук — тем точнее тон и визуал.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <div>
              <label style={labelStyle}>НАЗВАНИЕ БРЕНДА</label>
              <input type="text" value={brandBook.brandName} onChange={e => update({ brandName: e.target.value })} placeholder="как называем бренд в публикациях" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>СЛОГАН / ПОЗИЦИОНИРОВАНИЕ</label>
              <input type="text" value={brandBook.tagline} onChange={e => update({ tagline: e.target.value })} placeholder="короткая формулировка (до 10 слов)" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>МИССИЯ БРЕНДА</label>
            <textarea value={brandBook.mission} onChange={e => update({ mission: e.target.value })} rows={2} placeholder="во что верим и зачем существуем" style={taStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>ЦВЕТОВАЯ ПАЛИТРА</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", border: `2px solid var(--border)`, overflow: "hidden", cursor: "pointer", background: pickerColor, boxShadow: "var(--shadow)" }}>
                  <input
                    type="color"
                    value={pickerColor}
                    onChange={e => setPickerColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addColor(pickerColor)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  + добавить
                </button>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{pickerColor}</span>
              </div>
              {brandBook.colors.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {brandBook.colors.map((col, i) => (
                    <div key={i}
                      style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 6px", borderRadius: 6, background: "var(--background)", border: `1px solid var(--muted)` }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: col, border: `1px solid var(--border)` }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--foreground-secondary)" }}>{col}</span>
                      <button
                        type="button"
                        onClick={() => removeColor(col)}
                        title="удалить"
                        style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={hintStyle}>Выбери цвет в кружочке и нажми «+ добавить».</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>ШРИФТ ЗАГОЛОВКОВ</label>
                <select
                  value={brandBook.fontHeader}
                  onChange={e => update({ fontHeader: e.target.value })}
                  style={{ ...inputStyle, fontFamily: brandBook.fontHeader || "inherit", cursor: "pointer" }}>
                  <option value="">— не выбран —</option>
                  {POPULAR_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ШРИФТ ТЕКСТА</label>
                <select
                  value={brandBook.fontBody}
                  onChange={e => update({ fontBody: e.target.value })}
                  style={{ ...inputStyle, fontFamily: brandBook.fontBody || "inherit", cursor: "pointer" }}>
                  <option value="">— не выбран —</option>
                  {POPULAR_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>TONE OF VOICE (3-5 дескрипторов)</label>
              <input type="text" value={brandBook.toneOfVoice.join(", ")} onChange={e => updateList("toneOfVoice", e.target.value)} placeholder="дружелюбный, экспертный, без формальностей" style={inputStyle} />
              <div style={hintStyle}>Через запятую. Влияет на стиль всех текстов.</div>
            </div>
            <div>
              <label style={labelStyle}>ЗАПРЕЩЁННЫЕ СЛОВА / ФОРМУЛИРОВКИ</label>
              <input type="text" value={brandBook.forbiddenWords.join(", ")} onChange={e => updateList("forbiddenWords", e.target.value)} placeholder="дешёвый, клиент, проблема" style={inputStyle} />
              <div style={hintStyle}>ИИ будет избегать этих слов.</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ПРИМЕРЫ &laquo;ХОРОШИХ&raquo; ФРАЗ БРЕНДА (по одной на строку)</label>
            <textarea
              value={brandBook.goodPhrases.join("\n")}
              onChange={e => updateList("goodPhrases", e.target.value)}
              rows={3}
              placeholder={"Сделаем быстрее, чем вы успеете заварить кофе\nНе продаём — помогаем выбрать"}
              style={taStyle}
            />
            <div style={hintStyle}>ИИ будет ориентироваться на этот стиль.</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ВИЗУАЛЬНЫЙ СТИЛЬ (для генерации картинок)</label>
            <textarea
              value={brandBook.visualStyle}
              onChange={e => update({ visualStyle: e.target.value })}
              rows={3}
              placeholder="минимализм, тёплые бежевые тона, мягкий свет, плёночная зернистость, без стоковых лиц"
              style={taStyle}
            />
            <div style={hintStyle}>Добавляется к промпту Gemini/DALL-E для каждой картинки.</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ЛОГОТИП (PNG / JPG)</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: 11, color: "var(--foreground-secondary)" }} />
              {brandBook.logoDataUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brandBook.logoDataUrl} alt="logo" style={{ maxHeight: 48, maxWidth: 120, borderRadius: 6, border: `1px solid var(--muted)`, background: "var(--background)", padding: 4 }} />
                  <button onClick={() => update({ logoDataUrl: undefined })} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 10, cursor: "pointer" }}>✕ удалить</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

