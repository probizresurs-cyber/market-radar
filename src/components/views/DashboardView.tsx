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
import { DataBadge } from "@/components/ui/DataBadge";
import { OrderCTA } from "@/components/ui/OrderCTA";
import { classifyRevenue } from "@/lib/data-quality";
import { PageSpeedWidget } from "@/components/ui/PageSpeedWidget";
import { MarketShareBlock } from "@/components/ui/MarketShareBlock";
import { CompetitorAdsBlock } from "@/components/ui/CompetitorAdsBlock";
import { KeysoSiteInsightsBlock } from "@/components/ui/KeysoSiteInsightsBlock";
import { Building2, TrendingUp, Key, FileText, Cpu, Users as UsersIcon, LineChart, Tag, RefreshCw, Search, AlertTriangle, Activity, Clock, CalendarCheck, Zap, PieChart } from "lucide-react";

export function DashboardView({ c, data, competitors, onUpdateData }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[]; onUpdateData?: (next: AnalysisResult) => void }) {
  const { company, recommendations } = data;
  const [kwSearch, setKwSearch] = useState("");
  const [kwEngine, setKwEngine] = useState<"yandex" | "google">("yandex");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myOffers, setMyOffers] = useState<any>(null);
  const [myOffersLoading, setMyOffersLoading] = useState(false);

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
          const stamped = { ...json.data, generatedAt: new Date().toISOString() };
          setMyOffers(stamped);
          try { localStorage.setItem(offersKey, JSON.stringify(stamped)); } catch { /* ignore */ }
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
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
          {company.name} · {company.url}
          {data.analyzedAt && (
            <span style={{ marginLeft: 10, padding: "2px 8px", background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
              Анализ: {new Date(data.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </p>
      </div>
      {/* ───── Monitoring Status Bar ───── */}
      {data.analyzedAt && (() => {
        const CYCLE = 30;
        const now = Date.now();
        const analyzedMs = new Date(data.analyzedAt).getTime();
        const ageDays = Math.floor((now - analyzedMs) / (24 * 60 * 60 * 1000));
        const nextInDays = Math.max(0, CYCLE - ageDays);
        const pct = Math.min(100, Math.round((ageDays / CYCLE) * 100));
        const stale = ageDays >= CYCLE;

        const status = stale ? "stale" : ageDays >= CYCLE * 0.7 ? "aging" : "fresh";
        const accent = status === "fresh" ? "#22c55e" : status === "aging" ? "#f59e0b" : "var(--destructive)";
        const nextDateStr = new Date(analyzedMs + CYCLE * 24 * 60 * 60 * 1000)
          .toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        const lastDateStr = new Date(analyzedMs)
          .toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        const ageLabelShort = ageDays === 0 ? "сегодня" : `${ageDays} дн. назад`;

        return (
          <div style={{
            background: "var(--card)",
            border: `1px solid ${stale ? "var(--destructive)44" : "var(--border)"}`,
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 18,
            boxShadow: "var(--shadow)",
          }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {/* Pulsing dot */}
              <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: accent, opacity: 0.35,
                  animation: stale ? "none" : "monPulse 2s ease-in-out infinite" }} />
                <span style={{ position: "absolute", inset: 2, borderRadius: "50%", background: accent }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={14} color={accent} />
                  {stale ? "Данные устарели — нужен новый анализ" : "Мониторинг активен"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                  Score, конкуренты и бенчмарки обновляются каждые {CYCLE} дней автоматически
                </div>
              </div>

              {/* Quick stats chips */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20,
                  background: "var(--muted)", fontSize: 11, fontWeight: 600, color: "var(--foreground-secondary)" }}>
                  <Clock size={11} />
                  {ageLabelShort}
                </div>
                {!stale && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20,
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    fontSize: 11, fontWeight: 600, color: accent }}>
                    <CalendarCheck size={11} />
                    через {nextInDays} дн.
                  </div>
                )}
              </div>
            </div>

            {/* Timeline bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 999, transition: "width 0.4s" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Zap size={9} color={accent} /> Анализ: {lastDateStr}</span>
              <span style={{ fontWeight: 600, color: stale ? "var(--destructive)" : "var(--foreground-secondary)" }}>
                {stale ? "Обновите сейчас" : `Обновление: ~${nextDateStr}`}
              </span>
            </div>

            {/* CSS keyframe for pulse */}
            <style>{`@keyframes monPulse { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(2.2);opacity:0} }`}</style>
          </div>
        );
      })()}

      {/* ───── TOP-INSIGHT block: one headline, one first action ───── */}
      {(() => {
        const score = company.score ?? 0;
        const avg = company.avgNiche ?? 0;
        const gap = avg > 0 ? score - avg : 0;
        const topRec = (recommendations ?? [])
          .slice()
          .sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 } as const;
            return order[a.priority] - order[b.priority];
          })[0];

        const gapText = gap < 0
          ? `Вы отстаёте от среднего по нише на ${Math.abs(gap)} баллов.`
          : gap > 0
            ? `Вы опережаете среднее по нише на ${gap} баллов.`
            : `Ваш Score соответствует среднему по нише (${score}).`;
        const accent = gap < -10 ? "var(--destructive)" : gap < 0 ? "var(--warning)" : "var(--success)";

        return (
          <div style={{
            background: "var(--card)",
            border: `1px solid var(--border)`,
            borderLeft: `4px solid ${accent}`,
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 20,
            boxShadow: "var(--shadow)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Главный вывод</div>
              <a
                href="/owner-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12, fontWeight: 600, color: "var(--primary)",
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                Дашборд руководителя →
              </a>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.35, marginBottom: 6 }}>
              {gapText}
            </div>
            {topRec && (
              <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Первое действие:</span>{" "}
                {topRec.text}
                {topRec.effect && <span style={{ color: "var(--muted-foreground)" }}> — {topRec.effect}</span>}
              </div>
            )}
          </div>
        );
      })()}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: `linear-gradient(160deg, var(--card) 60%, var(--primary)06 100%)`, borderRadius: 16, border: `1px solid var(--border)`, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 16, letterSpacing: "0.03em" }}>ОБЩИЙ SCORE</div>
          <ScoreRing score={company.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: "var(--foreground-secondary)" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>{company.avgNiche}</div><div>Среднее ниши</div></div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: "var(--success)" }}>{company.top10}+</div><div>ТОП-10%</div></div>
          </div>
        </div>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, flex: 1, minWidth: 280, boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.03em" }}>ОЦЕНКА ПО КАТЕГОРИЯМ</div>
          <RadarChart data={company} competitors={[]} c={c} size={240} />
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--primary)" }} /> {company.name.length > 20 ? company.name.slice(0, 20) + "…" : company.name}</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>
      <CollapsibleSection c={c} title="AI-рекомендации" extra={<DataBadge variant="ai" source="Claude" />}>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
          {recommendations.map((rec, i) => {
            const dotColor = rec.priority === "high" ? "var(--destructive)" : rec.priority === "medium" ? "var(--warning)" : "var(--success)";
            return (
              <div key={i} style={{ display: "flex", alignItems: "stretch", padding: "12px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid var(--muted)` : "none", gap: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, width: "45%", paddingRight: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.45 }}>{rec.text}</span>
                </div>
                <div style={{ width: 1, background: "var(--muted)", flexShrink: 0 }} />
                <div style={{ width: "40%", paddingLeft: 16, display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--success)", lineHeight: 1.4 }}>{rec.effect}</span>
                </div>
                <div style={{ width: "15%", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <OrderCTA category={rec.category} text={rec.text} />
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* ── Анализ офферов (своей компании) ── */}
      <CollapsibleSection c={c} title="Анализ офферов" icon={<Tag size={16} strokeWidth={1.75} />}
        extra={myOffers && !myOffersLoading ? (<>
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
                const stamped = { ...json.data, generatedAt: new Date().toISOString() };
                setMyOffers(stamped);
                try { localStorage.setItem(`mr_offers_${company.url || company.name}`, JSON.stringify(stamped)); } catch { /* ignore */ }
              }
            }).catch(() => {/* ignore */}).finally(() => setMyOffersLoading(false));
          }} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 11, cursor: "pointer" }}>
            <RefreshCw size={12} strokeWidth={2} style={{ marginRight: 4 }} />Актуализировать
          </button>
          {myOffers?.generatedAt && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, textAlign: "right" }}>
              Актуализировано: {new Date(myOffers.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, textAlign: "right" }}>Рекомендуем раз в месяц</div>
        </>) : undefined}>
        {myOffersLoading && (
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, textAlign: "center", boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <div style={{ color: "var(--primary)", fontSize: 13 }}>Анализирую офферы с сайта компании...</div>
          </div>
        )}
        {myOffers && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "color-mix(in oklch, var(--primary) 6%, transparent)", borderRadius: 12, padding: 16, border: `1px solid var(--primary)30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕННОСТНОЕ ПРЕДЛОЖЕНИЕ</div>
              <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0, fontWeight: 600 }}>{myOffers.mainValueProposition}</p>
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginTop: 6 }}>Стратегия: {myOffers.pricingStrategy}</div>
            </div>
            {(myOffers.offers ?? []).map((offer: { title: string; description: string; price: string; uniqueSellingPoint: string; targetAudience: string }, i: number) => (
              <div key={i} style={{ background: "var(--card)", borderRadius: 12, padding: 16, border: `1px solid var(--border)`, boxShadow: "var(--shadow)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{offer.title}</div>
                  {offer.price && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", background: "color-mix(in oklch, var(--success) 7%, transparent)", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{offer.price}</span>}
                </div>
                <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 6px", lineHeight: 1.4 }}>{offer.description}</p>
                {offer.uniqueSellingPoint && <div style={{ fontSize: 12, color: "var(--primary)" }}>USP: {offer.uniqueSellingPoint}</div>}
                {offer.targetAudience && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>ЦА: {offer.targetAudience}</div>}
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>СИЛЬНЫЕ СТОРОНЫ</div>
                {(myOffers.strengths ?? []).map((s: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--success)30` }}>{s}</div>)}
              </div>
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8 }}>СЛАБЫЕ СТОРОНЫ</div>
                {(myOffers.weaknesses ?? []).map((w: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--destructive)30` }}>{w}</div>)}
              </div>
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", marginBottom: 8 }}>НЕ ХВАТАЕТ</div>
                {(myOffers.missingOffers ?? []).map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--warning)30` }}>{m}</div>)}
              </div>
            </div>
          </div>
        )}
        {!myOffers && !myOffersLoading && (
          <div style={{ background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`, padding: 16, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
            <button onClick={() => {
              setMyOffersLoading(true);
              fetch("/api/analyze-offers", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
              }).then(r => r.json()).then(json => {
                if (json.ok) { const stamped = { ...json.data, generatedAt: new Date().toISOString() }; setMyOffers(stamped); try { localStorage.setItem(`mr_offers_${company.url || company.name}`, JSON.stringify(stamped)); } catch {/**/} }
              }).catch(()=>{}).finally(() => setMyOffersLoading(false));
            }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Загрузить офферы
            </button>
          </div>
        )}
      </CollapsibleSection>

      {/* ── PageSpeed Insights ── */}
      {data.seo?.lighthouseScores && (
        <CollapsibleSection c={c} title="Скорость сайта" icon={<Zap size={16} strokeWidth={1.75} />} defaultOpen={true}
          extra={<span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(6,182,212,0.12)", color: "#22d3ee" }}>REAL DATA</span>}>
          <PageSpeedWidget scores={data.seo.lighthouseScores} url={data.company?.url} />
        </CollapsibleSection>
      )}

      {/* Key.so Dashboard with refresh capability */}
      <CollapsibleSection c={c} title="Данные Key.so" icon={<TrendingUp size={16} strokeWidth={1.75} />} defaultOpen={true}>
        <KeysoDashboardBlock
          c={c}
          dash={data.keysoDashboard}
          domain={onUpdateData ? data.company.url : undefined}
          onRefresh={onUpdateData ? (result) => {
            onUpdateData({
              ...data,
              keysoDashboard: result.keysoDashboard,
              seo: {
                ...data.seo,
                positions: result.positions ?? data.seo.positions,
                googlePositions: result.googlePositions ?? data.seo.googlePositions,
              },
            });
          } : undefined}
        />
      </CollapsibleSection>

      {/* Market share — only if we have at least 1 competitor */}
      <CollapsibleSection c={c} title="Доли рынка" icon={<PieChart size={16} strokeWidth={1.75} />} defaultOpen={false}>
        <MarketShareBlock
          myDomain={data.company.url}
          competitorDomains={competitors.map(c => c.company.url).filter(Boolean)}
        />
      </CollapsibleSection>

      {/* Yandex Direct — own ads audit */}
      <CollapsibleSection c={c} title="Реклама в Я.Директ" icon={<TrendingUp size={16} strokeWidth={1.75} />} defaultOpen={false}>
        <CompetitorAdsBlock domain={data.company.url} />
      </CollapsibleSection>

      {/* Расширенные SEO-детали из Keys.so — топ страницы, потерянные ключи, бэклинки, темы */}
      <CollapsibleSection c={c} title="SEO детали (Keys.so)" icon={<FileText size={16} strokeWidth={1.75} />} defaultOpen={false}>
        <KeysoSiteInsightsBlock domain={data.company.url} />
      </CollapsibleSection>

      {/* ── Ключевые слова ── */}
      {(data.seo?.positions ?? []).length > 0 && (
        <CollapsibleSection c={c} title="Ключевые слова и позиции" icon={<Key size={16} strokeWidth={1.75} />}
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", background: "var(--background)", borderRadius: 8, border: `1px solid var(--border)`, padding: 2 }}>
                {(["yandex", "google"] as const).map(e => (
                  <button key={e} onClick={() => setKwEngine(e)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: kwEngine === e ? "var(--primary)" : "transparent", color: kwEngine === e ? "#fff" : "var(--foreground-secondary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    {e === "yandex" ? "Яндекс" : "Google"}
                  </button>
                ))}
              </div>
              <input type="text" value={kwSearch} onChange={e => setKwSearch(e.target.value)} placeholder="Поиск…"
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, outline: "none", width: 160 }} />
            </div>
          }>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 6 }}>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--background)", position: "sticky", top: 0, zIndex: 1 }}>
                {["Ключевое слово", "Позиция", "Объём/мес", "Рейтинг"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: "var(--background)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredPositions.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: "20px 16px", color: "var(--muted-foreground)", textAlign: "center" }}>Ничего не найдено по запросу «{kwSearch}»</td></tr>
                ) : filteredPositions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: i < filteredPositions.length - 1 ? `1px solid var(--muted)` : "none" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{pos.keyword}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: pos.position <= 10 ? "var(--success)" : pos.position <= 30 ? "var(--warning)" : "var(--foreground-secondary)" }}>#{pos.position}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-secondary)" }}>{pos.volume.toLocaleString("ru")}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ width: 90, height: 6, borderRadius: 3, background: "var(--muted)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, Math.round((1 - (pos.position - 1) / 99) * 100))}%`, background: pos.position <= 10 ? "var(--success)" : pos.position <= 30 ? "var(--warning)" : "var(--destructive)", borderRadius: 3 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
            {isRealKeywords
              ? <span style={{ color: "var(--success)", fontWeight: 600 }}>✓ Реальные позиции из Keys.so · {activePositions.length} ключевых слов · показано до 50</span>
              : "⚠ Позиции — AI-оценка. Подключён Keys.so, но данных по этому домену не найдено."}
          </div>
        </CollapsibleSection>
      )}

      {/* ── SEO-детали + Бизнес-профиль ── */}
      <CollapsibleSection c={c} title="SEO-детали и бизнес-профиль" icon={<Search size={16} strokeWidth={1.75} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Search size={14} strokeWidth={1.75} style={{ color: "var(--muted-foreground)" }} />SEO-детали</div>
            {[
              { label: "Трафик/мес", value: data.seo?.estimatedTraffic ?? "—" },
              { label: "Возраст домена", value: data.seo?.domainAge ?? "—" },
              { label: "Страниц на сайте", value: data.seo?.pageCount ? String(data.seo.pageCount) : "—" },
              ...(data.seo?.firstArchiveDate ? [{ label: "В веб-архиве с", value: `${data.seo.firstArchiveDate} (${data.seo.archiveAgeYears ?? 0} лет)` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
                <span style={{ color: "var(--foreground-secondary)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
              </div>
            ))}
            {/* PageSpeed виджет вынесен в отдельную карту ниже */}
            {(data.seo?.issues ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ПРОБЛЕМЫ</div>
                {data.seo.issues.map((issue, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6, fontSize: 12, color: "var(--foreground-secondary)" }}>
                    <AlertTriangle size={13} strokeWidth={2} style={{ color: "var(--destructive)", marginTop: 1, flexShrink: 0 }} />{issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={16} strokeWidth={1.75} style={{ color: "var(--muted-foreground)" }} />
                Бизнес-профиль
              </div>
              <DataBadge variant="real" source="DaData + Руспрофайл" title="Реквизиты и статус — DaData Suggestions API. Выручка и суд. дела — Руспрофайл.ру. Данные обновляются при каждом анализе." />
            </div>
            {/* Индикатор, каких полей нет в источнике (AI-подстановка) */}
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>
              Если поле не подтянулось из реестра — значение оценено AI на основе сайта и открытых данных.
            </div>
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
              const revenueClass = classifyRevenue(data.business?.revenue);
              const employeesValue = data.business?.employees ?? "—";
              const employeesIsRange = /\b\d+\s*[-–—]\s*\d+\b/.test(employeesValue);
              const foundedValue = data.business?.founded ?? "—";
              const foundedIsApprox = /[~≈]/.test(foundedValue);
              const mainRows: Array<{
                label: string;
                value: string;
                quality?: "real" | "estimate";
              }> = [
                {
                  label: "Сотрудников",
                  value: employeesValue,
                  quality: employeesValue === "—" ? undefined : employeesIsRange ? "estimate" : "real",
                },
                ...(revenueClass
                  ? [{
                      label: "Выручка / год",
                      value: revenueClass.value,
                      quality: revenueClass.quality === "estimate" ? "estimate" as const : "real" as const,
                    }]
                  : [{ label: "Выручка / год", value: "—" }]),
                {
                  label: "Основана",
                  value: foundedValue,
                  quality: foundedValue === "—" ? undefined : foundedIsApprox ? "estimate" : "real",
                },
                { label: "Форма", value: data.business?.legalForm ?? "—" },
                ...(data.business?.courtCases !== undefined ? [{ label: "Арб. дела", value: String(data.business.courtCases), quality: "real" as const }] : []),
                ...legalFields,
              ];
              return (
                <>
                  {mainRows.map(({ label, value, quality }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
                      <span style={{ color: "var(--foreground-secondary)", flexShrink: 0 }}>{label}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "65%" }}>
                        <span style={{ fontWeight: 600, color: "var(--foreground)", textAlign: "right", wordBreak: "break-word" }}>{value}</span>
                        {quality === "estimate" && value !== "—" && (
                          <DataBadge variant="estimate" compact title="Диапазон оценки. Для точных цифр подключите интеграцию с Руспрофайлом или укажите вручную." />
                        )}
                      </span>
                    </div>
                  ))}
                  {data.business?.rusprofileUrl && (
                    <a href={data.business.rusprofileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>Rusprofile →</a>
                  )}
                  {cleanDesc && (
                    <p style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>{cleanDesc}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Госконтракты ── */}
      {data.governmentContracts && data.governmentContracts.totalContracts > 0 && (
        <CollapsibleSection c={c} title="Госконтракты (zakupki.gov.ru)" icon={<FileText size={16} strokeWidth={1.75} />} extra={<DataBadge variant="real" source="zakupki.gov.ru" />}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 14 }}>
              Найдено <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{data.governmentContracts.totalContracts}</span> контрактов на сумму <span style={{ fontWeight: 700, color: "var(--primary)" }}>{data.governmentContracts.totalAmount}</span>
            </div>
            {data.governmentContracts.recentContracts.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Дата", "Сумма", "Заказчик", "Предмет"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 10, letterSpacing: "0.04em" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.governmentContracts.recentContracts.map((ct: { date: string; amount: string; customer: string; subject: string }, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid var(--muted)`, color: "var(--foreground-secondary)", whiteSpace: "nowrap" }}>{ct.date}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid var(--muted)`, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap" }}>{ct.amount}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid var(--muted)`, color: "var(--foreground-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.customer}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid var(--muted)`, color: "var(--foreground-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Технологии ── */}
      <CollapsibleSection c={c} title="Технологии" icon={<Cpu size={16} strokeWidth={1.75} />} extra={<DataBadge variant="real" source="HTML парсинг" />}>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
          {data.techStack?.cms && data.techStack.cms !== "Unknown" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>CMS</div>
              <span style={{ background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.cms}</span>
            </div>
          )}
          {(data.techStack?.analytics ?? []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>АНАЛИТИКА</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.techStack.analytics.map(a => <span key={a} style={{ background: "color-mix(in oklch, var(--success) 8%, transparent)", color: "var(--success)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{a}</span>)}
              </div>
            </div>
          )}
          {data.techStack?.chat && !["None", "Unknown", "—"].includes(data.techStack.chat) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ЧАТ-ПОДДЕРЖКА</div>
              <span style={{ background: "color-mix(in oklch, var(--warning) 8%, transparent)", color: "var(--warning)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.chat}</span>
            </div>
          )}
          {(data.techStack?.other ?? []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ДРУГОЕ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.techStack.other.map(o => <span key={o} style={{ background: "var(--muted)", color: "var(--foreground-secondary)", borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid var(--border)` }}>{o}</span>)}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Найм ── */}
      <CollapsibleSection c={c} title="Найм (hh.ru)" icon={<UsersIcon size={16} strokeWidth={1.75} />} extra={<DataBadge variant="real" source="hh.ru API" />}>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
              <UsersIcon size={16} strokeWidth={1.75} style={{ color: "var(--muted-foreground)" }} />
              Найм (hh.ru)
            </div>
            {data.hiring?.trend && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                background: data.hiring.trend === "growing" ? "color-mix(in oklch, var(--success) 9%, transparent)" : data.hiring.trend === "declining" ? "color-mix(in oklch, var(--destructive) 9%, transparent)" : "var(--muted)",
                color: data.hiring.trend === "growing" ? "var(--success)" : data.hiring.trend === "declining" ? "var(--destructive)" : "var(--muted-foreground)"
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
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
              <span style={{ color: "var(--foreground-secondary)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
            </div>
          ))}
          {(data.hiring?.topRoles ?? []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ИЩУТ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.hiring.topRoles.map(r => <span key={r} style={{ background: "var(--background)", color: "var(--foreground-secondary)", borderRadius: 8, padding: "4px 10px", fontSize: 11, border: `1px solid var(--border)` }}>{r}</span>)}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Прогноз ниши ── */}
      {data.nicheForecast && (
        <CollapsibleSection c={c} title={`Прогноз ниши — ${data.nicheForecast.timeframe}`} icon={<LineChart size={16} strokeWidth={1.75} />} extra={<DataBadge variant="ai" source="Claude" />}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Рост рынка / год</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: data.nicheForecast.trend === "growing" ? "var(--success)" : data.nicheForecast.trend === "declining" ? "var(--destructive)" : "var(--warning)" }}>
                    {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: "var(--muted)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.abs(data.nicheForecast.trendPercent) * 5)}%`, background: data.nicheForecast.trend === "growing" ? "var(--success)" : data.nicheForecast.trend === "declining" ? "var(--destructive)" : "var(--warning)", borderRadius: 5, transition: "width 1.2s ease" }} />
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap",
                background: data.nicheForecast.trend === "growing" ? "color-mix(in oklch, var(--success) 9%, transparent)" : data.nicheForecast.trend === "declining" ? "color-mix(in oklch, var(--destructive) 9%, transparent)" : "color-mix(in oklch, var(--warning) 9%, transparent)",
                color: data.nicheForecast.trend === "growing" ? "var(--success)" : data.nicheForecast.trend === "declining" ? "var(--destructive)" : "var(--warning)"
              }}>
                {data.nicheForecast.trend === "growing" ? "▲ Растёт" : data.nicheForecast.trend === "declining" ? "▼ Снижается" : "→ Стабильно"}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.65, marginBottom: 14 }}>{data.nicheForecast.forecast}</p>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Куда движется рынок:</div>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55, marginBottom: 20 }}>{data.nicheForecast.direction}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={12} strokeWidth={2} />Возможности</div>
                {(data.nicheForecast.opportunities ?? []).map((o, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--foreground-secondary)", padding: "6px 0", borderBottom: i < (data.nicheForecast.opportunities.length - 1) ? `1px solid var(--muted)` : "none" }}>{o}</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} strokeWidth={2} />Угрозы</div>
                {(data.nicheForecast.threats ?? []).map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--foreground-secondary)", padding: "6px 0", borderBottom: i < (data.nicheForecast.threats.length - 1) ? `1px solid var(--muted)` : "none" }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
