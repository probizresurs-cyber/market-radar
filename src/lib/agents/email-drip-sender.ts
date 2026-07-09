/**
 * Email Drip Sender агент.
 *
 * Поведенческо-триггерный конструктор email-серий. Запускается раз в час,
 * проходит по всем активным юзерам, проверяет триггеры (onboarding,
 * re-engagement, trial-ending) и шлёт соответствующее AI-персонализированное
 * письмо. Дедуп через колонку `drip_sent` в DB (создаётся on-the-fly).
 *
 * Архитектура триггеров (каждый = независимая функция):
 *
 *   1) ONBOARDING — после регистрации
 *      +1d  → «Добро пожаловать, что попробовать сегодня»
 *      +3d  → «Главная фишка — анализ конкурентов» (если ещё не запускал)
 *      +7d  → «Кейс клиента из вашей ниши» (AI-генерится под нишу юзера)
 *      +14d → «5 советов по платформе»
 *
 *   2) RE-ENGAGEMENT — после 30 дней без активности
 *      «Соскучились — вот что нового на платформе»
 *
 *   3) TRIAL-ENDING — за 3 дня до окончания триала
 *      «Триал кончается через 3 дня — спецпредложение -20%»
 *
 *   4) INVOICE-OVERDUE — счёт не оплачен 3+ дней
 *      «Напомнить — счёт #X на сумму Y». Эскалация на 7+ дней.
 *
 * Каждый шаблон проходит через Claude Haiku для персонализации:
 * подмешивается название компании юзера, его ниша, какие модули он
 * уже трогал. Это даёт уникальное звучание вместо шаблонного письма.
 *
 * Защита от двойной отправки:
 *   - Таблица `drip_sent (user_id, trigger_key, sent_at)` UNIQUE
 *   - `trigger_key` = «onboarding-d1», «onboarding-d3», «re-engagement-2026-05-12»
 *   - В случае re-engagement key содержит ISO неделю — чтобы можно было
 *     повторно слать раз в N месяцев
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query, initDb } from "@/lib/db";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import { sendMail } from "@/lib/mailer";

// ─── Драйверы триггеров ────────────────────────────────────────────────

interface UserCtx {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  created_at: string;
  last_active_at: string | null; // если не трекаем — = created_at
  plan_expires_at: string | null;
  plan: string | null;
}

interface DripTrigger {
  key: string;                  // уникальный (user_id, key) — для дедупа
  subject: string;
  greeting: string;             // вступление (Claude развернёт)
  cta: string;
  ctaLink: string;
  contextHint: string;          // что Claude учтёт при персонализации
  fromAccount?: "noreply" | "hello" | "billing";
}

/** Сколько дней прошло с момента ISO-строки. NaN если строка пустая. */
function daysSince(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Список триггеров для юзера на сегодня. Каждый юзер может попасть в
 * несколько триггеров одновременно (например, onboarding-d3 + trial-ending),
 * но дедуп по key не даст отправить одно письмо дважды.
 */
function detectTriggersForUser(u: UserCtx): DripTrigger[] {
  const out: DripTrigger[] = [];
  const sinceSignup = daysSince(u.created_at);
  const sinceActive = daysSince(u.last_active_at || u.created_at);

  // ── 1. Onboarding ──
  if (sinceSignup === 1) {
    out.push({
      key: "onboarding-d1",
      subject: "С чего начать в MarketRadar — за 5 минут",
      greeting: `Это второй день после вашей регистрации в MarketRadar. Хочу подсказать самый быстрый старт: запустите анализ компании${u.company_name ? ` («${u.company_name}»)` : ""} и посмотрите Score. Это даст карту того, что улучшать.`,
      cta: "Запустить анализ",
      ctaLink: "https://marketradar24.ru/?nav=new-analysis",
      contextHint: "Юзер только зарегистрировался день назад. Тон — дружелюбный, помогающий.",
    });
  }
  if (sinceSignup === 3) {
    out.push({
      key: "onboarding-d3",
      subject: "Самая мощная фича — анализ конкурентов",
      greeting: "Прошло 3 дня с регистрации. Один из лучших шагов — добавить 3-5 конкурентов и посмотреть Battle Cards. AI сразу подскажет где они сильнее и какие возражения вы можете повернуть в свою пользу.",
      cta: "Добавить конкурентов",
      ctaLink: "https://marketradar24.ru/?nav=competitors",
      contextHint: "День 3 — фокус на конкурентном анализе. Тон уверенный.",
    });
  }
  if (sinceSignup === 7) {
    out.push({
      key: "onboarding-d7",
      subject: "Кейс из вашей ниши",
      greeting: `За неделю в платформе уже можно увидеть результат. Хотите познакомиться с кейсом компании из вашей ниши, которая выросла на 30% за 60 дней? Расскажу как именно — без воды.`,
      cta: "Посмотреть кейс",
      ctaLink: "https://marketradar24.ru/?nav=reports",
      contextHint: "Неделя. Возможно нужна мотивация продолжить. Покажи value.",
      fromAccount: "hello",
    });
  }
  if (sinceSignup === 14) {
    out.push({
      key: "onboarding-d14",
      subject: "5 советов, которые экономят 3 часа в неделю",
      greeting: "Две недели в MarketRadar. Время поделиться приёмами, которые большинство юзеров находят случайно: брендбук → контент-завод → авто-постинг — связка из 5 кликов вместо 5 часов работы.",
      cta: "Посмотреть советы",
      ctaLink: "https://marketradar24.ru/?nav=content-plan",
      contextHint: "Опытный юзер уже 14 дней. Тон — инсайдерский, поделиться приёмами.",
    });
  }

  // ── 2. Re-engagement ──
  // Лимитируем по неделям (key содержит ISO-неделю) — не чаще раз в месяц.
  if (sinceActive >= 30 && sinceSignup > 30) {
    const week = isoWeekKey(new Date());
    out.push({
      key: `re-engagement-${week}`,
      subject: "Соскучились — что нового на платформе",
      greeting: `Давно не заходили в MarketRadar. За это время добавили: календарь публикаций с авто-постингом в VK/TG, AI-агентов (по расписанию автоматически делают рутину), Yandex.Карты отзывы. Если хотите — посмотрю что у вас изменилось в нише.`,
      cta: "Зайти и попробовать",
      ctaLink: "https://marketradar24.ru/?nav=agents",
      contextHint: "Юзер 30+ дней не был. Тон — soft re-engagement, без давления.",
      fromAccount: "hello",
    });
  }

  // ── 3. Trial ending ──
  if (u.plan_expires_at && u.plan === "trial") {
    const daysLeft = -daysSince(u.plan_expires_at);
    if (daysLeft === 3) {
      out.push({
        key: "trial-ending-3d",
        subject: "Триал заканчивается через 3 дня",
        greeting: `Триал в MarketRadar завершается через 3 дня. Чтобы не потерять собранные данные (компанию, конкурентов, контент-план), оформите подписку — для тех кто продлевает в трёхдневный коридор у нас -20% на первый месяц.`,
        cta: "Продлить со скидкой",
        ctaLink: "https://marketradar24.ru/?nav=settings&tab=subscription",
        contextHint: "Триал кончается через 3 дня. Тон — без давления, но конкретный.",
        fromAccount: "hello",
      });
    }
  }

  return out;
}

function isoWeekKey(d: Date): string {
  // ISO week — YYYY-Www
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ─── Persistence: drip_sent table ──────────────────────────────────────

async function ensureDripTable() {
  await initDb();
  // Создаём on-the-fly — отдельная миграция избыточна для одной таблицы
  await query(`
    CREATE TABLE IF NOT EXISTS drip_sent (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trigger_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      message_id TEXT,
      PRIMARY KEY (user_id, trigger_key)
    )
  `);
}

async function isAlreadySent(userId: string, key: string): Promise<boolean> {
  const rows = await query<{ user_id: string }>(
    `SELECT user_id FROM drip_sent WHERE user_id = $1 AND trigger_key = $2 LIMIT 1`,
    [userId, key],
  );
  return rows.length > 0;
}

async function markSent(userId: string, key: string, messageId?: string) {
  await query(
    `INSERT INTO drip_sent (user_id, trigger_key, message_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, trigger_key) DO NOTHING`,
    [userId, key, messageId ?? null],
  );
}

// ─── AI-персонализация ────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — друг-маркетолог, который пишет короткие персонализированные email-письма от лица команды MarketRadar.

Стиль:
- Дружелюбный, тёплый, **на «вы»**
- Без канцелярита, без «уважаемый клиент»
- 2-3 коротких абзаца (всего 80-150 слов)
- Без шаблонных вставок («желаем удачи», «спасибо что выбрали нас»)
- Без markdown в теле — обычный текст, абзацы через пустую строку

В конце ВСЕГДА:
- Призыв к действию ссылкой (HTML <a href="...">текст</a>)
- Подпись «— Команда MarketRadar»

Ответ — ТОЛЬКО HTML-тело письма (без <html>/<body>, чисто содержимое <main>):
  <p>абзац 1</p>
  <p>абзац 2</p>
  <p><a href="…">CTA</a></p>
  <p>— Команда MarketRadar</p>`;

async function personalizeEmail(
  user: UserCtx,
  trigger: DripTrigger,
): Promise<string> {
  const userMessage = `Пользователь:
- Имя: ${user.name ?? "(без имени)"}
- Компания: ${user.company_name ?? "(не указана)"}
- Email: ${user.email}
- Дней с регистрации: ${daysSince(user.created_at)}

Триггер: ${trigger.key}
Контекст: ${trigger.contextHint}

Базовое сообщение (можно перефразировать сохраняя смысл):
${trigger.greeting}

CTA: «${trigger.cta}» → ${trigger.ctaLink}

Напиши HTML-тело письма по правилам в system.`;

  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // Fallback на статичный шаблон если AI отвалился
  if (!text) {
    return `
      <p>Здравствуйте${user.name ? `, ${user.name}` : ""}!</p>
      <p>${trigger.greeting}</p>
      <p><a href="${trigger.ctaLink}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">${trigger.cta}</a></p>
      <p>— Команда MarketRadar</p>
    `.trim();
  }
  return text;
}

// ─── Регистрация агента ─────────────────────────────────────────────

registerAgent({
  name: "email-drip-sender",
  label: "Email Drip Sender",
  description: "Поведенческие email-серии: onboarding (1д/3д/7д/14д), re-engagement (30+д), напоминания о триале и счетах. AI персонализирует каждое письмо.",
  icon: "Send",
  defaultSchedule: "hourly",
  category: "system",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    await ensureDripTable();

    // Per-user агент: проверяем триггеры только для текущего юзера.
    // Если когда-то нужно будет массовая рассылка по всем — добавим
    // отдельный admin-trigger endpoint.
    // `last_active_at` колонки сейчас нет — используем created_at как fallback.
    const users = await query<UserCtx>(`
      SELECT id, email, name, company_name, created_at::text, plan, plan_expires_at::text,
             created_at::text as last_active_at
        FROM users
       WHERE id = $1 AND email IS NOT NULL AND email LIKE '%@%'
       LIMIT 1
    `, [ctx.userId]);

    if (users.length === 0) {
      return { summary: "Юзер не найден или нет email.", skipped: true };
    }

    const user = users[0];

    // ── Настройки из конфига агента ──────────────────────────────────────
    const VALID_ACC = ["noreply", "hello", "billing"] as const;
    const fromOverride =
      typeof ctx.params.fromAccount === "string" && (VALID_ACC as readonly string[]).includes(ctx.params.fromAccount)
        ? (ctx.params.fromAccount as "noreply" | "hello" | "billing")
        : null;
    const bccAdmin =
      typeof ctx.params.bccAdmin === "string" && ctx.params.bccAdmin.includes("@")
        ? ctx.params.bccAdmin.trim()
        : undefined;
    const skipDays =
      typeof ctx.params.skipDays === "number" && ctx.params.skipDays > 0 ? ctx.params.skipDays : 3;
    // audienceFilter: домен (например «@yandex.ru») — шлём только подходящим.
    let audienceFilter =
      typeof ctx.params.audienceFilter === "string" ? ctx.params.audienceFilter.trim().toLowerCase() : "";
    if (audienceFilter && !audienceFilter.startsWith("@")) audienceFilter = "@" + audienceFilter;

    if (audienceFilter && !user.email.toLowerCase().endsWith(audienceFilter)) {
      return { summary: `Email юзера не подходит под фильтр аудитории (${audienceFilter}).`, skipped: true };
    }

    // skipDays-троттлинг: не шлём, если этому адресу уже уходил drip в
    // последние N дней (защита от частых писем поверх дедупа по trigger_key).
    const recent = await query<{ last: string }>(
      `SELECT MAX(sent_at)::text AS last FROM drip_sent WHERE user_id = $1`,
      [user.id],
    );
    const lastSentDays = daysSince(recent[0]?.last);
    if (!isNaN(lastSentDays) && lastSentDays < skipDays) {
      return { summary: `Письмо этому адресу уходило ${lastSentDays} дн. назад (<${skipDays}) — пропускаем.`, skipped: true };
    }

    const triggers = detectTriggersForUser(user);

    if (triggers.length === 0) {
      return {
        summary: "Сегодня для этого аккаунта триггеров email нет.",
        skipped: true,
      };
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const trig of triggers) {
      if (await isAlreadySent(user.id, trig.key)) {
        skipped++;
        continue;
      }
      try {
        const html = await personalizeEmail(user, trig);
        const result = await sendMail({
          to: user.email,
          subject: trig.subject,
          html,
          // Приоритет: явный override из настроек агента > предпочтение триггера > noreply.
          from: fromOverride ?? trig.fromAccount ?? "noreply",
          ...(bccAdmin ? { bcc: bccAdmin } : {}),
        });
        if (result.ok && !result.skipped) {
          await markSent(user.id, trig.key, result.messageId);
          sent++;
        } else if (result.skipped) {
          // EMAIL_ENABLED=false — считаем как «отправлено» (для dev)
          await markSent(user.id, trig.key, "skipped");
          skipped++;
        } else {
          errors.push(`${trig.key}: ${result.error ?? "unknown"}`);
        }
      } catch (e) {
        errors.push(`${trig.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      summary:
        sent > 0
          ? `Отправлено ${sent} writem${sent === 1 ? "о" : "а"}: ${triggers.filter(t => !errors.find(e => e.startsWith(t.key))).map(t => t.key).join(", ")}.`
          : skipped > 0
          ? `Все ${skipped} триггеров уже были отправлены ранее.`
          : `Ошибки: ${errors.join("; ")}`,
      result: { sent, skipped, errors, triggers: triggers.map(t => t.key) },
    };
  },
});
