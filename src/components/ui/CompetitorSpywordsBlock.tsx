"use client";

import React from "react";
import type { AnalysisResult } from "@/lib/types";
import { BarChart2, Target, TrendingUp, Coins, Eye, Megaphone, Info } from "lucide-react";
import { DonutChart } from "./Charts";

type SpywordsDashboard = NonNullable<AnalysisResult["spywordsDashboard"]>;
type CompetitorShape = NonNullable<NonNullable<SpywordsDashboard["competitors"]>["yandex"]>[number];

interface Props {
  /** Конкурент которого мы сейчас смотрим — его собственные данные SpyWords. */
  competitor: AnalysisResult;
  /** Наши данные — отсюда вытащим side-by-side сравнение и общие ключи. */
  myCompany?: AnalysisResult | null;
}

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

/** Нормализация домена для матчинга. */
function normDomain(d?: string): string {
  return (d ?? "").replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].toLowerCase();
}

export function CompetitorSpywordsBlock({ competitor, myCompany }: Props) {
  const compDomain = normDomain(competitor.company.url);
  const compSw = competitor.spywordsDashboard;
  const mySw = myCompany?.spywordsDashboard;

  // Ищем матчинг в наших Fight* данных (если этот конкурент был в топ-3
  // SEO-конкурентов нашего домена, у него заполнены commonOrganicKeys и т.д.)
  const enrichedMatch: CompetitorShape | undefined = (() => {
    if (!mySw) return undefined;
    const all = [
      ...(mySw.competitors?.yandex ?? []),
      ...(mySw.competitors?.google ?? []),
    ];
    return all.find(c => normDomain(c.domain) === compDomain);
  })();

  if (!compSw && !enrichedMatch) {
    return (
      <div style={{
        padding: "20px 18px", borderRadius: 10,
        background: "var(--background)", border: "1px dashed var(--border)",
        color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
          По этому конкуренту пока нет данных SpyWords
        </div>
        Перезапустите анализ — данные подтянутся в фоне.
      </div>
    );
  }

  // Берём Яндекс по умолчанию, fallback на Google
  const compYandex = compSw?.overview?.yandex;
  const compGoogle = compSw?.overview?.google;
  const compOverview = compYandex ?? compGoogle;
  const engineColor = compYandex ? "#FF5500" : "#4285F4";
  const engineLabel = compYandex ? "Яндекс" : "Google";

  const myYandex = mySw?.overview?.yandex;
  const myGoogle = mySw?.overview?.google;
  const myOverview = myYandex ?? myGoogle;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={14} /> SpyWords — конкурентный анализ
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginLeft: 8 }}>
            сравнение с вашим доменом
          </span>
        </div>
      </div>

      {/* Side-by-side таблица «вы vs конкурент» */}
      {compOverview && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            ВЫ vs {compDomain.toUpperCase()} — {engineLabel}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr", gap: 6, fontSize: 12 }}>
            <div style={{ padding: "5px 10px", color: "var(--muted-foreground)", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>Метрика</div>
            <div style={{ padding: "5px 10px", color: "var(--success)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>Вы</div>
            <div style={{ padding: "5px 10px", color: engineColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>{compDomain}</div>
            <div style={{ padding: "5px 10px", color: "var(--muted-foreground)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textAlign: "center" }}>Разрыв</div>

            {([
              { label: "Ключей в ТОП-10", my: myOverview?.organicKeysTop10 ?? 0, comp: compOverview.organicKeysTop10, fmt },
              { label: "Ключей в ТОП-50", my: myOverview?.organicKeysTop50 ?? 0, comp: compOverview.organicKeysTop50, fmt },
              { label: "Трафик / мес (органика)", my: myOverview?.organicTraffic ?? 0, comp: compOverview.organicTraffic, fmt },
              { label: "Ключей в контексте", my: myOverview?.adKeywords ?? 0, comp: compOverview.adKeywords, fmt },
              { label: "Трафик / мес (реклама)", my: myOverview?.adTraffic ?? 0, comp: compOverview.adTraffic, fmt },
              { label: "Бюджет на контекст", my: myOverview?.adBudget ?? 0, comp: compOverview.adBudget, fmt: fmtMoney },
            ] as const).filter(m => m.my > 0 || m.comp > 0).map((m, i) => {
              const winning = m.my >= m.comp;
              const ratio = m.comp > 0 ? (m.my / m.comp) : (m.my > 0 ? 999 : 1);
              const gap = winning
                ? (ratio >= 999 ? "—" : `+${((m.my - m.comp) / Math.max(1, m.comp) * 100).toFixed(0)}%`)
                : `−${((1 - ratio) * 100).toFixed(0)}%`;
              return (
                <React.Fragment key={i}>
                  <div style={{ padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)" }}>{m.label}</div>
                  <div style={{ padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "right", fontWeight: 700, color: winning ? "var(--success)" : "var(--foreground-secondary)" }}>{m.fmt(m.my)}</div>
                  <div style={{ padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "right", fontWeight: 700, color: !winning ? engineColor : "var(--foreground-secondary)" }}>{m.fmt(m.comp)}</div>
                  <div style={{ padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "center", fontWeight: 700, fontSize: 11, color: winning ? "var(--success)" : "var(--destructive)" }}>{gap}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Donut: трафик нашего домена vs конкурента */}
      {compOverview && myOverview && (compOverview.organicTraffic + (myOverview.organicTraffic ?? 0)) > 0 && (
        <div style={{ marginBottom: 18, padding: "16px 18px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            ДОЛЯ ТРАФИКА (ВЫ vs КОНКУРЕНТ)
          </div>
          <DonutChart
            size={150}
            ringWidth={22}
            centerLabel="всего"
            centerValue={fmt((myOverview.organicTraffic ?? 0) + compOverview.organicTraffic)}
            segments={[
              { label: "Ваш домен", value: myOverview.organicTraffic ?? 0, color: "var(--primary)" },
              { label: compDomain, value: compOverview.organicTraffic, color: engineColor },
            ]}
          />
        </div>
      )}

      {/* Общие органические ключи — пересечение через FightOrganic */}
      {enrichedMatch?.commonOrganicKeys && enrichedMatch.commonOrganicKeys.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            ОБЩИЕ ОРГАНИЧЕСКИЕ КЛЮЧИ С ВАМИ ({enrichedMatch.commonOrganicKeys.length})
            <span title="Запросы по которым и вы, и конкурент ранжируетесь в выдаче. По этим ключам идёт прямая конкуренция за место в ТОПе." style={{ cursor: "help", color: "var(--muted-foreground)", opacity: 0.5, display: "inline-flex" }}>
              <Info size={10} />
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 70px", gap: 4, maxHeight: 320, overflowY: "auto", fontSize: 11 }}>
            <div style={{ padding: "4px 8px", color: "var(--muted-foreground)", fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>Запрос</div>
            <div style={{ padding: "4px 6px", color: "var(--success)", fontWeight: 700, fontSize: 9, textTransform: "uppercase", textAlign: "center" }}>Вы</div>
            <div style={{ padding: "4px 6px", color: engineColor, fontWeight: 700, fontSize: 9, textTransform: "uppercase", textAlign: "center" }}>Он</div>
            <div style={{ padding: "4px 6px", color: "var(--muted-foreground)", fontWeight: 700, fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>Объём</div>
            {enrichedMatch.commonOrganicKeys.map((k, i) => (
              <React.Fragment key={`comm-${k.keyword}-${i}`}>
                <div style={{ padding: "5px 8px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)" }}>{k.keyword}</div>
                <div style={{ padding: "5px 6px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "center", fontWeight: 700, color: k.site1Pos && k.site1Pos <= 10 ? "var(--success)" : "var(--muted-foreground)" }}>{k.site1Pos ?? "—"}</div>
                <div style={{ padding: "5px 6px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "center", fontWeight: 700, color: k.site2Pos && k.site2Pos <= 10 ? engineColor : "var(--muted-foreground)" }}>{k.site2Pos ?? "—"}</div>
                <div style={{ padding: "5px 6px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, textAlign: "right", color: "var(--foreground-secondary)" }}>{k.volume > 0 ? fmt(k.volume) : "—"}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Топ ad-keywords конкурента — это полезно знать */}
      {compSw?.ads?.yandex && compSw.ads.yandex.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Megaphone size={11} /> ОБЪЯВЛЕНИЯ КОНКУРЕНТА В Я.ДИРЕКТЕ ({compSw.ads.yandex.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {compSw.ads.yandex.slice(0, 5).map((a, i) => (
              <div key={`ad-${a.keyword}-${i}`} style={{ padding: "10px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: engineColor, marginBottom: 4, textTransform: "uppercase" }}>{a.keyword}</div>
                {a.title && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{a.title}</div>}
                {a.description && <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{a.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Подсказка про то откуда данные */}
      <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--background)", borderRadius: 6, fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        💡 Данные получены из SpyWords FightOverview (сравнение метрик) и FightOrganic (общие ключи). На API Start доступны только общие ключи (sector=12), не органика конкурента целиком.
      </div>
    </div>
  );
}
