"use client";

import React, { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { BarChart2, Target, Coins, Eye, Swords, Megaphone, TrendingUp, FileText, ChevronDown, ChevronRight, Info } from "lucide-react";

type SpywordsDashboard = NonNullable<AnalysisResult["spywordsDashboard"]>;
type Competitor = NonNullable<NonNullable<SpywordsDashboard["competitors"]>["yandex"]>[number];

interface Props {
  data: SpywordsDashboard;
}

/**
 * Объяснения метрик. Хранятся отдельно от UI чтобы менять текст без правки
 * вёрстки. Если ключа нет — подсказка просто не показывается.
 */
const METRIC_HINTS: Record<string, string> = {
  "Ключей в ТОП-10": "Сколько уникальных поисковых запросов сайта попадают в первую страницу выдачи (топ-10). Чем больше — тем больше прямого трафика.",
  "Ключей в ТОП-50": "Всего запросов сайта в видимой части поисковой выдачи (топ-50). Включает ТОП-10. Резерв для роста — ключи из топ-50 можно «дотянуть» в топ-10.",
  "Трафик из органики": "Оценка SpyWords о месячном бесплатном трафике из поиска. Считается на основе позиций + частотности запросов + кликабельности позиции.",
  "Ключей в контексте": "Сколько запросов сайт выкупает в платной выдаче (Яндекс.Директ / Google Ads). 0 = не размещают контекстную рекламу.",
  "Уник. объявлений": "Сколько уникальных рекламных объявлений показывает сайт. Большое число = разнообразная креативность, мало = шаблонные кампании.",
  "Ср. позиция": "Средняя позиция объявлений сайта в платной выдаче. 1 = всегда в самом верху, 5+ = чаще снизу или сбоку.",
  "Трафик из контекста": "Оценка месячного платного трафика. Считается из ключей × CPC × позиции.",
  "Бюджет на контекст": "Сколько сайт примерно тратит в месяц на платную рекламу (₽). По SpyWords, исходя из ставок CPC и количества показов.",
  "Уровень конкуренции": "Процент пересечения ключей конкурента с вашими. 100% = полная копия семантики, 0% = конкурируют по совсем другим запросам.",
  "Общих ключей": "Сколько запросов у вас и конкурента совпадают. Это «прямая конкуренция» — за эти ключи вы боретесь.",
  "Уникальных ключей": "Сколько запросов есть у конкурента, но нет у вас. Это «зона роста» — потенциальная семантика которой вам не хватает.",
  "Всего ключей": "Сколько всего запросов у конкурента в выдаче (топ-50 органики).",
  "Трафик / мес": "Месячный органический трафик конкурента — оценка SpyWords.",
  "Бюджет ₽/мес": "Сколько конкурент тратит на контекст в месяц.",
};

function fmt(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("ru-RU");
}

function fmtMoney(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс. ₽`;
  return `${n.toLocaleString("ru-RU")} ₽`;
}

/** Иконка-инфо со всплывающей подсказкой при ховере. */
function InfoTip({ label }: { label: string }) {
  const hint = METRIC_HINTS[label];
  if (!hint) return null;
  return (
    <span title={hint} style={{ display: "inline-flex", cursor: "help", color: "var(--muted-foreground)", opacity: 0.6 }}>
      <Info size={11} />
    </span>
  );
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  const hint = METRIC_HINTS[label];
  return (
    <div style={{
      background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)",
      padding: "14px 16px", boxShadow: "var(--shadow)",
      display: "flex", flexDirection: "column", minHeight: 110,
    }}>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          {icon} {label} <InfoTip label={label} />
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? "var(--foreground)", lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** Развёрнутая карточка конкурента: имя, базовые метрики, при клике — overview + ads. */
function CompetitorCard({ c, engineColor, engineLabel }: { c: Competitor; engineColor: string; engineLabel: string }) {
  const [open, setOpen] = useState(false);
  const hasEnrichment = !!c.overview || (c.topAds && c.topAds.length > 0);

  return (
    <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => hasEnrichment && setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          padding: "10px 12px", cursor: hasEnrichment ? "pointer" : "default",
          display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit",
          color: "var(--foreground)",
        }}
      >
        {hasEnrichment && (open ? <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.domain}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {c.commonKeywords > 0 && <><b style={{ color: engineColor }}>{fmt(c.commonKeywords)}</b> общих ключей</>}
            {c.uniqueKeywords && c.uniqueKeywords > 0 ? <> · {fmt(c.uniqueKeywords)} уник.</> : null}
            {c.totalKeywords > 0 ? <> · всего {fmt(c.totalKeywords)}</> : null}
            {c.competitionLevel && c.competitionLevel > 0 ? <> · конкуренция {c.competitionLevel}%</> : null}
          </div>
        </div>
      </button>

      {/* Развёрнутая часть — метрики + топ-объявления */}
      {open && hasEnrichment && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {c.overview && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", margin: "12px 0 8px" }}>
                МЕТРИКИ КОНКУРЕНТА В {engineLabel.toUpperCase()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                <MiniMetric label="ТОП-10" value={fmt(c.overview.organicKeysTop10)} />
                <MiniMetric label="ТОП-50" value={fmt(c.overview.organicKeysTop50)} />
                <MiniMetric label="Трафик / мес" value={fmt(c.overview.organicTraffic)} />
                {c.overview.adKeywords > 0 && <MiniMetric label="Ключей в контексте" value={fmt(c.overview.adKeywords)} accent="var(--warning)" />}
                {c.overview.adTraffic > 0 && <MiniMetric label="Трафик из контекста" value={fmt(c.overview.adTraffic)} />}
                {c.overview.adBudget > 0 && <MiniMetric label="Бюджет ₽/мес" value={fmtMoney(c.overview.adBudget)} accent="var(--destructive)" />}
              </div>
            </>
          )}
          {c.topAds && c.topAds.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                ТОП ОБЪЯВЛЕНИЙ ЭТОГО КОНКУРЕНТА
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {c.topAds.map((a, i) => (
                  <div key={`${a.keyword}-${i}`} style={{ padding: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: engineColor, marginBottom: 3, textTransform: "uppercase" }}>{a.keyword}</div>
                    {a.title && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{a.title}</div>}
                    {a.description && <div style={{ fontSize: 11, color: "var(--foreground-secondary)", lineHeight: 1.45 }}>{a.description}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: accent ?? "var(--foreground)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function SpywordsBlock({ data }: Props) {
  const hasYandex = !!(data.overview?.yandex || (data.competitors?.yandex?.length) || (data.ads?.yandex?.length) || (data.advCompetitors?.yandex?.length));
  const hasGoogle = !!(data.overview?.google || (data.competitors?.google?.length) || (data.ads?.google?.length) || (data.advCompetitors?.google?.length));

  const [engine, setEngine] = useState<"yandex" | "google">(hasYandex ? "yandex" : "google");

  if (!hasYandex && !hasGoogle) return null;

  const ov  = engine === "yandex" ? data.overview?.yandex : data.overview?.google;
  const cmp = engine === "yandex" ? data.competitors?.yandex : data.competitors?.google;
  const advCmp = engine === "yandex" ? data.advCompetitors?.yandex : data.advCompetitors?.google;
  const ads = engine === "yandex" ? data.ads?.yandex : data.ads?.google;
  const pages = engine === "yandex" ? data.topPages?.yandex : data.topPages?.google;

  const engineLabel = engine === "yandex" ? "Яндекс" : "Google";
  const engineColor = engine === "yandex" ? "#FF5500" : "#4285F4";

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header + Yandex/Google toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={14} /> SpyWords — органика, реклама и конкуренты
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginLeft: 8 }}>
            дополнение к Keys.so
          </span>
        </div>
        {hasYandex && hasGoogle && (
          <div style={{ display: "inline-flex", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: 2 }}>
            <button type="button" onClick={() => setEngine("yandex")}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: engine === "yandex" ? "#FF5500" : "transparent", color: engine === "yandex" ? "#fff" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Яндекс
            </button>
            <button type="button" onClick={() => setEngine("google")}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: engine === "google" ? "#4285F4" : "transparent", color: engine === "google" ? "#fff" : "var(--foreground-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Google
            </button>
          </div>
        )}
      </div>

      {/* Overview block */}
      {ov && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            ОБЗОР В {engineLabel.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {ov.organicKeysTop10 > 0 && <MetricCard icon={<BarChart2 size={12} />} label="Ключей в ТОП-10" value={fmt(ov.organicKeysTop10)} accent="var(--success)" />}
            {ov.organicKeysTop50 > 0 && <MetricCard icon={<Eye size={12} />} label="Ключей в ТОП-50" value={fmt(ov.organicKeysTop50)} />}
            {ov.organicTraffic > 0 && <MetricCard icon={<TrendingUp size={12} />} label="Трафик из органики" value={`${fmt(ov.organicTraffic)} / мес`} />}
            {ov.adKeywords > 0 && <MetricCard icon={<Target size={12} />} label="Ключей в контексте" value={fmt(ov.adKeywords)} accent="var(--warning)" />}
            {ov.uniqueAds > 0 && <MetricCard icon={<Megaphone size={12} />} label="Уник. объявлений" value={fmt(ov.uniqueAds)} />}
            {ov.adTraffic > 0 && <MetricCard icon={<Megaphone size={12} />} label="Трафик из контекста" value={`${fmt(ov.adTraffic)} / мес`} />}
            {ov.adBudget > 0 && <MetricCard icon={<Coins size={12} />} label="Бюджет на контекст" value={fmtMoney(ov.adBudget)} accent="var(--destructive)" />}
            {ov.avgAdPos > 0 && <MetricCard icon={<Target size={12} />} label="Ср. позиция" value={ov.avgAdPos.toFixed(1)} />}
          </div>
        </div>
      )}

      {/* SEO competitors with enrichment */}
      {cmp && cmp.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Swords size={11} /> SEO-КОНКУРЕНТЫ В {engineLabel.toUpperCase()} ({cmp.length})
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
            Сайты которые ранжируются по тем же запросам что и вы в органической выдаче.
            У топ-{Math.min(5, cmp.length)} развёрнут — клик по карточке покажет их метрики и топ-объявления.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cmp.slice(0, 10).map(c => (
              <CompetitorCard key={c.domain} c={c} engineColor={engineColor} engineLabel={engineLabel} />
            ))}
          </div>
        </div>
      )}

      {/* Adv competitors (separate from organic) */}
      {advCmp && advCmp.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Megaphone size={11} /> КОНКУРЕНТЫ В РЕКЛАМЕ {engineLabel.toUpperCase()} ({advCmp.length})
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
            Сайты которые выкупают те же ключи в платной выдаче что и вы. Часто это совсем
            другой список чем SEO-конкуренты выше — рекламодатели «бьются» с вами за клики
            в Я.Директе / Google Ads.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {advCmp.slice(0, 10).map(c => (
              <div key={c.domain} style={{ padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.domain}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {c.commonKeywords > 0 && <span><b style={{ color: engineColor }}>{fmt(c.commonKeywords)}</b> общих</span>}
                  {c.uniqueKeywords && c.uniqueKeywords > 0 ? <span>{fmt(c.uniqueKeywords)} уник.</span> : null}
                  {c.totalKeywords > 0 ? <span>всего {fmt(c.totalKeywords)}</span> : null}
                  {c.competitionLevel && c.competitionLevel > 0 ? <span>конкуренция {c.competitionLevel}%</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top pages */}
      {pages && pages.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={11} /> ТОП СТРАНИЦ В {engineLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
            Страницы вашего сайта, которые приносят больше всего трафика из поиска.
            «Потеряно» — сколько ключей страница перестала ранжировать с прошлого
            обновления базы SpyWords (повод для аудита).
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pages.slice(0, 10).map((p, i) => (
              <div key={`${p.url}-${i}`} style={{ padding: "10px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {p.title && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{p.title}</div>}
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none", wordBreak: "break-all", opacity: 0.85 }}>
                      {p.url}
                    </a>
                  </div>
                  {p.trafficShare > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: engineColor, whiteSpace: "nowrap" }}>
                      {p.trafficShare}% трафика
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--muted-foreground)" }}>
                  {p.top10Keys > 0 && <span><b style={{ color: "var(--success)" }}>{fmt(p.top10Keys)}</b> в ТОП-10</span>}
                  {p.top50Keys > 0 && <span>{fmt(p.top50Keys)} в ТОП-50</span>}
                  {p.lostKeys > 0 && <span style={{ color: "var(--destructive)" }}>− {fmt(p.lostKeys)} потеряно</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Our top ads */}
      {ads && ads.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Megaphone size={11} /> ВАШИ ТОП ОБЪЯВЛЕНИЙ В {engineLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
            Объявления вашего домена в платной выдаче. Сортированы по трафику.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ads.slice(0, 6).map((a, i) => (
              <div key={`${a.keyword}-${i}`} style={{
                padding: "10px 12px", background: "var(--background)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: engineColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {a.keyword}
                </div>
                {a.title && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>{a.title}</div>}
                {a.description && <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{a.description}</div>}
                {a.visibleUrl && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                    {a.visibleUrl}
                    {typeof a.position === "number" && a.position > 0 && (
                      <span style={{ marginLeft: 8 }}>· позиция {a.position}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
