"use client";

/**
 * /analysis-request — публичная форма заявки на полноценный анализ за 2 990 ₽.
 * Ссылка на неё — с кнопки «Хотите полноценный анализ?» на /kp и других
 * интерактивных анализах. Принимает ?company=&site=&ref= для автозаполнения.
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";

function AnalysisRequestForm() {
  const params = useSearchParams();
  const [companyName, setCompanyName] = useState(params.get("company") ?? "");
  const [website, setWebsite] = useState(params.get("site") ?? "");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !website.trim() || !contact.trim()) {
      setError("Заполните все поля");
      return;
    }
    setStatus("sending"); setError(null);
    try {
      const res = await fetch("/api/analysis-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          website: website.trim(),
          contact: contact.trim(),
          source_path: params.get("ref") ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Ошибка отправки");
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Ошибка сети");
    }
  };

  if (status === "done") {
    return (
      <div style={{ textAlign: "center" }}>
        <CheckCircle2 size={44} style={{ color: "var(--success)", marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>Заявка отправлена</h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
          Свяжемся с вами в ближайшее время и подготовим полноценный анализ.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px" }}>Полноценный анализ — 2 990 ₽</h1>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 28px", lineHeight: 1.5 }}>
        Оставьте контакты — подготовим детальный разбор сайта, ниши и конкурентов и свяжемся с вами.
      </p>

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Название компании</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ООО «Ромашка»"
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 15, marginBottom: 18 }} />

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Сайт</label>
      <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.ru"
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 15, marginBottom: 18 }} />

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Контакт (телефон, email или Telegram)</label>
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+7 900 000-00-00"
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 15, marginBottom: 24 }} />

      {error && <div style={{ color: "var(--destructive)", fontSize: 13.5, marginBottom: 16 }}>{error}</div>}

      <button type="submit" disabled={status === "sending"} className="ds-btn ds-btn-primary"
        style={{ width: "100%", height: 50, fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: status === "sending" ? "wait" : "pointer" }}>
        <Send size={17} /> {status === "sending" ? "Отправляем…" : "Отправить заявку"}
      </button>
    </form>
  );
}

export default function AnalysisRequestPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <div className="ds-card" style={{ maxWidth: 460, width: "100%", padding: "36px 32px" }}>
        <Suspense fallback={null}>
          <AnalysisRequestForm />
        </Suspense>
      </div>
    </div>
  );
}
