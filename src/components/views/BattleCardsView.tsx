"use client";

import React, { useState, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { BattleCardsResult, BattleCard } from "@/app/api/generate-battle-cards/route";
import { Swords, ChevronDown, ChevronRight, Printer, RefreshCw, Shield, AlertTriangle, MessageSquare, DollarSign, Zap, Target, CheckCircle, XCircle, Loader2, Users, ArrowRight } from "lucide-react";

// ─── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `mr_battle_cards_${userId}`;
}

function loadCards(userId: string): BattleCardsResult | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCards(userId: string, data: BattleCardsResult) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{text}</span>
    </div>
  );
}

function Tag({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, color, background: bg, marginBottom: 6, lineHeight: "1.6" }}>
      {text}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = score >= 70 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--muted)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 30 }}>{score}</span>
    </div>
  );
}

// ─── Single Battle Card ────────────────────────────────────────────────────────

function BattleCardItem({ card, c, defaultOpen }: { card: BattleCard; c: Colors; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const scoreDelta = card.competitorScore;
  const deltaColor = scoreDelta >= 70 ? "var(--destructive)" : scoreDelta >= 50 ? "var(--warning)" : "var(--success)";
  const deltaBg = scoreDelta >= 70 ? "rgba(239,68,68,0.1)" : scoreDelta >= 50 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)";

  return (
    <div className="battle-card-item" style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 16, breakInside: "avoid" }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
          padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: open ? `1px solid var(--border)` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: deltaBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: deltaColor, flexShrink: 0 }}>
            {card.competitorScore}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>{card.competitorName}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {card.competitorUrl}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Карточка бoя</span>
          {open ? <ChevronDown size={18} style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight size={18} style={{ color: "var(--muted-foreground)" }} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Strengths */}
            <div>
              <SectionLabel icon={<Shield size={14} />} text="Сильные стороны конкурента" color="var(--destructive)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {card.strengths.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <XCircle size={14} style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            <div>
              <SectionLabel icon={<AlertTriangle size={14} />} text="Слабые стороны конкурента" color="var(--success)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {card.weaknesses.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Win Condition */}
            <div style={{ padding: 14, borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <SectionLabel icon={<Target size={14} />} text="Условие победы" color="#6366f1" />
              <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.6, fontWeight: 500 }}>{card.winCondition}</p>
            </div>

            {/* Migration trigger */}
            <div style={{ padding: 14, borderRadius: 10, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <SectionLabel icon={<ArrowRight size={14} />} text="Триггер миграции" color="var(--success)" />
              <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>{card.migrationTrigger}</p>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Objections */}
            <div>
              <SectionLabel icon={<MessageSquare size={14} />} text="Возражения и контраргументы" color="var(--primary)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {card.objections.map((obj, i) => (
                  <div key={i} style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.06)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", flexShrink: 0, marginTop: 1 }}>❝</span>
                      <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.55, fontStyle: "italic" }}>{obj.objection}</span>
                    </div>
                    <div style={{ padding: "8px 12px", background: "rgba(34,197,94,0.05)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.55 }}>{obj.counter}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border)" }}>
              <SectionLabel icon={<DollarSign size={14} />} text="Ценовое сравнение" color="var(--muted-foreground)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Конкурент</span>
                  <Tag text={card.pricing.competitorRange} color="var(--foreground)" bg="var(--muted)" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Мы</span>
                  <Tag text={card.pricing.ourRange} color="var(--primary)" bg="rgba(99,102,241,0.1)" />
                </div>
                {card.pricing.positioningNote && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, fontStyle: "italic" }}>
                    {card.pricing.positioningNote}
                  </p>
                )}
              </div>
            </div>

            {/* Talking points */}
            <div>
              <SectionLabel icon={<Zap size={14} />} text="Скрипты для продажника" color="#f59e0b" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {card.talkingPoints.map((tp, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.55 }}>
                      <span style={{ color: "#f59e0b", fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>{tp}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk factors */}
            {card.riskFactors.length > 0 && (
              <div>
                <SectionLabel icon={<AlertTriangle size={14} />} text="Когда мы проигрываем" color="var(--warning)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {card.riskFactors.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--warning)", fontSize: 12, flexShrink: 0, marginTop: 2 }}>⚠</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ c, onGenerate, hasCompetitors }: { c: Colors; onGenerate: () => void; hasCompetitors: boolean }) {
  if (!hasCompetitors) {
    return (
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
        <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}>
          <Users size={48} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Нет конкурентов для battle cards</div>
        <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
          Сначала добавьте хотя бы одного конкурента в раздел «Список конкурентов»
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Swords size={32} style={{ color: "var(--destructive)" }} />
        </div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Battle Cards</div>
      <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, maxWidth: 400, margin: "0 auto 28px" }}>
        AI создаст карточки конкурентного боя с готовыми скриптами, ответами на возражения и триггерами миграции для вашего отдела продаж.
      </div>
      <button
        onClick={onGenerate}
        style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ef4444, #f97316)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Swords size={16} /> Создать Battle Cards
        </span>
      </button>
    </div>
  );
}

// ─── Print styles ──────────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  .battle-cards-print-area,
  .battle-cards-print-area * { visibility: visible !important; }
  .battle-cards-print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .battle-cards-print-toolbar { display: none !important; }
  .battle-card-item { break-inside: avoid; page-break-inside: avoid; }
  @page { margin: 15mm; size: A4 portrait; }
}
`;

// ─── Main component ────────────────────────────────────────────────────────────

export function BattleCardsView({
  c,
  myCompany,
  competitors,
  userId,
}: {
  c: Colors;
  myCompany: AnalysisResult | null;
  competitors: AnalysisResult[];
  userId: string;
}) {
  const [result, setResult] = useState<BattleCardsResult | null>(() => loadCards(userId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!myCompany || competitors.length === 0) return;
    setLoading(true);
    setError(null);

    const compPayload = competitors.map(comp => ({
      name: comp.company.name,
      url: comp.company.url,
      score: comp.company.score,
      description: comp.company.description ?? "",
      strengths: comp.recommendations
        ?.filter(r => r.priority === "low")
        .slice(0, 3)
        .map(r => r.text) ?? [],
      weaknesses: comp.recommendations
        ?.filter(r => r.priority === "high")
        .slice(0, 3)
        .map(r => r.text) ?? [],
    }));

    try {
      const res = await fetch("/api/generate-battle-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myCompany: {
            name: myCompany.company.name,
            url: myCompany.company.url,
            score: myCompany.company.score,
            niche: myCompany.company.description ?? "",
          },
          competitors: compPayload,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        saveCards(userId, json.data);
      } else {
        setError(json.error ?? "Ошибка генерации");
      }
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, [myCompany, competitors, userId]);

  const handlePrint = () => {
    window.print();
  };

  if (!myCompany) {
    return (
      <div style={{ maxWidth: 700 }}>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center" }}>
          <Swords size={48} style={{ color: "var(--muted-foreground)", display: "block", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Сначала проанализируйте свой сайт</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Запустите анализ своей компании, чтобы создать battle cards</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div style={{ maxWidth: 1000 }} className="battle-cards-print-area">

        {/* Toolbar */}
        <div className="battle-cards-print-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 10 }}>
              <Swords size={22} style={{ color: "var(--destructive)" }} />
              Battle Cards
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              Карточки конкурентного боя · {competitors.length} {competitors.length === 1 ? "конкурент" : competitors.length < 5 ? "конкурента" : "конкурентов"}
              {result && (
                <span style={{ marginLeft: 8 }}>
                  · обновлено {new Date(result.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {result && (
              <button
                onClick={handlePrint}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                <Printer size={15} /> PDF / Печать
              </button>
            )}
            <button
              onClick={generate}
              disabled={loading || competitors.length === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, border: "none", background: result ? "var(--primary)" : "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", cursor: loading || competitors.length === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={15} />}
              {result ? "Обновить" : "Создать"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--destructive)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 40, textAlign: "center" }}>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Loader2 size={36} style={{ color: "var(--primary)", animation: "spin 1s linear infinite" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Генерируем Battle Cards…</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>AI анализирует {competitors.length} {competitors.length === 1 ? "конкурента" : "конкурентов"} — это займёт ~20 секунд</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && (
          <EmptyState c={c} onGenerate={generate} hasCompetitors={competitors.length > 0} />
        )}

        {/* Results */}
        {!loading && result && (
          <>
            {/* Executive Summary */}
            {result.executiveSummary && (
              <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", marginBottom: 6 }}>
                  Расстановка сил
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.65 }}>
                  {result.executiveSummary}
                </p>
              </div>
            )}

            {/* Score comparison header */}
            <div style={{ background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`, padding: "14px 20px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 12 }}>СРАВНЕНИЕ ОЦЕНОК</div>
              <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(${Math.min(competitors.length, 5)}, 1fr)`, gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, marginBottom: 4 }}>▶ {myCompany.company.name}</div>
                  <ScoreBar score={myCompany.company.score} />
                </div>
                {competitors.slice(0, 5).map((comp, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {comp.company.name}
                    </div>
                    <ScoreBar score={comp.company.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Cards */}
            <div>
              {result.cards.map((card, i) => (
                <BattleCardItem key={i} card={card} c={c} defaultOpen={i === 0} />
              ))}
            </div>

            {/* Print footer */}
            <div className="battle-cards-print-toolbar" style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <button
                onClick={handlePrint}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                <Printer size={15} /> Экспортировать в PDF (A4)
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
