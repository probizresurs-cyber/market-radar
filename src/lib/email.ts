/**
 * Email utility — uses Resend (resend.com) if RESEND_API_KEY is set.
 * Falls back to a console log in development if the key is missing.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const FROM_NAME = "MarketRadar";
// Change to your verified domain address once domain is added in Resend.
// Until then, use onboarding@resend.dev (works only to the owner's email).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@marketradar24.ru";

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    console.info(`[email] Would send to: ${to}\nSubject: ${subject}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] sendEmail failed:", err);
    return false;
  }
}

// ─── Email templates ─────────────────────────────────────────────────────────

export function partnerWelcomeEmail(opts: {
  name: string;
  type: "referral" | "integrator";
  email: string;
  tempPassword: string | null;
  isExistingUser: boolean;
}): { subject: string; html: string } {
  const { name, type, email, tempPassword, isExistingUser } = opts;
  const loginUrl = "https://marketradar24.ru/partner/login";
  const cabinetUrl = type === "integrator"
    ? "https://marketradar24.ru/integrator"
    : "https://marketradar24.ru/partner";
  const typeLabel = type === "integrator" ? "Интегратор" : "Реферальный партнёр";
  const commissionText = type === "integrator"
    ? "25–50% прогрессивно от базовой цены + ваша наценка"
    : "20% с каждого платежа привлечённого клиента";

  const credentialsBlock = isExistingUser
    ? `<p style="color:#94a3b8;font-size:14px;">Войдите с вашим существующим паролем MarketRadar.</p>`
    : `
      <div style="background:#1a1f2e;border-radius:10px;padding:20px 24px;margin:20px 0;border:1px solid #2d3748;">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">ДАННЫЕ ДЛЯ ВХОДА</p>
        <table style="width:100%;">
          <tr>
            <td style="font-size:13px;color:#64748b;padding:4px 0;">Email:</td>
            <td style="font-size:14px;color:#e2e8f0;font-weight:600;padding:4px 0;">${email}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding:4px 0;">Пароль:</td>
            <td style="font-family:monospace;font-size:20px;color:#7c3aed;font-weight:800;letter-spacing:0.1em;padding:4px 0;">${tempPassword}</td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#475569;">Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
      </div>`;

  const subject = `Добро пожаловать в партнёрскую программу MarketRadar!`;

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:26px;font-weight:800;color:#7c3aed;letter-spacing:-0.02em;">MarketRadar</span>
    </div>

    <!-- Card -->
    <div style="background:#11131c;border:1px solid #1e2737;border-radius:16px;padding:36px 40px;">

      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em;">
        Добро пожаловать в партнёрскую программу! 🎉
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
        Привет${name ? `, ${name}` : ""}! Ваша заявка на участие в партнёрской программе MarketRadar одобрена.
      </p>

      <!-- Type badge -->
      <div style="display:inline-block;background:#7c3aed22;border:1px solid #7c3aed44;border-radius:8px;padding:8px 16px;margin-bottom:20px;">
        <span style="font-size:13px;font-weight:700;color:#a78bfa;">Статус: ${typeLabel}</span>
      </div>

      <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
        Ваша комиссия: <strong style="color:#4ade80;">${commissionText}</strong>
      </p>

      <hr style="border:none;border-top:1px solid #1e2737;margin:24px 0;">

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#f1f5f9;">Войти в личный кабинет</h2>

      ${credentialsBlock}

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${loginUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;font-weight:800;font-size:15px;border-radius:10px;padding:14px 36px;letter-spacing:-0.01em;">
          Войти в кабинет →
        </a>
      </div>

      <p style="text-align:center;margin:0;font-size:12px;color:#334155;">
        Или откройте ссылку: <a href="${cabinetUrl}" style="color:#7c3aed;">${cabinetUrl}</a>
      </p>

      <hr style="border:none;border-top:1px solid #1e2737;margin:28px 0;">

      <!-- What's next -->
      <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#f1f5f9;">Что вас ждёт в кабинете</h2>
      <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#64748b;line-height:2;">
        <li>Ваша реферальная ссылка для привлечения клиентов</li>
        <li>Статистика: клиенты, платежи, комиссионные</li>
        ${type === "integrator" ? "<li>Настройка цен для клиентов и расчёт дохода</li>" : ""}
        <li>История выплат и запросы на вывод средств</li>
      </ul>

      <hr style="border:none;border-top:1px solid #1e2737;margin:28px 0;">

      <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;">
        Если у вас возникнут вопросы — пишите на
        <a href="mailto:${process.env.RESEND_FROM_EMAIL || "hello@marketradar24.ru"}" style="color:#7c3aed;">
          ${process.env.RESEND_FROM_EMAIL || "hello@marketradar24.ru"}
        </a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#1e293b;">
      MarketRadar · <a href="https://marketradar24.ru" style="color:#334155;">marketradar24.ru</a>
      · <a href="https://company24.pro/politicahr2026" style="color:#334155;">Политика конфиденциальности</a>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
