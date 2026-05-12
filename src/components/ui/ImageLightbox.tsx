"use client";

/**
 * ImageLightbox — fullscreen-просмотр картинки с возможностью скачать.
 *
 * Использование:
 *   const [open, setOpen] = useState(false);
 *   <ClickableImage src={url} alt={...} onClick={() => setOpen(true)} />
 *   {open && <ImageLightbox src={url} filename="..." onClose={() => setOpen(false)} />}
 *
 * Или короче — есть hook `useImageLightbox()` который возвращает {trigger, modal}.
 */

import React, { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

export function ImageLightbox({
  src,
  filename,
  onClose,
}: {
  src: string;
  filename?: string;
  onClose: () => void;
}) {
  // Esc для закрытия
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // Блокируем скролл body пока открыт
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Скачивание. Для data: URL — простой <a download>. Для http URL — fetch + blob,
  // потому что cross-origin <a download> часто игнорируется.
  const handleDownload = async () => {
    const name = filename || `image-${Date.now()}.png`;
    try {
      if (src.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = src;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      // http(s) — fetch + создаём blob URL
      const res = await fetch(src);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
    } catch {
      // Fallback: открыть в новой вкладке — пользователь сохранит вручную
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 24,
        cursor: "zoom-out",
        animation: "lbFadeIn 0.18s ease both",
      }}
    >
      <style>{`
        @keyframes lbFadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Top-right action bar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          display: "flex",
          gap: 10,
          zIndex: 10001,
          cursor: "default",
        }}
      >
        <button
          onClick={handleDownload}
          aria-label="Скачать"
          title="Скачать"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "inherit",
            backdropFilter: "blur(8px)",
          }}
        >
          <Download size={16} /> Скачать
        </button>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          title="Закрыть (Esc)"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: 10,
            padding: 10,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "inherit",
            backdropFilter: "blur(8px)",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Image — клик по самой картинке не закрывает */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "92vw",
          maxHeight: "92vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
    </div>
  );
}
