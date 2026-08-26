/**
 * POST /api/kp-generate/<id>/magic-link
 *
 * Фаза B воронки: «Создать доступ к платформе» из карточки истории в
 * менеджерке. По email лида (client_email/kp_sent_to):
 *  1. Находит существующий аккаунт `users` по email, либо создаёт новый
 *     (случайный пароль-хэш — клиент входит только по ссылке; обычный
 *     пароль можно завести позже через «забыли пароль», если он появится).
 *  2. Если у аккаунта ещё НЕТ своих данных компании (`user_data.company`) —
 *     переносит туда готовый анализ из `kp_generations.company` (это ровно
 *     тот же AnalysisResult, что и обычный /api/analyze — см. kp-generate.ts).
 *     Если данные уже есть (клиент сам анализировался раньше) — не трогаем,
 *     чужой/более старый анализ не должен затирать его текущую работу.
 *  3. Выдаёт одноразовую ссылку входа (magic-link, 30 дней) и отправляет на
 *     email клиента. Согласие (consent_accepted_at) фиксируется не здесь, а
 *     в момент перехода по ссылке — сам клик и есть акт согласия.
 *
 * Идемпотентно по аккаунту: повторный вызов не плодит дубликаты юзера и не
 * перетирает данные, но каждый раз выдаёт свежую ссылку (использовать как
 * «переслать доступ»).
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { createMagicLink } from "@/lib/magic-link";
import { seedCompanyFromKp } from "@/lib/kp-handoff";
import { sendMail } from "@/lib/mailer";
import { TRIAL_TOKEN_LIMIT, TRIAL_DAYS } from "@/lib/subscription";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

interface Row {
  id: string; url: string; company_name: string | null; locale: string;
  client_email: string | null; kp_sent_to: string | null;
  company: AnalysisResult | null; platform_user_id: string | null;
}

const T: Record<string, {
  subject: (n: string) => string; title: string; body: (n: string) => string; cta: string; footer: string;
}> = {
  ru: {
    subject: (n) => `Доступ к вашей панели ${n} готов`,
    title: "Ваша персональная панель готова",
    body: (n) => `Мы перенесли разбор «${n}» на платформу MarketRadar — там же дашборд компании, конкуренты, целевая аудитория и генератор контента. Один клик — и вы внутри, ничего заново вводить не нужно.`,
    cta: "Открыть панель →",
    footer: "Ссылка одноразовая и действует 30 дней. Есть вопросы — просто ответьте на это письмо.",
  },
  de: {
    subject: (n) => `Zugang zu Ihrem Dashboard ${n} ist bereit`,
    title: "Ihr persönliches Dashboard ist bereit",
    body: (n) => `Wir haben die Analyse „${n}" auf die MarketRadar-Plattform übertragen — dort finden Sie das Firmen-Dashboard, Wettbewerber, Zielgruppe und den Content-Generator. Ein Klick genügt, nichts muss erneut eingegeben werden.`,
    cta: "Dashboard öffnen →",
    footer: "Der Link ist einmalig gültig und läuft in 30 Tagen ab. Fragen — einfach auf diese E-Mail antworten.",
  },
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;

  const rows = await query<Row>(
    `SELECT id, url, company_name, locale, client_email, kp_sent_to, company, platform_user_id
       FROM kp_generations WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "КП не найдено" }, { status: 404 });

  const email = (r.client_email || r.kp_sent_to || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Нет email клиента — сначала получите его (форма пересборки или отправка КП)" }, { status: 400 });
  }
  if (!r.company) {
    return NextResponse.json({ ok: false, error: "Анализ компании ещё не готов" }, { status: 400 });
  }

  // ── Найти или создать аккаунт ────────────────────────────────────────────
  const existing = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  let userId: string;
  let isNewUser: boolean;
  if (existing.length > 0) {
    userId = existing[0].id;
    isNewUser = false;
  } else {
    userId = randomUUID();
    isNewUser = true;
    const randomPasswordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
    const name = r.company_name || r.url;
    const website = r.company?.company?.url || r.url;
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, plan, plan_started_at, plan_expires_at, tokens_used, tokens_limit, website)
       VALUES ($1, $2, $3, $4, 'user', 'trial', NOW(), NOW() + ($5 || ' days')::INTERVAL, 0, $6, $7)`,
      [userId, email, randomPasswordHash, name, String(TRIAL_DAYS), TRIAL_TOKEN_LIMIT, website],
    );
  }

  // ── Перенести анализ, только если у аккаунта своих данных ещё нет ───────
  // Тот же шаг делает онбординг после самогенерации КП — общий код в
  // kp-handoff, чтобы правило «не затирать чужой анализ» не разъехалось.
  await seedCompanyFromKp(userId, id, r.company);

  // ── Ссылка + письмо ──────────────────────────────────────────────────────
  const token = await createMagicLink(userId, id);
  const origin = new URL(req.url).origin;
  const link = `${origin}/api/auth/magic-link/${token}`;
  const locale = r.locale === "de" ? "de" : "ru";
  const t = T[locale];
  const name = r.company_name || r.url;

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
        <a href="${link}" style="display:inline-block;background:#2a78d6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;padding:14px 32px;">${t.cta}</a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${t.footer}</p>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">MarketRadar · marketradar24.ru</div>
  </div>
</body>
</html>`;

  const mail = await sendMail({ to: email, subject: t.subject(name), html, from: "hello" });
  if (!mail.ok || mail.skipped) {
    return NextResponse.json({ ok: false, error: mail.error ?? "Письмо не отправлено (SMTP не настроен)", link }, { status: 502 });
  }

  return NextResponse.json({ ok: true, link, isNewUser, sentTo: email });
}
