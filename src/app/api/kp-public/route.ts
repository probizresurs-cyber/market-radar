import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";
import { enqueueKp } from "@/lib/kp-queue";

export const runtime = "nodejs";

/**
 * POST /api/kp-public { url } — публичная самогенерация КП с лендинга.
 *
 * Тот же конвейер, что у менеджера (/api/kp-generate), но без логина —
 * посетитель вводит сайт и получает КП сам. Поэтому обязательны лимиты:
 * каждая генерация — это реальные вызовы Claude.
 *  - 3 КП в сутки с одного IP: честному посетителю хватает с запасом;
 *  - 40 публичных КП в сутки всего: потолок бюджета, при переборе честно
 *    говорим «на сегодня всё», а не молча копим очередь.
 * Дубль-защита: если по этому url публичное КП уже готовится или готово
 * (за сутки) — возвращаем его же, не ставя новую генерацию.
 */
export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const raw = String(body.url ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false, error: "Укажите ссылку на сайт" }, { status: 400 });
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { new URL(url); } catch {
    return NextResponse.json({ ok: false, error: "Это не похоже на адрес сайта" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  // Дубль: тот же сайт за последние сутки — отдаём существующую генерацию.
  const dup = await query<{ id: string }>(
    `SELECT id FROM kp_generations
      WHERE source='public' AND url=$1 AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('queued','running','done')
      ORDER BY created_at DESC LIMIT 1`,
    [url],
  );
  if (dup[0]) return NextResponse.json({ ok: true, id: dup[0].id, reused: true });

  // Анти-абьюз per-IP остаётся отказом. А вот общий дневной потолок отсюда
  // убран: отказывать оплаченному клику «попробуйте завтра» — сжигать деньги
  // рекламы. Бюджет теперь стережёт сама очередь (kp-queue,
  // PUBLIC_DAILY_BUDGET): лишние КП ждут освобождения окна, и ссылка
  // доезжает письмом/TG (kp-notify), даже если человек давно закрыл вкладку.
  const perIp = await query<{ n: string }>(
    `SELECT COUNT(*) n FROM kp_generations WHERE source='public' AND client_ip=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [ip],
  );
  if (Number(perIp[0]?.n ?? 0) >= 3) {
    return NextResponse.json({ ok: false, error: "Лимит на сегодня исчерпан — попробуйте завтра или напишите нам" }, { status: 429 });
  }

  const id = await enqueueKp(url, "ru", { source: "public", clientIp: ip });
  return NextResponse.json({ ok: true, id });
}
