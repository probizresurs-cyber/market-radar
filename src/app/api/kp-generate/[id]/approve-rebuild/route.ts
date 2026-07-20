import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { sendMail } from "@/lib/mailer";

// POST /api/kp-generate/<id>/approve-rebuild — менеджер сравнил оригинал и
// пересобранную версию (таб «Ревью пересборок») и одобряет отправку клиенту.
// Письмо уходит на email, оставленный клиентом при запросе («Да, интересно»
// на /kp-share). TG/WhatsApp — Фаза 5, для этого нет захваченного контакта
// клиента в мессенджере (см. docs/astro-rebuild.md — намеренно отложено).
export const runtime = "nodejs";

interface Row {
  id: string; url: string; company_name: string | null;
  rebuild_status: string | null; rebuild_id: string | null; client_email: string | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;

  const rows = await query<Row>(
    "SELECT id, url, company_name, rebuild_status, rebuild_id, client_email FROM kp_generations WHERE id = $1",
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
  const previewUrl = `${origin}/api/site-preview/${r.rebuild_id}`;
  const name = r.company_name || r.url;

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:32px auto;padding:0 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:800;color:#2a78d6;">MarketRadar</span>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px;">
      <h1 style="margin:0 0 12px;font-size:21px;font-weight:800;color:#111827;">Новая версия сайта готова</h1>
      <p style="margin:0 0 20px;font-size:14.5px;color:#4b5563;line-height:1.6;">
        Здравствуйте! Мы подготовили обновлённую версию сайта «${name}» — дизайн сохранён без изменений,
        устранены технические проблемы, из-за которых сайт грузился медленнее и хуже был виден в поиске.
      </p>
      <div style="text-align:center;margin:26px 0;">
        <a href="${previewUrl}" style="display:inline-block;background:#2a78d6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;padding:14px 32px;">
          Посмотреть новую версию →
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
        Если хотите оставить эту версию себе — просто ответьте на это письмо, обсудим детали переноса.
      </p>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">MarketRadar · marketradar24.ru</div>
  </div>
</body>
</html>`;

  const mail = await sendMail({ to: r.client_email, subject: `Новая версия сайта готова — ${name}`, html, from: "hello" });
  const emailSent = mail.ok && !mail.skipped;

  await query(
    "UPDATE kp_generations SET rebuild_status = $2, approved_at = COALESCE(approved_at, NOW()) WHERE id = $1",
    [id, emailSent ? "sent" : "approved"],
  );

  return NextResponse.json({
    ok: true,
    emailSent,
    emailError: emailSent ? null : (mail.error ?? "Письмо не отправлено (SMTP не настроен) — пришлите ссылку клиенту вручную"),
    previewUrl,
  });
}
