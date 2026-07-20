"use client";

/**
 * /kp-share/<token> — публичная шер-ссылка КП для клиента. Гейт по простому
 * паролю (слово+цифры, диктует менеджер). После ввода рендерит то же КП, что
 * видит менеджер, но без менеджерского обвеса.
 */

import { use, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";
import { KpProposal } from "@/components/kp/KpProposal";

interface Loaded { company: AnalysisResult; bundle: PilotBundle; companyName: string | null; url: string; }

type AstroStatus = "idle" | "running" | "pending_review" | "approved" | "sent" | "error" | "rejected";

export default function KpSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [phase, setPhase] = useState<"loading" | "gate" | "ok" | "error">("loading");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);

  // Фаза 3: статус запроса пересборки на Astro — восстанавливается из ответа
  // разблокировки (если клиент уже нажимал «Да, интересно» раньше и вернулся
  // по той же ссылке), дальше живёт локально до следующей перезагрузки.
  const [astroStatus, setAstroStatus] = useState<AstroStatus>("idle");
  const [astroEmail, setAstroEmail] = useState<string | null>(null);
  const [astroSubmitting, setAstroSubmitting] = useState(false);
  const [astroError, setAstroError] = useState<string | null>(null);

  const requestAstroRebuild = async (email: string) => {
    setAstroSubmitting(true); setAstroError(null);
    try {
      const r = await fetch(`/api/kp-share/${token}/rebuild`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!j.ok) { setAstroError(j.error || "Не получилось отправить запрос"); return; }
      setAstroStatus(j.status as AstroStatus);
      setAstroEmail(email);
    } catch { setAstroError("Ошибка сети"); }
    finally { setAstroSubmitting(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/kp-share/${token}`);
        const j = await r.json();
        if (!j.ok) { setPhase("error"); setError(j.error || "Ссылка недоступна"); return; }
        setCompanyName(j.companyName);
        setPhase("gate");
      } catch { setPhase("error"); setError("Ошибка сети"); }
    })();
  }, [token]);

  const unlock = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch(`/api/kp-share/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || "Неверный пароль"); return; }
      setData({ company: j.company, bundle: j.bundle, companyName: j.companyName, url: j.url });
      if (j.rebuildStatus) setAstroStatus(j.rebuildStatus as AstroStatus);
      if (j.clientEmail) setAstroEmail(j.clientEmail);
      setPhase("ok");
    } catch { setError("Ошибка сети"); }
    finally { setSubmitting(false); }
  };

  if (phase === "loading") {
    return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", fontFamily: "'Inter',system-ui", color: "#6b7280" }}>Загружаем…</div>;
  }

  if (phase === "error") {
    return (
      <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", fontFamily: "'Inter',system-ui", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Ссылка недоступна</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>{error || "Проверьте ссылку или попросите новую."}</div>
        </div>
      </div>
    );
  }

  if (phase === "ok" && data) {
    return (
      <KpProposal
        company={data.company}
        competitors={[]}
        generatedBundle={data.bundle}
        astroRebuild={{
          status: astroStatus,
          onRequest: requestAstroRebuild,
          submitting: astroSubmitting,
          error: astroError,
          clientEmail: astroEmail,
        }}
      />
    );
  }

  // gate
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f7f8", fontFamily: "'Inter',system-ui" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 30, width: 380, maxWidth: "90vw", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2a78d6", marginBottom: 10 }}>MarketRadar</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          {companyName ? `Разбор для «${companyName}»` : "Персональный разбор"}
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 18, lineHeight: 1.5 }}>
          Введите пароль из сообщения менеджера, чтобы открыть предложение.
        </div>
        <input
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !submitting) unlock(); }}
          placeholder="Пароль" autoFocus
          style={{ width: "100%", height: 46, padding: "0 14px", fontSize: 16, textAlign: "center", border: "1px solid #d1d5db", borderRadius: 10, marginBottom: 12 }}
        />
        {error && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        <button onClick={unlock} disabled={submitting}
          style={{ width: "100%", height: 46, fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none", background: submitting ? "#9ca3af" : "#2a78d6", color: "#fff", cursor: submitting ? "default" : "pointer" }}>
          {submitting ? "Открываем…" : "Открыть предложение"}
        </button>
      </div>
    </div>
  );
}
