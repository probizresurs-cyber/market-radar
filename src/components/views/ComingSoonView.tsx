"use client";

import React, { useState } from "react";
import { Sparkles, BellRing, Check } from "lucide-react";
import type { Colors } from "@/lib/colors";

interface Props {
  c: Colors;
  featureId: string;
  title: string;
  description?: string;
  userEmail?: string;       // пред-заполняем для авторизованных
}

/**
 * Показывается вместо заблокированного модуля. Пользователь может оставить
 * заявку — попадает в feature_waitlist (видно админу).
 */
export function ComingSoonView({ c, featureId, title, description, userEmail }: Props) {
  const [email, setEmail] = useState(userEmail ?? "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/features/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId, email: email.trim() || undefined, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Не удалось отправить");
    }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        maxWidth: 560,
        width: "100%",
        background: c.bgCard,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: "40px 36px",
        textAlign: "center",
        boxShadow: c.shadow,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative glow */}
        <div style={{
          position: "absolute",
          top: -120, right: -120,
          width: 280, height: 280,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.accent}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `color-mix(in srgb, ${c.accent} 18%, transparent)`,
            color: c.accent,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}>
            <Sparkles size={30} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.14em", marginBottom: 8 }}>
            СКОРО БУДЕТ
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: c.textPrimary,
            margin: "0 0 12px", letterSpacing: "-0.02em",
          }}>
            {title}
          </h1>
          <p style={{ fontSize: 15, color: c.textMuted, lineHeight: 1.6, margin: "0 0 28px" }}>
            {description ?? "Модуль в активной разработке. Оставьте заявку — напишем, как только запустим."}
          </p>

          {status === "ok" ? (
            <div style={{
              background: `color-mix(in srgb, ${c.accent} 15%, transparent)`,
              border: `1px solid ${c.accent}`,
              borderRadius: 12,
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "center",
              color: c.textPrimary,
            }}>
              <Check size={20} style={{ color: c.accent }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                Готово! Мы уведомим вас первыми, когда модуль запустится.
              </span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  disabled={!!userEmail}
                  style={{
                    padding: "12px 14px",
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                    color: c.textPrimary,
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Как планируете использовать модуль? (необязательно)"
                  rows={3}
                  style={{
                    padding: "12px 14px",
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                    color: c.textPrimary,
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {status === "error" && (
                <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={status === "loading"}
                style={{
                  width: "100%",
                  padding: "13px 22px",
                  background: c.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: status === "loading" ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: status === "loading" ? 0.7 : 1,
                }}
              >
                <BellRing size={16} />
                {status === "loading" ? "Отправляем…" : "Уведомить меня о запуске"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
