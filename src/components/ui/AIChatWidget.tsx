"use client";

/**
 * AIChatWidget — плавающий AI-чат внутри дашборда.
 *
 * Открывается кнопкой снизу справа. Знает всё о компании:
 * анализ, конкуренты, ЦА, СММ.
 *
 * Используется в app/page.tsx — принимает весь контекст как props.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2, ChevronDown } from "lucide-react";
import type { DashboardContext, ChatMessage } from "@/app/api/chat/route";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";

// ─── Context builder ──────────────────────────────────────────────────────────

function buildContext(
  myCompany: AnalysisResult | null,
  competitors: AnalysisResult[],
  taAnalysis: TAResult | null,
  smmAnalysis: SMMResult | null,
): DashboardContext {
  if (!myCompany) return {};
  return {
    companyName: myCompany.company.name,
    companyUrl: myCompany.company.url,
    companyScore: myCompany.company.score,
    companyDescription: myCompany.company.description,
    categories: myCompany.company.categories.map(c => ({ name: c.name, score: c.score, icon: c.icon })),
    topRecommendations: (myCompany.recommendations ?? [])
      .filter(r => r.priority === "high")
      .slice(0, 6)
      .map(r => ({ text: r.text, effect: r.effect, priority: r.priority, category: r.category })),
    seoKeywords: myCompany.seo?.keywords ?? [],
    seoTraffic: myCompany.seo?.estimatedTraffic,
    seoDomainAge: myCompany.seo?.domainAge,
    seoIssues: myCompany.seo?.issues ?? [],
    competitors: competitors.map(c => ({ name: c.company.name, url: c.company.url, score: c.company.score })),
    taSummary: taAnalysis?.summary,
    taSegments: taAnalysis?.segments?.slice(0, 4).map(s => ({
      name: s.segmentName,
      isGolden: s.isGolden,
      mainProblems: s.mainProblems?.slice(0, 2) ?? [],
    })),
    smmStrategy: smmAnalysis?.contentStrategy?.bigIdea,
    smmPlatforms: smmAnalysis?.platformStrategies?.map(p => p.platform) ?? undefined,
    businessRevenue: myCompany.business?.revenue,
    businessEmployees: myCompany.business?.employees,
  };
}

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTERS = [
  "Какие 3 действия дадут быстрый рост?",
  "В чём мы сильнее конкурентов?",
  "На какой сегмент ЦА нацелиться в первую очередь?",
  "Что улучшить в SEO прямо сейчас?",
  "Напиши стратегию на следующий квартал",
  "Как повысить рейтинг с карт?",
];

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 2 }}>
          <Sparkles size={14} style={{ color: "#fff" }} />
        </div>
      )}
      <div style={{
        maxWidth: "82%",
        padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
        background: isUser ? "var(--primary)" : "var(--card)",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "#fff" : "var(--foreground)",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        boxShadow: "var(--shadow)",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Sparkles size={14} style={{ color: "#fff" }} />
      </div>
      <div style={{ padding: "10px 14px", borderRadius: "4px 14px 14px 14px", background: "var(--card)", border: "1px solid var(--border)", display: "flex", gap: 4, alignItems: "center" }}>
        <style>{`
          @keyframes chat-dot { 0%,60%,100%{opacity:0.3;transform:scale(0.8)} 30%{opacity:1;transform:scale(1)} }
        `}</style>
        {[0, 150, 300].map(delay => (
          <div key={delay} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", animation: `chat-dot 1.2s ${delay}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

interface AIChatWidgetProps {
  myCompany: AnalysisResult | null;
  competitors: AnalysisResult[];
  taAnalysis: TAResult | null;
  smmAnalysis: SMMResult | null;
}

const STORAGE_KEY = "mr_chat_history";

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(msgs: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); } catch { /* ignore */ }
}

export function AIChatWidget({ myCompany, competitors, taAnalysis, smmAnalysis }: AIChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    saveHistory(nextMsgs);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-16), // last 16 for context window
          context: buildContext(myCompany, competitors, taAnalysis, smmAnalysis),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        const assistantMsg: ChatMessage = { role: "assistant", content: json.message };
        const withReply = [...nextMsgs, assistantMsg];
        setMessages(withReply);
        saveHistory(withReply);
      } else {
        setError(json.error ?? "Ошибка ответа");
      }
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, [messages, loading, myCompany, competitors, taAnalysis, smmAnalysis]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const hasContext = !!myCompany;
  const unread = !open && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

  if (!hydrated) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="AI-ассистент"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: open ? "var(--primary)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,58,237,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.4)"; }}
      >
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {unread && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: "50%", background: "#22d3ee", border: "2px solid white" }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 999,
          width: 380, height: 560,
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "chatSlideIn 0.2s ease",
        }}>
          <style>{`
            @keyframes chatSlideIn { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:none; } }
          `}</style>

          {/* Header */}
          <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={18} style={{ color: "rgba(255,255,255,0.9)" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>AI-ассистент</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                  MarketRadar
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {messages.length > 0 && (
                <button onClick={clearHistory} title="Очистить историю" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px", display: "flex", flexDirection: "column" }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ textAlign: "center", marginBottom: 20, padding: "12px 0" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Спросите меня что угодно</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                    {hasContext
                      ? `Я знаю всё о ${myCompany!.company.name}: рейтинги, SEO, конкуренты, ЦА и стратегию`
                      : "Сначала запустите анализ своего сайта, чтобы я мог давать персональные советы"}
                  </div>
                </div>
                {hasContext && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {STARTERS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        style={{
                          textAlign: "left", padding: "8px 12px", borderRadius: 10,
                          border: "1px solid var(--border)", background: "var(--card)",
                          color: "var(--foreground-secondary)", fontSize: 12, cursor: "pointer",
                          lineHeight: 1.4, transition: "border-color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--foreground)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--foreground-secondary)"; }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

            {/* Typing indicator */}
            {loading && <TypingDots />}

            {/* Error */}
            {error && (
              <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--destructive)", fontSize: 12, marginBottom: 8 }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasContext ? "Спросите что-нибудь…" : "Сначала проанализируйте сайт"}
                disabled={loading || !hasContext}
                rows={1}
                style={{
                  flex: 1, resize: "none", padding: "9px 12px",
                  borderRadius: 12, border: "1.5px solid var(--border)",
                  background: "var(--card)", color: "var(--foreground)",
                  fontSize: 13, fontFamily: "inherit", lineHeight: 1.5,
                  outline: "none", maxHeight: 100, overflowY: "auto",
                  opacity: !hasContext ? 0.5 : 1,
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 100) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim() || !hasContext}
                style={{
                  width: 38, height: 38, borderRadius: 12, border: "none",
                  background: "var(--primary)", color: "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  opacity: loading || !input.trim() || !hasContext ? 0.5 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 10, color: "var(--muted-foreground)" }}>
              Enter — отправить · Shift+Enter — новая строка
            </div>
          </div>
        </div>
      )}
    </>
  );
}
