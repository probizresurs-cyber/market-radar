/**
 * Telegram-воронка для КП-клиентов (дожим после пересборки сайта).
 *
 * Клиент подключается к боту по deep-link kp_<код> со страницы КП (Фаза 5).
 * Дальше бот не только уведомляет «сайт готов», но и дожимает на следующий
 * продукт: полный анализ сайта + SEO/GEO-продвижение — тем же ботом
 * (@market_radar1_bot), тем же TELEGRAM_BOT_TOKEN, что и остальная платформа.
 *
 * Шаги воронки:
 *   1. connect        — подтверждение подписки (webhook, /start kp_...)
 *   2. site-ready     — новый сайт готов: кнопки «Открыть» + «Полный анализ»
 *                       (approve-rebuild, после одобрения менеджером)
 *   3. followup день 1 — «как вам новая версия?» + оффер полного анализа
 *   4. followup день 3 — последний штрих: SEO/GEO-ценность, CTA «ответьте здесь»
 *      (3–4 шлёт cron /api/cron/kp-followups; followup_stage в kp_generations)
 *   + любой входящий текст от КП-клиента → ответ-меню + пересылка менеджеру
 *     (env KP_MANAGER_TG_CHAT_ID, опционально).
 *
 * Все тексты локализованы RU/DE по kp_generations.locale.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";
const SITE = "https://marketradar24.ru";

export type KpTgLocale = "ru" | "de";

export interface TgButton { text: string; url?: string; callback_data?: string }

export async function sendKpTgMessage(
  chatId: number | string,
  text: string,
  keyboard?: TgButton[][],
): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.length > 4096 ? text.slice(0, 4093) + "..." : text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  try {
    const r = await fetch(`${TG_BASE}/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json() as { ok: boolean; description?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.description ?? "Telegram error" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Данные КП, нужные воронке ──────────────────────────────────────────────

export interface KpFunnelCtx {
  companyName: string;
  locale: KpTgLocale;
  /** Ссылка на клиентскую страницу /site-ready/<rebuild_id>?locale=... (если пересборка отправлена). */
  siteReadyUrl?: string | null;
  /** Ссылка на само КП /kp-share/<token> (там тарифы + форма заявки). */
  kpUrl?: string | null;
}

export function kpShareUrl(shareToken: string | null): string | null {
  return shareToken ? `${SITE}/kp-share/${shareToken}` : null;
}

// ─── Тексты ─────────────────────────────────────────────────────────────────

const T: Record<KpTgLocale, {
  connected: (name: string) => string;
  codeInvalid: string;
  siteReady: (name: string) => string;
  btnOpenSite: string;
  btnFullAnalysis: string;
  btnOpenKp: string;
  followup1: (name: string) => string;
  followup2: (name: string) => string;
  inboundAck: string;
}> = {
  ru: {
    connected: (name) =>
      `✅ <b>Готово!</b>\n\n` +
      `Подключили уведомления по КП «${name}». Как только новая версия сайта будет готова и проверена — пришлём ссылку сюда же, не только на почту.`,
    codeInvalid:
      `🤔 Эта ссылка для подключения уже недействительна — попробуйте открыть её заново со страницы вашего КП.`,
    siteReady: (name) =>
      `🚀 <b>Новая версия сайта готова</b>\n\n` +
      `Мы подготовили обновлённую версию сайта «${name}»: дизайн сохранён, технические проблемы устранены — сайт грузится быстрее и лучше виден в поиске.\n\n` +
      `А чтобы быстрый сайт ещё и приводил клиентов, следующий шаг — полный анализ: SEO, конкуренты, целевая аудитория + SEO/GEO-продвижение (видимость в поиске и в ответах ИИ — ChatGPT, Алиса, Gemini).`,
    btnOpenSite: "🌐 Открыть новый сайт",
    btnFullAnalysis: "📊 Полный анализ + SEO/GEO",
    btnOpenKp: "📄 Открыть предложение",
    followup1: (name) =>
      `👋 Здравствуйте! Пару дней назад мы отправили вам новую версию сайта «${name}».\n\n` +
      `Как впечатления? Если что-то хочется поправить — просто ответьте на это сообщение, мы на связи.\n\n` +
      `И небольшое напоминание: скорость — это фундамент, но клиентов приводит видимость. Мы можем сделать <b>полный анализ</b> (SEO, конкуренты, целевая аудитория) и настроить <b>SEO/GEO-продвижение</b>, чтобы сайт находили и в поиске, и в ответах ИИ.`,
    followup2: (name) =>
      `📈 Последнее письмо от нас по сайту «${name}» — дальше не будем беспокоить.\n\n` +
      `Быстрый сайт — первый шаг. Второй — чтобы его находили:\n` +
      `• <b>SEO</b> — позиции в Яндексе и Google по вашим запросам\n` +
      `• <b>GEO</b> — попадание в ответы ИИ (ChatGPT, Алиса, Gemini), куда всё чаще уходят клиенты\n` +
      `• <b>Полный анализ</b> — конкуренты, целевая аудитория, план роста\n\n` +
      `Если интересно — просто ответьте на это сообщение или откройте предложение по кнопке ниже. Ответим в тот же день.`,
    inboundAck:
      `✅ Спасибо, получили ваше сообщение — передали менеджеру, ответим в ближайшее время.\n\n` +
      `Пока ждёте, всё по вашему проекту — по кнопкам ниже:`,
  },
  de: {
    connected: (name) =>
      `✅ <b>Fertig!</b>\n\n` +
      `Benachrichtigungen für das Angebot „${name}" sind verbunden. Sobald die neue Website-Version fertig und geprüft ist, senden wir den Link auch hierher — nicht nur per E-Mail.`,
    codeInvalid:
      `🤔 Dieser Verbindungslink ist nicht mehr gültig — öffnen Sie ihn bitte erneut über die Seite Ihres Angebots.`,
    siteReady: (name) =>
      `🚀 <b>Die neue Website-Version ist fertig</b>\n\n` +
      `Wir haben eine aktualisierte Version der Website „${name}" vorbereitet: Design unverändert, technische Probleme behoben — die Website lädt schneller und ist in der Suche besser sichtbar.\n\n` +
      `Damit die schnelle Website auch Kunden bringt, ist der nächste Schritt eine vollständige Analyse: SEO, Wettbewerber, Zielgruppe + SEO/GEO-Optimierung (Sichtbarkeit in der Suche und in KI-Antworten — ChatGPT, Gemini).`,
    btnOpenSite: "🌐 Neue Website öffnen",
    btnFullAnalysis: "📊 Vollanalyse + SEO/GEO",
    btnOpenKp: "📄 Angebot öffnen",
    followup1: (name) =>
      `👋 Hallo! Vor ein paar Tagen haben wir Ihnen die neue Version der Website „${name}" geschickt.\n\n` +
      `Wie ist Ihr Eindruck? Wenn Sie etwas anpassen möchten — antworten Sie einfach auf diese Nachricht.\n\n` +
      `Und eine kleine Erinnerung: Geschwindigkeit ist das Fundament, aber Kunden bringt die Sichtbarkeit. Wir können eine <b>Vollanalyse</b> (SEO, Wettbewerber, Zielgruppe) durchführen und <b>SEO/GEO</b> einrichten, damit Ihre Website in der Suche und in KI-Antworten gefunden wird.`,
    followup2: (name) =>
      `📈 Unsere letzte Nachricht zur Website „${name}" — danach melden wir uns nicht mehr ungefragt.\n\n` +
      `Eine schnelle Website ist der erste Schritt. Der zweite — gefunden zu werden:\n` +
      `• <b>SEO</b> — Positionen bei Google zu Ihren Suchanfragen\n` +
      `• <b>GEO</b> — Präsenz in KI-Antworten (ChatGPT, Gemini), wohin immer mehr Kunden abwandern\n` +
      `• <b>Vollanalyse</b> — Wettbewerber, Zielgruppe, Wachstumsplan\n\n` +
      `Bei Interesse antworten Sie einfach auf diese Nachricht oder öffnen Sie das Angebot über den Button unten. Wir antworten am selben Tag.`,
    inboundAck:
      `✅ Danke, wir haben Ihre Nachricht erhalten und an Ihren Manager weitergeleitet — wir melden uns in Kürze.\n\n` +
      `In der Zwischenzeit finden Sie alles zu Ihrem Projekt über die Buttons unten:`,
  },
};

function funnelButtons(ctx: KpFunnelCtx): TgButton[][] {
  const t = T[ctx.locale];
  const rows: TgButton[][] = [];
  if (ctx.siteReadyUrl) rows.push([{ text: t.btnOpenSite, url: ctx.siteReadyUrl }]);
  if (ctx.kpUrl) rows.push([{ text: ctx.siteReadyUrl ? t.btnFullAnalysis : t.btnOpenKp, url: ctx.kpUrl }]);
  return rows;
}

// ─── Шаги воронки ───────────────────────────────────────────────────────────

/** Шаг 1: подтверждение подписки после /start kp_<код> (зовётся из webhook). */
export async function sendKpConnected(chatId: number | string, ctx: KpFunnelCtx) {
  const t = T[ctx.locale];
  const buttons: TgButton[][] = ctx.kpUrl ? [[{ text: t.btnOpenKp, url: ctx.kpUrl }]] : [];
  return sendKpTgMessage(chatId, t.connected(ctx.companyName), buttons.length ? buttons : undefined);
}

/**
 * Код kp_<...> из /start не найден в БД (устарел/ошибка) — на этом этапе
 * ещё нет строки kp_generations, поэтому locale клиента неизвестен.
 * Честно шлём оба варианта одним сообщением, а не гадаем язык.
 */
export async function sendKpCodeInvalid(chatId: number | string) {
  return sendKpTgMessage(chatId, `${T.ru.codeInvalid}\n\n${T.de.codeInvalid}`);
}

/** Шаг 2: «новый сайт готов» + кнопки апселла (зовётся из approve-rebuild). */
export async function sendKpSiteReady(chatId: number | string, ctx: KpFunnelCtx) {
  return sendKpTgMessage(chatId, T[ctx.locale].siteReady(ctx.companyName), funnelButtons(ctx));
}

/** Шаги 3–4: дожим-серия (зовётся из cron/kp-followups). stage: 1 → day-1, 2 → day-3. */
export async function sendKpFollowup(chatId: number | string, ctx: KpFunnelCtx, stage: 1 | 2) {
  const t = T[ctx.locale];
  const text = stage === 1 ? t.followup1(ctx.companyName) : t.followup2(ctx.companyName);
  return sendKpTgMessage(chatId, text, funnelButtons(ctx));
}

/** Ответ на любой входящий текст от КП-клиента (зовётся из webhook). */
export async function sendKpInboundAck(chatId: number | string, ctx: KpFunnelCtx) {
  return sendKpTgMessage(chatId, T[ctx.locale].inboundAck, funnelButtons(ctx));
}

/**
 * Пересылка сообщения КП-клиента менеджеру (личка/группа менеджеров).
 * Работает, только если задан env KP_MANAGER_TG_CHAT_ID — иначе no-op.
 */
export async function forwardToKpManager(params: {
  companyName: string;
  clientChatId: number;
  clientName?: string;
  text: string;
}) {
  const managerChat = process.env.KP_MANAGER_TG_CHAT_ID;
  if (!managerChat) return { ok: false, error: "KP_MANAGER_TG_CHAT_ID не настроен" };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return sendKpTgMessage(
    managerChat,
    `💬 <b>Сообщение от КП-клиента</b>\n` +
      `Компания: ${esc(params.companyName)}\n` +
      `От: ${esc(params.clientName || "клиент")} (chat_id <code>${params.clientChatId}</code>)\n\n` +
      `${esc(params.text)}\n\n` +
      `↩️ Чтобы ответить клиенту — сделайте Reply на это сообщение, бот передаст ответ.`,
  );
}

/** Достаёт chat_id клиента из пересланного менеджеру сообщения (для Reply-релея в webhook). */
export function extractClientChatId(forwardedText: string): number | null {
  const m = forwardedText.match(/chat_id (\d+)/);
  return m ? Number(m[1]) : null;
}
