/**
 * POST /api/mini-check/lead-tg { id, consent } — вторая дверь
 * воронки: получить разбор в Telegram вместо почты.
 *
 * Зачем отдельная дверь: в российском B2B заметная часть аудитории охотнее
 * нажмёт «в Telegram», чем оставит почту незнакомому сайту — почта означает
 * рассылку, мессенджер ощущается обратимым. Бот и вся TG-механика уже были
 * (kp-tg-funnel, webhook, client_tg_code), не хватало только входа с
 * лендинга: единственной дверью оставался email.
 *
 * Механика: ставим генерацию так же, как email-дверь, но вместо адреса
 * заводим одноразовый код kp_<...> и отдаём ссылку t.me/<bot>?start=<код>.
 * Человек жмёт Start — webhook связывает chat_id с генерацией, а kp-notify
 * присылает ссылку на разбор в тот же чат, когда КП соберётся.
 *
 * Согласие то же, что у email-двери: обработка ПД. По инструкции юриста
 * это единственная обязательная галочка — рекламная остаётся отдельной и
 * необязательной, иначе услуга оказывается под условием согласия на рекламу.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { initDb, query } from "@/lib/db";
import { enqueueKp, cloneKpForLead } from "@/lib/kp-queue";

export const runtime = "nodejs";

const TG_BOT_USERNAME = process.env.TG_BOT_USERNAME || "market_radar1_bot";

export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id обязателен" }, { status: 400 });
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "Нужно согласие на обработку персональных данных" }, { status: 400 });
  }

  const rows = await query<{
    id: string; url: string; kp_id: string | null; client_ip: string | null;
    phone: string | null; utm: Record<string, string> | null;
  }>(
    `SELECT id, url, kp_id, client_ip, phone, utm FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Проверка не найдена" }, { status: 404 });

  let kpId = r.kp_id;
  if (!kpId) {
    // Тот же дедуп, что у email-двери: сайт мог уже запросить разбор.
    const dupKp = await query<{ id: string }>(
      `SELECT id FROM kp_generations
        WHERE source='public' AND url=$1 AND created_at > NOW() - INTERVAL '24 hours'
          AND status = 'done'
        ORDER BY created_at DESC LIMIT 1`,
      [r.url],
    );
    // Как и у email-двери: готовый разбор копируется этому лиду, а не
    // отдаётся чужой строкой.
    kpId = (dupKp[0] ? await cloneKpForLead(dupKp[0].id, { clientPhone: r.phone ?? undefined, clientIp: r.client_ip ?? undefined, source: "public" }) : null) ?? await enqueueKp(r.url, "ru", {
      source: "public",
      clientPhone: r.phone ?? undefined,
      clientIp: r.client_ip ?? undefined,
    });
    await query(`UPDATE mini_checks SET kp_id = $2, updated_at = NOW() WHERE id = $1`, [id, kpId]);
  }

  // Код выдаём один раз и переиспользуем: повторное нажатие кнопки не должно
  // плодить ссылки, по которым «подключится» разный chat_id к одному КП.
  const existing = await query<{ client_tg_code: string | null }>(
    `SELECT client_tg_code FROM kp_generations WHERE id = $1`,
    [kpId],
  );
  const tgCode = existing[0]?.client_tg_code ?? `kp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  await query(
    `UPDATE kp_generations
        SET client_tg_code = COALESCE(client_tg_code, $2::text),
            unsub_token = COALESCE(unsub_token, $3::text),
            utm = COALESCE(utm, $4::jsonb)
      WHERE id = $1`,
    [kpId, tgCode, randomUUID().replace(/-/g, "").slice(0, 24), r.utm ? JSON.stringify(r.utm) : null],
  );

  return NextResponse.json({
    ok: true,
    kpId,
    tgConnectUrl: `https://t.me/${TG_BOT_USERNAME}?start=${tgCode}`,
  });
}
