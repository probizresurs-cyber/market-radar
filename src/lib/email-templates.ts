/**
 * HTML-шаблоны email-писем.
 *
 * Все письма — на едином layout (table-based для совместимости с
 * Outlook/Gmail/Yandex.Почтой). Тёмный logo-bar сверху, белый body,
 * один primary CTA-button. Inline-стили (CSS-классы письма игнорят).
 *
 * Каждый шаблон — функция, возвращающая `{ subject, html }`.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marketradar24.ru";
const SUPPORT_EMAIL = "hello@marketradar24.ru";

const COLORS = {
  primary: "#6366f1",
  primaryDark: "#4f46e5",
  bg: "#f5f5f7",
  card: "#ffffff",
  text: "#1a1a2e",
  textSecondary: "#55576B",
  textMuted: "#8A8C9E",
  border: "#e5e7eb",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
};

function escape(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Layout ──────────────────────────────────────────────────────────────────
function layout(opts: { previewText?: string; title: string; body: string; cta?: { label: string; href: string } }): string {
  const { previewText = "", title, body, cta } = opts;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
<!-- Preview text (показывается как preheader в inbox-листе) -->
<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:0;line-height:0;mso-hide:all;">
${escape(previewText)}
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${COLORS.bg};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:${COLORS.card};border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">

    <!-- Logo bar -->
    <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:20px 32px;text-align:left;">
      <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding-right:14px;vertical-align:middle;">
              <img src="${SITE_URL}/email-logo.svg" width="44" height="44" alt="MarketRadar24" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:44px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                <span style="color:#9aa0c4;font-weight:400;">Market</span>Radar<span style="color:#00D4FF;font-weight:700;">24</span>
              </span>
            </td>
          </tr>
        </table>
      </a>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:36px 32px;">
      <h1 style="margin:0 0 22px;font-size:24px;font-weight:700;color:${COLORS.text};line-height:1.3;letter-spacing:-0.4px;">
        ${escape(title)}
      </h1>
      <div style="font-size:15px;line-height:1.6;color:${COLORS.textSecondary};">
        ${body}
      </div>

      ${cta ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
        <tr><td style="border-radius:10px;background:${COLORS.primary};">
          <a href="${escape(cta.href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
            ${escape(cta.label)} →
          </a>
        </td></tr>
      </table>
      ` : ""}
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.bg};font-size:12px;color:${COLORS.textMuted};line-height:1.55;">
      <div style="margin-bottom:8px;">
        Письмо отправлено автоматически. Если у вас есть вопросы —
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.primary};text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
      <div>MarketRadar24 — AI-платформа конкурентного анализа · <a href="${SITE_URL}" style="color:${COLORS.textMuted};text-decoration:underline;">${SITE_URL.replace(/^https?:\/\//, "")}</a></div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── 1. Welcome (после регистрации) ──────────────────────────────────────────
export function welcomeEmail(opts: { name: string; email: string }) {
  const subject = "Добро пожаловать в MarketRadar 🎯";
  const body = `
    <p style="margin:0 0 14px;">Привет, ${escape(opts.name)}!</p>
    <p style="margin:0 0 14px;">
      Спасибо, что зарегистрировались в <b>MarketRadar24</b> — AI-платформе для анализа бизнеса,
      конкурентов и видимости в нейросетях.
    </p>
    <p style="margin:0 0 14px;">
      Вам активирован <b>пробный период на 7 дней</b> со 100&nbsp;000 AI-токенов. Этого хватит на:
    </p>
    <ul style="margin:0 0 14px;padding-left:22px;">
      <li>Полный анализ компании и 3-5 конкурентов</li>
      <li>Портрет целевой аудитории + CJM</li>
      <li>СММ-стратегию и контент-план</li>
      <li>SWOT-анализ с экспортом в PDF</li>
      <li>20-30 готовых постов и сторис с картинками</li>
    </ul>
    <p style="margin:0 0 0;">
      Нажмите кнопку, чтобы запустить первый анализ — это займёт 3 минуты.
    </p>
  `;
  return {
    subject,
    html: layout({
      previewText: "Ваш пробный период активирован — 7 дней и 100k AI-токенов",
      title: `Привет, ${opts.name}! 👋`,
      body,
      cta: { label: "Запустить первый анализ", href: `${SITE_URL}/?nav=new-analysis` },
    }),
  };
}

// ─── 2. Восстановление пароля ────────────────────────────────────────────────
export function passwordResetEmail(opts: { name: string; resetUrl: string }) {
  const subject = "Восстановление пароля — MarketRadar";
  const body = `
    <p style="margin:0 0 14px;">Привет, ${escape(opts.name)}!</p>
    <p style="margin:0 0 14px;">
      Вы запросили восстановление пароля. Нажмите кнопку ниже, чтобы задать новый пароль —
      ссылка действует <b>1 час</b>.
    </p>
    <p style="margin:0 0 14px;">
      Если вы <i>не запрашивали</i> восстановление — просто проигнорируйте это письмо,
      ваш пароль не изменится.
    </p>
    <p style="margin:14px 0 0;font-size:13px;color:${COLORS.textMuted};">
      Если кнопка не работает, скопируйте ссылку:<br>
      <span style="font-family:monospace;word-break:break-all;color:${COLORS.textSecondary};">${escape(opts.resetUrl)}</span>
    </p>
  `;
  return {
    subject,
    html: layout({
      previewText: "Ссылка на восстановление пароля действует 1 час",
      title: "Восстановление пароля",
      body,
      cta: { label: "Задать новый пароль", href: opts.resetUrl },
    }),
  };
}

// ─── 3. Счёт на оплату (выставлен) ───────────────────────────────────────────
export function invoiceCreatedEmail(opts: {
  recipientName: string;
  invoiceNumber: string;
  amount: number;          // в рублях
  dueDate: Date;
  serviceDescription: string;
  invoiceUrl: string;       // ссылка на /api/invoices/[id]/pdf
}) {
  const fmtMoney = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(opts.amount);
  const fmtDate = opts.dueDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const subject = `Счёт на оплату № ${opts.invoiceNumber}`;
  const body = `
    <p style="margin:0 0 14px;">Здравствуйте, ${escape(opts.recipientName)}!</p>
    <p style="margin:0 0 18px;">
      По вашему запросу выставлен счёт на оплату. Файл во вложении (PDF).
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.bg};border-radius:10px;padding:18px;margin:0 0 18px;">
      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Номер счёта</td></tr>
      <tr><td style="font-size:18px;font-weight:700;color:${COLORS.text};padding:0 0 14px;">${escape(opts.invoiceNumber)}</td></tr>

      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Сумма к оплате</td></tr>
      <tr><td style="font-size:32px;font-weight:800;color:${COLORS.text};padding:0 0 14px;letter-spacing:-0.5px;">${fmtMoney} ₽</td></tr>

      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Услуга</td></tr>
      <tr><td style="font-size:14px;color:${COLORS.textSecondary};padding:0 0 14px;line-height:1.55;">${escape(opts.serviceDescription)}</td></tr>

      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Срок оплаты</td></tr>
      <tr><td style="font-size:15px;font-weight:600;color:${COLORS.text};">до ${fmtDate}</td></tr>
    </table>
    <p style="margin:0 0 0;font-size:14px;color:${COLORS.textSecondary};">
      В назначении платежа укажите: <b>«Оплата по счёту № ${escape(opts.invoiceNumber)}, без НДС»</b>.
      После поступления средств мы пришлём акт выполненных работ автоматически.
    </p>
  `;
  return {
    subject,
    html: layout({
      previewText: `Счёт ${opts.invoiceNumber} на ${fmtMoney} ₽, срок оплаты до ${fmtDate}`,
      title: `Счёт № ${opts.invoiceNumber}`,
      body,
      cta: { label: "Открыть счёт", href: opts.invoiceUrl },
    }),
  };
}

// ─── 4. Акт выполненных работ ────────────────────────────────────────────────
export function actCreatedEmail(opts: {
  recipientName: string;
  actNumber: string;
  invoiceNumber?: string | null;
  amount: number;
  serviceDescription: string;
  actUrl: string;
}) {
  const fmtMoney = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(opts.amount);
  const subject = `Акт об оказании услуг № ${opts.actNumber}`;
  const body = `
    <p style="margin:0 0 14px;">Здравствуйте, ${escape(opts.recipientName)}!</p>
    <p style="margin:0 0 18px;">
      Подтверждаем получение оплаты${opts.invoiceNumber ? ` по счёту <b>${escape(opts.invoiceNumber)}</b>` : ""}.
      Прикладываем акт об оказании услуг (PDF во вложении).
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.bg};border-radius:10px;padding:18px;margin:0 0 18px;">
      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Номер акта</td></tr>
      <tr><td style="font-size:18px;font-weight:700;color:${COLORS.text};padding:0 0 14px;">${escape(opts.actNumber)}</td></tr>

      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Сумма</td></tr>
      <tr><td style="font-size:24px;font-weight:800;color:${COLORS.success};padding:0 0 14px;letter-spacing:-0.4px;">${fmtMoney} ₽</td></tr>

      <tr><td style="font-size:13px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;padding:0 0 6px;">Услуга</td></tr>
      <tr><td style="font-size:14px;color:${COLORS.textSecondary};line-height:1.55;">${escape(opts.serviceDescription)}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:${COLORS.textSecondary};">
      Подписанный экземпляр со стороны исполнителя — во вложении. Если требуется обмен оригиналами,
      напишите нам на <a href="mailto:hello@marketradar24.ru" style="color:${COLORS.primary};text-decoration:none;">hello@marketradar24.ru</a>.
    </p>
  `;
  return {
    subject,
    html: layout({
      previewText: `Акт ${opts.actNumber} на ${fmtMoney} ₽`,
      title: `Акт № ${opts.actNumber}`,
      body,
      cta: { label: "Открыть акт", href: opts.actUrl },
    }),
  };
}

// ─── 5. Уведомление админу о новом регистрации ───────────────────────────────
export function adminNewSignupEmail(opts: {
  email: string;
  name: string;
  companyName: string | null;
  companyUrl: string | null;
  referralCode: string | null;
  createdAt: Date;
}) {
  const ts = opts.createdAt.toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const subject = `🆕 Новая регистрация: ${opts.email}`;
  const body = `
    <p style="margin:0 0 14px;">Зарегистрировался новый пользователь на платформе.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.bg};border-radius:10px;padding:18px;margin:0 0 14px;">
      <tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;width:160px;">Email</td><td style="font-size:14px;font-weight:600;color:${COLORS.text};padding:6px 0;"><a href="mailto:${escape(opts.email)}" style="color:${COLORS.primary};text-decoration:none;">${escape(opts.email)}</a></td></tr>
      <tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;">Имя</td><td style="font-size:14px;color:${COLORS.text};padding:6px 0;">${escape(opts.name)}</td></tr>
      ${opts.companyName ? `<tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;">Компания</td><td style="font-size:14px;color:${COLORS.text};padding:6px 0;">${escape(opts.companyName)}</td></tr>` : ""}
      ${opts.companyUrl ? `<tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;">Сайт</td><td style="font-size:14px;color:${COLORS.text};padding:6px 0;"><a href="${escape(opts.companyUrl)}" style="color:${COLORS.primary};text-decoration:none;">${escape(opts.companyUrl)}</a></td></tr>` : ""}
      ${opts.referralCode ? `<tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;">Реф.код</td><td style="font-size:14px;font-family:monospace;color:${COLORS.success};padding:6px 0;font-weight:700;">${escape(opts.referralCode)}</td></tr>` : ""}
      <tr><td style="font-size:13px;color:${COLORS.textMuted};padding:6px 0;">Время</td><td style="font-size:14px;color:${COLORS.text};padding:6px 0;">${ts}</td></tr>
    </table>
  `;
  return {
    subject,
    html: layout({
      previewText: `${opts.email}${opts.companyName ? ` · ${opts.companyName}` : ""}`,
      title: "🆕 Новая регистрация",
      body,
      cta: { label: "Открыть админку", href: `${SITE_URL}/admin/dashboard` },
    }),
  };
}

// ─── 6. Тестовое письмо (для админ-страницы /admin/email-test) ───────────────
export function testEmail(opts: { account: string }) {
  const ts = new Date().toLocaleString("ru-RU");
  const subject = `[TEST] MarketRadar24 email — ${opts.account}`;
  const body = `
    <p style="margin:0 0 14px;">Это тестовое письмо от платформы MarketRadar24.</p>
    <p style="margin:0 0 14px;">
      Если вы получили его — значит SMTP-аккаунт <b>${escape(opts.account)}</b> работает корректно.
    </p>
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">
      Время отправки: ${ts}
    </p>
  `;
  return {
    subject,
    html: layout({
      previewText: `Test email from ${opts.account}`,
      title: "Тест SMTP",
      body,
    }),
  };
}
