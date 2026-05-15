"use client";

import { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";

export function LoadingView({ c, url }: { c: Colors; url: string }) {
  void c;
  const steps = ["Загружаем сайт…", "Извлекаем данные…", "AI анализирует…"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => s < steps.length - 1 ? s + 1 : s), 4000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--background)",
    }}>
      {/* Стабильный SVG-спиннер: круг + вращающаяся дуга. Не зависит
          от CSS-переменных, всегда выглядит цельным, не «ломается»
          между рендерами. Раньше был div с border-top, который при
          определённых рендерах показывал странные артефакты. */}
      <style>{`
        @keyframes mr-loader-spin { to { transform: rotate(360deg); } }
        .mr-loader { animation: mr-loader-spin 1.1s linear infinite; transform-origin: 50% 50%; }
      `}</style>
      <svg
        width="56" height="56" viewBox="0 0 56 56" fill="none"
        style={{ marginBottom: 24, display: "block" }}
        aria-label="Загрузка"
      >
        {/* Базовый круг — тонкий, неполный. */}
        <circle cx="28" cy="28" r="22" stroke="rgba(148,163,184,0.25)" strokeWidth="4" fill="none" />
        {/* Вращающаяся дуга. */}
        <circle
          className="mr-loader"
          cx="28" cy="28" r="22"
          stroke="#6366f1" strokeWidth="4" fill="none"
          strokeLinecap="round"
          strokeDasharray="50 138"
        />
      </svg>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>{steps[step]}</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{url}</div>
    </div>
  );
}
