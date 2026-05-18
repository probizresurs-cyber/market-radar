/**
 * AI Visibility Monitor — еженедельный аудит видимости бренда в нейросетях.
 *
 * Запрашивает 5-10 вопросов из ниши у ChatGPT / Claude / YandexGPT, считает
 * mention rate (% запросов, где бренд упомянут) и сравнивает с прошлой неделей.
 * Алертит при падении ≥10% — это важный сигнал что GEO-стратегия буксует.
 *
 * Параметры (params в agent_configs):
 *   - brandName: string (опц) — берём из users.last_analyzed_company.name если не задано
 *   - websiteUrl: string (опц) — из users.last_analyzed_company.url
 *   - niche: string (опц) — берём из last_analyzed_company / описания
 *   - queries: string[] (опц) — кастомные запросы. Если пусто — генерим через Claude
 *   - llms: string[] (опц) — какие модели проверять. Default: ["chatgpt", "claude", "yandex"]
 *   - alertDropPct: number (опц) — на сколько % должен упасть mention rate. Default: 10
 *
 * Стратегия:
 *   1. Резолвим brandName + niche
 *   2. Если params.queries пуст — Claude генерит 5 запросов
 *   3. Для каждой LLM (через /api/ai-visibility/check-llm) проверяем все запросы
 *   4. Считаем mentionRate = mentioned / total на каждую LLM + overall
 *   5. Сравниваем с params.lastSnapshot (если есть)
 *   6. При падении ≥ alertDropPct — TG alert + inbox card
 *   7. Сохраняем snapshot в params.lastSnapshot
 *
 * Cron: weekly (GEO-показатели меняются медленно, чаще — лишний расход API).
 */

import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";
import { randomUUID } from "crypto";

type LLM = "chatgpt" | "claude" | "yandex" | "gemini" | "perplexity";

interface CheckResult {
  llm: LLM;
  query: string;
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  isSimulated?: boolean;
  unavailable?: boolean;
}

interface VisibilitySnapshot {
  takenAt: string;          // ISO
  brandName: string;
  niche: string;
  queries: string[];
  // mentionRate per LLM (0-100). null если LLM была недоступна.
  rates: Record<string, number | null>;
  overallRate: number;
}

const PUBLIC_HOST = (process.env.PUBLIC_HOST?.replace(/\/$/, "") || "http://localhost:3000");

/** Telegram-alert. */
async function sendTelegram(userId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatRows = await query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM users WHERE id = $1`,
    [userId],
  );
  const chatId = chatRows[0]?.telegram_chat_id;
  if (!chatId) return;
  try {
    const base = process.env.TG_API_BASE ?? "https://api.telegram.org";
    await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.warn("[ai-vis-monitor] TG send failed:", e);
  }
}

/** Через Haiku генерируем 5 реалистичных запросов из ниши.
 *  Запросы должны быть «как у обычного юзера», без подсказок про бренд. */
async function generateQueries(niche: string): Promise<string[]> {
  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Сгенерируй 5 реалистичных поисковых запросов на русском, которые человек задал бы ChatGPT при выборе компании в нише: "${niche}".

Запросы должны:
- Звучать как живой разговор, не SEO-формула
- Включать намерение выбрать/купить/заказать (transactional intent)
- Быть длинными (5-12 слов) — короткие AI плохо обрабатывает
- НЕ упоминать конкретный бренд

Верни JSON массив строк: ["запрос 1", "запрос 2", ...]`,
    }],
  });
  if (!text) return [];
  const parsed = extractJson<string[]>(text);
  return Array.isArray(parsed) ? parsed.slice(0, 5).filter(s => typeof s === "string" && s.length > 5) : [];
}

/** Вызывает существующий /api/ai-visibility/check-llm для одной модели + списка запросов. */
async function checkLLM(llm: LLM, queries: string[], brandName: string, niche: string): Promise<CheckResult[]> {
  try {
    const r = await fetch(`${PUBLIC_HOST}/api/ai-visibility/check-llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, queries, brandName, niche }),
      // 60 сек на каждую LLM × 5 запросов — большой запас.
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) {
      console.warn(`[ai-vis-monitor] check-llm failed for ${llm}: ${r.status}`);
      return queries.map(q => ({ llm, query: q, mentioned: false, position: null, sentiment: null, unavailable: true }));
    }
    const data = await r.json() as { ok: boolean; mentions?: CheckResult[] };
    if (!data.ok || !data.mentions) {
      return queries.map(q => ({ llm, query: q, mentioned: false, position: null, sentiment: null, unavailable: true }));
    }
    return data.mentions;
  } catch (e) {
    console.warn(`[ai-vis-monitor] check-llm error for ${llm}:`, e);
    return queries.map(q => ({ llm, query: q, mentioned: false, position: null, sentiment: null, unavailable: true }));
  }
}

registerAgent({
  name: "ai-visibility-monitor",
  label: "AI Visibility Monitor",
  description: "Раз в неделю проверяет упоминания вашего бренда в ChatGPT / Claude / YandexGPT. Алертит при падении видимости.",
  icon: "Bot",
  defaultSchedule: "weekly",
  category: "visibility",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const params = ctx.params as {
      brandName?: string;
      websiteUrl?: string;
      niche?: string;
      queries?: string[];
      llms?: LLM[];
      alertDropPct?: number;
      lastSnapshot?: VisibilitySnapshot;
    };

    // ── Резолвим brand + niche + queries ─────────────────────────
    let brandName = params.brandName?.trim();
    let niche = params.niche?.trim();
    if (!brandName || !niche) {
      const rows = await query<{
        last_analyzed_company: { name?: string; url?: string; niche?: string; description?: string } | null;
      }>(
        `SELECT last_analyzed_company FROM users WHERE id = $1`,
        [ctx.userId],
      );
      const lc = rows[0]?.last_analyzed_company;
      brandName = brandName || lc?.name?.trim();
      niche = niche || lc?.niche?.trim() || lc?.description?.split(/[.,!?]/)?.[0]?.trim();
    }
    if (!brandName) {
      return {
        summary: "Не нашёл brand name. Запустите анализ компании или укажите в настройках.",
        skipped: true,
      };
    }
    if (!niche) niche = "услуги";

    let queries = Array.isArray(params.queries) && params.queries.length > 0
      ? params.queries
      : [];
    if (queries.length === 0) {
      queries = await generateQueries(niche);
      if (queries.length === 0) {
        return {
          summary: `Не смог сгенерировать запросы для ниши «${niche}». Укажите вручную в настройках.`,
          skipped: true,
        };
      }
      // Сохраняем сгенерированные запросы в params чтобы трекать ту же выборку из недели в неделю
      // (иначе сравнение mention rate будет нечестным — разные запросы → разные шансы).
      await query(
        `UPDATE agent_configs
            SET params = jsonb_set(params, '{queries}', $1::jsonb), updated_at = NOW()
          WHERE user_id = $2 AND agent_name = 'ai-visibility-monitor'`,
        [JSON.stringify(queries), ctx.userId],
      );
    }

    const llms: LLM[] = Array.isArray(params.llms) && params.llms.length > 0
      ? params.llms
      : ["chatgpt", "claude", "yandex"];
    const alertDropPct = params.alertDropPct ?? 10;

    // ── Опрашиваем каждую LLM параллельно ────────────────────────
    const allMentions: CheckResult[] = [];
    const llmResults = await Promise.all(llms.map(llm => checkLLM(llm, queries, brandName!, niche!)));
    for (const arr of llmResults) allMentions.push(...arr);

    // ── Считаем mention rate per LLM + overall ───────────────────
    const rates: Record<string, number | null> = {};
    let totalChecked = 0;
    let totalMentioned = 0;
    for (const llm of llms) {
      const llmMentions = allMentions.filter(m => m.llm === llm && !m.unavailable);
      if (llmMentions.length === 0) {
        rates[llm] = null;
        continue;
      }
      const mentioned = llmMentions.filter(m => m.mentioned).length;
      rates[llm] = Math.round((mentioned / llmMentions.length) * 1000) / 10;
      totalChecked += llmMentions.length;
      totalMentioned += mentioned;
    }
    const overallRate = totalChecked > 0 ? Math.round((totalMentioned / totalChecked) * 1000) / 10 : 0;

    const snapshot: VisibilitySnapshot = {
      takenAt: new Date().toISOString(),
      brandName: brandName!,
      niche: niche!,
      queries,
      rates,
      overallRate,
    };

    // ── Сравниваем с прошлой неделей ─────────────────────────────
    const last = params.lastSnapshot;
    let alertText: string | null = null;
    let trendBits: string[] = [];

    if (last) {
      const diff = overallRate - last.overallRate;
      const sign = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
      trendBits.push(`${last.overallRate}% → ${overallRate}% (${sign}${Math.abs(diff).toFixed(1)}%)`);

      // Алертим только при падении. Рост — тоже сохраняем, но без TG-спама.
      if (diff <= -alertDropPct) {
        const perLlm = llms.map(l => {
          const before = last.rates[l];
          const now = rates[l];
          if (before == null || now == null) return null;
          const d = now - before;
          if (Math.abs(d) < 1) return null;
          return `• <b>${l}</b>: ${before}% → ${now}% (${d > 0 ? "↑" : "↓"}${Math.abs(d).toFixed(1)}%)`;
        }).filter(Boolean).join("\n");
        alertText =
          `🚨 <b>AI-видимость ${brandName} просела на ${Math.abs(diff).toFixed(1)}%</b>\n\n` +
          `Общий mention rate: ${last.overallRate}% → <b>${overallRate}%</b>\n\n` +
          (perLlm || "По отдельным LLM ниже порога") +
          `\n\nПодробности и план — в платформе MarketRadar24.`;
      }
    } else {
      trendBits.push(`первый замер: ${overallRate}%`);
    }

    // ── Сохраняем snapshot для следующей недели ──────────────────
    await query(
      `UPDATE agent_configs
          SET params = jsonb_set(params, '{lastSnapshot}', $1::jsonb), updated_at = NOW()
        WHERE user_id = $2 AND agent_name = 'ai-visibility-monitor'`,
      [JSON.stringify(snapshot), ctx.userId],
    );

    // ── Inbox card со снапшотом всегда (даже если не было падения) ──
    const ratesStr = llms.map(l => `${l}: ${rates[l] !== null ? rates[l] + "%" : "n/a"}`).join(" · ");
    const inboxSummary = `📊 ${brandName} · ${overallRate}% mention rate · ${ratesStr} · ${trendBits.join(", ")}`;
    await query(
      `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                               summary, result, needs_approval)
         VALUES ($1, $2, 'ai-visibility-monitor', NOW(), NOW(), 'ok', $3, $4::jsonb, false)`,
      [randomUUID(), ctx.userId, inboxSummary.slice(0, 500), JSON.stringify({ snapshot, allMentions })],
    );

    // ── TG-alert при падении ─────────────────────────────────────
    if (alertText) {
      await sendTelegram(ctx.userId, alertText);
    }

    return {
      summary: `${brandName}: ${overallRate}% mention rate (${trendBits.join(", ")}). ${alertText ? "🚨 алерт отправлен" : "стабильно"}.`,
      // Каст в Record<string, unknown> — типы агентов ожидают generic-objект.
      result: snapshot as unknown as Record<string, unknown>,
    };
  },
});
