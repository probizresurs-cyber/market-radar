import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { sendMail } from "@/lib/mailer";

// POST /api/kp-generate/<id>/send { email } — отправить готовое КП клиенту
// на email прямо из менеджерки (ссылка + пароль), вместо ручного копирования
// в мессенджер. Фиксирует kp_sent_at/kp_sent_to — от этого момента считается
// ранний дожим (cron/kp-followups, nudge-серия до пересборки).
export const runtime = "nodejs";

interface Row {
  id: string; url: string; company_name: string | null; locale: string; status: string;
  share_token: string | null; share_password: string | null; client_email: string | null;
}

const T: Record<string, {
  subject: (n: string) => string; title: string;
  body: (n: string) => string; cta: string; passwordLabel: string; footer: string;
}> = {
  ru: {
    subject: (n) => `Персональный разбор для ${n}`,
    title: "Ваш персональный разбор готов",
    body: (n) => `Здравствуйте! Мы провели анализ «${n}»: сайт, видимость в поиске и в ответах ИИ, конкуренты. Внутри — конкретные находки и план, что улучшить в первую очередь.`,
    cta: "Открыть разбор →",
    passwordLabel: "Пароль для доступа",
    footer: "Есть вопросы — просто ответьте на это письмо.",
  },
  de: {
    subject: (n) => `Persönliche Analyse für ${n}`,
    title: "Ihre persönliche Analyse ist fertig",
    body: (n) => `Hallo! Wir haben „${n}" analysiert: Website, Sichtbarkeit in der Suche und in KI-Antworten, Wettbewerber. Darin — konkrete Erkenntnisse und ein Plan, was zuerst verbessert werden sollte.`,
    cta: "Analyse öffnen →",
    passwordLabel: "Zugangspasswort",
    footer: "Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Укажите корректный email" }, { status: 400 });
  }

  const rows = await query<Row>(
    "SELECT id, url, company_name, locale, status, share_token, share_password, client_email FROM kp_generations WHERE id = $1",
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "КП не найдено" }, { status: 404 });
  if (r.status !== "done" || !r.share_token || !r.share_password) {
    return NextResponse.json({ ok: false, error: "КП ещё не готово к отправке" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const locale = r.locale === "de" ? "de" : "ru";
  const t = T[locale];
  const name = r.company_name || r.url;
  const shareUrl = `${origin}/kp-share/${r.share_token}`;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:32px auto;padding:0 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:800;color:#2a78d6;">MarketRadar</span>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px;">
      <h1 style="margin:0 0 12px;font-size:21px;font-weight:800;color:#111827;">${t.title}</h1>
      <p style="margin:0 0 20px;font-size:14.5px;color:#4b5563;line-height:1.6;">${t.body(name)}</p>
      <div style="text-align:center;margin:24px 0 14px;">
        <a href="${shareUrl}" style="display:inline-block;background:#2a78d6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;padding:14px 32px;">${t.cta}</a>
      </div>
      <p style="margin:0 0 20px;font-size:13.5px;color:#4b5563;text-align:center;">
        ${t.passwordLabel}: <b style="font-family:ui-monospace,monospace;font-size:15px;color:#111827;">${r.share_password}</b>
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${t.footer}</p>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">MarketRadar · marketradar24.ru</div>
  </div>
</body>
</html>`;

  const mail = await sendMail({ to: email, subject: t.subject(name), html, from: "hello" });
  if (!mail.ok || mail.skipped) {
    return NextResponse.json({ ok: false, error: mail.error ?? "Письмо не отправлено (SMTP не настроен)" }, { status: 502 });
  }

  // client_email не перетираем, если клиент уже оставил свой в форме пересборки.
  await query(
    "UPDATE kp_generations SET kp_sent_at = NOW(), kp_sent_to = $2, client_email = COALESCE(client_email, $2) WHERE id = $1",
    [id, email],
  );

  return NextResponse.json({ ok: true, sentTo: email });
}
