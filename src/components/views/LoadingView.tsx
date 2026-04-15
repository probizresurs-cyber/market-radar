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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
      <style>{`@keyframes mr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 48, height: 48, border: "3px solid var(--border)", borderTop: "3px solid var(--primary)", borderRadius: "50%", animation: "mr-spin 1s linear infinite", marginBottom: 24 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>{steps[step]}</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{url}</div>
    </div>
  );
}
