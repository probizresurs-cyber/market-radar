"use client";

import React, { useState, useRef } from "react";
import type { Colors } from "@/lib/colors";
import type { ReferenceImage } from "@/lib/content-types";
import { Lightbulb } from "lucide-react";

export function ImageReferencePanel({ c, images, onChange }: {
  c: Colors;
  images: ReferenceImage[];
  onChange: (next: ReferenceImage[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const readFiles = (files: FileList) => {
    Array.from(files).slice(0, 5 - images.length).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        onChange([...images, { id: `ref-${Date.now()}-${Math.random()}`, name: file.name, mimeType: file.type, data: base64, previewUrl: dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, boxShadow: "var(--shadow)", marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid var(--muted)` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>🖼 Референсы для стиля изображений</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
            {images.length > 0 ? `${images.length} референс${images.length === 1 ? "" : images.length < 5 ? "а" : "ов"} — Gemini будет генерировать в похожем стиле` : "Не загружено — Gemini генерирует без стиля"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {images.slice(0, 3).map(img => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.previewUrl} alt={img.name} style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", border: `1px solid var(--border)` }} />
              ))}
            </div>
          )}
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer",
              background: dragging ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent", transition: "all 0.15s", marginBottom: 14,
            }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Перетащите картинки сюда или кликните</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>До 5 изображений · JPG, PNG, WEBP · Макс. 4 МБ каждый</div>
            <input
              ref={inputRef} type="file" accept="image/*" multiple
              style={{ display: "none" }}
              onChange={e => e.target.files && readFiles(e.target.files)}
            />
          </div>

          {images.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ЗАГРУЖЕННЫЕ РЕФЕРЕНСЫ ({images.length}/5)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {images.map(img => (
                  <div key={img.id} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt={img.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: `1px solid var(--border)` }} />
                    <button
                      onClick={() => onChange(images.filter(i => i.id !== img.id))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--destructive)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1 }}>
                      ×
                    </button>
                    <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 3, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onChange([])}
                style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, border: `1px solid var(--destructive)30`, background: "transparent", color: "var(--destructive)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                🗑 Удалить все
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, padding: "10px 12px", background: "color-mix(in oklch, var(--primary) 3%, transparent)", borderRadius: 8, fontSize: 11, color: "var(--foreground-secondary)", lineHeight: 1.5, display:"flex", alignItems:"flex-start", gap:6 }}>
            <Lightbulb size={13} style={{flexShrink:0, marginTop:1}}/><span><b>Как работает:</b> загрузите 1-3 картинки в нужном стиле (например, фирменные фото или референс-изображения). Gemini будет генерировать картинки для постов, ориентируясь на их цвета, композицию и настроение.</span>
          </div>
        </div>
      )}
    </div>
  );
}


