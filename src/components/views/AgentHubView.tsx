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
  Send, Mail, Eye, TrendingUp, Star, TrendingDown,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

// Маппинг строкового имени иконки → компонент. Используется в карточке агента
// чтобы по AGENT_ICONS[agent.name] подобрать lucide-иконку.
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Send, Mail, Eye, TrendingUp, TrendingDown, Star, Bot,
};

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

// Неоновые акценты под лендинг marketradar24.ru. Каждой категории — свой цвет
// (видно с порога что относится к чему). Используется в border-top, glow-shadow
// и метках агентов.
const CATEGORY_NEON: Record<AgentItem["category"], string> = {
  content:     "#D500F9", // magenta
  competitors: "#4FC3F7", // cyan
  reviews:     "#69FF47", // green
  visibility:  "#9B59FF", // violet
  system:      "#f59e0b", // orange
};

// Иконка под имя агента (lucide-react). Подставляется в карточку — узнаваемее
// без иконок все карточки выглядят одинаково.
// Что должно быть подключено для каждого агента чтобы он реально работал.
// Используется для предупреждения «Включён, но не сработает — настройте X».
interface ConnectionState {
  telegramChat: boolean;
  telegramChannel: boolean;
  vkGroup: boolean;
  smtp: boolean;
  keysoApi: boolean;
  yandexMapsApi: boolean;
  googlePlacesApi: boolean;
}
interface MissingConnection {
  label: string;
  hint: string;
  link?: string;
}
function getMissingConnections(agentName: string, c: ConnectionState): MissingConnection[] {
  const out: MissingConnection[] = [];
  if (agentName === "auto-publisher") {
    if (!c.telegramChannel && !c.vkGroup) {
      out.push({
        label: "Нет ни одного канала публикации",
        hint: "Подключите Telegram-канал или VK-группу в Профиле, иначе агенту некуда публиковать.",
        link: "/?nav=settings",
      });
    }
  }
  if (agentName === "yandex-reviews-watcher") {
    if (!c.yandexMapsApi && !c.googlePlacesApi) {
      out.push({
        label: "Нет API-ключей для карт",
        hint: "Нужен YANDEX_MAPS_API_KEY или GOOGLE_PLACES_API_KEY в окружении сервера. Обратитесь к админу платформы.",
      });
    }
  }
  if (agentName === "site-change-detector" && !c.telegramChat) {
    out.push({
      label: "Telegram-чат не подключён",
      hint: "Алерты об изменениях идут в TG. Подключите бота в Профиле → Telegram.",
      link: "/?nav=settings",
    });
  }
  if (agentName === "email-drip-sender" && !c.smtp) {
    out.push({
      label: "SMTP не настроен на сервере",
      hint: "Нужны переменные SMTP_USER_HELLO/PASS на VPS. Обратитесь к админу платформы.",
    });
  }
  if (agentName === "seo-position-tracker" && !c.keysoApi) {
    out.push({
      label: "Keys.so API не настроен",
      hint: "Нужен KEYSO_API_TOKEN на сервере. Без него агент не получит данные по позициям.",
    });
  }
  return out;
}

const AGENT_ICONS: Record<string, string> = {
  "auto-publisher":           "Send",
  "email-drip-sender":        "Mail",
  "site-change-detector":     "Eye",
  "trend-hunter":             "TrendingUp",
  "yandex-reviews-watcher":   "Star",
  "reviews-watcher":          "Star",
  "seo-position-tracker":     "TrendingDown",
  "ai-visibility-monitor":    "Bot",
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
      label: "Название компании для поиска",
      type: "text",
      placeholder: "Оставьте пустым — возьмём из текущего анализа",
      help: "Используется и для Yandex.Карт, и для Google Maps. Если пусто — следует за last_analyzed_company.",
    },
    {
      key: "checkYandex",
      label: "Проверять Yandex.Карты",
      type: "boolean",
      help: "Парсим публичный виджет отзывов yandex.ru/maps. Нужен YANDEX_MAPS_API_KEY на сервере для поиска orgId.",
    },
    {
      key: "checkGoogle",
      label: "Проверять Google Maps",
      type: "boolean",
      help: "Через Google Places API (нужен GOOGLE_PLACES_API_KEY). Ищет place_id по названию + забирает 5 последних отзывов.",
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
  "seo-position-tracker": [
    {
      key: "domain",
      label: "Домен для мониторинга",
      type: "text",
      placeholder: "Оставьте пустым — возьмём из текущего анализа",
      help: "Без http/www. Например: me-dent.ru",
    },
    {
      key: "base",
      label: "Регион поиска",
      type: "text",
      placeholder: "msk",
      help: "Регион Keys.so: msk (Москва) / spb (Питер) / ru (Россия) / goo_ru (Google Россия). По умолчанию msk.",
    },
    {
      key: "minOldPosition",
      label: "Алертить только если ключ был не ниже",
      type: "number",
      min: 5,
      max: 100,
      help: "Если ключ был на 30+ месте и просел — нам это не интересно. По умолчанию 30 (только топ-30).",
    },
    {
      key: "notifyTelegram",
      label: "Telegram-уведомления",
      type: "boolean",
      help: "Слать топ-5 просевших ключей в TG. Нужен подключённый telegram_chat_id в профиле.",
    },
  ],
  "ai-visibility-monitor": [
    {
      key: "brandName",
      label: "Название бренда",
      type: "text",
      placeholder: "Оставьте пустым — возьмём из текущего анализа",
      help: "Точное название как должно искаться в нейросетях. Например: «СМ-Стоматология».",
    },
    {
      key: "niche",
      label: "Ниша",
      type: "text",
      placeholder: "Например: стоматологические клиники в Москве",
      help: "Чем точнее — тем релевантнее тестовые запросы будут к ChatGPT/Claude/YandexGPT.",
    },
    {
      key: "queries",
      label: "Кастомные запросы для проверки (опц)",
      type: "url-list",
      placeholder: "лучшая стоматология в москве с гарантией\nгде поставить импланты в Москве недорого",
      help: "По одному запросу на строку. Если пусто — Claude сгенерирует 5 на основе ниши.",
    },
    {
      key: "alertDropPct",
      label: "Алертить при падении на N%",
      type: "number",
      min: 3,
      max: 50,
      help: "Если общий mention rate упал на ≥N% относительно прошлой недели — TG-алерт + inbox. По умолчанию 10.",
    },
  ],
  "email-drip-sender": [
    {
      key: "fromAccount",
      label: "Аккаунт-отправитель",
      type: "text",
      placeholder: "hello",
      help: "Один из настроенных SMTP-аккаунтов: hello / noreply / billing. По умолчанию — hello.",
    },
    {
      key: "audienceFilter",
      label: "Отправлять только пользователям с email-доменом",
      type: "text",
      placeholder: "Например, @yandex.ru или оставьте пустым для всех",
      help: "Если задано — рассылку получают только юзеры с этим email-доменом. Полезно для тестов.",
    },
    {
      key: "skipDays",
      label: "Не отправлять чаще чем раз в N дней одному адресу",
      type: "number",
      min: 1,
      max: 30,
      help: "Защита от спама. По умолчанию 3 дня.",
    },
    {
      key: "bccAdmin",
      label: "BCC копия админу",
      type: "text",
      placeholder: "admin@marketradar24.ru",
      help: "Если задан — каждое письмо шлёт скрытую копию по этому адресу. Удобно мониторить, что уходит юзерам.",
    },
  ],
};

export function AgentHubView({ c }: { c: Colors }) {
  void c;
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningName, setRunningName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Какая карточка сейчас показывает модал настроек. null = ни одна.
  // Поднято с уровня AgentCard в hub чтобы исключить наслоение нескольких
  // открытых модалок (раньше при клике на ⚙ второй карточки первая не
  // закрывалась — оба диалога рендерились одновременно).
  const [settingsOpenFor, setSettingsOpenFor] = useState<string | null>(null);
  // Внешние коннекты юзера: TG-чат, TG-канал, VK-группа, SMTP, и т.д.
  // Карточки агентов показывают предупреждение «нужно подключить X»
  // если что-то не настроено и без этого агент не сможет работать.
  const [connections, setConnections] = useState<{
    telegramChat: boolean;
    telegramChannel: boolean;
    vkGroup: boolean;
    smtp: boolean;
    keysoApi: boolean;
    yandexMapsApi: boolean;
    googlePlacesApi: boolean;
  }>({ telegramChat: false, telegramChannel: false, vkGroup: false, smtp: false, keysoApi: false, yandexMapsApi: false, googlePlacesApi: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, i] = await Promise.all([
        fetch("/api/agents", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/agents/inbox", { cache: "no-store" }).then(r => r.json()),
      ]);
      if (a.ok) {
        setAgents(a.agents ?? []);
        if (a.connections) setConnections(a.connections);
      }
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

      {Object.entries(grouped).map(([category, list]) => {
        const neon = CATEGORY_NEON[category as AgentItem["category"]];
        return (
          <div key={category} style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 800,
              color: neon, letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: neon, boxShadow: `0 0 10px ${neon}` }} />
              {CATEGORY_LABELS[category as AgentItem["category"]]}
              <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${neon}55, transparent)`, marginLeft: 8 }} />
            </div>
            {/* Строго 3 колонки на десктопе → 2 на планшете → 1 на мобиле.
                Mobile-first через CSS-классы и media-query, чтобы 4-я карточка
                не висела сиротой в auto-fill. */}
            <div
              className="mr-agent-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {list.map(agent => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  neonColor={neon}
                  running={runningName === agent.name}
                  schema={AGENT_PARAM_SCHEMAS[agent.name] ?? []}
                  missingConnections={getMissingConnections(agent.name, connections)}
                  settingsOpen={settingsOpenFor === agent.name}
                  onOpenSettings={() => setSettingsOpenFor(agent.name)}
                  onCloseSettings={() => setSettingsOpenFor(null)}
                  onToggle={enabled => toggleEnabled(agent.name, enabled)}
                  onScheduleChange={s => changeSchedule(agent.name, s)}
                  onParamsChange={p => updateParams(agent.name, p)}
                  onRunNow={() => runNow(agent.name)}
                />
              ))}
            </div>
          </div>
        );
      })}
      <style>{`
        @media (max-width: 1100px) {
          .mr-agent-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 700px) {
          .mr-agent-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Единственный инстанс модалки настроек — на все агенты сразу.
          Когда юзер кликает на ⚙ карточки, мы запоминаем имя агента,
          и эта модалка показывается с его данными. Никаких наслоений
          физически не может быть — компонент один. */}
      {settingsOpenFor && (() => {
        const targetAgent = agents.find(a => a.name === settingsOpenFor);
        if (!targetAgent) return null;
        const cat = targetAgent.category as AgentItem["category"];
        return (
          <AgentSettingsModal
            agent={targetAgent}
            neonColor={CATEGORY_NEON[cat]}
            schema={AGENT_PARAM_SCHEMAS[targetAgent.name] ?? []}
            missingConnections={getMissingConnections(targetAgent.name, connections)}
            onClose={() => setSettingsOpenFor(null)}
            onSave={async (newParams) => {
              await updateParams(targetAgent.name, newParams);
              setSettingsOpenFor(null);
            }}
            onRunNow={() => { runNow(targetAgent.name); setSettingsOpenFor(null); }}
            running={runningName === targetAgent.name}
          />
        );
      })()}
    </div>
  );
}

function AgentCard({
  agent, neonColor, running, schema, missingConnections,
  settingsOpen, onOpenSettings, onCloseSettings,
  onToggle, onScheduleChange, onParamsChange, onRunNow,
}: {
  agent: AgentItem;
  neonColor: string;
  running: boolean;
  schema: ParamField[];
  missingConnections: MissingConnection[];
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onToggle: (enabled: boolean) => void;
  onScheduleChange: (s: Schedule) => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onRunNow: () => void;
}) {
  const IconComp = ICON_MAP[AGENT_ICONS[agent.name] ?? "Bot"] ?? Bot;
  // Карточка больше не держит draft параметров — это делает SettingsModal в HubView.
  // Тут оставляем только helper-ы для UI кнопки «Настройки».
  const showSettings = settingsOpen;
  const openSettings = () => onOpenSettings();
  void onCloseSettings; void onParamsChange; // используются модалкой в HubView
  const statusColor = agent.lastRunStatus ? STATUS_COLORS[agent.lastRunStatus] ?? "var(--muted-foreground)" : "var(--muted-foreground)";
  const lastRunStr = agent.lastRunAt
    ? new Date(agent.lastRunAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "ещё не запускался";

  return (
    <div style={{
      background: "var(--card)",
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${neonColor}`,
      borderRadius: 14, padding: 18,
      display: "flex", flexDirection: "column", gap: 12,
      opacity: agent.enabled ? 1 : 0.78,
      boxShadow: agent.enabled ? `0 0 28px ${neonColor}14` : "none",
      transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Иконка категории — неон-цвет под акцентом, фон полупрозрачный */}
          <div style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 10,
            background: `${neonColor}18`, border: `1px solid ${neonColor}40`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: neonColor, boxShadow: `0 0 16px ${neonColor}20`,
          }}>
            <IconComp size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", marginBottom: 4, letterSpacing: -0.2 }}>
              {agent.label}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
              {agent.description}
            </div>
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

      {/* Предупреждение о недостающих коннектах. Показываем если хоть один
          missingConnection есть — даже когда агент выключен, юзер видит что
          включать сейчас бесполезно. */}
      {missingConnections.length > 0 && (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: "#f59e0b14", border: "1px solid #f59e0b40",
          fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5,
        }}>
          {missingConnections.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < missingConnections.length - 1 ? 6 : 0 }}>
              <AlertCircle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>{m.label}</div>
                <div>{m.hint}</div>
                {m.link && (
                  <a href={m.link} style={{ color: "#f59e0b", textDecoration: "underline", fontWeight: 600 }}>
                    Настроить →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
            onClick={openSettings}
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

      {/* Модал настроек больше НЕ рендерится здесь — он живёт в AgentHubView
          одним инстансом на всех агентов. Это гарантирует что наслоения не будет. */}
    </div>
  );
}

// ─── Полноценная модалка-«ЛК агента» с табами ─────────────────────────────
// Renders ровно один раз в AgentHubView (lifted state). 3 таба:
//   • Настройки — текущие params + сохранение
//   • История — последние 10 запусков (agent_runs)
//   • Подключения — что необходимо для работы, статус каждого

interface AgentRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
  duration_ms: number | null;
  needs_approval: boolean;
}

function AgentSettingsModal({
  agent, neonColor, schema, missingConnections,
  onClose, onSave, onRunNow, running,
}: {
  agent: AgentItem;
  neonColor: string;
  schema: ParamField[];
  missingConnections: MissingConnection[];
  onClose: () => void;
  onSave: (params: Record<string, unknown>) => Promise<void>;
  onRunNow: () => void;
  running: boolean;
}) {
  const IconComp = ICON_MAP[AGENT_ICONS[agent.name] ?? "Bot"] ?? Bot;
  const [tab, setTab] = useState<"settings" | "history" | "connections">("settings");
  const [paramsDraft, setParamsDraft] = useState<Record<string, unknown>>(agent.params);
  const [paramsDirty, setParamsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AgentRunRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Загружаем историю только когда юзер открывает соответствующий таб —
  // экономим на запросе при ленивых юзерах.
  useEffect(() => {
    if (tab !== "history" || history.length > 0) return;
    setHistoryLoading(true);
    fetch(`/api/agents/history?name=${encodeURIComponent(agent.name)}&limit=10`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setHistory(d.runs ?? []); })
      .finally(() => setHistoryLoading(false));
  }, [tab, agent.name, history.length]);

  const setField = (key: string, value: unknown) => {
    setParamsDraft(prev => ({ ...prev, [key]: value }));
    setParamsDirty(true);
  };
  const save = async () => {
    setSaving(true);
    try { await onSave(paramsDraft); } finally { setSaving(false); }
  };
  const resetDraft = () => { setParamsDraft(agent.params); setParamsDirty(false); };

  function fmt(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: `1px solid var(--border)`,
          borderTop: `4px solid ${neonColor}`,
          borderRadius: 18, padding: 0,
          maxWidth: 760, width: "100%", maxHeight: "88vh",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: `0 20px 80px rgba(0,0,0,0.6), 0 0 60px ${neonColor}22`,
        }}
      >
        {/* Header */}
        <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: `${neonColor}18`, border: `1px solid ${neonColor}40`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: neonColor, boxShadow: `0 0 22px ${neonColor}30`,
            }}>
              <IconComp size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: neonColor, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                ЛИЧНЫЙ КАБИНЕТ АГЕНТА
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "var(--foreground)", marginTop: 4, letterSpacing: -0.3 }}>
                {agent.label}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--foreground-secondary)", marginTop: 4, lineHeight: 1.5, maxWidth: 520 }}>
                {agent.description}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 8, padding: 7, cursor: "pointer",
              color: "var(--foreground-secondary)", flexShrink: 0,
            }}
            aria-label="Закрыть"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Last run banner */}
        {(agent.lastRunAt || agent.lastRunSummary) && (
          <div style={{ margin: "14px 28px 0", padding: "10px 14px", background: "color-mix(in oklch, var(--primary) 6%, transparent)", border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)", borderRadius: 10, fontSize: 12, color: "var(--foreground-secondary)" }}>
            <span style={{ fontWeight: 800, color: STATUS_COLORS[agent.lastRunStatus ?? "ok"] ?? "#6b7280" }}>{agent.lastRunStatus ?? "ok"}</span>
            {" · "}{fmt(agent.lastRunAt)}
            {agent.lastRunSummary && <><br /><span style={{ color: "var(--foreground)" }}>{agent.lastRunSummary}</span></>}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: "1px solid var(--border)" }}>
          {([
            ["settings", "Настройки", <SettingsIcon size={13} key="s" />],
            ["history", "История", <History size={13} key="h" />],
            ["connections", "Подключения", <AlertCircle size={13} key="c" />],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "9px 16px", borderRadius: 0,
                border: "none", borderBottom: tab === key ? `2px solid ${neonColor}` : "2px solid transparent",
                background: "transparent",
                color: tab === key ? neonColor : "var(--foreground-secondary)",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {icon} {label}
              {key === "connections" && missingConnections.length > 0 && (
                <span style={{ background: "#f59e0b", color: "#000", borderRadius: 9, padding: "0 6px", fontSize: 10, fontWeight: 800, marginLeft: 4 }}>
                  {missingConnections.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>
          {tab === "settings" && (
            schema.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {schema.map(field => (
                  <ParamFieldEditor
                    key={field.key}
                    field={field}
                    value={paramsDraft[field.key]}
                    onChange={v => setField(field.key, v)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "20px 0" }}>
                У этого агента нет настраиваемых параметров. Поведение полностью автоматическое.
              </div>
            )
          )}

          {tab === "history" && (
            historyLoading ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "20px 0" }}>
                Загружаем историю…
              </div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "20px 0" }}>
                Пока ни одного запуска. Нажмите «Запустить сейчас» внизу — появится запись.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map(run => (
                  <div key={run.id} style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: "color-mix(in oklch, var(--primary) 3%, transparent)",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: STATUS_COLORS[run.status] ?? "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {run.status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        {fmt(run.started_at)}{run.duration_ms ? ` · ${Math.round(run.duration_ms / 1000)} сек` : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                      {run.summary || <span style={{ color: "var(--muted-foreground)" }}>(без описания)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "connections" && (
            <div>
              {missingConnections.length === 0 ? (
                <div style={{ padding: 14, borderRadius: 10, background: "color-mix(in oklch, #22c55e 8%, transparent)", border: "1px solid #22c55e40", color: "var(--foreground)", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
                  <Check size={16} color="#22c55e" />
                  Все необходимые подключения настроены. Агент готов работать.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {missingConnections.map((m, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 10, background: "#f59e0b14", border: "1px solid #f59e0b40", fontSize: 13, color: "var(--foreground-secondary)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, color: "#f59e0b", marginBottom: 4 }}>{m.label}</div>
                          <div style={{ lineHeight: 1.6, marginBottom: 6 }}>{m.hint}</div>
                          {m.link && (
                            <a href={m.link} style={{ color: "#f59e0b", textDecoration: "underline", fontWeight: 600, fontSize: 13 }}>
                              Перейти к настройке →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "var(--card)" }}>
          <button
            onClick={() => { onRunNow(); }}
            disabled={running}
            style={{
              padding: "9px 16px", borderRadius: 9, border: `1px solid ${neonColor}55`,
              background: running ? `${neonColor}15` : "transparent",
              color: neonColor, fontWeight: 700, fontSize: 13, cursor: running ? "wait" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
            }}
          >
            {running ? <Loader2 size={13} className="mr-spin" /> : <Play size={13} />}
            {running ? "Запускается…" : "Запустить сейчас"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { resetDraft(); onClose(); }}
              style={{
                padding: "9px 18px", borderRadius: 9,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--foreground-secondary)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Закрыть
            </button>
            {tab === "settings" && (
              <button
                onClick={save}
                disabled={saving || !paramsDirty}
                style={{
                  padding: "9px 22px", borderRadius: 9, border: "none",
                  background: paramsDirty ? neonColor : "var(--muted)",
                  color: "#fff",
                  fontSize: 13, fontWeight: 800,
                  cursor: saving ? "wait" : (paramsDirty ? "pointer" : "not-allowed"),
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: "inherit",
                  boxShadow: paramsDirty ? `0 4px 16px ${neonColor}50` : "none",
                  opacity: paramsDirty ? 1 : 0.7,
                }}
              >
                {saving ? <Loader2 size={12} className="mr-spin" /> : <Save size={12} />}
                Сохранить
              </button>
            )}
          </div>
        </div>
      </div>
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
