"use client";

/**
 * /admin/email-test
 *
 * Админ-страничка для проверки SMTP:
 *   - Кнопка «Проверить подключение» — verify TCP+TLS+AUTH для всех 3 аккаунтов
 *   - Форма «Отправить тестовое» с выбором аккаунта (noreply/billing/hello) и адресом
 *
 * Доступ: только админ. Защита — на API-эндпоинте.
 */

import React, { useEffect, useState } from "react";

interface VerifyResult { ok: boolean; error?: string }
type AccountStatus = Record<string, VerifyResult>;

export default function EmailTestPage() {
  const [verifying, setVerifying] = useState(false);
  const [accounts, setAccounts] = useState<AccountStatus | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [account, setAccount] = useState<"noreply" | "billing" | "hello">("noreply");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; messageId?: string; error?: string } | null>(null);

  const verifyAll = async () => {
    setVerifying(true);
    setVerifyError(null);
    setAccounts(null);
    try {
      const r = await fetch("/api/admin/email-test", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) {
        setVerifyError(j.error || "Ошибка");
        return;
      }
      setAccounts(j.accounts);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify on mount
  useEffect(() => { verifyAll(); }, []);

  const send = async () => {
    if (!to.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), account }),
      });
      const j = await r.json();
      setSendResult(j);
    } catch (e) {
      setSendResult({ ok: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setSending(false);
    }
  };

  const card: React.CSSProperties = {
    background: "#1a1d2e", border: "1px solid #2a2e44", borderRadius: 14,
    padding: 24, marginBottom: 20,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#8a8c9e",
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8,
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 9,
    border: "1.5px solid #2a2e44", background: "#0f1117", color: "#e2e8f0",
    fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5, color: "#fff" }}>
        Email · Тест SMTP
      </h1>
      <p style={{ fontSize: 15, color: "#8a8c9e", margin: "0 0 28px", lineHeight: 1.5 }}>
        Проверка подключения и тестовая отправка для всех 3 ящиков. Используется только админом.
      </p>

      {/* Connection verify */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>Состояние подключений</div>
          <button onClick={verifyAll} disabled={verifying}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #2a2e44",
              background: "transparent", color: "#a8abc2", fontSize: 13, fontWeight: 600,
              cursor: verifying ? "wait" : "pointer",
            }}>
            {verifying ? "Проверяю…" : "↻ Проверить"}
          </button>
        </div>

        {verifyError && (
          <div style={{ padding: 12, borderRadius: 8, background: "#3a1d1d", color: "#f87171", fontSize: 13 }}>
            ❌ {verifyError}
          </div>
        )}

        {accounts && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(["noreply", "billing", "hello"] as const).map(a => {
              const r = accounts[a];
              return (
                <div key={a} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 9, background: "#0f1117",
                  border: `1px solid ${r?.ok ? "#16a34a40" : "#dc262640"}`,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{a}@marketradar24.ru</div>
                    {!r?.ok && r?.error && (
                      <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{r.error}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    background: r?.ok ? "#16a34a18" : "#dc262618",
                    color: r?.ok ? "#4ade80" : "#f87171",
                  }}>
                    {r?.ok ? "✓ ok" : "✗ failed"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send test */}
      <div style={card}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
          Отправить тестовое письмо
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Аккаунт-отправитель</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["noreply", "billing", "hello"] as const).map(a => (
              <button key={a} onClick={() => setAccount(a)}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 9,
                  border: `1.5px solid ${account === a ? "#6366f1" : "#2a2e44"}`,
                  background: account === a ? "#6366f120" : "transparent",
                  color: account === a ? "#a5b4fc" : "#a8abc2",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                {a}@
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Кому отправить</label>
          <input type="email" value={to} onChange={e => setTo(e.target.value)}
            placeholder="your-email@gmail.com"
            style={inp} />
        </div>

        <button onClick={send} disabled={sending || !to.trim()}
          style={{
            padding: "12px 22px", borderRadius: 10, border: "none",
            background: sending || !to.trim() ? "#2a2e44" : "#6366f1",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: sending || !to.trim() ? "not-allowed" : "pointer",
            minHeight: 44,
          }}>
          {sending ? "Отправляю…" : "Отправить тестовое"}
        </button>

        {sendResult && (
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 10,
            background: sendResult.ok ? "#16a34a14" : "#3a1d1d",
            color: sendResult.ok ? "#4ade80" : "#f87171",
            fontSize: 13, lineHeight: 1.5,
          }}>
            {sendResult.ok ? (
              <>
                ✅ Отправлено!
                {sendResult.messageId && <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, opacity: 0.7, wordBreak: "break-all" }}>messageId: {sendResult.messageId}</div>}
                <div style={{ marginTop: 6, color: "#a8abc2" }}>Проверь входящие на {to}.</div>
              </>
            ) : (
              <>❌ {sendResult.error || "Ошибка"}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
