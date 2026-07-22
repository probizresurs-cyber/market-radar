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
import { CheckCircle2, ArrowRight, Gauge, Zap, Users, BarChart3, Rocket } from "lucide-react";
import { KP_UPSELL_PRICE } from "@/lib/kp-upsell-pricing";

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
  nextTitle: string; nextSubtitle: string;
  productAnalysisTitle: string; productAnalysisBody: string;
  productSeoGeoTitle: string; productSeoGeoBody: string;
  productBtn: string;
  leadBtn: string; leadContactPlaceholder: string; leadSubmit: string; leadSubmitting: string;
  leadDone: string; leadError: string;
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
    nextTitle: "Что дальше?", nextSubtitle: "Быстрый сайт — фундамент. Чтобы он приводил клиентов — два шага, можно по отдельности:",
    productAnalysisTitle: `Полный анализ — ${KP_UPSELL_PRICE.ru.fullAnalysis}`,
    productAnalysisBody: "SEO, конкуренты, целевая аудитория, план роста — всё по вашей компании, с конкретными шагами.",
    productSeoGeoTitle: `SEO/GEO-продвижение — ${KP_UPSELL_PRICE.ru.seoGeo}`,
    productSeoGeoBody: "Видимость в поиске (Яндекс, Google) и в ответах ИИ (ChatGPT, Алиса, Gemini), куда всё чаще уходят клиенты.",
    productBtn: "Подробнее",
    leadBtn: "Оставить заявку", leadContactPlaceholder: "Email или телефон",
    leadSubmit: "Отправить", leadSubmitting: "Отправляем…",
    leadDone: "Заявка принята — свяжемся сегодня", leadError: "Не получилось — попробуйте ещё раз",
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
    nextTitle: "Wie geht es weiter?", nextSubtitle: "Eine schnelle Website ist das Fundament. Damit sie Kunden bringt — zwei Schritte, einzeln buchbar:",
    productAnalysisTitle: `Vollanalyse — ${KP_UPSELL_PRICE.de.fullAnalysis}`,
    productAnalysisBody: "SEO, Wettbewerber, Zielgruppe, Wachstumsplan — alles zu Ihrem Unternehmen, mit konkreten Schritten.",
    productSeoGeoTitle: `SEO/GEO — ${KP_UPSELL_PRICE.de.seoGeo}`,
    productSeoGeoBody: "Sichtbarkeit in der Suche (Google) und in KI-Antworten (ChatGPT, Gemini), wohin immer mehr Kunden abwandern.",
    productBtn: "Mehr erfahren",
    leadBtn: "Anfrage senden", leadContactPlaceholder: "E-Mail oder Telefon",
    leadSubmit: "Senden", leadSubmitting: "Wird gesendet…",
    leadDone: "Anfrage erhalten — wir melden uns heute", leadError: "Fehlgeschlagen — bitte erneut versuchen",
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
  // «Полный анализ» ведёт на платформу MarketRadar (сам продукт полного
  // анализа), а не обратно в КП — КП клиент уже видел.
  const fullAnalysisUrl = "https://marketradar24.ru";
  const t = T[locale];

  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; data?: RebuildResult; error?: string }>({ status: "loading" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Заявка в 1 клик на апселл-продукты (полный анализ / SEO-GEO).
  const [leadOpenFor, setLeadOpenFor] = useState<string | null>(null);
  const [leadContact, setLeadContact] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadDoneFor, setLeadDoneFor] = useState<Set<string>>(new Set());
  const [leadError, setLeadError] = useState(false);

  const submitLead = async (intent: string) => {
    if (leadContact.trim().length < 5 || !state.data) return;
    setLeadBusy(true); setLeadError(false);
    try {
      const r = await fetch("/api/analysis-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: state.data.source.title || state.data.source.url,
          website: state.data.source.url,
          contact: leadContact.trim(),
          intent,
          source_path: `/site-ready/${id}`,
        }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (!j.ok) { setLeadError(true); return; }
      setLeadDoneFor(prev => new Set(prev).add(intent));
      setLeadOpenFor(null);
    } catch { setLeadError(true); }
    finally { setLeadBusy(false); }
  };

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

        {/* Дожим: два следующих продукта — полный анализ и SEO/GEO, каждый со
            своим тарифом (KP_UPSELL_PRICE — те же цены, что в боте и письме). */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 32px", marginTop: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>{t.nextTitle}</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px", lineHeight: 1.5 }}>{t.nextSubtitle}</p>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { intent: "full", icon: <BarChart3 size={18} style={{ color: "#2a78d6", flexShrink: 0, marginTop: 1 }} />, title: t.productAnalysisTitle, body: t.productAnalysisBody, href: fullAnalysisUrl },
              { intent: "seo-geo", icon: <Rocket size={18} style={{ color: "#2a78d6", flexShrink: 0, marginTop: 1 }} />, title: t.productSeoGeoTitle, body: t.productSeoGeoBody, href: "https://marketradar24.ru/seo-geo" },
            ].map((p) => (
              <div key={p.intent} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                {p.icon}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>{p.body}</div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <a href={p.href} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#2a78d6", textDecoration: "none" }}>
                      {t.productBtn} <ArrowRight size={14} />
                    </a>
                    {leadDoneFor.has(p.intent) ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "#059669" }}>
                        <CheckCircle2 size={14} /> {t.leadDone}
                      </span>
                    ) : (
                      <button onClick={() => { setLeadOpenFor(leadOpenFor === p.intent ? null : p.intent); setLeadError(false); }}
                        style={{ height: 30, padding: "0 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "1px solid #2a78d6", background: "#fff", color: "#2a78d6", cursor: "pointer" }}>
                        {t.leadBtn}
                      </button>
                    )}
                  </div>
                  {leadOpenFor === p.intent && !leadDoneFor.has(p.intent) && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={leadContact}
                        onChange={e => setLeadContact(e.target.value)}
                        placeholder={t.leadContactPlaceholder}
                        style={{ height: 36, padding: "0 12px", fontSize: 16, border: "1px solid #d1d5db", borderRadius: 8, flex: "1 1 180px", minWidth: 160, boxSizing: "border-box" }}
                      />
                      <button onClick={() => submitLead(p.intent)} disabled={leadBusy || leadContact.trim().length < 5}
                        style={{ height: 36, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "none", background: leadBusy ? "#9ca3af" : "#2a78d6", color: "#fff", cursor: leadBusy ? "default" : "pointer" }}>
                        {leadBusy ? t.leadSubmitting : t.leadSubmit}
                      </button>
                      {leadError && <div style={{ fontSize: 12, color: "#dc2626", alignSelf: "center" }}>{t.leadError}</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
