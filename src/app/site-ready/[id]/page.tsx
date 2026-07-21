"use client";

/**
 * /site-ready/<rebuild-id> — публичная клиентская страница результата
 * переноса на Astro (Фаза 4). НЕ технический /astro-rebuild (тот остаётся
 * инструментом менеджера — тени, вкладки «Оптимизация»/«Исходники», .zip):
 * здесь минимум текста, максимум фактов, которые поймёт нетехнический клиент.
 * Ссылку сюда шлём в письме/Telegram после одобрения менеджером (см.
 * /api/kp-generate/[id]/approve-rebuild).
 *
 * Блок "хотите ускорить ещё" (п.8 спеки) — пункты оптимизации, которые раньше
 * были просто рекомендацией без действия. Теперь клиент может одобрить: для
 * risk="safe"/"moderate" одобрение реально применяет консервативную правку
 * (минификация HTML, defer скриптов, объединение CSS — ничего не удаляем и
 * не переписываем поведение); для risk="manual" (jQuery) безопасного
 * автофикса нет — одобрение просто ставит задачу на ручную доработку команде,
 * без ложного "починили".
 */

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight, Gauge, Zap, Users } from "lucide-react";

type Locale = "ru" | "de";
type Risk = "safe" | "moderate" | "manual";

interface SpeedMetrics { performance: number | null }
interface OptIssue {
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  fixed: boolean;
  queued?: boolean;
  key?: string;
  risk?: Risk;
  metric?: number;
}
interface RebuildResult {
  ok: boolean;
  previewUrl: string;
  source: { url: string; title: string };
  fixes: string[];
  optimization?: { issues: OptIssue[] };
  speedCompare?: { original: SpeedMetrics; rebuilt: SpeedMetrics } | null;
}

const T: Record<Locale, {
  loading: string; notFound: string; notFoundBody: string;
  title: (name: string) => string; designKept: string; fixesCount: (n: number) => string;
  speedLabel: string; speedBefore: string; speedAfter: string;
  openSite: string;
  moreTitle: string; moreSubtitle: string;
  riskSafe: string; riskModerate: string; riskManual: string;
  approveBtn: string; approving: string; doneBtn: string; queuedBtn: string; approveError: string;
}> = {
  ru: {
    loading: "Загружаем…", notFound: "Ссылка недоступна", notFoundBody: "Проверьте ссылку или напишите нам.",
    title: (name) => `Новая версия сайта «${name}» готова`,
    designKept: "Дизайн сохранён без изменений",
    fixesCount: (n) => `${n} ${n === 1 ? "техническая проблема исправлена" : n < 5 ? "технические проблемы исправлены" : "технических проблем исправлено"}`,
    speedLabel: "Скорость загрузки", speedBefore: "Было", speedAfter: "Стало",
    openSite: "Открыть новый сайт",
    moreTitle: "Хотите ускорить ещё?", moreSubtitle: "Необязательные доработки — одобрите то, что нужно",
    riskSafe: "Безопасно, вид не меняется", riskModerate: "Может слегка изменить поведение скриптов", riskManual: "Требует ручной работы нашей команды",
    approveBtn: "Одобрить", approving: "Применяем…", doneBtn: "Сделано", queuedBtn: "Передано в работу", approveError: "Не получилось — попробуйте ещё раз",
  },
  de: {
    loading: "Wird geladen…", notFound: "Link nicht verfügbar", notFoundBody: "Prüfen Sie den Link oder schreiben Sie uns.",
    title: (name) => `Die neue Version der Website „${name}" ist fertig`,
    designKept: "Design unverändert erhalten",
    fixesCount: (n) => `${n} technische${n === 1 ? "s Problem behoben" : " Probleme behoben"}`,
    speedLabel: "Ladegeschwindigkeit", speedBefore: "Vorher", speedAfter: "Nachher",
    openSite: "Neue Website öffnen",
    moreTitle: "Möchten Sie es noch schneller?", moreSubtitle: "Optionale Verbesserungen — genehmigen Sie, was Sie möchten",
    riskSafe: "Sicher, das Erscheinungsbild ändert sich nicht", riskModerate: "Kann das Skriptverhalten leicht verändern", riskManual: "Erfordert manuelle Arbeit unseres Teams",
    approveBtn: "Genehmigen", approving: "Wird angewendet…", doneBtn: "Erledigt", queuedBtn: "In Bearbeitung", approveError: "Fehlgeschlagen — bitte erneut versuchen",
  },
};

// title/detail в OptIssue всегда по-русски (эти данные использует и
// менеджерский /astro-rebuild) — для DE-клиента здесь собираем текст
// заново по key+severity+metric, а не переводим строку из бэкенда.
function localizeIssue(issue: OptIssue, locale: Locale): { title: string; detail: string } {
  if (locale === "ru") return { title: issue.title, detail: issue.detail };
  const n = issue.metric ?? 0;
  switch (issue.key) {
    case "html-size":
      return {
        title: `HTML-Dokument ist ${n} KB groß`,
        detail: issue.severity === "critical"
          ? "Das ist sehr viel für eine einzelne Seite (üblich sind 100-200 KB). Der Grund: Der Baukasten schreibt das gesamte Layout und alle Stile inline in die Seite. Kommentare und überflüssige Leerzeichen lassen sich sicher entfernen (Minifizierung) — ein spürbarer, aber kein vollständiger Effekt; vollständig behebt das nur ein sauberer Neuaufbau des Layouts."
          : "Mehr als die empfohlenen 200 KB — das wirkt sich auf die Ladegeschwindigkeit aus, besonders auf Mobilgeräten. Die Minifizierung (ohne Änderung der Optik) macht die Datei etwas leichter.",
      };
    case "ext-scripts":
      return {
        title: `${n} externe Skripte`,
        detail: "Jedes Skript ist eine eigene Verbindung und Ausführungszeit — das ist die Hauptbremse für den Lighthouse-Wert. Nicht blockierende Skripte lassen sich auf verzögertes Laden (defer) umstellen — sie laufen weiter in der ursprünglichen Reihenfolge, bremsen aber nicht mehr die Darstellung der Seite. In sehr seltenen Fällen kann das ein Skript betreffen, das eine sofortige Ausführung erwartet.",
      };
    case "jquery":
      return {
        title: "jQuery wird verwendet",
        detail: "Veraltete Bibliothek (~90 KB). Sie bleibt, weil die Skripte der Original-Website darauf aufbauen — automatisch entfernen ist riskant, das könnte Slider oder Formulare zerstören. Die Genehmigung hier startet keine Automatik, sondern gibt eine Aufgabe zur manuellen Bearbeitung an unser Team weiter.",
      };
    case "ext-css":
      return {
        title: `${n} externe CSS-Dateien`,
        detail: "Viele einzelne Stildateien — jede blockiert die Darstellung. Sie lassen sich sicher zu einem eingebetteten Stilblock zusammenfassen — die Optik der Seite ändert sich nicht, es gibt nur weniger Anfragen.",
      };
    default:
      return { title: issue.title, detail: issue.detail };
  }
}

export default function SiteReadyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const locale: Locale = searchParams.get("locale") === "de" ? "de" : "ru";
  const t = T[locale];

  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; data?: RebuildResult; error?: string }>({ status: "loading" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/rebuild-astro/${id}`);
        const j = await r.json();
        if (!j.ok) { setState({ status: "error", error: j.error }); return; }
        setState({ status: "ok", data: j });
      } catch {
        setState({ status: "error" });
      }
    })();
  }, [id]);

  const approveItem = async (key: string) => {
    setBusyKey(key); setErrorKey(null);
    try {
      const r = await fetch("/api/rebuild-astro/optimize-item", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, key }),
      });
      const j = await r.json();
      if (!j.ok) { setErrorKey(key); return; }
      setState((prev) => prev.data ? { status: "ok", data: { ...prev.data, optimization: j.optimization ?? prev.data.optimization } } : prev);
    } catch { setErrorKey(key); }
    finally { setBusyKey(null); }
  };

  if (state.status === "loading") {
    return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", fontFamily: "'Inter',system-ui", color: "#6b7280" }}>{t.loading}</div>;
  }

  if (state.status === "error" || !state.data) {
    return (
      <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", fontFamily: "'Inter',system-ui", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t.notFound}</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>{t.notFoundBody}</div>
        </div>
      </div>
    );
  }

  const { previewUrl, source, fixes, speedCompare, optimization } = state.data;
  const before = speedCompare?.original?.performance ?? null;
  const after = speedCompare?.rebuilt?.performance ?? null;
  const showSpeed = before != null && after != null;
  const pendingItems = (optimization?.issues ?? []).filter((i) => i.risk);

  const riskLabel = (risk?: Risk) => risk === "safe" ? t.riskSafe : risk === "moderate" ? t.riskModerate : t.riskManual;
  const riskColor = (risk?: Risk) => risk === "safe" ? "#059669" : risk === "moderate" ? "#d97706" : "#2a78d6";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", fontFamily: "'Inter',system-ui", padding: "48px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#2a78d6" }}>MarketRadar</span>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "36px 32px", marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px", lineHeight: 1.3, textAlign: "center" }}>
            {t.title(source.title || source.url)}
          </h1>

          <div style={{ display: "grid", gap: 12, marginBottom: showSpeed ? 28 : 32 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5 }}>
              <CheckCircle2 size={19} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }} />
              <span>{t.designKept}</span>
            </div>
            {fixes.length > 0 && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5 }}>
                <CheckCircle2 size={19} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }} />
                <span>{t.fixesCount(fixes.length)}</span>
              </div>
            )}
          </div>

          {showSpeed && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "18px 16px", background: "#f7f7f8", borderRadius: 14, marginBottom: 32 }}>
              <Gauge size={18} style={{ color: "#6b7280", flexShrink: 0 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 2 }}>{t.speedBefore}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626" }}>{before}</div>
              </div>
              <ArrowRight size={18} style={{ color: "#9ca3af", flexShrink: 0 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 2 }}>{t.speedAfter}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{after}</div>
              </div>
            </div>
          )}

          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 12, background: "#2a78d6", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
            {t.openSite} <ArrowRight size={18} />
          </a>
        </div>

        {pendingItems.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Zap size={18} style={{ color: "#2a78d6" }} />
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{t.moreTitle}</h2>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px" }}>{t.moreSubtitle}</p>
            <div style={{ display: "grid", gap: 12 }}>
              {pendingItems.map((issue) => {
                const handled = issue.fixed || issue.queued;
                const busy = busyKey === issue.key;
                const loc = localizeIssue(issue, locale);
                return (
                  <div key={issue.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{loc.title}</div>
                        <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5, marginBottom: 6 }}>{loc.detail}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(issue.risk) }}>{riskLabel(issue.risk)}</span>
                      </div>
                      {handled ? (
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: issue.queued ? "#2a78d6" : "#059669", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {issue.queued ? <Users size={14} /> : <CheckCircle2 size={14} />} {issue.queued ? t.queuedBtn : t.doneBtn}
                        </span>
                      ) : (
                        <button onClick={() => approveItem(issue.key!)} disabled={busy}
                          style={{ height: 32, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "none", background: busy ? "#9ca3af" : "#2a78d6", color: "#fff", cursor: busy ? "default" : "pointer", flexShrink: 0 }}>
                          {busy ? t.approving : t.approveBtn}
                        </button>
                      )}
                    </div>
                    {errorKey === issue.key && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{t.approveError}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
