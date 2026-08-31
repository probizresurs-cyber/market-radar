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
 *   5. прогрев       — 3 сообщения тем, кто подключил бота и завис на разборе,
 *                       не дойдя до заявки (cron /api/cron/kp-tg-warm;
 *                       tg_warm_stage в kp_generations)
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

/**
 * Ссылка на КП вместе с паролем в query — ровно та, по которой откроется
 * документ без ввода пароля. Нужна менеджеру: голый /kp-share/<token>
 * упирается в форму пароля, и уведомление превращается в ребус.
 */
export function kpShareUrlWithPassword(
  shareToken: string | null | undefined,
  sharePassword: string | null | undefined,
): string | null {
  if (!shareToken) return null;
  const base = `${SITE}/kp-share/${shareToken}`;
  return sharePassword ? `${base}?p=${encodeURIComponent(sharePassword)}` : base;
}

// ─── Тексты ─────────────────────────────────────────────────────────────────

export { KP_UPSELL_PRICE } from "@/lib/kp-upsell-pricing";
import { KP_UPSELL_PRICE } from "@/lib/kp-upsell-pricing";

const T: Record<KpTgLocale, {
  connected: (name: string) => string;
  codeInvalid: string;
  siteReady: (name: string) => string;
  btnOpenSite: string;
  btnFullAnalysis: string;
  btnSeoGeo: string;
  btnOpenKp: string;
  followup1: (name: string) => string;
  followup2: (name: string) => string;
  inboundAck: string;
  /** ТГ-прогрев (cron/kp-tg-warm): 3 сообщения тем, кто подключил бота и молчит. */
  warm1: (name: string) => string;
  warm2: (name: string) => string;
  warm3: (name: string) => string;
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
      `Быстрый сайт — фундамент. Чтобы он ещё и приводил клиентов, дальше два шага (можно по отдельности):\n` +
      `📊 <b>Полный анализ</b> — SEO, конкуренты, целевая аудитория, план роста — ${KP_UPSELL_PRICE.ru.fullAnalysis}\n` +
      `🚀 <b>SEO/GEO-продвижение</b> — видимость в поиске и в ответах ИИ (ChatGPT, Алиса, Gemini) — ${KP_UPSELL_PRICE.ru.seoGeo}\n\n` +
      `Подробности — по кнопкам ниже.`,
    btnOpenSite: "🌐 Открыть новый сайт",
    btnFullAnalysis: `📊 Полный анализ — ${KP_UPSELL_PRICE.ru.fullAnalysis}`,
    btnSeoGeo: `🚀 SEO/GEO-продвижение — ${KP_UPSELL_PRICE.ru.seoGeo}`,
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
      `• <b>SEO/GEO-продвижение</b> — ${KP_UPSELL_PRICE.ru.seoGeo}\n` +
      `• <b>Полный анализ</b> — конкуренты, целевая аудитория, план роста — ${KP_UPSELL_PRICE.ru.fullAnalysis}\n\n` +
      `Если интересно — просто ответьте на это сообщение или откройте предложение по кнопке ниже. Ответим в тот же день.`,
    inboundAck:
      `✅ Спасибо, получили ваше сообщение — передали менеджеру, ответим в ближайшее время.\n\n` +
      `Пока ждёте, всё по вашему проекту — по кнопкам ниже:`,
    warm1: (name) =>
      `Разбор «${name}» у вас на руках. Если что-то в нём непонятно — спросите прямо здесь, ` +
      `ответим текстом, без звонка.\n\n` +
      `Чаще всего первый вопрос один: с чего начинать, если делать всё сразу не получится. ` +
      `Ответ зависит от вашей ситуации — напишите, какая задача сейчас острее, и мы скажем, что взяли бы первым.`,
    warm2: (name) =>
      `Три вещи, о которых обычно спрашивают после разбора «${name}»:\n\n` +
      `• <b>Когда будет результат.</b> Первые изменения — через один–три месяца. Быстрее не бывает ни у кого.\n` +
      `• <b>Можно ли частями.</b> Да, работы делятся: начать можно с одного направления и смотреть на отдачу.\n` +
      `• <b>А если подрядчик уже есть.</b> Тогда разбор — второе мнение: покажем, что у вас не закрыто, и это можно отдать текущей команде.\n\n` +
      `Если какой-то вопрос ваш — напишите сюда одной строкой, ответим по вашей ситуации.`,
    warm3: (name) =>
      `Последнее сообщение по разбору «${name}» — дальше без вашего ответа писать не будем.\n\n` +
      `Если тема живая, быстрее всего разобраться в разговоре: 15 минут, пройдём по вашим находкам ` +
      `и скажем, что имеет смысл делать в вашем случае, а что нет.\n\n` +
      `Ответьте «давайте» — предложим время. Если сейчас не до этого, напишите «не сейчас», и мы не вернёмся.`,
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
      `Eine schnelle Website ist das Fundament. Damit sie auch Kunden bringt, gibt es zwei nächste Schritte (einzeln buchbar):\n` +
      `📊 <b>Vollanalyse</b> — SEO, Wettbewerber, Zielgruppe, Wachstumsplan — ${KP_UPSELL_PRICE.de.fullAnalysis}\n` +
      `🚀 <b>SEO/GEO</b> — Sichtbarkeit in der Suche und in KI-Antworten (ChatGPT, Gemini) — ${KP_UPSELL_PRICE.de.seoGeo}\n\n` +
      `Details über die Buttons unten.`,
    btnOpenSite: "🌐 Neue Website öffnen",
    btnFullAnalysis: `📊 Vollanalyse — ${KP_UPSELL_PRICE.de.fullAnalysis}`,
    btnSeoGeo: `🚀 SEO/GEO — ${KP_UPSELL_PRICE.de.seoGeo}`,
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
      `• <b>SEO/GEO</b> — ${KP_UPSELL_PRICE.de.seoGeo}\n` +
      `• <b>Vollanalyse</b> — Wettbewerber, Zielgruppe, Wachstumsplan — ${KP_UPSELL_PRICE.de.fullAnalysis}\n\n` +
      `Bei Interesse antworten Sie einfach auf diese Nachricht oder öffnen Sie das Angebot über den Button unten. Wir antworten am selben Tag.`,
    inboundAck:
      `✅ Danke, wir haben Ihre Nachricht erhalten und an Ihren Manager weitergeleitet — wir melden uns in Kürze.\n\n` +
      `In der Zwischenzeit finden Sie alles zu Ihrem Projekt über die Buttons unten:`,
    warm1: (name) =>
      `Die Analyse „${name}" liegt Ihnen vor. Wenn etwas darin unklar ist — fragen Sie einfach hier, ` +
      `wir antworten schriftlich, ohne Anruf.\n\n` +
      `Die häufigste erste Frage: womit anfangen, wenn nicht alles auf einmal geht. ` +
      `Das hängt von Ihrer Situation ab — schreiben Sie, was gerade am dringendsten ist, und wir sagen, was wir zuerst angehen würden.`,
    warm2: (name) =>
      `Drei Fragen, die nach der Analyse „${name}" meistens kommen:\n\n` +
      `• <b>Wann gibt es Ergebnisse.</b> Erste Veränderungen nach ein bis drei Monaten. Schneller geht es bei niemandem.\n` +
      `• <b>Geht es auch schrittweise.</b> Ja, die Arbeiten lassen sich aufteilen: mit einem Bereich starten und die Wirkung beobachten.\n` +
      `• <b>Und wenn wir schon eine Agentur haben.</b> Dann ist die Analyse eine zweite Meinung: wir zeigen, was offen ist — umsetzen kann es Ihr aktuelles Team.\n\n` +
      `Wenn eine der Fragen Ihre ist — schreiben Sie eine Zeile hierher, wir antworten konkret.`,
    warm3: (name) =>
      `Letzte Nachricht zur Analyse „${name}" — ohne Ihre Antwort schreiben wir nicht weiter.\n\n` +
      `Falls das Thema aktuell ist, geht es im Gespräch am schnellsten: 15 Minuten, wir gehen Ihre Befunde durch ` +
      `und sagen, was in Ihrem Fall sinnvoll ist und was nicht.\n\n` +
      `Antworten Sie mit „gerne" — wir schlagen einen Termin vor. Passt es gerade nicht, schreiben Sie „später", und wir melden uns nicht wieder.`,
  },
};

function funnelButtons(ctx: KpFunnelCtx): TgButton[][] {
  const t = T[ctx.locale];
  const rows: TgButton[][] = [];
  if (ctx.siteReadyUrl) {
    rows.push([{ text: t.btnOpenSite, url: ctx.siteReadyUrl }]);
    // Два следующих продукта, каждый со своим тарифом: полный анализ ведёт
    // на платформу MarketRadar (сам продукт), SEO/GEO — на страницу услуги.
    rows.push([{ text: t.btnFullAnalysis, url: SITE }]);
    rows.push([{ text: t.btnSeoGeo, url: `${SITE}/seo-geo` }]);
  } else if (ctx.kpUrl) {
    rows.push([{ text: t.btnOpenKp, url: ctx.kpUrl }]);
  }
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

/**
 * ТГ-прогрев: 3 сообщения тем, кто подключил бота, но заявку так и не оставил
 * (зовётся из cron/kp-tg-warm). Кнопка ведёт в сам разбор — в нём же и форма
 * заявки, поэтому отдельного CTA-урла серии не нужно.
 */
export async function sendKpTgWarm(chatId: number | string, ctx: KpFunnelCtx, stage: 1 | 2 | 3) {
  const t = T[ctx.locale];
  const text = stage === 1 ? t.warm1(ctx.companyName) : stage === 2 ? t.warm2(ctx.companyName) : t.warm3(ctx.companyName);
  const buttons: TgButton[][] = ctx.kpUrl ? [[{ text: t.btnOpenKp, url: ctx.kpUrl }]] : [];
  return sendKpTgMessage(chatId, text, buttons.length ? buttons : undefined);
}

/** Ответ на любой входящий текст от КП-клиента (зовётся из webhook). */
export async function sendKpInboundAck(chatId: number | string, ctx: KpFunnelCtx) {
  return sendKpTgMessage(chatId, T[ctx.locale].inboundAck, funnelButtons(ctx));
}

/**
 * Чем адресовать КП в уведомлении менеджеру: либо уже известные токен и
 * пароль (роут их и так читает), либо просто id генерации — тогда достаём
 * сами. Второй вариант для мест, где строка не выбиралась целиком.
 */
export type KpManagerRef =
  | { shareToken?: string | null; sharePassword?: string | null; kpId?: never }
  | { kpId: string; shareToken?: never; sharePassword?: never };

async function resolveKpLink(ref: KpManagerRef): Promise<string | null> {
  const kpId = "kpId" in ref ? ref.kpId : null;
  const token = "shareToken" in ref ? ref.shareToken ?? null : null;
  const password = "sharePassword" in ref ? ref.sharePassword ?? null : null;
  if (token && password) return kpShareUrlWithPassword(token, password);
  if (!kpId && !token) return null;
  try {
    const { query } = await import("./db");
    const rows = kpId
      ? await query<{ share_token: string | null; share_password: string | null }>(
          "SELECT share_token, share_password FROM kp_generations WHERE id = $1", [kpId])
      : await query<{ share_token: string | null; share_password: string | null }>(
          "SELECT share_token, share_password FROM kp_generations WHERE share_token = $1", [token]);
    return kpShareUrlWithPassword(rows[0]?.share_token, rows[0]?.share_password);
  } catch {
    // Уведомление важнее ссылки: падение запроса не должно съесть заявку.
    return null;
  }
}

/**
 * Служебное уведомление менеджеру о горячем событии воронки (клиент открыл
 * КП, новая заявка на пересборку, ошибка пересборки, новая заявка на
 * апселл). Best-effort: без KP_MANAGER_TG_CHAT_ID — no-op, основной поток
 * никогда не падает из-за уведомления.
 */
export async function notifyKpManager(text: string, kp?: KpManagerRef): Promise<void> {
  // Ссылку клеим здесь, а не в каждом вызывающем роуте: иначе она снова
  // разъедется по местам и где-нибудь её опять не окажется.
  const link = kp ? await resolveKpLink(kp) : null;
  if (link) text += `\n📄 КП клиента: ${link}`;

  const managerChat = process.env.KP_MANAGER_TG_CHAT_ID;
  let delivered = false;
  if (managerChat) {
    try {
      const res = await sendKpTgMessage(managerChat, text);
      delivered = res.ok;
    } catch { /* не роняем поток */ }
  }
  if (delivered) return;

  // Запасной канал. Раньше при незаполненном KP_MANAGER_TG_CHAT_ID функция
  // молча ничего не делала — ни ошибки, ни строки в логе. Заявка на
  // сопровождение, самое дорогое событие воронки, исчезала из-за одной
  // незаполненной переменной, и узнать об этом было неоткуда. Теперь
  // уведомление дублируется письмом, а промах пишется в лог.
  const to = process.env.KP_MANAGER_EMAIL || "support@marketradar24.ru";
  console.warn(
    `[kp-tg] уведомление менеджеру не ушло в Telegram (${managerChat ? "ошибка отправки" : "KP_MANAGER_TG_CHAT_ID не задан"}) — дублирую на ${to}`,
  );
  try {
    const { sendMail } = await import("./mailer");
    await sendMail({
      to,
      subject: "MarketRadar: событие воронки (Telegram недоступен)",
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6">
<p style="color:#b45309"><b>Это уведомление не удалось доставить в Telegram.</b>
${managerChat ? "Отправка боту не прошла." : "Переменная KP_MANAGER_TG_CHAT_ID не задана."}</p>
<hr style="border:none;border-top:1px solid #e2e8f0">
${text.replace(/\n/g, "<br>")}
</div>`,
    });
  } catch (e) {
    console.error("[kp-tg] и письмо менеджеру не ушло:", String(e).slice(0, 160));
  }
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
  /** id генерации — чтобы приложить ссылку на КП, которое читает собеседник. */
  kpId?: string;
}) {
  const managerChat = process.env.KP_MANAGER_TG_CHAT_ID;
  if (!managerChat) return { ok: false, error: "KP_MANAGER_TG_CHAT_ID не настроен" };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const link = params.kpId ? await resolveKpLink({ kpId: params.kpId }) : null;
  return sendKpTgMessage(
    managerChat,
    `💬 <b>Сообщение от КП-клиента</b>\n` +
      `Компания: ${esc(params.companyName)}\n` +
      `От: ${esc(params.clientName || "клиент")} (chat_id <code>${params.clientChatId}</code>)\n\n` +
      `${esc(params.text)}\n\n` +
      (link ? `📄 КП клиента: ${link}\n\n` : "") +
      `↩️ Чтобы ответить клиенту — сделайте Reply на это сообщение, бот передаст ответ.`,
  );
}

/** Достаёт chat_id клиента из пересланного менеджеру сообщения (для Reply-релея в webhook). */
export function extractClientChatId(forwardedText: string): number | null {
  const m = forwardedText.match(/chat_id (\d+)/);
  return m ? Number(m[1]) : null;
}
