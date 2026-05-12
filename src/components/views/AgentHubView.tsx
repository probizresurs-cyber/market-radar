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
  Check, X as XIcon, RefreshCw, History,
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
          Автономные воркфлоу, которые работают по расписанию. Каждый агент использует ваши данные (брендбук, конкуренты, ЦА), сам выполняет работу и кладёт результат в Inbox или Telegram.
        </p>
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
                onToggle={enabled => toggleEnabled(agent.name, enabled)}
                onScheduleChange={s => changeSchedule(agent.name, s)}
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
  agent, running, onToggle, onScheduleChange, onRunNow,
}: {
  agent: AgentItem;
  running: boolean;
  onToggle: (enabled: boolean) => void;
  onScheduleChange: (s: Schedule) => void;
  onRunNow: () => void;
}) {
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
    </div>
  );
}
