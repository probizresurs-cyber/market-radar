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
import { initDb, query } from "@/lib/db";
import { enqueueKp } from "@/lib/kp-queue";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const consent = body.consent === true;

  if (!id) return NextResponse.json({ ok: false, error: "id обязателен" }, { status: 400 });
  if (!consent) return NextResponse.json({ ok: false, error: "Нужно согласие на обработку персональных данных" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Проверьте email" }, { status: 400 });
  }

  const rows = await query<{ id: string; url: string; kp_id: string | null; client_ip: string | null }>(
    `SELECT id, url, kp_id, client_ip FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Проверка не найдена" }, { status: 404 });

  // Повторный сабмит — не дубль генерации: отдаём уже привязанное КП.
  if (r.kp_id) {
    await query(`UPDATE mini_checks SET email = $2, updated_at = NOW() WHERE id = $1`, [id, email]);
    return NextResponse.json({ ok: true, kpId: r.kp_id, reused: true });
  }

  // Дедуп на уровне kp_generations — тот же сайт мог запросить полный разбор
  // с /express-report: переиспользуем генерацию, а не жжём Claude второй раз.
  const dupKp = await query<{ id: string }>(
    `SELECT id FROM kp_generations
      WHERE source='public' AND url=$1 AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('queued','running','done')
      ORDER BY created_at DESC LIMIT 1`,
    [r.url],
  );
  const kpId = dupKp[0]?.id ?? await enqueueKp(r.url, "ru", {
    source: "public",
    clientEmail: email,
    clientIp: r.client_ip ?? undefined,
  });

  await query(`UPDATE mini_checks SET email = $2, kp_id = $3, updated_at = NOW() WHERE id = $1`, [id, email, kpId]);
  return NextResponse.json({ ok: true, kpId });
}
