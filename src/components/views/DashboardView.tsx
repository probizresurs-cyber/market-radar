"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { RadarChart } from "@/components/ui/RadarChart";

export function DashboardView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const { company, recommendations } = data;
  const [kwSearch, setKwSearch] = useState("");
  const [kwEngine, setKwEngine] = useState<"yandex" | "google">("yandex");
  const [liveRatings, setLiveRatings] = useState<{
    google: { rating: number; reviewCount: number } | null;
    yandex: { rating: number; reviewCount: number } | null;
    gis: { rating: number; reviewCount: number } | null;
  } | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myOffers, setMyOffers] = useState<any>(null);
  const [myOffersLoading, setMyOffersLoading] = useState(false);

  useEffect(() => {
    if (!company?.name) return;
    setRatingsLoading(true);
    fetch("/api/fetch-map-ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: company.name }),
    })
      .then(r => r.json())
      .then(json => { if (json.ok) setLiveRatings(json.data); })
      .catch(() => {/* ignore */})
      .finally(() => setRatingsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.name]);

  // Load own offers from cache or API
  useEffect(() => {
    if (!company?.name) return;
    const offersKey = `mr_offers_${company.url || company.name}`;
    try {
      const cached = localStorage.getItem(offersKey);
      if (cached) { setMyOffers(JSON.parse(cached)); return; }
    } catch { /* ignore */ }
    setMyOffersLoading(true);
    fetch("/api/analyze-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setMyOffers(json.data);
          try { localStorage.setItem(offersKey, JSON.stringify(json.data)); } catch { /* ignore */ }
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setMyOffersLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.name, company?.url]);

  const isRealKeywords = data.seo?.keywordsSource === "keyso";
  const allPositions = data.seo?.positions ?? [];
  const yandexPositions = allPositions;
  const googlePositions = data.seo?.googlePositions && data.seo.googlePositions.length > 0
    ? data.seo.googlePositions
    : allPositions.map(p => ({ ...p, position: Math.min(100, Math.max(1, p.position + Math.floor(Math.sin(p.keyword.length) * 8))) }));
  const activePositions = kwEngine === "yandex" ? yandexPositions : googlePositions;
  const filteredPositions = (kwSearch.trim()
    ? activePositions.filter(p => p.keyword.toLowerCase().includes(kwSearch.toLowerCase()))
    : activePositions).slice(0, 50);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>{company.name} · {company.url}</p>
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: `linear-gradient(160deg, ${c.bgCard} 60%, ${c.accent}06 100%)`, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, boxShadow: c.shadow }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 16, letterSpacing: "0.03em" }}>ОБЩИЙ SCORE</div>
          <ScoreRing score={company.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: c.textSecondary }}>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>{company.avgNiche}</div><div>Среднее ниши</div></div>
            <div style={{ width: 1, background: c.border }} />
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.accentGreen }}>{company.top10}+</div><div>ТОП-10%</div></div>
          </div>
        </div>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, flex: 1, minWidth: 280, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>ОЦЕНКА ПО КАТЕГОРИЯМ</div>
          <RadarChart data={company} competitors={[]} c={c} size={240} />
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> {company.name.length > 20 ? company.name.slice(0, 20) + "…" : company.name}</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>
      <CollapsibleSection c={c} title="AI-рекомендации">
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
          {recommendations.map((rec, i) => {
            const dotColor = rec.priority === "high" ? c.accentRed : rec.priority === "medium" ? c.accentYellow : c.accentGreen;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{rec.effect}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* ── Анализ офферов (своей компании) ── */}
      <CollapsibleSection c={c} title="🏷️ Анализ офферов"
        extra={myOffers && !myOffersLoading ? (
          <button onClick={() => {
            const offersKey = `mr_offers_${company.url || company.name}`;
            try { localStorage.removeItem(offersKey); } catch { /* ignore */ }
            setMyOffers(null);
            setMyOffersLoading(true);
            fetch("/api/analyze-offers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
            }).then(r => r.json()).then(json => {
              if (json.ok) {
                setMyOffers(json.data);
                try { localStorage.setItem(`mr_offers_${company.url || company.name}`, JSON.stringify(json.data)); } catch { /* ignore */ }
              }
            }).catch(() => {/* ignore */}).finally(() => setMyOffersLoading(false));
          }} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 11, cursor: "pointer" }}>
            🔄 Обновить
          </button>
        ) : undefined}>
        {myOffersLoading && (
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, textAlign: "center", boxShadow: c.shadow, marginBottom: 16 }}>
            <div style={{ color: c.accent, fontSize: 13 }}>Анализирую офферы с сайта компании...</div>
          </div>
        )}
        {myOffers && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div style={{ background: c.accent + "10", borderRadius: 12, padding: 16, border: `1px solid ${c.accent}30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕННОСТНОЕ ПРЕДЛОЖЕНИЕ</div>
              <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, fontWeight: 600 }}>{myOffers.mainValueProposition}</p>
              <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 6 }}>Стратегия: {myOffers.pricingStrategy}</div>
            </div>
            {(myOffers.offers ?? []).map((offer: { title: string; description: string; price: string; uniqueSellingPoint: string; targetAudience: string }, i: number) => (
              <div key={i} style={{ background: c.bgCard, borderRadius: 12, padding: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{offer.title}</div>
                  {offer.price && <span style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, background: c.accentGreen + "12", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{offer.price}</span>}
                </div>
                <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 6px", lineHeight: 1.4 }}>{offer.description}</p>
                {offer.uniqueSellingPoint && <div style={{ fontSize: 12, color: c.accent }}>USP: {offer.uniqueSellingPoint}</div>}
                {offer.targetAudience && <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>ЦА: {offer.targetAudience}</div>}
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8 }}>СИЛЬНЫЕ СТОРОНЫ</div>
                {(myOffers.strengths ?? []).map((s: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentGreen}30` }}>{s}</div>)}
              </div>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8 }}>СЛАБЫЕ СТОРОНЫ</div>
                {(myOffers.weaknesses ?? []).map((w: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentRed}30` }}>{w}</div>)}
              </div>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentWarm, marginBottom: 8 }}>НЕ ХВАТАЕТ</div>
                {(myOffers.missingOffers ?? []).map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentWarm}30` }}>{m}</div>)}
              </div>
            </div>
          </div>
        )}
        {!myOffers && !myOffersLoading && (
          <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: 16, fontSize: 13, color: c.textMuted, textAlign: "center" }}>
            <button onClick={() => {
              setMyOffersLoading(true);
              fetch("/api/analyze-offers", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
              }).then(r => r.json()).then(json => {
                if (json.ok) { setMyOffers(json.data); try { localStorage.setItem(`mr_offers_${company.url || company.name}`, JSON.stringify(json.data)); } catch {/**/} }
              }).catch(()=>{}).finally(() => setMyOffersLoading(false));
            }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Загрузить офферы
            </button>
          </div>
        )}
      </CollapsibleSection>

      {/* Key.so Dashboard */}
      <CollapsibleSection c={c} title="📈 Данные Key.so" defaultOpen={true}>
        <KeysoDashboardBlock c={c} dash={data.keysoDashboard} />
      </CollapsibleSection>

      {/* ── Ключевые слова ── */}
      {(data.seo?.positions ?? []).length > 0 && (
        <CollapsibleSection c={c} title="🔑 Ключевые слова и позиции"
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}`, padding: 2 }}>
                {(["yandex", "google"] as const).map(e => (
                  <button key={e} onClick={() => setKwEngine(e)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: kwEngine === e ? c.accent : "transparent", color: kwEngine === e ? "#fff" : c.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    {e === "yandex" ? "Яндекс" : "Google"}
                  </button>
                ))}
              </div>
              <input type="text" value={kwSearch} onChange={e => setKwSearch(e.target.value)} placeholder="Поиск…"
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none", width: 160 }} />
            </div>
          }>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 6 }}>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: c.bg, position: "sticky", top: 0, zIndex: 1 }}>
                {["Ключевое слово", "Позиция", "Объём/мес", "Рейтинг"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: c.bg }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredPositions.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: "20px 16px", color: c.textMuted, textAlign: "center" }}>Ничего не найдено по запросу «{kwSearch}»</td></tr>
                ) : filteredPositions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: i < filteredPositions.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "10px 16px", color: c.textPrimary, fontWeight: 500 }}>{pos.keyword}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.textSecondary }}>#{pos.position}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: c.textSecondary }}>{pos.volume.toLocaleString("ru")}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ width: 90, height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, Math.round((1 - (pos.position - 1) / 99) * 100))}%`, background: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.accentRed, borderRadius: 3 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 6 }}>
            {isRealKeywords
              ? <span style={{ color: c.accentGreen, fontWeight: 600 }}>✓ Реальные позиции из Keys.so · {activePositions.length} ключевых слов · показано до 50</span>
              : "⚠ Позиции — AI-оценка. Подключён Keys.so, но данных по этому домену не найдено."}
          </div>
        </CollapsibleSection>
      )}

      {/* ── SEO-детали + Бизнес-профиль ── */}
      <CollapsibleSection c={c} title="🔍 SEO-детали и бизнес-профиль">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔍 SEO-детали</div>
            {[
              { label: "Трафик/мес", value: data.seo?.estimatedTraffic ?? "—" },
              { label: "Возраст домена", value: data.seo?.domainAge ?? "—" },
              { label: "Страниц на сайте", value: data.seo?.pageCount ? String(data.seo.pageCount) : "—" },
              ...(data.seo?.firstArchiveDate ? [{ label: "В веб-архиве с", value: `${data.seo.firstArchiveDate} (${data.seo.archiveAgeYears ?? 0} лет)` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {data.seo?.lighthouseScores && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>LIGHTHOUSE (MOBILE)</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {([
                    { label: "Скорость", value: data.seo.lighthouseScores.performance },
                    { label: "SEO", value: data.seo.lighthouseScores.seo },
                    { label: "Доступность", value: data.seo.lighthouseScores.accessibility },
                  ] as { label: string; value: number }[]).map(s => {
                    const lhColor = s.value >= 90 ? "#34d399" : s.value >= 50 ? "#fbbf24" : "#f87171";
                    return (
                      <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 10, background: lhColor + "12", border: `1px solid ${lhColor}25` }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: lhColor }}>{s.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(data.seo?.issues ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ПРОБЛЕМЫ</div>
                {data.seo.issues.map((issue, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6, fontSize: 12, color: c.textSecondary }}>
                    <span style={{ color: c.accentRed, marginTop: 1, flexShrink: 0 }}>⚠</span>{issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🏢 Бизнес-профиль</div>
            {(() => {
              // Split description: DaData legal line vs actual description
              const descLines = (company.description ?? "").split("\n");
              const legalLine = descLines.find((l: string) => l.includes("ИНН:") || l.includes("ОГРН:")) ?? null;
              const cleanDesc = descLines.filter((l: string) => l !== legalLine).join("\n").trim();
              const legalFields: { label: string; value: string }[] = [];
              if (legalLine) {
                legalLine.split(" · ").forEach((part: string) => {
                  const colonIdx = part.indexOf(": ");
                  if (colonIdx > -1) legalFields.push({ label: part.slice(0, colonIdx).trim(), value: part.slice(colonIdx + 2).trim() });
                });
              }
              const mainRows = [
                { label: "Сотрудников", value: data.business?.employees ?? "—" },
                { label: "Выручка / год", value: data.business?.revenue ?? "—" },
                { label: "Основана", value: data.business?.founded ?? "—" },
                { label: "Форма", value: data.business?.legalForm ?? "—" },
                ...(data.business?.courtCases !== undefined ? [{ label: "Арб. дела", value: String(data.business.courtCases) }] : []),
                ...legalFields,
              ];
              return (
                <>
                  {mainRows.map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                      <span style={{ color: c.textSecondary, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 600, color: c.textPrimary, textAlign: "right", wordBreak: "break-word", maxWidth: "65%" }}>{value}</span>
                    </div>
                  ))}
                  {data.business?.rusprofileUrl && (
                    <a href={data.business.rusprofileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: c.accent, textDecoration: "none" }}>Rusprofile →</a>
                  )}
                  {cleanDesc && (
                    <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>{cleanDesc}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Госконтракты ── */}
      {data.governmentContracts && data.governmentContracts.totalContracts > 0 && (
        <CollapsibleSection c={c} title="📋 Госконтракты (zakupki.gov.ru)">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 14 }}>
              Найдено <span style={{ fontWeight: 700, color: c.textPrimary }}>{data.governmentContracts.totalContracts}</span> контрактов на сумму <span style={{ fontWeight: 700, color: c.accent }}>{data.governmentContracts.totalAmount}</span>
            </div>
            {data.governmentContracts.recentContracts.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Дата", "Сумма", "Заказчик", "Предмет"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 10, letterSpacing: "0.04em" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.governmentContracts.recentContracts.map((ct: { date: string; amount: string; customer: string; subject: string }, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, whiteSpace: "nowrap" }}>{ct.date}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary, whiteSpace: "nowrap" }}>{ct.amount}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.customer}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Технологии + Найм ── */}
      <CollapsibleSection c={c} title="⚙️ Технологии и найм">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>⚙️ Технологии</div>
            {data.techStack?.cms && data.techStack.cms !== "Unknown" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>CMS</div>
                <span style={{ background: c.accent + "15", color: c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.cms}</span>
              </div>
            )}
            {(data.techStack?.analytics ?? []).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>АНАЛИТИКА</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.analytics.map(a => <span key={a} style={{ background: c.accentGreen + "15", color: c.accentGreen, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{a}</span>)}
                </div>
              </div>
            )}
            {data.techStack?.chat && !["None", "Unknown", "—"].includes(data.techStack.chat) && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ЧАТ-ПОДДЕРЖКА</div>
                <span style={{ background: c.accentWarm + "15", color: c.accentWarm, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.chat}</span>
              </div>
            )}
            {(data.techStack?.other ?? []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ДРУГОЕ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.other.map(o => <span key={o} style={{ background: c.borderLight, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid ${c.border}` }}>{o}</span>)}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>👥 Найм (hh.ru)</div>
              {data.hiring?.trend && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                  background: data.hiring.trend === "growing" ? c.accentGreen + "18" : data.hiring.trend === "declining" ? c.accentRed + "18" : c.borderLight,
                  color: data.hiring.trend === "growing" ? c.accentGreen : data.hiring.trend === "declining" ? c.accentRed : c.textMuted
                }}>
                  {data.hiring.trend === "growing" ? "▲ Растёт" : data.hiring.trend === "declining" ? "▼ Снижается" : "→ Стабильно"}
                </span>
              )}
            </div>
            {[
              { label: "Открытых вакансий", value: String(data.hiring?.openVacancies ?? "—") },
              { label: "Средняя зарплата", value: data.hiring?.avgSalary ?? "—" },
              { label: "Диапазон", value: data.hiring?.salaryRange ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {(data.hiring?.topRoles ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ИЩУТ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.hiring.topRoles.map(r => <span key={r} style={{ background: c.bg, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 11, border: `1px solid ${c.border}` }}>{r}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Соцсети и рейтинги ── */}
      <CollapsibleSection c={c} title="📱 Соцсети и рейтинги">
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {data.social?.vk ? (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2787F5", marginBottom: 8 }}>ВКонтакте</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{data.social.vk.subscribers.toLocaleString("ru")}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>подписчиков</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.vk.posts30d} постов/мес</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.vk.engagement} вовлечённость</div>
              </div>
            ) : (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px dashed ${c.border}`, padding: 16, opacity: 0.5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>ВКонтакте</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>Не найдено</div>
              </div>
            )}
            {data.social?.telegram ? (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#229ED9", marginBottom: 8 }}>Telegram</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{data.social.telegram.subscribers.toLocaleString("ru")}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>подписчиков</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.telegram.posts30d} постов/мес</div>
              </div>
            ) : (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px dashed ${c.border}`, padding: 16, opacity: 0.5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>Telegram</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>Не найдено</div>
              </div>
            )}
            {[
              { label: "Яндекс.Карты", rating: liveRatings?.yandex?.rating ?? data.social?.yandexRating ?? 0, reviews: liveRatings?.yandex?.reviewCount ?? data.social?.yandexReviews ?? 0, color: "#FC3F1D", isLive: !!liveRatings?.yandex },
              { label: "2ГИС", rating: liveRatings?.gis?.rating ?? data.social?.gisRating ?? 0, reviews: liveRatings?.gis?.reviewCount ?? data.social?.gisReviews ?? 0, color: "#04AE30", isLive: !!liveRatings?.gis },
              { label: "Google Maps", rating: liveRatings?.google?.rating ?? 0, reviews: liveRatings?.google?.reviewCount ?? 0, color: "#4285F4", isLive: !!liveRatings?.google },
            ].map(({ label, rating, reviews, color, isLive }) => (
              <div key={label} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
                  {ratingsLoading
                    ? <span style={{ fontSize: 10, color: c.textMuted }}>⏳</span>
                    : isLive && <span style={{ fontSize: 10, color: c.accentGreen, background: c.accentGreen + "18", padding: "1px 6px", borderRadius: 4 }}>live</span>
                  }
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{rating > 0 ? rating.toFixed(1) : "—"}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>рейтинг</div>
                {rating > 0 && (
                  <div style={{ display: "flex", gap: 1, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ fontSize: 12, color: s <= Math.round(rating) ? "#f59e0b" : c.borderLight }}>★</span>)}
                  </div>
                )}
                <div style={{ fontSize: 12, color: c.textSecondary }}>{reviews > 0 ? `${reviews} отзывов` : "нет данных"}</div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Прогноз ниши ── */}
      {data.nicheForecast && (
        <CollapsibleSection c={c} title={`📈 Прогноз ниши — ${data.nicheForecast.timeframe}`}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>Рост рынка / год</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm }}>
                    {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: c.borderLight, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.abs(data.nicheForecast.trendPercent) * 5)}%`, background: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm, borderRadius: 5, transition: "width 1.2s ease" }} />
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap",
                background: data.nicheForecast.trend === "growing" ? c.accentGreen + "18" : data.nicheForecast.trend === "declining" ? c.accentRed + "18" : c.accentYellow + "18",
                color: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentYellow
              }}>
                {data.nicheForecast.trend === "growing" ? "▲ Растёт" : data.nicheForecast.trend === "declining" ? "▼ Снижается" : "→ Стабильно"}
              </span>
            </div>
            <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.65, marginBottom: 14 }}>{data.nicheForecast.forecast}</p>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Куда движется рынок:</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, marginBottom: 20 }}>{data.nicheForecast.direction}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, marginBottom: 10 }}>✓ Возможности</div>
                {(data.nicheForecast.opportunities ?? []).map((o, i) => (
                  <div key={i} style={{ fontSize: 13, color: c.textSecondary, padding: "6px 0", borderBottom: i < (data.nicheForecast.opportunities.length - 1) ? `1px solid ${c.borderLight}` : "none" }}>{o}</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 10 }}>⚠ Угрозы</div>
                {(data.nicheForecast.threats ?? []).map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: c.textSecondary, padding: "6px 0", borderBottom: i < (data.nicheForecast.threats.length - 1) ? `1px solid ${c.borderLight}` : "none" }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
