import { NextRequest, NextResponse } from "next/server";
import { saveChatId } from "@/lib/tgStore";
import { canScan, recordScan, formatNextAllowed } from "@/lib/tg-scan-limiter";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const TG = `${TG_BASE}/bot${TOKEN}`;
const SITE = "https://marketradar24.ru";

type InlineButton = { text: string; url?: string; callback_data?: string };

async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: InlineButton[][],
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard };
  }
  await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Message templates ──────────────────────────────────────────────────────

const WELCOME = (name: string) =>
  `👋 Привет, ${name}!\n\n` +
  `Это <b>MarketRadar</b> — ИИ-анализ конкурентов и бренд-стратегия для российского рынка.\n\n` +
  `<b>Что умеет:</b>\n` +
  `• Экспресс-аудит сайта за 2 минуты — прямо здесь, в боте\n` +
  `• Полный анализ: SEO, соцсети, вакансии, отзывы, карты, ЦА, CJM, брендбук\n` +
  `• Сравнение с 7+ конкурентами + Battle Cards для отдела продаж\n` +
  `• Контент-завод: посты, рилсы, сторис, SEO-статьи, лендинги\n\n` +
  `<b>Команды:</b>\n` +
  `/express — получить бесплатный экспресс в Telegram\n` +
  `/price — тарифы и продукты\n` +
  `/partners — партнёрская программа (до 50%)\n` +
  `/connect — подключить уведомления по коду MR-XXXXXX\n` +
  `/site — открыть сайт\n` +
  `/help — все команды`;

const HELP =
  `<b>Доступные команды:</b>\n\n` +
  `/express — бесплатный экспресс-аудит сайта в Telegram\n` +
  `/price — тарифы и продукты (экспресс 1 ₽ · полный 2 900 ₽)\n` +
  `/partners — партнёрская программа (20–50% комиссии)\n` +
  `/about — что такое MarketRadar\n` +
  `/connect — подключить уведомления из кабинета (код MR-XXXXXX)\n` +
  `/site — открыть сайт\n` +
  `/help — эта справка\n\n` +
  `💡 Можно просто отправить ссылку на сайт (https://example.ru) — пришлю, куда отправиться за экспрессом.`;

const ABOUT =
  `<b>MarketRadar</b> — SaaS-платформа для бизнеса и агентств в России.\n\n` +
  `Автоматически анализирует:\n` +
  `• сайт, SEO, Core Web Vitals\n` +
  `• соцсети и контент-стратегию\n` +
  `• вакансии (HH.ru), реквизиты (DaData)\n` +
  `• отзывы и рейтинги (Google, Яндекс, 2ГИС)\n` +
  `• целевую аудиторию, CJM, брендбук\n` +
  `• до 10 конкурентов в одном дашборде\n\n` +
  `Работает на Claude (Anthropic) + GPT-4o.\n` +
  `Мониторинг обновляется каждые 30 дней.`;

const PRICE =
  `<b>💰 Тарифы MarketRadar</b>\n\n` +
  `<b>🎁 Бесплатный экспресс в Telegram — 0 ₽</b>\n` +
  `Отчёт по сайту за 2 минуты: score, инсайты, 5 категорий, база конкурентов.\n` +
  `→ команда /express\n\n` +
  `<b>💎 Экспресс-отчёт на сайте — 1 ₽ по промокоду START</b>\n` +
  `Полный экспресс с сохранением на email + готовый PDF.\n` +
  `→ ${SITE}/express-report\n\n` +
  `<b>🚀 Полный отчёт + 30 дней в платформе — 2 900 ₽</b> <i>(вместо 4 900 ₽)</i>\n` +
  `• Все 15 решений и рекомендаций\n` +
  `• Портрет ЦА, CJM, брендбук\n` +
  `• Battle Cards для отдела продаж\n` +
  `• Мониторинг 24/7\n\n` +
  `⭐ <b>Скидка 50% на первый месяц</b> любого тарифа после покупки полного отчёта:\n` +
  `MINI 2 450 ₽ · БАЗОВЫЙ 4 950 ₽ · PRO 9 950 ₽ · AGENCY 19 950 ₽`;

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
  `Через пару минут вернусь с отчётом: общий score, 5 категорий (SEO, скорость, UX, доверие, контент), топ-инсайты и краткая база конкурентов.\n\n` +
  `💡 Хотите сразу полный экспресс с сохранением на email и PDF? Перейдите на сайт с промокодом <b>START</b> — отдадим за 1 ₽:\n` +
  `${SITE}/express-report`;

const CONNECT_PROMPT =
  `🔗 Чтобы подключить уведомления:\n\n` +
  `1. Откройте MarketRadar → <b>Настройки → Уведомления</b>\n` +
  `2. Скопируйте код формата <code>MR-XXXXXX</code>\n` +
  `3. Отправьте его сюда\n\n` +
  `После этого сюда будут приходить: готовые анализы, изменения у конкурентов, дайджест раз в неделю.`;

const URL_RECEIVED = (url: string) =>
  `📥 Принял ссылку: <code>${url}</code>\n\n` +
  `⏳ Экспресс-аудит из Telegram сейчас в процессе раскатки — пока быстрее всего запустить его на сайте:\n\n` +
  `🎁 <b>Бесплатно</b> → ${SITE}/?url=${encodeURIComponent(url)}\n` +
  `💎 <b>За 1 ₽ по промокоду START</b> → ${SITE}/express-report?url=${encodeURIComponent(url)}\n\n` +
  `Результат откроется в браузере за 1–2 минуты.`;

const SCAN_LIMIT_REACHED = (nextDate: string) =>
  `⏳ <b>Лимит на месяц исчерпан</b>\n\n` +
  `Бесплатный экспресс-аудит — 1 раз в месяц с одного аккаунта. ` +
  `Следующее сканирование будет доступно с <b>${nextDate}</b>.\n\n` +
  `Если нужен полный отчёт прямо сейчас — оформите экспресс на сайте за <b>1 ₽</b> по промокоду <code>START</code>:\n` +
  `${SITE}/express-report\n\n` +
  `Или полный анализ + 30 дней в платформе за 2 900 ₽:\n` +
  `${SITE}/pricing`;

const SITE_BUTTONS: InlineButton[][] = [
  [{ text: "🚀 Открыть MarketRadar", url: SITE }],
  [
    { text: "💎 Экспресс за 1 ₽", url: `${SITE}/express-report` },
    { text: "📊 Тарифы", url: `${SITE}/pricing` },
  ],
  [{ text: "🤝 Партнёрам", url: `${SITE}/partners` }],
];

const EXPRESS_BUTTONS: InlineButton[][] = [
  [{ text: "💎 Полный экспресс за 1 ₽ (START)", url: `${SITE}/express-report` }],
  [{ text: "🚀 Перейти на сайт", url: SITE }],
];

const PRICE_BUTTONS: InlineButton[][] = [
  [{ text: "📊 Все тарифы на сайте", url: `${SITE}/pricing` }],
  [{ text: "💎 Экспресс за 1 ₽ (START)", url: `${SITE}/express-report` }],
];

const PARTNERS_BUTTONS: InlineButton[][] = [
  [{ text: "🤝 Стать партнёром", url: `${SITE}/partners` }],
];

// ─── Router ─────────────────────────────────────────────────────────────────

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const msg = update?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId: number = msg.chat?.id;
    const text: string = (msg.text ?? "").trim();
    const firstName: string = msg.chat?.first_name ?? "друг";

    // Normalize command (strip @botname suffix, lowercase)
    const command = text.split(/\s/)[0].replace(/@.*/, "").toLowerCase();

    if (command === "/start") {
      await sendMessage(chatId, WELCOME(firstName), SITE_BUTTONS);
    } else if (command === "/help") {
      await sendMessage(chatId, HELP, SITE_BUTTONS);
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
    } else if (command === "/connect") {
      await sendMessage(chatId, CONNECT_PROMPT);
    } else if (/^MR-[A-Z0-9]{6}$/i.test(text)) {
      // Save code → chatId so the connect endpoint can find it
      saveChatId(text, chatId);
      await sendMessage(
        chatId,
        `✅ <b>Готово!</b>\n\n` +
          `Вы подписались на уведомления MarketRadar.\n` +
          `Теперь нажмите кнопку <b>«Проверить подключение»</b> в приложении — и всё заработает.\n\n` +
          `Сюда будут приходить новые анализы, изменения у конкурентов и еженедельный дайджест.`,
        SITE_BUTTONS,
      );
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
        await recordScan(chatId, url);
        await sendMessage(chatId, URL_RECEIVED(url), EXPRESS_BUTTONS);
      }
    } else if (text.startsWith("/")) {
      // Unknown command
      await sendMessage(
        chatId,
        `🤔 Не знаю такую команду.\n\nПопробуйте /help — покажу всё, что умею.`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
