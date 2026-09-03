/**
 * Постинг в Telegram-канал @company24pro с обязательным одобрением менеджера.
 *
 * Зачем отдельный модуль, а не auto-publisher из src/lib/agents:
 * auto-publisher публикует контент КЛИЕНТА в его канал по расписанию и без
 * человека в цикле. Здесь ровно наоборот — это НАШ маркетинговый канал, и
 * ни один текст не должен попасть в него, пока живой менеджер его не прочёл.
 * Поэтому статус-машина черновика заканчивается на approved_at, а публикует
 * только явное действие менеджера (кнопка) или cron по уже одобренному посту.
 *
 * Жизненный цикл:
 *   pending  — AI написал черновик, карточка ушла менеджеру в личку
 *              (менеджер правит его обычными сообщениями: «убери про цену»,
 *              «сделай короче» — бот переписывает ту же карточку)
 *   approved — менеджер нажал «Опубликовать» (scheduled_for = NULL → уходит
 *              сразу) или отложил на время (/when → публикует cron)
 *   published / rejected / failed — терминальные
 *
 * Откуда берутся черновики:
 *   1. /post <тема> от менеджера — в любой момент
 *   2. cron /api/cron/channel-posts — пн/ср/пт 10:00 МСК, тема по рубрике
 *      из реальных данных платформы (включённые модули + тарифы)
 *
 * Env:
 *   TELEGRAM_CHANNEL_ID          — куда постим (по умолчанию @company24pro)
 *   CHANNEL_MANAGER_TG_CHAT_ID   — chat_id ответственного менеджера; можно
 *                                  список через запятую (первый — основной,
 *                                  ему уходят карточки; остальные тоже могут
 *                                  командовать ботом). Фолбэк —
 *                                  KP_MANAGER_TG_CHAT_ID.
 *   CHANNEL_AUTOPOST_DAYS        — дни авто-черновиков, 1=пн (по умолч. 1,3,5)
 *   CHANNEL_AUTOPOST_HOUR        — час МСК (по умолчанию 10)
 *   CHANNEL_AUTOPOST_ENABLED     — "false" полностью выключает авто-режим
 */
import { randomBytes } from "crypto";
import { query, initDb } from "./db";
import { chatJson, CHAT_MODEL_SMART } from "./ai-chat";
import { ANTI_HALLUCINATION_RULES } from "./ai-rules";
import {
  sendTelegramMessage,
  editTelegramMessage,
  escapeTgHtml,
  type TgInlineButton,
} from "./tg-send";
import { publishToTelegram, mdToHtml } from "./publishers/telegram";
import { PRICES, FIRST_MONTH_DISCOUNTS, fmtRub } from "./pricing-constants";

const SITE = "https://marketradar24.ru";

export function channelId(): string {
  return process.env.TELEGRAM_CHANNEL_ID?.trim() || "@company24pro";
}

/** Человекочитаемое имя канала для карточек: @company24pro. */
export function channelLabel(): string {
  const id = channelId();
  return id.startsWith("@") ? id : `канал ${id}`;
}

/**
 * Кто имеет право командовать каналом. Первый в списке — основной: именно ему
 * бот шлёт карточки черновиков. Остальные могут нажимать кнопки и слать /post
 * (полезно, когда менеджеров двое и один в отпуске).
 */
export function managerChatIds(): string[] {
  const raw = process.env.CHANNEL_MANAGER_TG_CHAT_ID || process.env.KP_MANAGER_TG_CHAT_ID || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function primaryManagerChatId(): string | null {
  return managerChatIds()[0] ?? null;
}

export function isManagerChat(chatId: number | string): boolean {
  return managerChatIds().includes(String(chatId));
}

// ─── Рубрики ────────────────────────────────────────────────────────────────

export type Rubric = "product-update" | "how-it-works" | "insight" | "offer";

interface RubricDef {
  key: Rubric;
  title: string;
  /** Что именно должен раскрыть пост этой рубрики. */
  angle: string;
}

export const RUBRICS: RubricDef[] = [
  {
    key: "product-update",
    title: "Что нового",
    angle:
      "апдейт продукта: какой модуль платформы появился или заметно вырос, " +
      "что конкретно он теперь делает за пользователя и какую рутину снимает",
  },
  {
    key: "how-it-works",
    title: "Как это работает",
    angle:
      "разбор одного модуля по шагам: что человек вводит, что платформа делает " +
      "внутри, что он получает на выходе и за какое время",
  },
  {
    key: "insight",
    title: "Польза / боль",
    angle:
      "рабочая мысль про конкурентный анализ, контент или бренд для владельца " +
      "бизнеса — типичная ошибка и что с ней делать; продукт упоминается одной " +
      "строкой в конце, а не в каждом абзаце",
  },
  {
    key: "offer",
    title: "Оффер",
    angle:
      "предложение попробовать: что входит, сколько стоит, что человек получит " +
      "в первые сутки; без давления и без выдуманных дедлайнов",
  },
];

export function rubricByKey(key: string): RubricDef {
  return RUBRICS.find(r => r.key === key) ?? RUBRICS[0];
}

// ─── Контекст продукта для промпта ──────────────────────────────────────────

/**
 * Основные модули платформы — не завязаны на фичефлаги (таблица `features`
 * знает только про часть продукта: контент-завод, презентации, лендинги,
 * SEO-статьи, отзывы), а анализ компании/конкурентов/ЦА/СММ и бесплатная
 * экспресс-проверка есть у каждого аккаунта всегда. Раз в несколько месяцев,
 * когда в платформе появляется что-то принципиально новое, этот список нужно
 * обновлять руками — сервер на проде разворачивается из git-архива без
 * истории коммитов, поэтому сам вычитать «что нового» из git он не может.
 *
 * Актуализировано: 2026-09-03.
 */
const CORE_MODULES = [
  `- Бесплатная экспресс-проверка сайта (без регистрации, без звонков) — за 1-2 минуты: ` +
    `техника сайта (скорость, структура, заголовки, микроразметка, sitemap, доступ для поисковых ` +
    `роботов), видимость в поиске, читаемость сайта для нейросетей и узнаваемость бренда в ответах ` +
    `AI-ассистентов (ChatGPT/Claude/Perplexity — тема GEO). Доступна в Telegram-боте ` +
    `@market_radar1_bot по ссылке на сайт и на ${SITE}/check`,
  `- Полный анализ компании — сайт, SEO, соцсети, вакансии (hh.ru), реквизиты (DaData), ` +
    `рейтинги и отзывы с Google Карт / Яндекс.Карт / 2ГИС`,
  `- Анализ конкурентов — сравнение с 7+ конкурентами в одном дашборде, AI-инсайты, ` +
    `Battle Cards для отдела продаж, разбор офферов конкурента`,
  `- Портрет целевой аудитории — сегменты, психографика, страхи/мотивы/возражения, ` +
    `путь клиента (CJM)`,
  `- Анализ соцсетей и СММ-стратегии — архетип бренда, рекомендации по платформам`,
  `- Анализ отзывов — автосбор с карт, AI-разбор тональности и тем, шаблоны ответов`,
].join("\n");

/**
 * Фактура для генератора: основные модули (выше) + включённые сейчас
 * фичефлаги платформы (таблица features, с под-модулями контент-завода) +
 * реальные цены. Без этого модель начинает сочинять несуществующие фичи —
 * ровно то, что запрещает ANTI_HALLUCINATION_RULES.
 */
export async function productContext(): Promise<string> {
  let flaggedModules = "";
  try {
    await initDb();
    const rows = await query<{ id: string; label: string; description: string | null; parent_id: string | null }>(
      `SELECT id, label, description, parent_id FROM features WHERE enabled = true ORDER BY sort_order ASC, id ASC`,
    );
    const roots = rows.filter(r => !r.parent_id);
    const children = rows.filter(r => r.parent_id);
    flaggedModules = roots
      .map(r => {
        const subs = children.filter(c => c.parent_id === r.id);
        const subLines = subs.map(s => `  - ${s.label}${s.description ? `: ${s.description}` : ""}`).join("\n");
        return `- ${r.label}${r.description ? `: ${r.description}` : ""}` + (subLines ? `\n${subLines}` : "");
      })
      .join("\n");
  } catch (e) {
    console.error("[channel] не удалось прочитать features:", e);
  }

  return [
    `Продукт: MarketRadar (${SITE}) — российская SaaS-платформа конкурентного анализа,`,
    `контент-маркетинга и бренд-стратегии для бизнеса и агентств в России. Работает на Claude (Anthropic).`,
    ``,
    `Модули, доступные каждому аккаунту всегда:`,
    CORE_MODULES,
    ``,
    `Модули, включённые сейчас в настройках платформы (пиши про них как про существующие; ` +
      `если модуля нет ни здесь, ни в разделе выше — не упоминай его как готовый):`,
    flaggedModules || "- (список недоступен — пиши только про модули из раздела выше)",
    ``,
    `Цены (менять нельзя):`,
    `- Экспресс-аудит в Telegram-боте @market_radar1_bot — бесплатно, 1 раз в месяц`,
    `- Экспресс-отчёт на сайте по промокоду START — ${fmtRub(PRICES.expressPaid)}`,
    `- Полный отчёт + 30 дней в платформе — ${fmtRub(PRICES.fullReport)} (вместо ${fmtRub(PRICES.fullReportOriginal)})`,
    `- Тарифы после первого отчёта со скидкой 50% на первый месяц: ` +
      FIRST_MONTH_DISCOUNTS.map(t => `${t.name} ${fmtRub(t.discounted)}`).join(", "),
    ``,
    `Партнёрская программа: 20% реферальным партнёрам, до 50% интеграторам (${SITE}/partners).`,
  ].join("\n");
}

// ─── Генерация текста ───────────────────────────────────────────────────────

const FORMAT_RULES = [
  `Формат поста для Telegram-канала:`,
  `- 700-1400 знаков, это пост в ленте, а не статья`,
  `- первая строка — крючок: конкретная мысль или ситуация, без «Друзья!» и «Сегодня мы хотим рассказать»`,
  `- дальше 2-4 коротких абзаца, между ними пустая строка`,
  `- разметка только такая: **жирный**, [текст ссылки](https://...). Никаких #-заголовков, таблиц, __подчёркиваний__`,
  `- максимум 2-3 эмодзи на весь пост, не в каждой строке`,
  `- в конце ровно один призыв с рабочей ссылкой (${SITE} или t.me/market_radar1_bot)`,
  `- можно 2-3 хэштега последней строкой, можно без них`,
  `- пиши по-русски, на «вы», по делу, без канцелярита и без превосходных степеней`,
].join("\n");

interface DraftJson { text?: string }

/** Общая обёртка вызова модели: и для первой версии, и для правок. */
async function askForPost(system: string, user: string): Promise<{ text: string; error?: string }> {
  const r = await chatJson<DraftJson>({
    system,
    user,
    maxTokens: 1600,
    model: CHAT_MODEL_SMART,
    temperature: 0.7,
  });
  const text = (r.data?.text ?? "").trim();
  if (!text) return { text: "", error: r.error ?? "модель вернула пустой текст" };
  return { text };
}

export async function generateDraft(opts: {
  rubric: Rubric;
  /** Тема/тезисы от менеджера. Если пусто — тему выбирает модель по рубрике. */
  brief?: string;
}): Promise<{ text: string; error?: string }> {
  const rubric = rubricByKey(opts.rubric);
  const ctx = await productContext();

  const system =
    `${ANTI_HALLUCINATION_RULES}\n\n` +
    `Ты — контент-редактор Telegram-канала ${channelLabel()} платформы MarketRadar. ` +
    `Канал читают владельцы малого и среднего бизнеса в России, маркетологи и агентства.\n\n` +
    `Рубрика поста: «${rubric.title}» — ${rubric.angle}.\n\n` +
    `${FORMAT_RULES}\n\n` +
    `Ответь СТРОГО валидным JSON без markdown: {"text": "готовый текст поста"}`;

  const user = opts.brief?.trim()
    ? `${ctx}\n\nТема и тезисы от менеджера (это главное, следуй им):\n${opts.brief.trim()}`
    : `${ctx}\n\nТемы менеджер не задал — выбери её сам по рубрике, опираясь ТОЛЬКО на модули и цены выше.`;

  return askForPost(system, user);
}

/**
 * Правка текущего текста по свободной инструкции менеджера («короче», «убери
 * про цену», «добавь пример с магазином окон»). Модель получает и исходный
 * бриф, и текущую версию — иначе после третьей правки пост уплывает от темы.
 */
export async function reviseDraft(opts: {
  current: string;
  instruction: string;
  brief?: string | null;
  rubric: Rubric;
}): Promise<{ text: string; error?: string }> {
  const rubric = rubricByKey(opts.rubric);
  const ctx = await productContext();

  const system =
    `${ANTI_HALLUCINATION_RULES}\n\n` +
    `Ты — контент-редактор Telegram-канала ${channelLabel()} платформы MarketRadar. ` +
    `Тебе дают готовый пост и правку от менеджера. Примени правку и верни ПОЛНЫЙ ` +
    `текст поста целиком — не фрагмент, не список изменений, не комментарий.\n` +
    `Всё, чего правка не касается, оставь как есть: формулировки, порядок абзацев, ссылки.\n\n` +
    `Рубрика: «${rubric.title}».\n\n${FORMAT_RULES}\n\n` +
    `Ответь СТРОГО валидным JSON без markdown: {"text": "полный текст поста после правки"}`;

  const user = [
    ctx,
    opts.brief ? `\nИсходная тема: ${opts.brief}` : "",
    `\nТекущая версия поста:\n"""\n${opts.current}\n"""`,
    `\nПравка менеджера: ${opts.instruction}`,
  ].filter(Boolean).join("\n");

  return askForPost(system, user);
}

// ─── Работа с записями ──────────────────────────────────────────────────────

export interface ChannelPost {
  id: string;
  rubric: Rubric;
  brief: string | null;
  draft: string;
  status: "pending" | "approved" | "published" | "rejected" | "failed";
  manager_chat_id: string | null;
  manager_message_id: number | null;
  edit_mode: boolean;
  channel_id: string | null;
  channel_message_id: number | null;
  message_url: string | null;
  scheduled_for: Date | null;
  approved_at: Date | null;
  published_at: Date | null;
  source: string;
  last_error: string | null;
  created_at: Date;
}

const COLS = `id, rubric, brief, draft, status, manager_chat_id, manager_message_id, edit_mode,
              channel_id, channel_message_id, message_url, scheduled_for, approved_at,
              published_at, source, last_error, created_at`;

export async function getPost(id: string): Promise<ChannelPost | null> {
  await initDb();
  const rows = await query<ChannelPost>(`SELECT ${COLS} FROM channel_posts WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Черновик, к которому относится свободный текст менеджера. Это самый свежий
 * pending с включённым edit_mode: менеджер только что получил карточку и пишет
 * правку, не нажимая ничего. /cancel выключает edit_mode — тогда его сообщения
 * снова уходят в обычный роутинг бота (экспресс-аудит по ссылке и т.д.).
 */
export async function activeDraftFor(chatId: number | string): Promise<ChannelPost | null> {
  await initDb();
  const rows = await query<ChannelPost>(
    `SELECT ${COLS} FROM channel_posts
     WHERE manager_chat_id = $1 AND status = 'pending' AND edit_mode = true
     ORDER BY created_at DESC LIMIT 1`,
    [String(chatId)],
  );
  return rows[0] ?? null;
}

export async function listQueue(limit = 10): Promise<ChannelPost[]> {
  await initDb();
  return query<ChannelPost>(
    `SELECT ${COLS} FROM channel_posts
     WHERE status IN ('pending','approved')
     ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
}

// ─── Время (МСК) ────────────────────────────────────────────────────────────

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Компоненты «сейчас» по Москве. Считаем от UTC вручную: TZ на VPS может быть любой. */
export function mskNow(): { y: number; m: number; d: number; hour: number; weekday: number } {
  const t = new Date(Date.now() + MSK_OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hour: t.getUTCHours(),
    // 1 = понедельник ... 7 = воскресенье
    weekday: t.getUTCDay() === 0 ? 7 : t.getUTCDay(),
  };
}

/** Дата/время МСК → абсолютный момент (Date в UTC). */
function mskToDate(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - MSK_OFFSET_MS);
}

export function formatMsk(d: Date | null): string {
  if (!d) return "сразу после одобрения";
  const t = new Date(d.getTime() + MSK_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())} МСК`;
}

/**
 * Разбор времени из сообщения менеджера. Понимает:
 *   «18:30», «завтра 10:00», «сегодня 18:00», «05.09 10:00», «05.09.2026 10:00».
 * Голое «18:30» — сегодня, а если час уже прошёл, то завтра.
 * Возвращает null, если распознать не удалось.
 */
export function parseMskDateTime(input: string): Date | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");
  const now = mskNow();

  const time = s.match(/(\d{1,2})[:.](\d{2})/);
  if (!time) return null;
  const hh = Number(time[1]);
  const mm = Number(time[2]);
  if (hh > 23 || mm > 59) return null;

  const date = s.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (date) {
    const d = Number(date[1]);
    const m = Number(date[2]);
    const y = date[3] ? Number(date[3]) : now.y;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = mskToDate(y, m, d, hh, mm);
      // «05.09 10:00» в декабре — это следующий год, а не прошедшая дата.
      if (!date[3] && dt.getTime() < Date.now()) return mskToDate(y + 1, m, d, hh, mm);
      return dt;
    }
  }

  const base = mskToDate(now.y, now.m, now.d, hh, mm);
  if (/послезавтра/.test(s)) return new Date(base.getTime() + 48 * 3600 * 1000);
  if (/завтра/.test(s)) return new Date(base.getTime() + 24 * 3600 * 1000);
  if (/сегодня/.test(s)) return base;
  return base.getTime() > Date.now() ? base : new Date(base.getTime() + 24 * 3600 * 1000);
}

// ─── Карточка черновика для менеджера ───────────────────────────────────────

function draftKeyboard(id: string): TgInlineButton[][] {
  return [
    [
      { text: "✅ Опубликовать", callback_data: `cp:pub:${id}` },
      { text: "🕒 Отложить", callback_data: `cp:later:${id}` },
    ],
    [
      { text: "🔄 Другой вариант", callback_data: `cp:redo:${id}` },
      { text: "🗑 Отклонить", callback_data: `cp:rej:${id}` },
    ],
  ];
}

export function renderDraftCard(post: ChannelPost): string {
  const rubric = rubricByKey(post.rubric);
  const when = post.scheduled_for ? formatMsk(post.scheduled_for) : "сразу после одобрения";
  return [
    `📝 <b>Черновик в ${escapeTgHtml(channelLabel())}</b>`,
    `Рубрика: ${escapeTgHtml(rubric.title)}${post.source === "cron" ? " · по расписанию" : ""}`,
    `Публикация: ${escapeTgHtml(when)}`,
    ``,
    `──────────`,
    mdToHtml(post.draft),
    `──────────`,
    ``,
    `<i>Правьте прямо сообщением — например «короче», «убери про цену», «добавь пример с автосервисом». Перепишу и покажу здесь же.</i>`,
    `<i>Время: /when завтра 10:00 · выйти из правок: /cancel</i>`,
  ].join("\n");
}

/** Финальная версия карточки: убирает кнопки, дописывает статус-строку. */
async function finalizeCard(post: ChannelPost, statusLine: string): Promise<void> {
  if (!post.manager_chat_id || !post.manager_message_id) return;
  const rubric = rubricByKey(post.rubric);
  const text = [
    `📝 <b>Черновик в ${escapeTgHtml(channelLabel())}</b>`,
    `Рубрика: ${escapeTgHtml(rubric.title)}`,
    ``,
    `──────────`,
    mdToHtml(post.draft),
    `──────────`,
    ``,
    statusLine,
  ].join("\n");
  await editTelegramMessage({
    chatId: post.manager_chat_id,
    messageId: post.manager_message_id,
    text,
    inlineKeyboard: [],
  });
}

/** Отправить карточку менеджеру и запомнить message_id для последующих правок. */
export async function sendDraftCard(post: ChannelPost): Promise<{ ok: boolean; error?: string }> {
  const chat = post.manager_chat_id;
  if (!chat) return { ok: false, error: "не задан chat_id менеджера" };
  const sent = await sendTelegramMessage({
    chatId: chat,
    text: renderDraftCard(post),
    inlineKeyboard: draftKeyboard(post.id),
  });
  if (!sent.ok) return { ok: false, error: sent.error };
  await query(
    `UPDATE channel_posts SET manager_message_id = $1, updated_at = NOW() WHERE id = $2`,
    [sent.messageId ?? null, post.id],
  );
  return { ok: true };
}

/** Перерисовать карточку после правки. Если сообщение не найдено — шлём новое. */
async function refreshDraftCard(post: ChannelPost): Promise<void> {
  if (!post.manager_chat_id) return;
  if (post.manager_message_id) {
    const r = await editTelegramMessage({
      chatId: post.manager_chat_id,
      messageId: post.manager_message_id,
      text: renderDraftCard(post),
      inlineKeyboard: draftKeyboard(post.id),
    });
    if (r.ok) return;
  }
  await sendDraftCard(post);
}

// ─── Действия ───────────────────────────────────────────────────────────────

/**
 * Создать черновик и отправить его менеджеру. Возвращает ошибку, если менеджер
 * не настроен — молча писать в никуда нельзя, иначе пост «потеряется».
 */
export async function createDraft(opts: {
  rubric: Rubric;
  brief?: string;
  source?: "manual" | "cron";
  scheduledFor?: Date | null;
  /** Кому слать карточку. По умолчанию — основной менеджер из env. */
  managerChatId?: string | number;
}): Promise<{ ok: boolean; post?: ChannelPost; error?: string }> {
  const manager = String(opts.managerChatId ?? primaryManagerChatId() ?? "");
  if (!manager) {
    return { ok: false, error: "CHANNEL_MANAGER_TG_CHAT_ID не задан — некому отправить черновик на одобрение" };
  }

  const gen = await generateDraft({ rubric: opts.rubric, brief: opts.brief });
  if (!gen.text) return { ok: false, error: `AI не написал черновик: ${gen.error ?? "неизвестная ошибка"}` };

  await initDb();
  const id = randomBytes(8).toString("hex");
  await query(
    `INSERT INTO channel_posts (id, rubric, brief, draft, status, manager_chat_id, scheduled_for, source, channel_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8)`,
    [id, opts.rubric, opts.brief?.trim() || null, gen.text, manager,
     opts.scheduledFor ?? null, opts.source ?? "manual", channelId()],
  );

  const post = await getPost(id);
  if (!post) return { ok: false, error: "черновик не сохранился" };
  const sent = await sendDraftCard(post);
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, post };
}

/** Применить правку менеджера и перерисовать карточку. */
export async function applyRevision(
  post: ChannelPost,
  instruction: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await reviseDraft({
    current: post.draft,
    instruction,
    brief: post.brief,
    rubric: post.rubric,
  });
  if (!r.text) return { ok: false, error: r.error ?? "модель не ответила" };

  await query(
    `UPDATE channel_posts
     SET draft = $1,
         revisions = revisions || $2::jsonb,
         updated_at = NOW()
     WHERE id = $3`,
    [r.text, JSON.stringify([{ at: new Date().toISOString(), instruction, text: r.text }]), post.id],
  );
  const fresh = await getPost(post.id);
  if (fresh) await refreshDraftCard(fresh);
  return { ok: true };
}

/** Кнопка «Другой вариант»: та же тема/рубрика, новый текст с нуля (не правка). */
export async function regenerateDraft(post: ChannelPost): Promise<{ ok: boolean; error?: string }> {
  const gen = await generateDraft({ rubric: post.rubric, brief: post.brief ?? undefined });
  if (!gen.text) return { ok: false, error: gen.error };
  await query(`UPDATE channel_posts SET draft = $1, updated_at = NOW() WHERE id = $2`, [gen.text, post.id]);
  const fresh = await getPost(post.id);
  if (fresh) await refreshDraftCard(fresh);
  return { ok: true };
}

/** Публикация в канал. Вызывается только после одобрения менеджером. */
export async function publishPost(post: ChannelPost): Promise<{ ok: boolean; url?: string; error?: string }> {
  const target = post.channel_id || channelId();
  const r = await publishToTelegram({ chatId: target, text: post.draft, disablePreview: false });

  if (!r.ok) {
    await query(
      `UPDATE channel_posts SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2`,
      [r.error ?? "неизвестная ошибка", post.id],
    );
    await finalizeCard(post, `⚠️ <b>Ошибка публикации:</b> ${escapeTgHtml(r.error ?? "неизвестная ошибка")}`);
    return { ok: false, error: r.error };
  }

  await query(
    `UPDATE channel_posts
     SET status = 'published', published_at = NOW(), channel_message_id = $1,
         message_url = $2, edit_mode = false, last_error = NULL, updated_at = NOW()
     WHERE id = $3`,
    [r.messageId ?? null, r.messageUrl ?? null, post.id],
  );
  await finalizeCard(post, `✅ <b>Опубликовано в ${escapeTgHtml(channelLabel())}</b>${r.messageUrl ? `\n${r.messageUrl}` : ""}`);
  return { ok: true, url: r.messageUrl };
}

/** Одобрить: без времени — публикуем сразу, со временем — отдаём крону. */
export async function approvePost(
  post: ChannelPost,
  opts?: { at?: Date | null },
): Promise<{ ok: boolean; published: boolean; url?: string; error?: string }> {
  const at = opts?.at ?? post.scheduled_for ?? null;

  if (at && at.getTime() > Date.now()) {
    await query(
      `UPDATE channel_posts
       SET status = 'approved', approved_at = NOW(), scheduled_for = $1, edit_mode = false, updated_at = NOW()
       WHERE id = $2`,
      [at, post.id],
    );
    const fresh = (await getPost(post.id)) ?? post;
    await finalizeCard(fresh, `🕒 <b>Запланировано на ${escapeTgHtml(formatMsk(at))}</b>`);
    return { ok: true, published: false };
  }

  await query(
    `UPDATE channel_posts SET status = 'approved', approved_at = NOW(), edit_mode = false, updated_at = NOW() WHERE id = $1`,
    [post.id],
  );
  const fresh = (await getPost(post.id)) ?? post;
  const r = await publishPost(fresh);
  return { ok: r.ok, published: r.ok, url: r.url, error: r.error };
}

export async function rejectPost(post: ChannelPost): Promise<void> {
  await query(
    `UPDATE channel_posts SET status = 'rejected', edit_mode = false, updated_at = NOW() WHERE id = $1`,
    [post.id],
  );
  await finalizeCard(post, `🗑 <b>Отклонено</b>`);
}

/** /cancel — перестать ловить свободный текст менеджера как правку. */
export async function stopEditing(post: ChannelPost): Promise<void> {
  await query(`UPDATE channel_posts SET edit_mode = false, updated_at = NOW() WHERE id = $1`, [post.id]);
}

// ─── Cron ───────────────────────────────────────────────────────────────────

/** Публикация одобренных постов, у которых наступило время. */
export async function publishDue(): Promise<{ published: number; failed: number; details: string[] }> {
  await initDb();
  const due = await query<ChannelPost>(
    `SELECT ${COLS} FROM channel_posts
     WHERE status = 'approved' AND scheduled_for IS NOT NULL AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC LIMIT 10`,
  );

  let published = 0, failed = 0;
  const details: string[] = [];
  for (const post of due) {
    const r = await publishPost(post);
    if (r.ok) {
      published++;
      details.push(`${post.id}: опубликован`);
      if (post.manager_chat_id) {
        await sendTelegramMessage({
          chatId: post.manager_chat_id,
          text: `✅ Отложенный пост вышел в ${escapeTgHtml(channelLabel())}.` +
            (r.url ? `\n${r.url}` : ""),
        });
      }
    } else {
      failed++;
      details.push(`${post.id}: ошибка — ${r.error}`);
      if (post.manager_chat_id) {
        await sendTelegramMessage({
          chatId: post.manager_chat_id,
          text: `⚠️ Не удалось опубликовать отложенный пост: ${escapeTgHtml(r.error ?? "")}\n\n` +
            `Пост остался в очереди со статусом «ошибка» — /queue.`,
        });
      }
    }
  }
  return { published, failed, details };
}

function autopostDays(): number[] {
  const raw = process.env.CHANNEL_AUTOPOST_DAYS ?? "1,3,5";
  const days = raw.split(",").map(s => Number(s.trim())).filter(n => n >= 1 && n <= 7);
  return days.length ? days : [1, 3, 5];
}

function autopostHour(): number {
  const h = Number(process.env.CHANNEL_AUTOPOST_HOUR ?? "10");
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 10;
}

/**
 * Авто-черновик по расписанию. Рубрика ротируется по числу уже созданных
 * авто-постов, чтобы канал не состоял из одних апдейтов.
 *
 * Защита от дублей: если авто-черновик уже создавался за последние 12 часов —
 * пропускаем. Крон может дёргаться чаще раза в час, а Telegram-канал с двумя
 * одинаковыми постами выглядит как сломанный бот.
 */
export async function maybeCreateScheduledDraft(opts?: { force?: boolean }): Promise<{
  created: boolean;
  reason: string;
  error?: string;
}> {
  if (process.env.CHANNEL_AUTOPOST_ENABLED === "false") {
    return { created: false, reason: "авто-режим выключен (CHANNEL_AUTOPOST_ENABLED=false)" };
  }
  await initDb();

  if (!opts?.force) {
    const now = mskNow();
    if (!autopostDays().includes(now.weekday)) {
      return { created: false, reason: `сегодня не день автопостинга (МСК день ${now.weekday}, ждём ${autopostDays().join(",")})` };
    }
    if (now.hour !== autopostHour()) {
      return { created: false, reason: `не тот час (МСК ${now.hour}:xx, ждём ${autopostHour()}:xx)` };
    }
  }

  const recent = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM channel_posts
     WHERE source = 'cron' AND created_at > NOW() - INTERVAL '12 hours'`,
  );
  if (Number(recent[0]?.n ?? 0) > 0) {
    return { created: false, reason: "авто-черновик уже создавался за последние 12 часов" };
  }

  const total = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM channel_posts WHERE source = 'cron'`,
  );
  const rubric = RUBRICS[Number(total[0]?.n ?? 0) % RUBRICS.length].key;

  const r = await createDraft({ rubric, source: "cron" });
  if (!r.ok) return { created: false, reason: "не удалось создать черновик", error: r.error };
  return { created: true, reason: `черновик по рубрике «${rubricByKey(rubric).title}» отправлен менеджеру` };
}
