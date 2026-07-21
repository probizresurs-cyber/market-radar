import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { sendMail } from "@/lib/mailer";
import { sendKpSiteReady, kpShareUrl } from "@/lib/kp-tg-funnel";

// POST /api/kp-generate/<id>/approve-rebuild — менеджер сравнил оригинал и
// пересобранную версию (таб «Ревью пересборок») и одобряет отправку клиенту.
// Ссылка ведёт на клиентскую /site-ready (Фаза 4, минимум жаргона) — не на
// технический /astro-rebuild и не напрямую на сырой previewUrl. Письмо + TG
// (если клиент подключил бота, Фаза 5). WhatsApp/Max по-прежнему недоступны
// (нет доступа к Meta Business API / VK API).
export const runtime = "nodejs";

interface Row {
  id: string; url: string; company_name: string | null; locale: string;
  rebuild_status: string | null; rebuild_id: string | null; client_email: string | null;
  client_tg_chat_id: number | null; share_token: string | null;
}

const EMAIL_TEXT: Record<string, { subject: (n: string) => string; title: string; body: (n: string) => string; cta: string; footer: string }> = {
  ru: {
    subject: (n) => `Новая версия сайта готова — ${n}`,
    title: "Новая версия сайта готова",
    body: (n) => `Здравствуйте! Мы подготовили обновлённую версию сайта «${n}» — дизайн сохранён без изменений, устранены технические проблемы, из-за которых сайт грузился медленнее и хуже был виден в поиске.`,
    cta: "Посмотреть новую версию →",
    footer: "Если хотите оставить эту версию себе — просто ответьте на это письмо, обсудим детали переноса.",
  },
  de: {
    subject: (n) => `Neue Website-Version fertig — ${n}`,
    title: "Neue Website-Version ist fertig",
    body: (n) => `Hallo! Wir haben eine aktualisierte Version der Website „${n}" vorbereitet — das Design ist unverändert, technische Probleme wurden behoben, die die Website verlangsamt und die Sichtbarkeit in der Suche verschlechtert haben.`,
    cta: "Neue Version ansehen →",
    footer: "Möchten Sie diese Version behalten — antworten Sie einfach auf diese E-Mail, wir besprechen die Details.",
  },
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;

  const rows = await query<Row>(
    "SELECT id, url, company_name, locale, rebuild_status, rebuild_id, client_email, client_tg_chat_id, share_token FROM kp_generations WHERE id = $1",
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "КП не найдено" }, { status: 404 });
  if (!r.rebuild_id || (r.rebuild_status !== "pending_review" && r.rebuild_status !== "approved")) {
    return NextResponse.json({ ok: false, error: "Пересборка не готова к отправке" }, { status: 400 });
  }
  if (!r.client_email) {
    return NextResponse.json({ ok: false, error: "У этой заявки нет email клиента" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const locale = r.locale === "de" ? "de" : "ru";
  const siteReadyUrl = `${origin}/site-ready/${r.rebuild_id}?locale=${locale}`;
  const name = r.company_name || r.url;
  const et = EMAIL_TEXT[locale];

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
      <h1 style="margin:0 0 12px;font-size:21px;font-weight:800;color:#111827;">${et.title}</h1>
      <p style="margin:0 0 20px;font-size:14.5px;color:#4b5563;line-height:1.6;">${et.body(name)}</p>
      <div style="text-align:center;margin:26px 0;">
        <a href="${siteReadyUrl}" style="display:inline-block;background:#2a78d6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;padding:14px 32px;">
          ${et.cta}
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${et.footer}</p>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">MarketRadar · marketradar24.ru</div>
  </div>
</body>
</html>`;

  const mail = await sendMail({ to: r.client_email, subject: et.subject(name), html, from: "hello" });
  const emailSent = mail.ok && !mail.skipped;

  // TG: не дубль письма, а первый шаг дожим-воронки — «сайт готов» + кнопки
  // «Открыть новый сайт» / «Полный анализ + SEO/GEO» (дальше cron/kp-followups).
  let tgSent = false;
  if (r.client_tg_chat_id) {
    const tg = await sendKpSiteReady(r.client_tg_chat_id, {
      companyName: name,
      locale,
      siteReadyUrl,
      kpUrl: kpShareUrl(r.share_token),
    });
    tgSent = tg.ok;
  }

  const notified = emailSent || tgSent;
  await query(
    "UPDATE kp_generations SET rebuild_status = $2, approved_at = COALESCE(approved_at, NOW()) WHERE id = $1",
    [id, notified ? "sent" : "approved"],
  );

  return NextResponse.json({
    ok: true,
    emailSent,
    tgSent,
    emailError: emailSent ? null : (mail.error ?? "Письмо не отправлено (SMTP не настроен) — пришлите ссылку клиенту вручную"),
    previewUrl: siteReadyUrl,
  });
}
