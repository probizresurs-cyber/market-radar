"use client";

/**
 * PackageProgressModal — оверлей для пакетной генерации контента из тренда.
 *
 * Показывает 4 шага (Пост / Сторис / Карусель / Рилс) с анимированным
 * статусом (pending → in-progress → ✓ done / ✗ failed). Пользователь видит
 * что именно сейчас происходит вместо «глухого» спиннера.
 *
 * Использование:
 *   const [progress, setProgress] = useState<PackageProgress | null>(null);
 *   ...
 *   setProgress({ post: "pending", stories: "pending", carousel: "pending", reel: "pending" });
 *   // как только начали делать запрос post — setProgress(p => ({...p, post: "loading"}))
 *   // когда успешно: setProgress(p => ({...p, post: "done"}))
 *   // когда упало: setProgress(p => ({...p, post: "failed"}))
 *   {progress && <PackageProgressModal progress={progress} />}
 */

import React from "react";
import { Loader2, Check, X, Wand2 } from "lucide-react";

export type StepStatus = "pending" | "loading" | "done" | "failed";

export interface PackageProgress {
  post: StepStatus;
  stories: StepStatus;
  carousel: StepStatus;
  reel: StepStatus;
}

const STEPS: Array<{ key: keyof PackageProgress; label: string; icon: string; color: string }> = [
  { key: "post",     label: "Пост",         icon: "📝", color: "#3b82f6" },
  { key: "stories",  label: "Серия сторис", icon: "📱", color: "#a855f7" },
  { key: "carousel", label: "Карусель",     icon: "🎠", color: "#ec4899" },
  { key: "reel",     label: "Рилс",         icon: "🎬", color: "#f59e0b" },
];

export function PackageProgressModal({ progress }: { progress: PackageProgress }) {
  const total = 4;
  const done = STEPS.filter(s => progress[s.key] === "done" || progress[s.key] === "failed").length;
  const inProgress = STEPS.filter(s => progress[s.key] === "loading").length;
  const allDone = done === total;
  const successCount = STEPS.filter(s => progress[s.key] === "done").length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0, 0, 0, 0.65)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        @keyframes pkg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pkg-pop  { 0% { transform: scale(0.85); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
      <div style={{
        background: "var(--card)", borderRadius: 18, maxWidth: 480, width: "100%",
        padding: 32, boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "color-mix(in oklch, var(--primary) 14%, transparent)",
            color: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {allDone
              ? <Check size={26} strokeWidth={2.5} />
              : <Wand2 size={26} style={{ animation: inProgress > 0 ? "pkg-spin 2s linear infinite" : "none" }} />}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.3 }}>
              {allDone
                ? `Готово ${successCount}/${total} 🎉`
                : "Генерирую пакет контента"}
            </div>
            <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 2 }}>
              {allDone
                ? "Все материалы сохранены в «Готовые»"
                : `Шаг ${done}/${total} · занимает 60-90 секунд`}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((step) => {
            const status = progress[step.key];
            const isLoading = status === "loading";
            const isDone = status === "done";
            const isFailed = status === "failed";
            const isPending = status === "pending";

            return (
              <div key={step.key} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px",
                borderRadius: 11,
                border: `1.5px solid ${
                  isDone   ? "#16a34a40"
                : isFailed ? "#dc262640"
                : isLoading ? `${step.color}55`
                : "var(--border)"}`,
                background: isLoading ? `${step.color}10`
                          : isDone ? "#16a34a08"
                          : isFailed ? "#dc262608"
                          : "transparent",
                transition: "all 0.3s ease",
                opacity: isPending ? 0.55 : 1,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: isDone ? "#16a34a"
                            : isFailed ? "#dc2626"
                            : isLoading ? step.color
                            : "var(--background)",
                  color: isPending ? "var(--muted-foreground)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 18,
                  border: isPending ? "1.5px solid var(--border)" : "none",
                }}>
                  {isLoading
                    ? <Loader2 size={18} style={{ animation: "pkg-spin 1s linear infinite" }} />
                  : isDone
                    ? <Check size={18} strokeWidth={3} style={{ animation: "pkg-pop 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both" }} />
                  : isFailed
                    ? <X size={18} strokeWidth={3} />
                  : <span>{step.icon}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700,
                    color: isPending ? "var(--muted-foreground)" : "var(--foreground)",
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {isLoading ? "Генерирую…"
                  : isDone ? "Сохранён в Готовые"
                  : isFailed ? "Не удалось"
                  : "Ожидает"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 24 }}>
          <div style={{
            height: 6, borderRadius: 3, background: "var(--background)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(done / total) * 100}%`,
              background: "linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 60%, #fff))",
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}/>
          </div>
          {!allDone && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
              Не закрывайте окно — продолжается генерация
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
