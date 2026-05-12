"use client";

/**
 * AgentHubView — список агентов с тогглами, расписаниями, inbox-карточками
 * и ручным запуском.
 *
 * Слева: карточки агентов (включить/выключить, выбрать schedule, последний run).
 * Сверху: inbox — что требует одобрения (drafts, alerts, suggestions).
 *
 * Каждая карточка:
 *   • icon + label + description
 *   • toggle Enabled/Disabled
 *   • schedule selector (hourly/daily/weekly/manual) если не fixed
 *   • Last run status + summary
 *   • Кнопки: «Запустить сейчас», «История»
 */

import React, { useEffect, useState, useCallback } from "react";
import type { Colors } from "@/lib/colors";
import {
  Bot, Inbox, Play, Loader2, Calendar as CalendarIcon, AlertCircle,
  Check, X as XIcon, RefreshCw, History, Settings as SettingsIcon, Save,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type Schedule = "hourly" | "daily" | "weekly" | "manual";

interface AgentItem {
  name: string;
  label: string;
  description: string;
  icon: string;
  category: "content" | "competitors" | "reviews" | "visibility" | "system";
  defaultSchedule: Schedule;
  fixedSchedule: boolean;
  minPlan?: string;
  enabled: boolean;
  schedule: Schedule;
  params: Record<string, unknown>;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunSummary: string | null;
}

interface InboxItem {
  id: string;
  agent_name: string;
  started_at: string;
  summary: string | null;
  result: Record<string, unknown>;
}

const CATEGORY_LABELS: Record<AgentItem["category"], string> = {
  content: "Контент",
  competitors: "Конкуренты",
  reviews: "Отзывы",
  visibility: "Видимость",
  system: "Система",
};

const SCHEDULE_LABELS: Record<Schedule, string> = {
  hourly: "Каждый час",
  daily: "Каждый день",
  weekly: "Каждую неделю",
  manual: "Только вручную",
};

const STATUS_COLORS: Record<string, string> = {
  ok: "#16a34a",
  skipped: "#6b7280",
  error: "#ef4444",
};

/**
 * Описание одного поля в форме настроек агента.
 * Структура схемы хардкодится здесь (по одному per-agent) — отдельная
 * мета на бэке избыточна для 5 агентов.
 */
type ParamField =
  | { key: string; label: string; type: "text"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "url-list"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "boolean"; help?: string }
  | { key: string; label: string; type: "number"; min?: number; max?: number; help?: string };

const AGENT_PARAM_SCHEMAS: Record<string, ParamField[]> = {
  "yandex-reviews-watcher": [
    {
      key: "companyName",
      label: "Название компании для поиска в Я.Картах",
      type: "text",
      placeholder: "Оставьте пустым, чтобы агент использовал текущую анализируемую компанию",
      help: "Если задано — агент всегда работает с этой компанией. Если пусто — следует за last_analyzed_company (текущим анализом).",
    },
  ],
  "site-change-detector": [
    {
      key: "urls",
      label: "URL для отслеживания",
      type: "url-list",
      placeholder: "https://competitor1.ru/\nhttps://competitor2.ru/pricing",
      help: "По одному URL на строку. Главные / pricing / blog страницы конкурентов.",
    },
    {
      key: "notifyTelegram",
      label: "Telegram-уведомления при изменениях",
      type: "boolean",
      help: "Шлёт alert в ваш Telegram-чат, когда страница значимо изменилась.",
    },
    {
      key: "minChangeChars",
      label: "Минимум символов для алерта",
      type: "number",
      min: 50,
      max: 5000,
      help: "Мелкие правки (даты, счётчики, формат) игнорируются. По умолчанию 100.",
    },
  ],
  "trend-hunter": [
    {
      key: "niche",
      label: "Ниша (для AI-скоринга)",
      type: "text",
      placeholder: "Оставьте пустым — возьмём из текущего анализа",
      help: "Влияет на «relevance»: AI оценит каждый тренд под эту нишу.",
    },
    {
      key: "minScore",
      label: "Минимальный score для inbox",
      type: "number",
      min: 50,
      max: 95,
      help: "Темы со score ниже не попадают в inbox. По умолчанию 70.",
    },
    {
      key: "sources",
      label: "Свои RSS-источники (опц)",
      type: "url-list",
      placeholder: "https://example.com/rss\nhttps://another.com/feed",
      help: "По одному feed на строку. Если пусто — дефолтные (vc.ru, habr, seonews).",
    },
  ],
  "auto-publisher": [
    {
      key: "requireApproval",
      label: "Требовать подтверждение перед публикацией",
      type: "boolean",
      help: "Если включено — посты сначала идут в Inbox для одобрения. Безопаснее для бренд-чувствительных аккаунтов.",
    },
    {
      key: "publishTelegram",
      label: "Публиковать в Telegram",
      type: "boolean",
    },
    {
      key: "publishVk",
      label: "Публиковать в VK",
      type: "boolean",
    },
  ],
  "email-drip-sender": [],
};

export function AgentHubView({ c }: { c: Colors }) {
  void c;
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningName, setRunningName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, i] = await Promise.all([
        fetch("/api/agents", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/agents/inbox", { cache: "no-store" }).then(r => r.json()),
      ]);
      if (a.ok) setAgents(a.agents ?? []);
      if (i.ok) setInbox(i.inbox ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = async (agentName: string, enabled: boolean) => {
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, enabled }),
    });
    setAgents(prev => prev.map(a => a.name === agentName ? { ...a, enabled } : a));
  };

  const changeSchedule = async (agentName: string, schedule: Schedule) => {
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, schedule }),
    });
    setAgents(prev => prev.map(a => a.name === agentName ? { ...a, schedule } : a));
  };

  const updateParams = async (agentName: string, params: Record<string, unknown>) => {
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, params }),
    });
    setAgents(prev => prev.map(a => a.name === agentName ? { ...a, params } : a));
  };

  const runNow = async (agentName: string) => {
    setRunningName(agentName);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentName)}/run`, { method: "POST" });
      const j = await res.json();
      if (!j.ok) setError(j.error ?? "Ошибка запуска");
      // Перезагружаем чтобы увидеть свежий last_run + inbox
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setRunningName(null);
    }
  };

  const approveInbox = async (id: string, action: "approve" | "dismiss") => {
    await fetch(`/api/agents/runs/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setInbox(prev => prev.filter(it => it.id !== id));
  };

  const grouped = agents.reduce<Record<string, AgentItem[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px", color: "var(--foreground)", letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 12 }}>
          <Bot size={26} style={{ color: "var(--primary)" }} />
          Агенты
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
          Автономные воркфлоу, которые работают с вашими данными (брендбук, конкуренты, ЦА). Кладут результат в Inbox или Telegram.
        </p>
      </div>

      {/* Объяснение разницы между ручным и автоматическим запуском */}
      <div style={{
        background: "color-mix(in oklch, var(--primary) 5%, transparent)",
        border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 20,
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--foreground-secondary)",
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <span style={{
            background: "color-mix(in oklch, var(--primary) 15%, transparent)",
            color: "var(--primary)",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 5,
            letterSpacing: "0.08em",
          }}>
            КАК ЭТО РАБОТАЕТ
          </span>
          <div style={{ flex: 1, minWidth: 280 }}>
            <b style={{ color: "var(--foreground)" }}>«Запустить сейчас»</b> — разовый прогон агента, ничего не активирует.
            {" "}
            <b style={{ color: "var(--foreground)" }}>Чтобы агент работал автоматически</b> — включите toggle и выберите расписание (час / день / неделя).
            При расписании <code style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>«Только вручную»</code> агент не запускается по cron, даже если toggle включён.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 10%, transparent)", color: "var(--destructive)", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Inbox — ждут approval */}
      {inbox.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Inbox size={16} style={{ color: "#f59e0b" }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>
              Ждут одобрения
            </h2>
            <span style={{
              background: "#f59e0b", color: "#fff", fontSize: 11, fontWeight: 800,
              padding: "2px 8px", borderRadius: 999, minWidth: 22, textAlign: "center",
            }}>
              {inbox.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inbox.map(item => (
              <div key={item.id} style={{
                background: "var(--card)",
                border: "1px solid color-mix(in oklch, #f59e0b 35%, var(--border))",
                borderLeft: "4px solid #f59e0b",
                borderRadius: 12, padding: "14px 18px",
                display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    {item.agent_name}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.5, marginBottom: 6 }}>
                    {item.summary || "Без описания"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {new Date(item.started_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => approveInbox(item.id, "approve")}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none",
                      background: "#16a34a", color: "#fff",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    <Check size={14} /> Одобрить
                  </button>
                  <button
                    onClick={() => approveInbox(item.id, "dismiss")}
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "transparent",
                      color: "var(--foreground-secondary)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    <XIcon size={13} /> Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reload */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>
          Доступные агенты
        </h2>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--foreground-secondary)",
            fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "inherit",
          }}
        >
          <RefreshCw size={13} className={loading ? "mr-spin" : ""} /> Обновить
        </button>
      </div>

      {/* Group by category */}
      {!loading && agents.length === 0 && (
        <EmptyState
          icon={<Bot size={28} />}
          title="Пока нет зарегистрированных агентов"
          description="Агенты регистрируются в коде платформы. Если вы видите это сообщение — значит этап развёртывания ещё не завершён."
        />
      )}

      {Object.entries(grouped).map(([category, list]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: "var(--muted-foreground)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
          }}>
            {CATEGORY_LABELS[category as AgentItem["category"]]}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 12,
          }}>
            {list.map(agent => (
              <AgentCard
                key={agent.name}
                agent={agent}
                running={runningName === agent.name}
                schema={AGENT_PARAM_SCHEMAS[agent.name] ?? []}
                onToggle={enabled => toggleEnabled(agent.name, enabled)}
                onScheduleChange={s => changeSchedule(agent.name, s)}
                onParamsChange={p => updateParams(agent.name, p)}
                onRunNow={() => runNow(agent.name)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentCard({
  agent, running, schema, onToggle, onScheduleChange, onParamsChange, onRunNow,
}: {
  agent: AgentItem;
  running: boolean;
  schema: ParamField[];
  onToggle: (enabled: boolean) => void;
  onScheduleChange: (s: Schedule) => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onRunNow: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [paramsDraft, setParamsDraft] = useState<Record<string, unknown>>(agent.params);
  const [paramsDirty, setParamsDirty] = useState(false);
  const [paramsSaving, setParamsSaving] = useState(false);

  // Если внешний state params изменился (после save или first load) — синкаем
  useEffect(() => {
    if (!paramsDirty) setParamsDraft(agent.params);
  }, [agent.params, paramsDirty]);

  const setField = (key: string, value: unknown) => {
    setParamsDraft(prev => ({ ...prev, [key]: value }));
    setParamsDirty(true);
  };

  const saveParams = async () => {
    setParamsSaving(true);
    try {
      await onParamsChange(paramsDraft);
      setParamsDirty(false);
    } finally {
      setParamsSaving(false);
    }
  };

  const resetParams = () => {
    setParamsDraft(agent.params);
    setParamsDirty(false);
  };
  const statusColor = agent.lastRunStatus ? STATUS_COLORS[agent.lastRunStatus] ?? "var(--muted-foreground)" : "var(--muted-foreground)";
  const lastRunStr = agent.lastRunAt
    ? new Date(agent.lastRunAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "ещё не запускался";

  return (
    <div style={{
      background: "var(--card)",
      border: `1.5px solid ${agent.enabled ? "color-mix(in oklch, var(--primary) 25%, var(--border))" : "var(--border)"}`,
      borderRadius: 14, padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
      opacity: agent.enabled ? 1 : 0.85,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", marginBottom: 4, letterSpacing: -0.2 }}>
            {agent.label}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
            {agent.description}
          </div>
        </div>
        {/* Toggle */}
        <label style={{ cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={agent.enabled}
            onChange={e => onToggle(e.target.checked)}
            style={{ display: "none" }}
          />
          <span style={{
            width: 36, height: 20, borderRadius: 12,
            background: agent.enabled ? "var(--primary)" : "var(--muted)",
            position: "relative", transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: 2,
              left: agent.enabled ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%",
              background: "#fff", transition: "left 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </span>
        </label>
      </div>

      {/* Schedule + Last run */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={agent.schedule}
          onChange={e => onScheduleChange(e.target.value as Schedule)}
          disabled={agent.fixedSchedule || !agent.enabled}
          style={{
            padding: "6px 10px", borderRadius: 7,
            border: "1px solid var(--border)", background: "var(--background)",
            color: "var(--foreground)", fontSize: 12, fontFamily: "inherit",
            cursor: (agent.fixedSchedule || !agent.enabled) ? "not-allowed" : "pointer",
            opacity: (agent.fixedSchedule || !agent.enabled) ? 0.55 : 1,
          }}
        >
          <option value="hourly">Каждый час</option>
          <option value="daily">Каждый день</option>
          <option value="weekly">Каждую неделю</option>
          <option value="manual">Только вручную</option>
        </select>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted-foreground)" }}>
          <CalendarIcon size={12} />
          {lastRunStr}
        </div>

        {agent.lastRunStatus && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
            background: `${statusColor}1a`, color: statusColor,
          }}>
            {agent.lastRunStatus === "ok" ? "✓" : agent.lastRunStatus === "error" ? "✗" : "—"} {agent.lastRunStatus}
          </span>
        )}
      </div>

      {/* Last summary */}
      {agent.lastRunSummary && (
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: agent.lastRunStatus === "error"
            ? "color-mix(in oklch, var(--destructive) 8%, transparent)"
            : "var(--background)",
          fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5,
          display: "flex", gap: 6, alignItems: "flex-start",
        }}>
          {agent.lastRunStatus === "error" && <AlertCircle size={12} style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 2 }} />}
          <span>{agent.lastRunSummary}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRunNow}
          disabled={running}
          style={{
            flex: 1, padding: "8px 14px", borderRadius: 8, border: "none",
            background: running ? "var(--muted)" : "var(--primary)",
            color: running ? "var(--muted-foreground)" : "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: running ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "inherit",
          }}
        >
          {running
            ? <><Loader2 size={13} className="mr-spin" /> Идёт работа…</>
            : <><Play size={13} /> Запустить сейчас</>}
        </button>
        {schema.length > 0 && (
          <button
            onClick={() => setShowSettings(v => !v)}
            title="Настроить параметры агента"
            style={{
              padding: "8px 10px", borderRadius: 8,
              border: `1px solid ${showSettings ? "var(--primary)" : "var(--border)"}`,
              background: showSettings ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent",
              color: showSettings ? "var(--primary)" : "var(--foreground-secondary)",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: "inherit",
            }}
          >
            <SettingsIcon size={13} />
          </button>
        )}
        <a
          href={`/api/agents/${encodeURIComponent(agent.name)}/runs`}
          target="_blank"
          rel="noopener noreferrer"
          title="JSON история запусков"
          style={{
            padding: "8px 10px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--foreground-secondary)",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: "inherit",
          }}
        >
          <History size={13} />
        </a>
      </div>

      {/* Settings panel — раскрывается по клику на ⚙ */}
      {showSettings && schema.length > 0 && (
        <div style={{
          marginTop: 4, padding: "14px 16px", borderRadius: 10,
          background: "color-mix(in oklch, var(--primary) 4%, transparent)",
          border: "1px dashed color-mix(in oklch, var(--primary) 25%, transparent)",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Настройки агента
          </div>
          {schema.map(field => (
            <ParamFieldEditor
              key={field.key}
              field={field}
              value={paramsDraft[field.key]}
              onChange={v => setField(field.key, v)}
            />
          ))}
          {paramsDirty && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={saveParams}
                disabled={paramsSaving}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: "var(--primary)", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: paramsSaving ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: "inherit",
                }}
              >
                {paramsSaving ? <Loader2 size={11} className="mr-spin" /> : <Save size={11} />}
                Сохранить
              </button>
              <button
                onClick={resetParams}
                style={{
                  padding: "7px 14px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--foreground-secondary)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamFieldEditor({ field, value, onChange }: {
  field: ParamField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "var(--foreground)", marginBottom: 4,
  };
  const helpStyle: React.CSSProperties = {
    fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.45,
  };
  const inputBase: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  if (field.type === "text") {
    return (
      <div>
        <div style={labelStyle}>{field.label}</div>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={inputBase}
        />
        {field.help && <div style={helpStyle}>{field.help}</div>}
      </div>
    );
  }

  if (field.type === "url-list") {
    const list = Array.isArray(value) ? (value as string[]).join("\n") : "";
    return (
      <div>
        <div style={labelStyle}>{field.label}</div>
        <textarea
          rows={4}
          value={list}
          onChange={e =>
            onChange(
              e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            )
          }
          placeholder={field.placeholder}
          style={{ ...inputBase, resize: "vertical", fontFamily: "monospace" }}
        />
        {field.help && <div style={helpStyle}>{field.help}</div>}
      </div>
    );
  }

  if (field.type === "boolean") {
    const checked = value === true;
    return (
      <div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{
            width: 32, height: 18, borderRadius: 10,
            background: checked ? "var(--primary)" : "var(--muted)",
            position: "relative", transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: 2, left: checked ? 16 : 2,
              width: 14, height: 14, borderRadius: "50%",
              background: "#fff", transition: "left 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </span>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            style={{ display: "none" }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            {field.label}
          </span>
        </label>
        {field.help && <div style={helpStyle}>{field.help}</div>}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <div style={labelStyle}>{field.label}</div>
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={(value as number) ?? ""}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          style={inputBase}
        />
        {field.help && <div style={helpStyle}>{field.help}</div>}
      </div>
    );
  }

  return null;
}
