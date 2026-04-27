"use client";

/**
 * /partner/certification — Partner exam + certificate page.
 *
 * Flow:
 *   1. Load partner status + existing certification via GET /api/partner/certification
 *   2. If already passed → show certificate (printable)
 *   3. Otherwise → show exam: 10 MCQ + 1 practical
 *   4. Submit → POST /api/partner/certification → show result
 *   5. On pass → certificate view appears
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Award, ChevronLeft, ChevronRight, CheckCircle, XCircle, Printer, Loader2, RefreshCw } from "lucide-react";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 760, margin: "0 auto" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 14, padding: 28, marginBottom: 20 } as React.CSSProperties,
  btn: (variant: "primary" | "secondary") => ({
    background: variant === "primary" ? "#7c3aed" : "transparent",
    border: variant === "primary" ? "none" : "1px solid #2d3748",
    color: variant === "primary" ? "#fff" : "#94a3b8",
    borderRadius: 10, padding: "10px 24px", cursor: "pointer",
    fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8,
  } as React.CSSProperties),
};

const PTABS = [
  { href: "/partner", label: "Дашборд" },
  { href: "/partner/clients", label: "Клиенты" },
  { href: "/partner/payouts", label: "Выплаты" },
  { href: "/partner/certification", label: "Сертификация" },
];

const PRACTICAL_PROMPT = `Опишите сценарий: как вы представили бы MarketRadar клиенту — маркетинговому агентству из 5 человек? Какие функции показали бы в первую очередь и почему? Как объяснили бы ценность платформы? (минимум 100 символов)`;

// ─── Certificate component ────────────────────────────────────────────────────

function Certificate({ name, company, refCode, certDate, score }: { name: string; company: string; refCode: string; certDate: string; score: number }) {
  const dateStr = new Date(certDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .mr-cert, .mr-cert * { visibility: visible !important; }
          .mr-cert { position: fixed; inset: 0; width: 100%; height: 100%; margin: 0 !important; border: none !important; }
          .mr-cert-no-print { display: none !important; }
          @page { margin: 0; size: A4 landscape; }
        }
      `}</style>

      {/* Print button */}
      <div className="mr-cert-no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={() => window.print()}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid #2d3748", background: "#1a1f2e", color: "#e2e8f0", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
        >
          <Printer size={15} /> Скачать PDF / Распечатать
        </button>
      </div>

      {/* Certificate */}
      <div className="mr-cert" style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 40%, #16213e 100%)",
        border: "2px solid #7c3aed",
        borderRadius: 20,
        padding: "52px 60px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(124,58,237,0.2), inset 0 0 60px rgba(124,58,237,0.05)",
      }}>
        {/* Decorative corners */}
        {[{ top: 16, left: 16 }, { top: 16, right: 16 }, { bottom: 16, left: 16 }, { bottom: 16, right: 16 }].map((pos, i) => (
          <div key={i} style={{ position: "absolute", ...pos, width: 40, height: 40, border: "2px solid #7c3aed", borderRadius: 4, opacity: 0.4 }} />
        ))}

        {/* Logo */}
        <div style={{ fontSize: 13, letterSpacing: "0.2em", color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
          MarketRadar
        </div>

        {/* Title */}
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#64748b", textTransform: "uppercase", marginBottom: 32 }}>
          Сертификат партнёра
        </div>

        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: "2px solid #7c3aed", marginBottom: 28 }}>
          <Award size={36} style={{ color: "#7c3aed" }} />
        </div>

        {/* Name */}
        <div style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>{name || "Партнёр"}</div>
        {company && <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 28 }}>{company}</div>}

        {/* Body */}
        <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, maxWidth: 460, margin: "0 auto 32px", fontStyle: "italic" }}>
          Успешно прошёл(а) сертификацию партнёрской программы MarketRadar и подтвердил(а) знание платформы на <strong style={{ color: "#f1f5f9" }}>{score}%</strong>.
        </div>

        {/* Score bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ width: 18, height: 6, borderRadius: 3, background: i < Math.round(score / 10) ? "#7c3aed" : "#2d3748" }} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-around", maxWidth: 460, margin: "0 auto" }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Дата выдачи</div>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{dateStr}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Реф. код</div>
            <div style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>{refCode}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Статус</div>
            <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>Сертифицирован</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageData {
  partner: { id: string; type: string; commission_rate: number; referral_code: string; company_name: string | null };
  certification: { score: number; theory_correct: number; passed: boolean; certified_at: string } | null;
  questions: Array<{ id: number; question: string; options: string[] }>;
  userName?: string;
}

export default function CertificationPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Exam state
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [practical, setPractical] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{ score: number; correct: number; passed: boolean; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/partner/certification");
      const d = await r.json();
      if (!d.ok) {
        if (r.status === 401) { window.location.href = "/"; return; }
        setError(d.error ?? "Ошибка загрузки");
        return;
      }
      setData(d);
      setAnswers(new Array(d.questions.length).fill(null));
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!data) return;
    const unanswered = answers.findIndex(a => a === null);
    if (unanswered !== -1) {
      setSubmitError(`Ответьте на вопрос ${unanswered + 1}`);
      return;
    }
    if (practical.trim().length < 100) {
      setSubmitError("Практическое задание слишком короткое (мин. 100 символов)");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch("/api/partner/certification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, practical }),
      });
      const d = await r.json();
      if (d.ok) {
        setResult(d);
        if (d.passed) {
          // Reload to get fresh certification data
          await load();
        }
      } else {
        setSubmitError(d.error ?? "Ошибка отправки");
      }
    } catch {
      setSubmitError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <Link href="/partner" style={{ ...S.logo, textDecoration: "none" }}>MarketRadar</Link>
        <Link href="/" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>← На платформу</Link>
      </header>

      {/* Tabs */}
      <nav style={S.nav}>
        {PTABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/partner/certification")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader2 size={32} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", display: "inline-block" }} />
            <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {error && (
          <div style={{ background: "#1a1f2e", border: "1px solid #ef4444", borderRadius: 12, padding: "20px 24px", color: "#ef4444" }}>{error}</div>
        )}

        {!loading && !error && data && (
          <>
            {/* Page title */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 10 }}>
                <Award size={24} style={{ color: "#7c3aed" }} />
                Сертификация партнёра
              </h1>
              <p style={{ color: "#64748b", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                Пройдите экзамен (10 вопросов + практическое задание) и получите сертификат с повышением комиссии до 50%.
              </p>
            </div>

            {/* Already certified → show certificate */}
            {data.certification?.passed && (
              <Certificate
                name={data.userName ?? data.partner.company_name ?? "Партнёр"}
                company={data.partner.company_name ?? ""}
                refCode={data.partner.referral_code}
                certDate={data.certification.certified_at}
                score={data.certification.score}
              />
            )}

            {/* Result after submit (failed attempt) */}
            {result && !result.passed && (
              <div style={{ ...S.card, borderColor: "#ef4444", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <XCircle size={22} style={{ color: "#ef4444" }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>Тест не пройден</span>
                </div>
                <p style={{ color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.6 }}>
                  Правильных ответов: <strong style={{ color: "#f1f5f9" }}>{result.correct} из {result.total}</strong> ({result.score}%). Для прохождения нужно набрать минимум 70% (7 из 10).
                </p>
                <button onClick={() => { setResult(null); setAnswers(new Array(data.questions.length).fill(null)); setPractical(""); }} style={S.btn("primary")}>
                  <RefreshCw size={15} /> Попробовать снова
                </button>
              </div>
            )}

            {/* Exam — only if not yet certified */}
            {!data.certification?.passed && !result?.passed && (
              <div>
                {/* Info banner */}
                <div style={{ padding: "14px 20px", borderRadius: 12, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", marginBottom: 28, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Award size={18} style={{ color: "#7c3aed", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65 }}>
                    <strong style={{ color: "#f1f5f9" }}>Условия сертификации:</strong> 10 вопросов по теории (70%+ = сдал) + практическое задание. После прохождения ваша комиссия повышается до 50%. Попыток — неограниченно.
                  </div>
                </div>

                {/* Questions */}
                {data.questions.map((q, qi) => (
                  <div key={q.id} style={{ ...S.card, marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: answers[qi] !== null ? "rgba(124,58,237,0.15)" : "#131720", border: `1px solid ${answers[qi] !== null ? "#7c3aed" : "#2d3748"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: answers[qi] !== null ? "#7c3aed" : "#64748b" }}>
                        {qi + 1}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.5 }}>{q.question}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 40 }}>
                      {q.options.map((opt, oi) => {
                        const selected = answers[qi] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => {
                              const next = [...answers];
                              next[qi] = oi;
                              setAnswers(next);
                            }}
                            style={{
                              textAlign: "left", padding: "10px 14px", borderRadius: 8,
                              border: `1.5px solid ${selected ? "#7c3aed" : "#2d3748"}`,
                              background: selected ? "rgba(124,58,237,0.1)" : "#131720",
                              color: selected ? "#a78bfa" : "#94a3b8",
                              cursor: "pointer", fontSize: 13, fontWeight: selected ? 600 : 400,
                              display: "flex", alignItems: "center", gap: 8,
                              transition: "border-color 0.15s, background 0.15s",
                            }}
                          >
                            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? "#7c3aed" : "#3d4a5f"}`, background: selected ? "#7c3aed" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Practical */}
                <div style={S.card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Практическое задание
                  </div>
                  <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 14px" }}>{PRACTICAL_PROMPT}</p>
                  <textarea
                    value={practical}
                    onChange={e => setPractical(e.target.value)}
                    rows={6}
                    placeholder="Опишите ваш сценарий..."
                    style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "12px 14px", fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ textAlign: "right", fontSize: 11, color: practical.length >= 100 ? "#4ade80" : "#64748b", marginTop: 4 }}>
                    {practical.length} / 100 символов минимум
                    {practical.length >= 100 && " ✓"}
                  </div>
                </div>

                {/* Submit */}
                {submitError && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
                    {submitError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Отвечено: {answers.filter(a => a !== null).length} из {data.questions.length} вопросов
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ ...S.btn("primary"), opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={15} />}
                    Отправить на проверку
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
