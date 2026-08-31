/**
 * POST /api/mini-check/lead { id, email, consent } — посетитель мини-проверки
 * запросил полный разбор. Конверсия анонима в лид:
 *  1. email сохраняется в mini_checks — лид есть, даже если генерация упадёт
 *     (менеджер видит его и дожимает руками);
 *  2. ставится генерация полного КП тем же конвейером kp-public с client_email
 *     — страница дальше поллит /api/kp-public/[kpId] и по готовности даёт
 *     ссылку на /kp-share.
 *
 * consent обязателен: согласие на обработку ПД по 152-ФЗ, чекбокс на форме
 * не проставлен заранее (инструкция юриста).
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { initDb, query } from "@/lib/db";
import { enqueueKp, cloneKpForLead } from "@/lib/kp-queue";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const emailInput = String(body.email ?? "").trim().toLowerCase();
  const consent = body.consent === true;
  // Отдельное согласие на рекламные письма: без него серия дожима шлёт
  // только сервисное письмо про заказанный разбор (инструкция юриста, п.3).
  const marketing = body.marketing === true;

  if (!id) return NextResponse.json({ ok: false, error: "id обязателен" }, { status: 400 });
  if (!consent) return NextResponse.json({ ok: false, error: "Нужно согласие на обработку персональных данных" }, { status: 400 });
  const rows = await query<{
    id: string; url: string; kp_id: string | null; client_ip: string | null;
    email: string | null; phone: string | null; utm: Record<string, string> | null;
  }>(
    `SELECT id, url, kp_id, client_ip, email, phone, utm FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Проверка не найдена" }, { status: 404 });

  // Контакт мог прийти раньше — с формы /geo, где человек оставил email и
  // телефон вместе с согласием. Заставлять его вводить адрес второй раз —
  // терять уже совершённую конверсию, поэтому сохранённый принимается как
  // есть, а введённый вручную имеет приоритет.
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput) ? emailInput : (r.email ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Проверьте email" }, { status: 400 });
  }

  // Повторный сабмит — не дубль генерации: отдаём уже привязанное КП.
  if (r.kp_id) {
    await query(`UPDATE mini_checks SET email = $2, updated_at = NOW() WHERE id = $1`, [id, email]);
    return NextResponse.json({ ok: true, kpId: r.kp_id, reused: true });
  }

  // Дедуп на уровне kp_generations — тот же сайт мог запросить полный разбор
  // с /express-report: переиспользуем генерацию, а не жжём Claude второй раз.
  const dupKp = await query<{ id: string; status: string }>(
    `SELECT id, status FROM kp_generations
      WHERE source='public' AND url=$1 AND created_at > NOW() - INTERVAL '24 hours'
        AND status = 'done'
      ORDER BY created_at DESC LIMIT 1`,
    [r.url],
  );
  // Готовый разбор того же сайта копируется этому лиду: содержимое то же,
  // Claude не вызывается, но ссылка, контакты и дожим — свои. Отдавать чужую
  // строку нельзя: email второго лида не записывался бы, и он терялся.
  const cloned = dupKp[0]
    ? await cloneKpForLead(dupKp[0].id, {
        clientEmail: email,
        clientPhone: r.phone ?? undefined,
        clientIp: r.client_ip ?? undefined,
        source: "public",
      })
    : null;
  const kpId = cloned ?? await enqueueKp(r.url, "ru", {
    source: "public",
    clientEmail: email,
    // Телефон с формы /geo раньше умирал в mini_checks: ни письма, ни звонка,
    // ни поля в карточке лида. Переносим — это второй канал связи.
    clientPhone: r.phone ?? undefined,
    clientIp: r.client_ip ?? undefined,
  });

  // Контакты и согласия кладём на саму генерацию — по ней работает дожим.
  // marketing_consent_at ставится ТОЛЬКО при явной галочке и больше не
  // сбрасывается: отзыв согласия делается отпиской, а не повторной формой.
  await query(
    `UPDATE kp_generations
        SET client_email = COALESCE(client_email, $2),
            marketing_consent_at = CASE WHEN $3 THEN COALESCE(marketing_consent_at, NOW()) ELSE marketing_consent_at END,
            unsub_token = COALESCE(unsub_token, $4),
            client_phone = COALESCE(client_phone, $5),
            utm = COALESCE(utm, $6::jsonb)
      WHERE id = $1`,
    [
      kpId, email, marketing, randomUUID().replace(/-/g, "").slice(0, 24),
      r.phone, r.utm ? JSON.stringify(r.utm) : null,
    ],
  );

  await query(`UPDATE mini_checks SET email = $2, kp_id = $3, updated_at = NOW() WHERE id = $1`, [id, email, kpId]);
  return NextResponse.json({ ok: true, kpId });
}
