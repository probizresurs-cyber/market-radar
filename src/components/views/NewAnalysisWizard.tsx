"use client";

/**
 * NewAnalysisWizard — multi-step мастер запуска анализа.
 *
 * Step 1 — URL компании
 * Step 2 — Какие модули анализа нужны (ЦА / СММ / Конкуренты / Отзывы)
 * Step 3 — Conditional: соц-сети если выбран СММ
 * Step 4 — Conditional: ссылки конкурентов если выбран модуль
 * Step 5 — Summary + «Запустить»
 *
 * После сабмита родитель получает `AnalysisOptions` и сам решает что
 * запускать (основной анализ + цепочка вторичных). Запросы летят
 * параллельно после основного — состояние модулей хранится в analysis
 * результате для последующего отображения вкладок.
 */

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import { Search, Users, Share2, Swords, Star, ChevronRight, ChevronLeft, Loader2, Check } from "lucide-react";

export type ModuleKey = "ta" | "smm" | "competitors" | "reviews";

export interface AnalysisOptions {
  url: string;
  modules: ModuleKey[];
  smm?: {
    vk?: string;
    telegram?: string;
    instagram?: string;
  };
  competitorUrls?: string[];
}

const MODULES: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  estMinutes: number;
}> = [
  {
    key: "ta",
    label: "Целевая аудитория",
    description: "AI-портрет ЦА: сегменты, страхи, мотивы, JTBD, барьеры воронки",
    icon: <Users size={18} />,
    color: "#a855f7",
    estMinutes: 2,
  },
  {
    key: "smm",
    label: "СММ-стратегия",
    description: "Архетип бренда, контент-столпы, тон голоса, реальная статистика соцсетей",
    icon: <Share2 size={18} />,
    color: "#ec4899",
    estMinutes: 3,
  },
  {
    key: "competitors",
    label: "Конкуренты",
    description: "Профили, ценовые матрицы, Battle Cards с возражениями",
    icon: <Swords size={18} />,
    color: "#f59e0b",
    estMinutes: 4,
  },
  {
    key: "reviews",
    label: "Анализ отзывов",
    description: "Автоматический сбор отзывов с Google / 2GIS, AI-анализ тональности",
    icon: <Star size={18} />,
    color: "#22c55e",
    estMinutes: 1,
  },
];

export function NewAnalysisWizard({
  c,
  onSubmit,
  isAnalyzing,
  initialUrl,
}: {
  c: Colors;
  onSubmit: (options: AnalysisOptions) => Promise<void>;
  isAnalyzing: boolean;
  /** Если задан — поле URL предзаполняется, и визард стартует со шага 2 (модули). */
  initialUrl?: string;
}) {
  void c;
  const [step, setStep] = useState(initialUrl ? 2 : 1);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set(["ta", "smm", "competitors"]));
  const [smmLinks, setSmmLinks] = useState<{ vk: string; telegram: string; instagram: string }>({
    vk: "", telegram: "", instagram: "",
  });
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);

  const isUrlValid = /^https?:\/\/[^\s]+$/i.test(url.trim()) || /^[a-z0-9-]+(\.[a-z]{2,})+/i.test(url.trim());
  const hasSmm = modules.has("smm");
  const hasCompetitors = modules.has("competitors");

  const normalizeUrl = (u: string): string => {
    const t = u.trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
  };

  const toggleModule = (key: ModuleKey) => {
    setModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const estimatedTotalMinutes =
    3 + // основной анализ
    Array.from(modules).reduce((sum, m) => sum + (MODULES.find(x => x.key === m)?.estMinutes ?? 0), 0);

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!isUrlValid) {
        setError("Введите корректный URL сайта");
        return;
      }
      // Сразу пропускаем к шагу 2 (выбор модулей)
      setStep(2);
      return;
    }
    if (step === 2) {
      // Если выбран SMM — идём к шагу 3, иначе к шагу 4 или 5
      if (hasSmm) setStep(3);
      else if (hasCompetitors) setStep(4);
      else setStep(5);
      return;
    }
    if (step === 3) {
      // После SMM-step → конкуренты или summary
      if (hasCompetitors) setStep(4);
      else setStep(5);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 5) {
      if (hasCompetitors) setStep(4);
      else if (hasSmm) setStep(3);
      else setStep(2);
      return;
    }
    if (step === 4) {
      if (hasSmm) setStep(3);
      else setStep(2);
      return;
    }
    if (step === 3) setStep(2);
    if (step === 2) setStep(1);
  };

  const handleFinalSubmit = async () => {
    setError(null);
    try {
      const payload: AnalysisOptions = {
        url: normalizeUrl(url),
        modules: Array.from(modules),
      };
      if (hasSmm) {
        const cleaned: AnalysisOptions["smm"] = {};
        if (smmLinks.vk.trim()) cleaned.vk = smmLinks.vk.trim();
        if (smmLinks.telegram.trim()) cleaned.telegram = smmLinks.telegram.trim();
        if (smmLinks.instagram.trim()) cleaned.instagram = smmLinks.instagram.trim();
        if (Object.keys(cleaned).length > 0) payload.smm = cleaned;
      }
      if (hasCompetitors) {
        const urls = competitorUrls.map(u => u.trim()).filter(Boolean).map(normalizeUrl);
        if (urls.length > 0) payload.competitorUrls = urls;
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const totalSteps = 5;
  // Активные шаги учитывая conditional skip — для прогресс-бара
  const visibleSteps = [1, 2];
  if (hasSmm) visibleSteps.push(3);
  if (hasCompetitors) visibleSteps.push(4);
  visibleSteps.push(5);
  const currentVisibleIdx = visibleSteps.indexOf(step);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px", color: "var(--foreground)", letterSpacing: -0.5 }}>
        Новый анализ
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Один запуск — несколько отчётов сразу. Выберите какие модули нужны: получите дашборд по каждому + общий отчёт руководителя.
      </p>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {visibleSteps.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= currentVisibleIdx ? "var(--primary)" : "var(--border)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>

      <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, boxShadow: "var(--shadow)" }}>
        {/* STEP 1: URL */}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>
              Какой сайт анализируем?
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>
              Введите URL — мы соберём данные по 30+ источникам.
            </p>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="example.ru или https://example.ru"
              disabled={isAnalyzing}
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && isUrlValid) handleNext(); }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: `1.5px solid ${error ? "var(--destructive)" : "var(--border)"}`,
                background: "var(--background)", color: "var(--foreground)",
                fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </>
        )}

        {/* STEP 2: Выбор модулей */}
        {step === 2 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>
              Какие модули анализа нужны?
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>
              Основной анализ компании (Score, SEO, бизнес, тех-аудит) запустится всегда. Дополнительно выберите углублённые модули.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MODULES.map(m => {
                const active = modules.has(m.key);
                return (
                  <label
                    key={m.key}
                    style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                      background: active ? `${m.color}10` : "var(--background)",
                      border: `1.5px solid ${active ? m.color : "var(--border)"}`,
                      transition: "all 0.12s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleModule(m.key)}
                      style={{ display: "none" }}
                    />
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: active ? m.color : "var(--background)",
                      border: `2px solid ${active ? m.color : "var(--border)"}`,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, color: "#fff",
                    }}>
                      {active && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ color: m.color, display: "inline-flex" }}>{m.icon}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--foreground)" }}>{m.label}</span>
                        <span style={{
                          marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)",
                          background: "var(--muted)", borderRadius: 5, padding: "2px 7px",
                        }}>
                          +{m.estMinutes} мин
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
                        {m.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 3: SMM links */}
        {step === 3 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>
              Где у вас соцсети?
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>
              Подтянем реальную статистику подписчиков и постов из ВКонтакте и Telegram. Если соц-сетей пока нет — оставьте пустыми, AI напишет стратегию с нуля.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                { key: "vk", label: "ВКонтакте", placeholder: "vk.com/yourpage", icon: <Users size={15} style={{ color: "#4a76a8" }} /> },
                { key: "telegram", label: "Telegram", placeholder: "t.me/yourchannel", icon: <Share2 size={15} style={{ color: "#229ED9" }} /> },
                { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourbrand (опц)", icon: <Share2 size={15} style={{ color: "#E4405F" }} /> },
              ] as const).map(field => (
                <div key={field.key}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 5 }}>
                    {field.icon} {field.label}
                  </label>
                  <input
                    type="text"
                    value={smmLinks[field.key]}
                    onChange={e => setSmmLinks(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    disabled={isAnalyzing}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10,
                      border: "1.5px solid var(--border)", background: "var(--background)",
                      color: "var(--foreground)", fontSize: 14, outline: "none",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 4: Конкуренты */}
        {step === 4 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>
              С кем будем сравнивать?
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>
              Укажите 1-3 сайта конкурентов. Можно не заполнять — AI сам найдёт через Keys.so.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {competitorUrls.map((u, i) => (
                <input
                  key={i}
                  type="text"
                  value={u}
                  onChange={e => setCompetitorUrls(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`Конкурент ${i + 1} (например, competitor${i + 1}.ru)`}
                  disabled={isAnalyzing}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid var(--border)", background: "var(--background)",
                    color: "var(--foreground)", fontSize: 14, outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* STEP 5: Summary */}
        {step === 5 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>
              Готовы запустить
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>
              Анализ займёт ≈ {estimatedTotalMinutes} мин. После завершения откроется основной дашборд, остальные модули — в своих вкладках.
            </p>
            <div style={{ background: "var(--background)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 4 }}>САЙТ</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", wordBreak: "break-all" }}>{normalizeUrl(url)}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 6 }}>МОДУЛИ</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "var(--primary)", color: "#fff" }}>
                    Основной (Score, SEO, бизнес)
                  </span>
                  {Array.from(modules).map(k => {
                    const m = MODULES.find(x => x.key === k);
                    if (!m) return null;
                    return (
                      <span key={k} style={{
                        fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                        background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}50`,
                      }}>
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              {hasSmm && (smmLinks.vk || smmLinks.telegram || smmLinks.instagram) && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 4 }}>СОЦСЕТИ</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>
                    {[smmLinks.vk, smmLinks.telegram, smmLinks.instagram].filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}
              {hasCompetitors && competitorUrls.some(u => u.trim()) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 4 }}>КОНКУРЕНТЫ</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>
                    {competitorUrls.filter(u => u.trim()).join(" · ")}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              marginTop: 16, padding: "10px 14px", background: "color-mix(in oklch, var(--primary) 6%, transparent)",
              border: "1px dashed color-mix(in oklch, var(--primary) 30%, var(--border))",
              borderRadius: 10, fontSize: 12.5, color: "var(--foreground-secondary)", lineHeight: 1.55,
            }}>
              <b style={{ color: "var(--foreground)" }}>После анализа</b> — каждый модуль появится своей вкладкой в сайдбаре.
              Общая картина по всем модулям сразу доступна в <b style={{ color: "var(--foreground)" }}>Дашборде руководителя</b> (ОБЗОР сверху).
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px",
            background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--destructive) 30%, transparent)",
            borderRadius: 10, color: "var(--destructive)", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {isAnalyzing && step === 5 && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={16} className="mr-spin" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 600 }}>Запускаем цепочку анализов…</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Можете закрыть страницу — анализ продолжит работать, результат появится в дашбордах.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {step > 1 ? (
            <button
              onClick={handleBack}
              disabled={isAnalyzing}
              style={{
                padding: "10px 16px", borderRadius: 10,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--foreground-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "inherit",
              }}
            >
              <ChevronLeft size={14} /> Назад
            </button>
          ) : <div />}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Шаг {currentVisibleIdx + 1} из {visibleSteps.length}
            </span>
            {step < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={isAnalyzing || (step === 1 && !isUrlValid)}
                style={{
                  padding: "11px 20px", borderRadius: 10, border: "none",
                  background: "var(--primary)", color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: (step === 1 && !isUrlValid) ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                Далее <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleFinalSubmit}
                disabled={isAnalyzing}
                style={{
                  padding: "11px 22px", borderRadius: 10, border: "none",
                  background: "var(--primary)", color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: isAnalyzing ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 7,
                  opacity: isAnalyzing ? 0.7 : 1,
                  fontFamily: "inherit",
                  boxShadow: "0 4px 18px color-mix(in oklch, var(--primary) 40%, transparent)",
                }}
              >
                {isAnalyzing
                  ? <><Loader2 size={15} className="mr-spin" /> Анализирую…</>
                  : <><Search size={15} /> Запустить анализ</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
