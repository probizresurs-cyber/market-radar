"use client";

/**
 * OnboardingChecklist — 6-шаговая дорожная карта работы с платформой.
 *
 * Показывается на пустых view (Дашборд, Контент-завод, ЦА и т.д.) если
 * пользователь ещё не дошёл до этого шага. Помогает понять flow платформы:
 *
 *   1. Анализ компании
 *   2. Конкуренты (3-5 шт)
 *   3. Целевая аудитория
 *   4. СММ-стратегия
 *   5. Брендбук
 *   6. Контент-завод (план + посты)
 *
 * Каждый шаг — clickable и ведёт на свой раздел через `setActiveNav`.
 *
 * Использование:
 *   <OnboardingChecklist
 *     state={{ company: !!myCompany, competitors: competitors.length > 0, ... }}
 *     onNavigate={setActiveNav}
 *   />
 */

import React from "react";
import { Check, ArrowRight, Building2, Target, Brain, Smartphone, Palette, Factory } from "lucide-react";

export interface OnboardingState {
  company: boolean;
  competitors: boolean;
  ta: boolean;
  smm: boolean;
  brandbook: boolean;
  content: boolean;
}

const STEPS: Array<{ key: keyof OnboardingState; label: string; desc: string; nav: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "company",     label: "Анализ компании", desc: "Запустите первый анализ — 3 минуты, и вся аналитика готова",                  nav: "new-analysis",  icon: Building2 },
  { key: "competitors", label: "Конкуренты",      desc: "Добавьте 3-5 конкурентов — будет таблица сравнения и Battle Cards",            nav: "competitors",   icon: Target },
  { key: "ta",          label: "Целевая аудитория", desc: "Сегменты, боли, страхи, мотивации — основа для контента",                   nav: "ta-new",        icon: Brain },
  { key: "smm",         label: "СММ-стратегия",   desc: "Архетип бренда, тон голоса, платформы и контент-столпы",                      nav: "smm-new",       icon: Smartphone },
  { key: "brandbook",   label: "Брендбук",        desc: "Цвета, шрифты, запрещённые слова, фирменные фразы",                            nav: "ta-brandbook",  icon: Palette },
  { key: "content",     label: "Контент-завод",   desc: "План на 30 дней, посты, рилсы, сторис с картинками",                          nav: "content-plan",  icon: Factory },
];

export function OnboardingChecklist({ state, onNavigate }: {
  state: OnboardingState;
  onNavigate: (nav: string) => void;
}) {
  const completedCount = STEPS.filter(s => state[s.key]).length;
  const total = STEPS.length;
  // Первый незавершённый шаг — current
  const currentIdx = STEPS.findIndex(s => !state[s.key]);
  const allDone = currentIdx === -1;

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 18,
      padding: 28,
      marginBottom: 24,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>
            С чего начать
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.4, marginBottom: 4 }}>
            {allDone
              ? "🎉 Всё настроено — можно работать"
              : `Шаг ${completedCount + 1} из ${total}: ${STEPS[currentIdx]?.label}`}
          </div>
          <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            {allDone
              ? "Все 6 модулей пройдены. Возвращайтесь сюда, чтобы быстро попасть в нужный раздел."
              : "Каждый шаг занимает 3-10 минут. Вместе это дает полную картину бизнеса и готовый контент."}
          </div>
        </div>
        {/* Прогресс-кольцо */}
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" stroke="var(--border)" strokeWidth="4" fill="none" />
            <circle cx="32" cy="32" r="28" stroke="var(--primary)" strokeWidth="4" fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(completedCount / total) * 175.93} 175.93`}
              transform="rotate(-90 32 32)"
              style={{ transition: "stroke-dasharray 0.5s ease" }} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "var(--foreground)",
          }}>
            {completedCount}/{total}
          </div>
        </div>
      </div>

      {/* Шаги */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STEPS.map((step, i) => {
          const done = state[step.key];
          const isCurrent = i === currentIdx;
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              onClick={() => onNavigate(step.nav)}
              role="button"
              tabIndex={0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                borderRadius: 11,
                border: `1.5px solid ${
                  done       ? "color-mix(in oklch, #16a34a 30%, var(--border))"
                : isCurrent  ? "var(--primary)"
                             : "var(--border)"}`,
                background: done       ? "color-mix(in oklch, #16a34a 5%, transparent)"
                          : isCurrent  ? "color-mix(in oklch, var(--primary) 6%, transparent)"
                                       : "transparent",
                cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { if (!done && !isCurrent) e.currentTarget.style.background = "var(--background)"; }}
              onMouseLeave={e => { if (!done && !isCurrent) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: done ? "#16a34a"
                          : isCurrent ? "var(--primary)"
                                      : "var(--background)",
                color: done || isCurrent ? "#fff" : "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                border: !done && !isCurrent ? "1.5px solid var(--border)" : "none",
              }}>
                {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: done ? "#16a34a" : isCurrent ? "var(--primary)" : "var(--foreground)",
                  lineHeight: 1.3,
                }}>
                  {i + 1}. {step.label}
                </div>
                {(isCurrent || !done) && (
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.45 }}>
                    {step.desc}
                  </div>
                )}
              </div>
              <ArrowRight size={16} style={{ color: done ? "#16a34a" : isCurrent ? "var(--primary)" : "var(--muted-foreground)", flexShrink: 0, opacity: done ? 0.7 : 1 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
