import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveChatId } from "@/lib/tgStore";
import { canScan, recordScan, formatNextAllowed } from "@/lib/tg-scan-limiter";
import { query, initDb } from "@/lib/db";
import { sendTelegramMessage, answerTelegramCallback, escapeTgHtml, type TgInlineButton } from "@/lib/tg-send";
import {
  isManagerChat, createDraft, listQueue, activeDraftFor, applyRevision, approvePost,
  rejectPost, stopEditing, regenerateDraft, parseMskDateTime, formatMsk, channelLabel,
  RUBRICS, rubricByKey, getPost as getChannelPost, type Rubric,
} from "@/lib/channel-poster";
import { scrapeWebsite } from "@/lib/scraper";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { estimateTokens } from "@/lib/with-ai-security";
import { PRICES, FIRST_MONTH_DISCOUNTS, fmtRub } from "@/lib/pricing-constants";
import {
  sendKpInboundAck, forwardToKpManager, extractClientChatId, sendKpTgMessage, kpShareUrl,
  sendKpConnected, sendKpCodeInvalid,
  type KpFunnelCtx, type KpTgLocale,
} from "@/lib/kp-tg-funnel";

const SITE = "https://marketradar24.ru";

async function sendMessage(chatId: number, text: string, keyboard?: TgInlineButton[][]) {
  // Вся отправка — через общий хелпер (TG_API_BASE-прокси, проверка ответа,
  // логирование ошибок). Ошибку не пробрасываем: webhook должен ответить 200.
  await sendTelegramMessage({ chatId, text, inlineKeyboard: keyboard });
}

// ─── Message templates ──────────────────────────────────────────────────────

const WELCOME = (name: string) =>
  `👋 Привет, ${name}!\n\n` +
  `Это <b>MarketRadar</b> — ИИ-анализ конкурентов и бренд-стратегия для российского рынка.\n\n` +
  `<b>Что умеет:</b>\n` +
  `• Экспресс-аудит сайта прямо здесь, в боте: пришлите ссылку — верну разбор через 1–2 минуты\n` +
  `• Полный анализ: SEO, соцсети, вакансии, отзывы, карты, ЦА, CJM, брендбук\n` +
  `• Сравнение с 7+ конкурентами + Battle Cards для отдела продаж\n` +
  `• Контент-завод: посты, рилсы, сторис, SEO-статьи, лендинги\n\n` +
  `<b>Команды:</b>\n` +
  `/express — бесплатный экспресс-аудит в Telegram\n` +
  `/price — тарифы и продукты\n` +
  `/partners — партнёрская программа (до 50%)\n` +
  `/connect — подключить уведомления по коду MR-XXXXXX\n` +
  `/site — открыть сайт\n` +
  `/help — все команды`;

const HELP =
  `<b>Доступные команды:</b>\n\n` +
  `/express — бесплатный экспресс-аудит сайта в Telegram\n` +
  `/price — тарифы и продукты (экспресс ${fmtRub(PRICES.expressPaid)} · полный ${fmtRub(PRICES.fullReport)})\n` +
  `/partners — партнёрская программа (20–50% комиссии)\n` +
  `/about — что такое MarketRadar\n` +
  `/connect — подключить уведомления из кабинета (код MR-XXXXXX)\n` +
  `/site — открыть сайт\n` +
  `/help — эта справка\n\n` +
  `💡 Можно просто отправить ссылку на сайт (https://example.ru) — сделаю экспресс-аудит прямо здесь. Бесплатно, 1 раз в месяц.`;

const ABOUT =
  `<b>MarketRadar</b> — SaaS-платформа для бизнеса и агентств в России.\n\n` +
  `Автоматически анализирует:\n` +
  `• сайт, SEO, Core Web Vitals\n` +
  `• соцсети и контент-стратегию\n` +
  `• вакансии (HH.ru), реквизиты (DaData)\n` +
  `• отзывы и рейтинги (Google, Яндекс, 2ГИС)\n` +
  `• целевую аудиторию, CJM, брендбук\n` +
  `• до 10 конкурентов в одном дашборде\n\n` +
  `Работает на Claude (Anthropic).\n` +
  `Мониторинг обновляется каждые 30 дней.`;

const PRICE =
  `<b>💰 Тарифы MarketRadar</b>\n\n` +
  `<b>🎁 Бесплатный экспресс в Telegram — ${fmtRub(PRICES.expressFree)}</b>\n` +
  `Мини-аудит сайта прямо в боте: что за бизнес, сильные и слабые места, следующий шаг.\n` +
  `→ команда /express\n\n` +
  `<b>💎 Экспресс-отчёт на сайте — ${fmtRub(PRICES.expressPaid)} по промокоду START</b>\n` +
  `Полный экспресс с сохранением на email + готовый PDF.\n` +
  `→ ${SITE}/express-report\n\n` +
  `<b>🚀 Полный отчёт + 30 дней в платформе — ${fmtRub(PRICES.fullReport)}</b> <i>(вместо ${fmtRub(PRICES.fullReportOriginal)})</i>\n` +
  `• Все 15 решений и рекомендаций\n` +
  `• Портрет ЦА, CJM, брендбук\n` +
  `• Battle Cards для отдела продаж\n` +
  `• Мониторинг 24/7\n\n` +
  `⭐ <b>Скидка 50% на первый месяц</b> любого тарифа после покупки полного отчёта:\n` +
  FIRST_MONTH_DISCOUNTS.map(t => `${t.name} ${fmtRub(t.discounted)}`).join(" · ");

const PARTNERS =
  `<b>🤝 Партнёрская программа MarketRadar</b>\n\n` +
  `<b>Реферальный уровень — 20%</b>\n` +
  `Приводите клиентов по своей ссылке и получайте 20% с каждой оплаты. Клиент получает 10% скидки.\n\n` +
  `<b>Интеграторский уровень — до 50%</b>\n` +
  `Прогрессивная шкала по объёму:\n` +
  `• 1–5 клиентов — 25%\n` +
  `• 6–15 — 30%\n` +
  `• 16–30 — 40%\n` +
  `• 31+ — 50%\n\n` +
  `Выплаты ежемесячно на карту или расчётный счёт.\n` +
  `Подробнее: ${SITE}/partners`;

const EXPRESS_PROMPT =
  `<b>🔍 Бесплатный экспресс-аудит</b>\n\n` +
  `Отправьте мне ссылку на ваш сайт — например <code>https://example.ru</code>.\n\n` +
  `Через 1–2 минуты верну мини-аудит прямо сюда: что за бизнес, 3 сильных стороны, 3 слабых места сайта и самое важное следующее действие.\n\n` +
  `💡 Хотите полный экспресс с сохранением на email и PDF? Перейдите на сайт с промокодом <b>START</b> — отдадим за ${fmtRub(PRICES.expressPaid)}:\n` +
  `${SITE}/express-report`;

const CONNECT_PROMPT =
  `🔗 Чтобы подключить уведомления:\n\n` +
  `1. Откройте MarketRadar → <b>Настройки → Уведомления</b>\n` +
  `2. Скопируйте код формата <code>MR-XXXXXX</code>\n` +
  `3. Отправьте его сюда\n\n` +
  `После этого сюда будут приходить: готовые анализы, изменения у конкурентов, дайджест раз в неделю.`;

const SCANNING = (url: string) =>
  `📥 Принял ссылку: <code>${escapeTgHtml(url)}</code>\n\n` +
  `🔍 Сканирую сайт и готовлю экспресс-аудит — обычно занимает 1–2 минуты. Результат пришлю сюда.`;

const AUDIT_FAILED = (url: string) =>
  `😔 Не удалось просканировать <code>${escapeTgHtml(url)}</code> — сайт не ответил или закрыт от роботов.\n\n` +
  `Бесплатная попытка этого месяца <b>не потрачена</b> — можно прислать другую ссылку.\n\n` +
  `Либо запустите полный экспресс на сайте:\n` +
  `💎 За ${fmtRub(PRICES.expressPaid)} по промокоду START → ${SITE}/express-report?url=${encodeURIComponent(url)}`;

const SCAN_LIMIT_REACHED = (nextDate: string) =>
  `⏳ <b>Лимит на месяц исчерпан</b>\n\n` +
  `Бесплатный экспресс-аудит — 1 раз в месяц с одного аккаунта. ` +
  `Следующее сканирование будет доступно с <b>${nextDate}</b>.\n\n` +
  `Если нужен полный отчёт прямо сейчас — оформите экспресс на сайте за <b>${fmtRub(PRICES.expressPaid)}</b> по промокоду <code>START</code>:\n` +
  `${SITE}/express-report\n\n` +
  `Или полный анализ + 30 дней в платформе за ${fmtRub(PRICES.fullReport)}:\n` +
  `${SITE}/pricing`;

const SITE_BUTTONS: TgInlineButton[][] = [
  [{ text: "🚀 Открыть MarketRadar", url: SITE }],
  [
    { text: `💎 Экспресс за ${fmtRub(PRICES.expressPaid)}`, url: `${SITE}/express-report` },
    { text: "📊 Тарифы", url: `${SITE}/pricing` },
  ],
  [{ text: "🤝 Партнёрам", url: `${SITE}/partners` }],
];

const EXPRESS_BUTTONS: TgInlineButton[][] = [
  [{ text: `💎 Полный экспресс за ${fmtRub(PRICES.expressPaid)} (START)`, url: `${SITE}/express-report` }],
  [{ text: "🚀 Перейти на сайт", url: SITE }],
];

const PRICE_BUTTONS: TgInlineButton[][] = [
  [{ text: "📊 Все тарифы на сайте", url: `${SITE}/pricing` }],
  [{ text: `💎 Экспресс за ${fmtRub(PRICES.expressPaid)} (START)`, url: `${SITE}/express-report` }],
];

const PARTNERS_BUTTONS: TgInlineButton[][] = [
  [{ text: "🤝 Стать партнёром", url: `${SITE}/partners` }],
];

// ─── Экспресс-аудит в боте ──────────────────────────────────────────────────

interface TgExpressAudit {
  business: string;
  strengths: string[];
  weaknesses: string[];
  nextStep: string;
}

function formatAudit(url: string, a: TgExpressAudit): string {
  const li = (items: string[]) => items.slice(0, 3).map(s => `• ${escapeTgHtml(s)}`).join("\n");
  return (
    `📋 <b>Экспресс-аудит</b> <code>${escapeTgHtml(url)}</code>\n\n` +
    `<b>Что за бизнес:</b> ${escapeTgHtml(a.business)}\n\n` +
    `💪 <b>Сильные стороны сайта:</b>\n${li(a.strengths)}\n\n` +
    `⚠️ <b>Слабые места:</b>\n${li(a.weaknesses)}\n\n` +
    `🎯 <b>Следующий шаг:</b> ${escapeTgHtml(a.nextStep)}\n\n` +
    `Полный отчёт со score, 5 категориями и базой конкурентов — по кнопке ниже.`
  );
}

/**
 * Учёт AI-расхода бота в ai_logs. checkAiAccess здесь неприменим — у
 * Telegram-чата нет auth-сессии. user_id — владелец chatId, если он привязал
 * бота в настройках; иначе NULL (FK на users(id) не позволяет служебное
 * значение вроде "tg-anon" — анонимные вызовы находятся по endpoint'у).
 */
async function logAuditToAiLogs(opts: {
  chatId: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    const owner = await query<{ id: string }>(
      `SELECT id FROM users WHERE telegram_chat_id = $1 LIMIT 1`,
      [opts.chatId],
    );
    await query(
      `INSERT INTO ai_logs
         (id, user_id, endpoint, model, prompt_tokens, completion_tokens, total_tokens,
          duration_ms, success, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(),
        owner[0]?.id ?? null,
        "telegram/express-audit",
        opts.model,
        opts.promptTokens || null,
        opts.completionTokens || null,
        (opts.promptTokens + opts.completionTokens) || null,
        opts.durationMs,
        opts.success,
        opts.errorMessage ?? null,
      ],
    );
  } catch (e) {
    console.error("[tg webhook] ai_logs insert failed:", e);
  }
}

/**
 * Настоящий экспресс-аудит: скрейп главной (cheerio, таймаут ~10с внутри
 * scrapeWebsite) → Claude Sonnet → структурированный мини-отчёт в чат.
 * Запускается fire-and-forget ПОСЛЕ ответа Telegram'у (см. POST).
 * Лимит 1/мес списывается ТОЛЬКО при успешно доставленном аудите.
 */
async function runExpressAudit(chatId: number, url: string): Promise<void> {
  const startedAt = Date.now();
  let system = "";
  let siteSummary = "";
  try {
    const site = await scrapeWebsite(url);
    siteSummary = [
      `URL: ${site.url}`,
      `Title: ${site.title || "(пусто)"}`,
      `Meta description: ${site.metaDescription || "(пусто)"}`,
      site.h1.length ? `H1: ${site.h1.slice(0, 3).join(" | ")}` : "H1: отсутствует",
      site.h2.length ? `H2: ${site.h2.join(" | ")}` : "",
      `HTTPS: ${site.isHttps}; viewport: ${site.hasViewport}; schema.org: ${site.hasSchemaMarkup}; canonical: ${site.hasCanonical}`,
      `robots.txt: ${site.hasRobotsTxt}; sitemap.xml: ${site.hasSitemap}`,
      `Картинок: ${site.imageCount}, из них с alt: ${site.imagesWithAlt}`,
      `Ссылки на соцсети: ${Object.keys(site.socialLinks).join(", ") || "не найдены"}`,
      `Технологии: ${site.techStack.join(", ") || "не определены"}`,
      site.jsHeavy ? "ВНИМАНИЕ: контент рендерится JS — текст страницы почти не виден без браузера." : "",
      `Текст страницы (фрагмент): ${site.rawTextSample.slice(0, 2500)}`,
    ].filter(Boolean).join("\n");

    system =
      `${ANTI_HALLUCINATION_SHORT}\n\n` +
      `Ты — аудитор сайтов платформы MarketRadar. По данным главной страницы составь краткий ` +
      `экспресс-аудит для владельца бизнеса. Пиши по-русски, конкретно, без воды и без обращений. ` +
      `Опирайся ТОЛЬКО на переданные данные.\n` +
      `Ответь СТРОГО валидным JSON без markdown:\n` +
      `{"business": "что это за бизнес, 1-2 предложения", ` +
      `"strengths": ["ровно 3 сильных стороны сайта"], ` +
      `"weaknesses": ["ровно 3 слабых места сайта"], ` +
      `"nextStep": "одно самое важное следующее действие"}`;

    const r = await chatJson<TgExpressAudit>({
      system,
      user: siteSummary,
      maxTokens: 1200,
      model: CHAT_MODEL_SMART,
    });
    if (!r.data?.business || !Array.isArray(r.data.strengths) || !Array.isArray(r.data.weaknesses)) {
      throw new Error(r.error ?? "модель вернула неполный аудит");
    }

    // Сначала доставляем результат, потом списываем лимит — если отправка
    // упала (бот заблокирован и т.п.), бесплатная попытка не сгорает.
    const sent = await sendTelegramMessage({
      chatId,
      text: formatAudit(url, r.data),
      inlineKeyboard: [
        [{ text: `💎 Полный отчёт за ${fmtRub(PRICES.expressPaid)} (START)`, url: `${SITE}/express-report?url=${encodeURIComponent(url)}` }],
        [{ text: "🚀 Открыть MarketRadar", url: SITE }],
      ],
    });
    if (!sent.ok) throw new Error(`не доставлено в чат: ${sent.error}`);

    await recordScan(chatId, url);
    await logAuditToAiLogs({
      chatId,
      model: r.modelUsed,
      promptTokens: estimateTokens(system + siteSummary),
      completionTokens: estimateTokens(r.raw),
      durationMs: Date.now() - startedAt,
      success: true,
    });
  } catch (err) {
    console.error("[tg webhook] express audit failed:", err);
    await sendMessage(chatId, AUDIT_FAILED(url), EXPRESS_BUTTONS);
    await logAuditToAiLogs({
      chatId,
      model: CHAT_MODEL_SMART,
      promptTokens: estimateTokens(system + siteSummary),
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

interface KpClientRow {
  id: string;
  company_name: string | null;
  url: string;
  locale: string;
  share_token: string | null;
  rebuild_id: string | null;
  rebuild_status: string | null;
}

/** КП-клиент? Берём самую свежую привязанную заявку (клиент мог подключить несколько). */
async function findKpClient(chatId: number): Promise<KpClientRow | null> {
  await initDb();
  const rows = await query<KpClientRow>(
    `SELECT id, company_name, url, locale, share_token, rebuild_id, rebuild_status
     FROM kp_generations WHERE client_tg_chat_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [chatId],
  );
  return rows[0] ?? null;
}

/**
 * Входящий текст от КП-клиента: подтверждаем получение (locale-aware, с кнопками
 * «новый сайт» / «полный анализ + SEO/GEO») и пересылаем менеджеру. Возвращает
 * false, если чат не привязан ни к одному КП — тогда работает обычный роутинг.
 */
async function handleKpClientMessage(chatId: number, firstName: string, text: string): Promise<boolean> {
  const row = await findKpClient(chatId);
  if (!row) return false;
  const ctx = kpFunnelCtx(row);
  await sendKpInboundAck(chatId, ctx);
  await forwardToKpManager({ companyName: ctx.companyName, clientChatId: chatId, clientName: firstName, text, kpId: row.id });
  return true;
}

function kpFunnelCtx(row: KpClientRow): KpFunnelCtx {
  const locale: KpTgLocale = row.locale === "de" ? "de" : "ru";
  return {
    companyName: row.company_name || row.url,
    locale,
    siteReadyUrl: row.rebuild_id && row.rebuild_status === "sent"
      ? `${SITE}/site-ready/${row.rebuild_id}?locale=${locale}`
      : null,
    kpUrl: kpShareUrl(row.share_token),
  };
}

// ─── Постинг в канал @company24pro (менеджер) ──────────────────────────────

function parseChannelBrief(raw: string): { rubric: Rubric; brief?: string } {
  const m = raw.match(/^([a-z-]+):\s*(.*)$/is);
  if (m && RUBRICS.some(r => r.key === m[1].toLowerCase())) {
    return { rubric: m[1].toLowerCase() as Rubric, brief: m[2].trim() || undefined };
  }
  return { rubric: "product-update", brief: raw.trim() || undefined };
}

/**
 * Команды менеджера по каналу + перехват свободного текста как правки
 * активного черновика. Возвращает false, если сообщение не относится к
 * каналу — тогда работает обычный роутинг бота.
 */
async function handleManagerMessage(chatId: number, text: string, command: string): Promise<boolean> {
  if (command === "/post") {
    const { rubric, brief } = parseChannelBrief(text.slice(command.length).trim());
    await sendMessage(chatId, "✍️ Пишу черновик…");
    const r = await createDraft({ rubric, brief, managerChatId: chatId });
    if (!r.ok) await sendMessage(chatId, `⚠️ Не получилось написать черновик: ${escapeTgHtml(r.error ?? "")}`);
    return true;
  }
  if (command === "/rubrics") {
    await sendMessage(
      chatId,
      `<b>Рубрики</b> (можно указать в /post рубрика: тема):\n\n` +
        RUBRICS.map(r => `<code>${r.key}</code> — ${escapeTgHtml(r.title)}`).join("\n"),
    );
    return true;
  }
  if (command === "/queue") {
    const items = await listQueue();
    if (!items.length) {
      await sendMessage(chatId, "🗂 Очередь пуста.");
      return true;
    }
    const lines = items.map(p => {
      const when = p.scheduled_for ? ` · на ${escapeTgHtml(formatMsk(p.scheduled_for))}` : "";
      return `• <code>${p.id}</code> — ${escapeTgHtml(rubricByKey(p.rubric).title)} — <b>${p.status}</b>${when}`;
    });
    await sendMessage(chatId, `🗂 <b>Очередь (${channelLabel()})</b>\n\n${lines.join("\n")}`);
    return true;
  }
  if (command === "/when") {
    const draft = await activeDraftFor(chatId);
    if (!draft) {
      await sendMessage(chatId, "Нет активного черновика в правке — сначала /post.");
      return true;
    }
    const arg = text.slice(command.length).trim();
    const at = arg ? parseMskDateTime(arg) : null;
    if (arg && !at) {
      await sendMessage(chatId, "Не понял время. Примеры: <code>/when 18:30</code>, <code>/when завтра 10:00</code>, <code>/when 05.09 12:00</code>.");
      return true;
    }
    const r = await approvePost(draft, { at });
    if (!r.ok) {
      await sendMessage(chatId, `⚠️ Ошибка: ${escapeTgHtml(r.error ?? "")}`);
    } else if (!r.published) {
      await sendMessage(chatId, `🕒 Запланировано на ${escapeTgHtml(formatMsk(at))}.`);
    }
    return true;
  }
  if (command === "/cancel") {
    const draft = await activeDraftFor(chatId);
    if (draft) await stopEditing(draft);
    await sendMessage(chatId, draft ? "Ок, вышел из режима правок." : "Активного черновика нет.");
    return true;
  }
  if (!text.startsWith("/")) {
    const draft = await activeDraftFor(chatId);
    if (draft) {
      const r = await applyRevision(draft, text);
      if (!r.ok) await sendMessage(chatId, `⚠️ Не получилось применить правку: ${escapeTgHtml(r.error ?? "")}`);
      return true;
    }
    // Свободный текст без активного черновика — это и есть «просто напишите тему»,
    // без явной команды /post. Ссылки не перехватываем: можно тестировать обычный
    // экспресс-аудит бота, прислав URL — как любой другой пользователь.
    if (text && !extractUrl(text)) {
      const { rubric, brief } = parseChannelBrief(text);
      await sendMessage(chatId, "✍️ Пишу черновик…");
      const r = await createDraft({ rubric, brief, managerChatId: chatId });
      if (!r.ok) await sendMessage(chatId, `⚠️ Не получилось написать черновик: ${escapeTgHtml(r.error ?? "")}`);
      return true;
    }
  }
  return false;
}

interface TgCallbackQuery {
  id: string;
  data?: string;
  message?: { chat?: { id?: number }; message_id?: number };
}

async function handleChannelCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const [prefix, action, id] = (cb.data ?? "").split(":");
  if (prefix !== "cp" || !action || !id || !chatId) {
    await answerTelegramCallback(cb.id);
    return;
  }

  const post = await getChannelPost(id);
  if (!post) {
    await answerTelegramCallback(cb.id, "Черновик не найден", true);
    return;
  }
  if (String(post.manager_chat_id) !== String(chatId)) {
    await answerTelegramCallback(cb.id, "Это не ваш черновик", true);
    return;
  }

  if (action === "pub") {
    const r = await approvePost(post, { at: null });
    await answerTelegramCallback(cb.id, r.ok ? "Опубликовано" : `Ошибка: ${r.error ?? ""}`, !r.ok);
  } else if (action === "later") {
    await answerTelegramCallback(cb.id);
    await sendMessage(
      chatId,
      `🕒 Во сколько опубликовать? Например: <code>/when завтра 10:00</code> или <code>/when 18:30</code>.`,
    );
  } else if (action === "redo") {
    await answerTelegramCallback(cb.id, "Пишу заново…");
    const r = await regenerateDraft(post);
    if (!r.ok) await sendMessage(chatId, `⚠️ Не получилось: ${escapeTgHtml(r.error ?? "")}`);
  } else if (action === "rej") {
    await rejectPost(post);
    await answerTelegramCallback(cb.id, "Отклонено");
  } else {
    await answerTelegramCallback(cb.id);
  }
}

export async function POST(req: NextRequest) {
  // Anti-spoof: Telegram передаёт secret_token в этом header при правильно
  // настроенном webhook. Без проверки атакующий мог подделать update с
  // кодом MR-XXXXXX и перехватить уведомления жертвы.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (receivedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
    }
  }

  try {
    const update = await req.json();

    if (update?.callback_query) {
      await handleChannelCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    const msg = update?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId: number = msg.chat?.id;
    const text: string = (msg.text ?? "").trim();
    const firstName: string = msg.chat?.first_name ?? "друг";

    // Normalize command (strip @botname suffix, lowercase)
    const command = text.split(/\s/)[0].replace(/@.*/, "").toLowerCase();

    // Reply-релей менеджера: если менеджер (env KP_MANAGER_TG_CHAT_ID) делает
    // Reply на пересланное ботом сообщение КП-клиента — передаём текст клиенту.
    const managerChat = process.env.KP_MANAGER_TG_CHAT_ID;
    const replyToText: string | undefined = msg.reply_to_message?.text;
    if (managerChat && String(chatId) === managerChat && replyToText && text && !text.startsWith("/")) {
      const clientChatId = extractClientChatId(replyToText);
      if (clientChatId) {
        const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const relayed = await sendKpTgMessage(clientChatId, `💬 <b>MarketRadar:</b> ${esc}`);
        await sendKpTgMessage(chatId, relayed.ok ? "✅ Передал клиенту." : `⚠️ Не получилось: ${relayed.error}`);
        return NextResponse.json({ ok: true });
      }
    }

    // /start payload — Telegram передаёт его как второй "аргумент" команды,
    // напр. /start kp_a1b2c3d4. Отдельная ветка ДО общего /start: клиент КП
    // не должен увидеть маркетинговый WELCOME вместо подтверждения подписки.
    const startPayload = command === "/start" ? text.split(/\s+/)[1] : null;
    if (startPayload?.startsWith("kp_")) {
      await initDb();
      const rows = await query<KpClientRow & { status: string; share_password: string | null }>(
        `SELECT id, company_name, url, locale, share_token, rebuild_id, rebuild_status,
                status, share_password
         FROM kp_generations WHERE client_tg_code = $1`,
        [startPayload],
      );
      const row = rows[0];
      if (row) {
        await query("UPDATE kp_generations SET client_tg_chat_id = $1 WHERE id = $2", [chatId, row.id]);
        // Две разные ситуации под одним кодом. Классическая: менеджер отправил
        // пересборку сайта и человек подключает уведомления по ней. Новая:
        // человек пришёл с лендинга через TG-дверь, и его разбор ещё
        // собирается — ему надо сказать про разбор, а не про «новую версию
        // сайта», иначе первое же сообщение бота говорит не о том, за чем
        // человек пришёл.
        const name = row.company_name || row.url;
        if (row.rebuild_status) {
          await sendKpConnected(chatId, kpFunnelCtx(row));
        } else if (row.status === "done" && row.share_token) {
          const url = `${SITE}/kp-share/${row.share_token}?p=${encodeURIComponent(row.share_password ?? "")}`;
          await sendKpTgMessage(
            chatId,
            `✅ <b>Разбор «${name}» готов.</b>\n\nНаходки, конкуренты, прогноз и план работ с ценами — по кнопке ниже.`,
            [[{ text: "Открыть разбор", url }]],
          );
        } else {
          await sendKpTgMessage(
            chatId,
            `🛠 <b>Собираем разбор «${name}».</b>\n\nОбычно 2–3 минуты. Пришлём ссылку сюда, как только будет готов — можно закрыть Telegram.`,
          );
        }
      } else {
        await sendKpCodeInvalid(chatId);
      }
    } else if (isManagerChat(chatId) && await handleManagerMessage(chatId, text, command)) {
      // Команда по каналу (/post, /queue, /when, /cancel, /rubrics) или
      // свободный текст-правка активного черновика — обработано внутри.
    } else if (command === "/start") {
      await sendMessage(chatId, WELCOME(firstName), SITE_BUTTONS);
    } else if (command === "/help") {
      const channelHelp = isManagerChat(chatId)
        ? `\n\n<b>Канал ${escapeTgHtml(channelLabel())}:</b>\n` +
          `Просто напишите тему текстом — не нужна команда, я напишу черновик и пришлю на одобрение.\n` +
          `Пока черновик не одобрен, любое ваше сообщение — это правка: «короче», «убери про цену», ` +
          `«добавь пример с автосервисом» — перепишу и покажу здесь же.\n\n` +
          `/post [рубрика:] тема — то же самое явной командой\n` +
          `/rubrics — список рубрик\n` +
          `/queue — что в очереди\n` +
          `/when 18:30 — отложить активный черновик на время (МСК)\n` +
          `/cancel — выйти из правки черновика`
        : "";
      await sendMessage(chatId, HELP + channelHelp, SITE_BUTTONS);
    } else if (command === "/about") {
      await sendMessage(chatId, ABOUT, SITE_BUTTONS);
    } else if (command === "/price" || command === "/pricing" || command === "/tariff") {
      await sendMessage(chatId, PRICE, PRICE_BUTTONS);
    } else if (command === "/partners" || command === "/partner") {
      await sendMessage(chatId, PARTNERS, PARTNERS_BUTTONS);
    } else if (command === "/express") {
      await sendMessage(chatId, EXPRESS_PROMPT, EXPRESS_BUTTONS);
    } else if (command === "/site" || command === "/website") {
      await sendMessage(chatId, `🌐 <b>MarketRadar:</b> ${SITE}`, SITE_BUTTONS);
    } else if (command === "/id" || command === "/whoami") {
      // Служебная команда: узнать свой chat_id для CHANNEL_MANAGER_TG_CHAT_ID
      // и подобных env-переменных. В UI Telegram он нигде не показывается.
      await sendMessage(chatId, `🆔 Ваш chat_id: <code>${chatId}</code>`);
    } else if (command === "/connect") {
      await sendMessage(chatId, CONNECT_PROMPT);
    } else if (/^MR-[A-Z0-9]{6}$/i.test(text)) {
      // Save code → chatId so the connect endpoint can find it
      await saveChatId(text, chatId);
      await sendMessage(
        chatId,
        `✅ <b>Готово!</b>\n\n` +
          `Вы подписались на уведомления MarketRadar.\n` +
          `Теперь нажмите кнопку <b>«Проверить подключение»</b> в приложении — и всё заработает.\n\n` +
          `Сюда будут приходить новые анализы, изменения у конкурентов и еженедельный дайджест.`,
        SITE_BUTTONS,
      );
    } else if (text && !text.startsWith("/") && await handleKpClientMessage(chatId, firstName, text)) {
      // КП-клиент написал боту — ответ-меню + пересылка менеджеру (внутри хелпера)
    } else if (extractUrl(text)) {
      const url = extractUrl(text)!;
      // 1 scan per chat per calendar month — see src/lib/tg-scan-limiter.ts
      const quota = await canScan(chatId);
      if (!quota.allowed) {
        const nextDate = quota.nextAllowedAt
          ? formatNextAllowed(quota.nextAllowedAt)
          : "следующего месяца";
        await sendMessage(chatId, SCAN_LIMIT_REACHED(nextDate), PRICE_BUTTONS);
      } else {
        await sendMessage(chatId, SCANNING(url));
        // Fire-and-forget: Telegram должен получить 200 сразу (иначе ретраи
        // того же update), а скрейп + Claude занимают до минуты. Лимит
        // спишется внутри runExpressAudit и только при успехе.
        void runExpressAudit(chatId, url);
      }
    } else if (text.startsWith("/")) {
      // Unknown command
      await sendMessage(
        chatId,
        `🤔 Не знаю такую команду.\n\nПопробуйте /help — покажу всё, что умею.`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 200 даже при ошибке — иначе Telegram будет бесконечно ретраить тот же
    // update, и мы зациклимся на падающем сообщении.
    console.error("[tg webhook]", err);
    return NextResponse.json({ ok: true });
  }
}
