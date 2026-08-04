"use client";

/**
 * Степпер конвейера Контент-завода: Стиль → Тренды → План → Генерация → Календарь.
 *
 * Делает пайплайн видимым: пользователь с первого экрана понимает, из каких
 * шагов состоит завод, что уже сделано (галка) и куда идти дальше. До этого
 * шаги существовали только как разрозненные вкладки в сайдбаре, и «полный
 * цикл» приходилось собирать в голове.
 *
 * Компонент — чистое отображение: все статусы приходят готовыми из AppShell
 * (единственного владельца контент-состояния), сюда не заносим ни localStorage,
 * ни fetch. Клик по шагу — обычная навигация на его вкладку.
 */
import React from "react";

export interface PipelineStep {
  navId: string;
  label: string;
  /** Одно слово о результате шага, показывается под названием. */
  hint: string;
  done: boolean;
}

export function PipelineStepper({ steps, activeNav, onNavigate }: {
  steps: PipelineStep[];
  activeNav: string;
  onNavigate: (navId: string) => void;
}) {
  // Следующий рекомендуемый шаг — первый несделанный. Подсвечиваем его,
  // чтобы вести пользователя по конвейеру без чтения инструкций.
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 0, marginBottom: 24,
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "10px 8px", overflowX: "auto",
    }}>
      {steps.map((step, i) => {
        const isActive = step.navId === activeNav
          // Вкладки генерации сгруппированы в один шаг — подсвечиваем его
          // для любой из них.
          || (step.navId === "content-posts" && ["content-reels", "content-stories", "content-carousels"].includes(activeNav));
        const isNext = i === nextIdx;
        return (
          <React.Fragment key={step.navId}>
            {i > 0 && (
              <div style={{ alignSelf: "center", flexShrink: 0, width: 18, height: 1, background: "var(--border)", margin: "0 2px" }} />
            )}
            <button
              onClick={() => onNavigate(step.navId)}
              title={step.hint}
              style={{
                flex: "1 0 auto", minWidth: 108, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 3, padding: "8px 10px", borderRadius: 10,
                cursor: "pointer", textAlign: "center",
                border: isActive ? "1px solid var(--primary)" : "1px solid transparent",
                background: isActive ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                background: step.done ? "#22c55e" : isNext ? "var(--primary)" : "var(--muted)",
                color: step.done || isNext ? "#fff" : "var(--muted-foreground)",
              }}>
                {step.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span style={{ fontSize: 12, fontWeight: isActive || isNext ? 700 : 500, color: isActive || isNext ? "var(--foreground)" : "var(--foreground-secondary)", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                {step.done ? "готово" : step.hint}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
