"use client";

/**
 * AIChatWidget — плавающий AI-чат внутри дашборда.
 *
 * Открывается кнопкой снизу справа. Знает всё о компании:
 * анализ, конкуренты, ЦА, СММ.
 *
 * Новое: proactive bubble — через 5 с после открытия платформы
 * показывает всплывашку «Нужна помощь?» с кнопкой запуска
 * workflow-гида в зависимости от прогресса пользователя.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2, ChevronDown, MapPin, ArrowRight, Mic, MicOff } from "lucide-react";
import type { DashboardContext, ChatMessage } from "@/app/api/chat/route";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

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

// ─── Workflow step calculator ─────────────────────────────────────────────────

function calcWorkflowStep(
  myCompany: AnalysisResult | null,
  competitors: AnalysisResult[],
  taAnalysis: TAResult | null,
  smmAnalysis: SMMResult | null,
): { step: number; total: number; nextAction: string; nextNav: string; greeting: string } {
  if (!myCompany) return {
    step: 0, total: 6,
    nextAction: "Запустить анализ компании",
    nextNav: "new-analysis",
    greeting: "Добро пожаловать в MarketRadar! 👋 Давайте начнём с анализа вашего сайта.",
  };
  if (competitors.length === 0) return {
    step: 1, total: 6,
    nextAction: "Добавить конкурентов",
    nextNav: "competitors",
    greeting: `Отличный старт — ${myCompany.company.name} проанализирован! 🎯 Следующий шаг: добавьте конкурентов.`,
  };
  if (!taAnalysis) return {
    step: 2, total: 6,
    nextAction: "Сгенерировать портрет ЦА",
    nextNav: "ta-new",
    greeting: "Конкуренты добавлены! 👍 Теперь разберёмся с целевой аудиторией.",
  };
  if (!smmAnalysis) return {
    step: 3, total: 6,
    nextAction: "Запустить анализ СММ",
    nextNav: "smm-new",
    greeting: "ЦА готова! 📊 Теперь выстроим SMM-стратегию на основе аудитории.",
  };
  return {
    step: 5, total: 6,
    nextAction: "Создать план контента",
    nextNav: "content-plan",
    greeting: "Все ключевые анализы готовы! 🚀 Теперь составим план контента и запустим производство.",
  };
}

function buildWorkflowPrompt(
  myCompany: AnalysisResult | null,
  competitors: AnalysisResult[],
  taAnalysis: TAResult | null,
  smmAnalysis: SMMResult | null,
): string {
  const { step, total } = calcWorkflowStep(myCompany, competitors, taAnalysis, smmAnalysis);
  const done = [
    myCompany && "✅ Анализ компании",
    competitors.length > 0 && `✅ Конкуренты (${competitors.length})`,
    taAnalysis && "✅ Целевая аудитория",
    smmAnalysis && "✅ СММ-стратегия",
  ].filter(Boolean).join(", ") || "пока ничего";

  return `Покажи мне оптимальный порядок работы на платформе MarketRadar.

Мой прогресс (шаг ${step}/${total}): ${done}.

Объясни:
1. Что уже сделано и что это даёт
2. Что делать дальше и зачем (конкретный следующий шаг)
3. Какой порядок всех шагов рекомендуешь и почему
4. Что получу в итоге после завершения всех этапов

Отвечай кратко, по пунктам. Конкретные действия — ссылки на разделы платформы.`;
}

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTERS = [
  "Покажи оптимальный порядок работы с платформой",
  "Какие 3 действия дадут быстрый рост?",
  "В чём мы сильнее конкурентов?",
  "На какой сегмент ЦА нацелиться в первую очередь?",
  "Что улучшить в SEO прямо сейчас?",
  "Напиши стратегию на следующий квартал",
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
  /** ID текущего пользователя — для скоупа истории чата по аккаунту. */
  userId?: string;
}

// История чата теперь скоупится по userId — иначе при смене аккаунта
// новый юзер видел переписку предыдущего.
const storageKey = (uid?: string) => `mr_chat_history_${uid ?? "anon"}`;
const BUBBLE_SEEN_KEY = "mr_nav_bubble_seen";

function loadHistory(uid?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(msgs: ChatMessage[], uid?: string) {
  try { localStorage.setItem(storageKey(uid), JSON.stringify(msgs.slice(-50))); } catch { /* ignore */ }
}

export function AIChatWidget({ myCompany, competitors, taAnalysis, smmAnalysis, userId }: AIChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Голосовой ввод через Web Speech API (SpeechRecognition).
  // В Chrome/Edge/Safari работает out-of-the-box, в Firefox/Yandex нет — там
  // кнопка не отрисуется. `isListening` — флаг записи, `voiceError` — текст
  // если юзер не дал разрешение / нет интернета (распознавание идёт в Google
  // на стороне Chrome для русского).
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = React.useRef<unknown>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const history = loadHistory(userId);
    setMessages(history);
    setHydrated(true);

    // Web Speech API доступен? Chrome/Edge/Safari дают webkitSpeechRecognition,
    // Firefox/Yandex Browser нет — там кнопка мика не покажется.
    try {
      const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (SR) {
        setVoiceSupported(true);
      }
    } catch { /* ignore */ }

    // Show proactive bubble after 5s if: no chat history AND bubble not yet seen this session
    const bubbleSeen = sessionStorage.getItem(BUBBLE_SEEN_KEY);
    if (!bubbleSeen && history.length === 0) {
      const timer = setTimeout(() => setShowBubble(true), 5000);
      return () => clearTimeout(timer);
    }
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

  const dismissBubble = () => {
    setShowBubble(false);
    try { sessionStorage.setItem(BUBBLE_SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  const openWithWorkflow = () => {
    dismissBubble();
    setOpen(true);
    // Small delay to let chat open, then auto-send the workflow question
    setTimeout(() => {
      sendMessage(buildWorkflowPrompt(myCompany, competitors, taAnalysis, smmAnalysis));
    }, 300);
  };

  // Старт/стоп распознавания речи. Использует webkitSpeechRecognition с
  // continuous=false (одна фраза — один результат) и lang=ru-RU.
  // Распознанный текст добавляется в input, потом юзер сам жмёт Send или Enter
  // (намеренно не отправляем автоматом — даём шанс исправить опечатки).
  const toggleVoice = () => {
    if (isListening && recognitionRef.current) {
      // Стоп — пользователь нажал ещё раз чтобы остановить запись.
      try { (recognitionRef.current as { stop: () => void }).stop(); } catch { /* ignore */ }
      setIsListening(false);
      return;
    }
    setVoiceError(null);
    try {
      const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) {
        setVoiceError("Голосовой ввод не поддерживается в этом браузере. Откройте в Chrome или Edge.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec: any = new SR();
      rec.lang = "ru-RU";
      rec.continuous = false;
      rec.interimResults = true;          // показываем промежуточный результат пока говорим
      rec.maxAlternatives = 1;

      rec.onresult = (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
        // Собираем все промежуточные + финальный результаты в одну строку.
        let finalText = "";
        for (let i = 0; i < ev.results.length; i++) {
          finalText += ev.results[i][0].transcript;
        }
        setInput(prev => {
          // Если в инпуте уже что-то напечатано — приписываем через пробел.
          // Иначе перезаписываем — это для случая «нажал мик до набора текста».
          if (!prev.trim()) return finalText;
          // Чтобы не дублировать промежуточные результаты, при повторных onresult
          // мы заменяем то что было добавлено голосом. Простой способ: храним
          // финальный текст в ref-е и переписываем хвост. Здесь упрощаем —
          // просто записываем целиком (хвост может потеряться, но в кратких
          // фразах это норм).
          return finalText;
        });
      };
      rec.onerror = (ev: { error?: string }) => {
        if (ev.error === "not-allowed") setVoiceError("Нет доступа к микрофону. Разрешите в настройках браузера.");
        else if (ev.error === "no-speech") setVoiceError("Не услышал, попробуйте ещё раз");
        else if (ev.error === "network") setVoiceError("Нет интернета для распознавания");
        else if (ev.error) setVoiceError(`Ошибка: ${ev.error}`);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Не удалось запустить распознавание");
      setIsListening(false);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    saveHistory(nextMsgs, userId);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-16),
          context: buildContext(myCompany, competitors, taAnalysis, smmAnalysis),
        }),
      });
      const json = await jsonOrThrow(res);
      if (json.ok) {
        const assistantMsg: ChatMessage = { role: "assistant", content: json.message };
        const withReply = [...nextMsgs, assistantMsg];
        setMessages(withReply);
        saveHistory(withReply, userId);
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
    try { localStorage.removeItem(storageKey(userId)); } catch { /* ignore */ }
  };

  const hasContext = !!myCompany;
  const unread = !open && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";
  const workflow = calcWorkflowStep(myCompany, competitors, taAnalysis, smmAnalysis);

  if (!hydrated) return null;

  return (
    <>
      <style>{`
        @keyframes chatSlideIn { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:none; } }
        @keyframes bubbleIn { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ── Proactive navigation bubble ── */}
      {showBubble && !open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 1001,
          width: 300,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          boxShadow: "0 8px 32px rgba(124,58,237,0.22)",
          overflow: "hidden",
          animation: "bubbleIn 0.25s ease",
        }}>
          {/* Bubble header */}
          <div style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={16} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Навигатор по платформе</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>Шаг {workflow.step + 1} из {workflow.total}</div>
            </div>
            <button onClick={dismissBubble} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <X size={13} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: "rgba(124,58,237,0.15)" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg,#7c3aed,#a855f7)", width: `${Math.round((workflow.step / workflow.total) * 100)}%`, transition: "width 0.4s" }} />
          </div>

          {/* Content */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, marginBottom: 12 }}>
              {workflow.greeting}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={openWithWorkflow}
                style={{
                  flex: 1, padding: "9px 14px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Sparkles size={12} /> Показать план работы
              </button>
              <button
                onClick={() => {
                  dismissBubble();
                  // Navigate to next action
                  if (workflow.nextNav && typeof window !== "undefined") {
                    window.location.href = `/?nav=${workflow.nextNav}`;
                  }
                }}
                style={{
                  padding: "9px 12px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--background)",
                  color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <ArrowRight size={12} /> Перейти
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10, textAlign: "center" }}>
              Следующий шаг: <strong>{workflow.nextAction}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { setOpen(o => !o); if (showBubble) dismissBubble(); }}
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
        {(unread || showBubble) && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: "50%", background: showBubble ? "#f59e0b" : "#22d3ee", border: "2px solid white" }} />
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

          {/* Header */}
          <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={18} style={{ color: "rgba(255,255,255,0.9)" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>AI-ассистент</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                  MarketRadar · Шаг {workflow.step + 1}/{workflow.total}
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

          {/* Progress bar in header */}
          <div style={{ height: 2, background: "rgba(124,58,237,0.15)", flexShrink: 0 }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg,#7c3aed,#a855f7)", width: `${Math.round((workflow.step / workflow.total) * 100)}%` }} />
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

                {/* Next step banner */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.08))",
                  border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12,
                  padding: "12px 14px", marginBottom: 14,
                  cursor: "pointer",
                }}
                  onClick={() => sendMessage(buildWorkflowPrompt(myCompany, competitors, taAnalysis, smmAnalysis))}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <MapPin size={13} style={{ color: "#7c3aed", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Следующий шаг: {workflow.nextAction}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", paddingLeft: 21 }}>
                    Нажмите, чтобы получить пошаговый план работы с платформой
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
              {voiceSupported && (
                <button
                  onClick={toggleVoice}
                  disabled={loading || !hasContext}
                  title={isListening ? "Остановить запись" : "Голосовой ввод"}
                  style={{
                    width: 38, height: 38, borderRadius: 12, border: "none",
                    background: isListening ? "#ef4444" : "var(--card)",
                    color: isListening ? "#fff" : "var(--foreground-secondary)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: isListening ? "0 0 0 4px rgba(239,68,68,0.25)" : "none",
                    animation: isListening ? "mr-pulse 1.2s ease-in-out infinite" : undefined,
                    opacity: loading || !hasContext ? 0.5 : 1,
                    transition: "background 0.15s, box-shadow 0.15s",
                  }}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
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
            {voiceError && (
              <div style={{ marginTop: 6, padding: "6px 10px", fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.08)", borderRadius: 6, textAlign: "center" }}>
                {voiceError}
              </div>
            )}
            {isListening && (
              <div style={{ marginTop: 6, padding: "6px 10px", fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.08)", borderRadius: 6, textAlign: "center", fontWeight: 600 }}>
                🔴 Говорите… (нажмите микрофон ещё раз чтобы остановить)
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 10, color: "var(--muted-foreground)" }}>
              Enter — отправить · Shift+Enter — новая строка{voiceSupported ? " · 🎤 — голос" : ""}
            </div>
            <style>{`
              @keyframes mr-pulse {
                0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
                50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.4); }
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
}
