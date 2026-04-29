"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { CompetitorAdsBlock } from "@/components/ui/CompetitorAdsBlock";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { RadarChart } from "@/components/ui/RadarChart";
import {
  TrendingUp, AlertTriangle, Lightbulb, Tag, RefreshCw, Key,
  Search, Building2, ClipboardList, Settings, Users, Smartphone,
} from "lucide-react";

export function CompetitorProfileView({ c, data, onBack }: { c: Colors; data: AnalysisResult; onBack: () => void }) {
  const { company, recommendations, insights } = data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [offers, setOffers] = useState<any>(null);
  const [offersLoading, setOffersLoading] = useState(false);

  const offersKey = `mr_offers_${company.url || company.name}`;

  const loadOffers = async (force = false) => {
    // Check localStorage cache first
    if (!force) {
      try {
        const cached = localStorage.getItem(offersKey);
        if (cached) {
          setOffers(JSON.parse(cached));
          return;
        }
      } catch { /* ignore */ }
    }
    setOffersLoading(true);
    try {
      const res = await fetch("/api/analyze-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
      });
      const json = await res.json();
      if (json.ok) {
        setOffers(json.data);
        try { localStorage.setItem(offersKey, JSON.stringify(json.data)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setOffersLoading(false);
  };

  // Auto-load on mount
  useEffect(() => {
    loadOffers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.url, company.name]);

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        ← Назад к конкурентам
      </button>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "color-mix(in oklch, var(--primary) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>
          {company.name.charAt(0)}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>{company.name}</h1>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {company.url}
            {data.analyzedAt && (
              <span style={{ marginLeft: 8, padding: "1px 7px", background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {new Date(data.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ScoreRing score={company.score} size={80} strokeWidth={6} c={c} />
        </div>
      </div>

      {/* Categories */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>Оценки по категориям</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>

      {/* Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><TrendingUp size={14} /> Сильные стороны</div>
          {company.categories.filter(c2 => c2.score >= 60).map(cat => (
            <div key={cat.name} style={{ fontSize: 13, color: "var(--foreground)", marginBottom: 6 }}>
              {cat.icon} {cat.name} — <strong>{cat.score}/100</strong>
            </div>
          ))}
          {company.categories.filter(c2 => c2.score >= 60).length === 0 && (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Нет категорий выше 60</div>
          )}
        </div>
        <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><AlertTriangle size={14} /> Слабые стороны</div>
          {company.categories.filter(c2 => c2.score < 50).map(cat => (
            <div key={cat.name} style={{ fontSize: 13, color: "var(--foreground)", marginBottom: 6 }}>
              {cat.icon} {cat.name} — <strong>{cat.score}/100</strong>
            </div>
          ))}
          {company.categories.filter(c2 => c2.score < 50).length === 0 && (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Нет категорий ниже 50</div>
          )}
        </div>
      </div>

      {/* AI Recommendations for this competitor */}
      <CollapsibleSection c={c} title="AI-рекомендации">
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--muted)" }}>
                <th style={{ padding: "9px 16px", textAlign: "left", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", width: 110 }}>Приоритет</th>
                <th style={{ padding: "9px 16px", textAlign: "left", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", width: 120 }}>Категория</th>
                <th style={{ padding: "9px 16px", textAlign: "left", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>Рекомендация</th>
                <th style={{ padding: "9px 16px", textAlign: "left", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", width: 140 }}>Эффект</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec, i) => {
                const priorityColor = rec.priority === "high" ? "var(--destructive)" : rec.priority === "medium" ? "var(--warning)" : "var(--success)";
                const priorityLabel = rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий";
                return (
                  <tr key={i} style={{ borderBottom: i < recommendations.length - 1 ? `1px solid var(--muted)` : "none" }}>
                    <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, background: priorityColor + "18", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{priorityLabel}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted-foreground)", verticalAlign: "top" }}>{rec.category}</td>
                    <td style={{ padding: "12px 16px", color: "var(--foreground)", lineHeight: 1.5, verticalAlign: "top" }}>{rec.text}</td>
                    <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", background: "color-mix(in oklch, var(--success) 7%, transparent)", padding: "3px 9px", borderRadius: 6, display: "inline-block" }}>{rec.effect}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Insights */}
      {insights.length > 0 && (
        <CollapsibleSection c={c} title="Инсайты" icon={<Lightbulb size={16} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{ins.title}</div>
                <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{ins.text}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Offers analysis */}
      <CollapsibleSection c={c} title="Анализ офферов" icon={<Tag size={16} />}
        extra={offers && !offersLoading ? (
          <div style={{ textAlign: "right" }}>
            <button onClick={() => loadOffers(true)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={11} /> Актуализировать
            </button>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Рекомендуем раз в неделю</div>
          </div>
        ) : undefined}>
        {!offers && !offersLoading && (
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, textAlign: "center", boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 12 }}>Загружаю офферы конкурента...</p>
            <button onClick={() => loadOffers(true)} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Загрузить офферы
            </button>
          </div>
        )}
        {offersLoading && (
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, textAlign: "center", boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <div style={{ color: "var(--primary)", fontSize: 13 }}>Анализирую офферы с сайта...</div>
          </div>
        )}
        {offers && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "color-mix(in oklch, var(--primary) 6%, transparent)", borderRadius: 12, padding: 16, border: `1px solid var(--primary)30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕННОСТНОЕ ПРЕДЛОЖЕНИЕ</div>
              <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0, fontWeight: 600 }}>{offers.mainValueProposition}</p>
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginTop: 6 }}>Стратегия: {offers.pricingStrategy}</div>
            </div>
            {(offers.offers ?? []).map((offer: { title: string; description: string; price: string; uniqueSellingPoint: string; targetAudience: string }, i: number) => (
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
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>СИЛЬНЫЕ</div>
                {(offers.strengths ?? []).map((s: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--success)30` }}>{s}</div>)}
              </div>
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8 }}>СЛАБЫЕ</div>
                {(offers.weaknesses ?? []).map((w: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--destructive)30` }}>{w}</div>)}
              </div>
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", marginBottom: 8 }}>НЕ ХВАТАЕТ</div>
                {(offers.missingOffers ?? []).map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid var(--warning)30` }}>{m}</div>)}
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Key.so Dashboard */}
      <CollapsibleSection c={c} title="Данные Key.so" icon={<TrendingUp size={16} />} defaultOpen={true}>
        <KeysoDashboardBlock c={c} dash={data.keysoDashboard} />
      </CollapsibleSection>

      {/* Реклама Я.Директ конкурента */}
      <div style={{ marginTop: 16 }}>
        <CompetitorAdsBlock domain={data.company.url} />
      </div>

      {/* ── Ключевые слова ── */}
      {(data.seo?.positions ?? []).length > 0 && (
        <CollapsibleSection c={c} title="Ключевые слова и позиции" icon={<Key size={16} />}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--background)" }}>
                {["Ключевое слово", "Позиция", "Объём/мес", "Рейтинг"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.seo.positions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: i < data.seo.positions.length - 1 ? `1px solid var(--muted)` : "none" }}>
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
        </CollapsibleSection>
      )}

      {/* ── SEO-детали + Бизнес-профиль ── */}
      <CollapsibleSection c={c} title="SEO-детали и бизнес-профиль" icon={<Search size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 8 }}><Search size={14} /> SEO-детали</div>
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
            {data.seo?.lighthouseScores && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>LIGHTHOUSE (MOBILE)</div>
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
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginTop: 2 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(data.seo?.issues ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ПРОБЛЕМЫ</div>
                {data.seo.issues.map((issue, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6, fontSize: 12, color: "var(--foreground-secondary)" }}>
                    <span style={{ color: "var(--destructive)", marginTop: 1, flexShrink: 0 }}>⚠</span>{issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 8 }}><Building2 size={14} /> Бизнес-профиль</div>
            {(() => {
              const descLines = (data.company.description ?? "").split("\n");
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
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
                      <span style={{ color: "var(--foreground-secondary)", flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 600, color: "var(--foreground)", textAlign: "right", wordBreak: "break-word", maxWidth: "65%" }}>{value}</span>
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
        <CollapsibleSection c={c} title="Госконтракты (zakupki.gov.ru)" icon={<ClipboardList size={16} />}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", marginBottom: 16 }}>
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

      {/* ── Технологии + Найм ── */}
      <CollapsibleSection c={c} title="Технологии и найм" icon={<Settings size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 8 }}><Settings size={14} /> Технологии</div>
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

          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 8 }}><Users size={14} /> Найм (hh.ru)</div>
              {data.hiring?.trend && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                  background: data.hiring.trend === "growing" ? "color-mix(in oklch, var(--success) 9%, transparent)" : data.hiring.trend === "declining" ? "color-mix(in oklch, var(--destructive) 9%, transparent)" : "var(--muted)",
                  color: data.hiring.trend === "growing" ? "var(--success)" : data.hiring.trend === "declining" ? "var(--destructive)" : "var(--muted-foreground)"
                }}>
                  {data.hiring.trend === "growing" ? "↑ растёт" : data.hiring.trend === "declining" ? "↓ снижается" : "→ стабильно"}
                </span>
              )}
            </div>
            {[
              { label: "Открытых вакансий", value: String(data.hiring?.openVacancies ?? 0) },
              { label: "Средняя зарплата", value: data.hiring?.avgSalary ?? "—" },
              { label: "Вилка зарплат", value: data.hiring?.salaryRange ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
                <span style={{ color: "var(--foreground-secondary)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
              </div>
            ))}
            {(data.hiring?.topRoles ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ТОП ВАКАНСИИ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.hiring.topRoles.map(role => <span key={role} style={{ background: "var(--muted)", color: "var(--foreground-secondary)", borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid var(--border)` }}>{role}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Соцсети ── */}
      {(data.social?.vk || data.social?.telegram || data.social?.yandexRating || data.social?.gisRating) && (
        <CollapsibleSection c={c} title="Соцсети и отзывы" icon={<Smartphone size={16} />}>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {data.social?.vk && (
                <div style={{ background: "var(--background)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>ВКонтакте</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>{data.social.vk.subscribers.toLocaleString("ru")}</div>
                  <div style={{ fontSize: 11, color: "var(--foreground-secondary)" }}>подписчиков</div>
                </div>
              )}
              {data.social?.telegram && (
                <div style={{ background: "var(--background)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>Telegram</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>{data.social.telegram.subscribers.toLocaleString("ru")}</div>
                  <div style={{ fontSize: 11, color: "var(--foreground-secondary)" }}>подписчиков</div>
                </div>
              )}
              {(data.social?.yandexRating ?? 0) > 0 && (
                <div style={{ background: "var(--background)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>Яндекс.Карты</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--warning)" }}>★ {data.social.yandexRating.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: "var(--foreground-secondary)" }}>{data.social.yandexReviews} отзывов</div>
                </div>
              )}
              {(data.social?.gisRating ?? 0) > 0 && (
                <div style={{ background: "var(--background)", borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>2ГИС</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--warning)" }}>★ {data.social.gisRating.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: "var(--foreground-secondary)" }}>{data.social.gisReviews} отзывов</div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
