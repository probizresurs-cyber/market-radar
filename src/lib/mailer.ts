/**
 * Email-инфраструктура MarketRadar.
 *
 * Используется reg.ru Mail-1 (`mail.hosting.reg.ru`, SSL/TLS на 465).
 * Три отдельных ящика-аккаунта, каждый под свой класс писем:
 *
 *   noreply@  — все системные письма (welcome, восстановление пароля,
 *               уведомления, продление триала). Reply-To идёт на hello@.
 *   billing@  — счета и акты для юрлиц/ИП. Reply-To на hello@.
 *   hello@    — для контактов клиентов (FROM-адрес для outbound от админа,
 *               и REPLY-TO для всех системных).
 *
 * Все 3 ящика на одном SMTP, отличаются только auth.user/pass.
 *
 * ENV (на VPS):
 *   SMTP_HOST=mail.hosting.reg.ru
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER_NOREPLY=noreply@marketradar24.ru
 *   SMTP_PASS_NOREPLY=...
 *   SMTP_USER_BILLING=billing@marketradar24.ru
 *   SMTP_PASS_BILLING=...
 *   SMTP_USER_HELLO=hello@marketradar24.ru
 *   SMTP_PASS_HELLO=...
 *   EMAIL_FROM_NAME=MarketRadar
 *   EMAIL_REPLY_TO=hello@marketradar24.ru
 *   EMAIL_ENABLED=true   (false — отключить отправку, для локальной разработки)
 *
 * NOTE: nodemailer создаёт пул TCP-соединений (max 5), сам делает retry на
 * сетевые ошибки. Мы добавляем верхнеуровневый retry с экспоненциальной
 * задержкой и троттлинг — reg.ru Mail-1 имеет негласный лимит ~150 писем
 * в час с одного ящика, мы пушим не больше 1 письма в секунду.
 */

// Динамический импорт — чтобы локальный билд (где nodemailer может быть не
// установлен — например, ENOSPC на диске разработчика) не падал.
// На VPS пакет установится через npm install и dynamic-import отработает.
type NodemailerModule = typeof import("nodemailer");
type NMTransporter = ReturnType<NodemailerModule["createTransport"]>;
// SendMailOptions описывает параметры одного письма.
// Дублируем минимально нужный subset, чтобы не зависеть от установки types.
interface NMSendMailOptions {
  from?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename?: string;
    content?: Buffer | string;
    contentType?: string;
    path?: string;
  }>;
  headers?: Record<string, string>;
}

let _nodemailer: NodemailerModule | null = null;
async function getNodemailer(): Promise<NodemailerModule> {
  if (_nodemailer) return _nodemailer;
  // Используем Function-обёртку, чтобы Turbopack не пытался резолвить
  // импорт во время статического анализа (пакет может быть не установлен
  // локально из-за переполненного диска — на VPS он есть).
  const importer = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  const mod = (await importer("nodemailer")) as NodemailerModule;
  _nodemailer = mod;
  return mod;
}

export type MailAccount = "noreply" | "billing" | "hello";

const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MarketRadar";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? "hello@marketradar24.ru";
const ENABLED = process.env.EMAIL_ENABLED !== "false";

// ─── Подключения (lazy, один раз) ────────────────────────────────────────────
type Pool = { user: string; transporter: NMTransporter };
const pools: Partial<Record<MailAccount, Pool>> = {};

async function getPool(acc: MailAccount): Promise<Pool | null> {
  if (pools[acc]) return pools[acc]!;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";

  const user = process.env[`SMTP_USER_${acc.toUpperCase()}`];
  const pass = process.env[`SMTP_PASS_${acc.toUpperCase()}`];
  if (!host || !user || !pass) return null;

  const nm = await getNodemailer();
  pools[acc] = {
    user,
    transporter: nm.createTransport({
      host, port, secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      // Reg.ru сертификат иногда без полной цепочки — strict ставим в false
      // только если явно скажут (на проде должно быть true).
      tls: { rejectUnauthorized: process.env.SMTP_TLS_STRICT !== "false" },
    }),
  };
  return pools[acc]!;
}

// ─── Throttle: 1 письмо в секунду max ─────────────────────────────────────────
let lastSentAt = 0;
const MIN_INTERVAL_MS = 1000;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastSentAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastSentAt = Date.now();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SendMailParams {
  /** Кому. Один email или массив. */
  to: string | string[];
  /** Subject. */
  subject: string;
  /** HTML-тело. */
  html: string;
  /** Plaintext fallback. Если не задано — выдернем из html (грубо). */
  text?: string;
  /** Какой аккаунт-отправитель использовать. По умолчанию `noreply`. */
  from?: MailAccount;
  /** Reply-To. По умолчанию EMAIL_REPLY_TO. */
  replyTo?: string;
  /** Вложения (например, PDF счёта). */
  attachments?: NMSendMailOptions["attachments"];
  /** BCC администратору и т.п. */
  bcc?: string | string[];
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** false — если EMAIL_ENABLED=false или нет credentials. Не считаем за ошибку. */
  skipped?: boolean;
}

/** Отправить письмо. С retry (3 попытки) и троттлингом. */
export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  if (!ENABLED) {
    console.log("[mailer] disabled (EMAIL_ENABLED=false)", { to: params.to, subject: params.subject });
    return { ok: true, skipped: true };
  }

  const account: MailAccount = params.from ?? "noreply";
  let pool: Pool | null;
  try {
    pool = await getPool(account);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mailer] failed to load nodemailer:", msg);
    return { ok: false, skipped: true, error: `Не удалось загрузить nodemailer: ${msg}` };
  }
  if (!pool) {
    console.warn("[mailer] no SMTP credentials for", account);
    return { ok: false, skipped: true, error: `Не настроен SMTP-аккаунт ${account}` };
  }

  await throttle();

  const fallbackText = params.text ?? params.html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const message: NMSendMailOptions = {
    from: `"${FROM_NAME}" <${pool.user}>`,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    subject: params.subject,
    html: params.html,
    text: fallbackText,
    replyTo: params.replyTo ?? REPLY_TO,
    bcc: params.bcc,
    attachments: params.attachments,
    headers: {
      "X-Mailer": "MarketRadar",
      "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
    },
  };

  const MAX_RETRIES = 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const info = await pool.transporter.sendMail(message);
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      // Backoff: 1.5s, 4.5s, 13s
      if (attempt < MAX_RETRIES) {
        const delay = 1500 * Math.pow(3, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  console.error("[mailer] send failed after retries", { to: params.to, subject: params.subject, error: msg });
  return { ok: false, error: msg };
}

/**
 * Проверить SMTP-подключение для конкретного аккаунта (используется в админ-тесте).
 * Не отправляет письмо — только TCP+TLS+AUTH handshake.
 */
export async function verifyMailAccount(account: MailAccount): Promise<{ ok: boolean; error?: string }> {
  if (!ENABLED) return { ok: false, error: "EMAIL_ENABLED=false" };
  try {
    const pool = await getPool(account);
    if (!pool) return { ok: false, error: `Нет SMTP credentials для ${account}` };
    await pool.transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
