import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, initDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { runRebuild } from "@/app/api/rebuild-astro/route";
import { notifyKpManager } from "@/lib/kp-tg-funnel";

// POST /api/kp-share/<token>/rebuild { email } — клиент нажал «Да, интересно»
// на своей КП-странице и просит собрать новую версию сайта на Astro. Запускает
// тот же конвейер, что /api/rebuild-astro (сохранение дизайна 1:1 + технические
// правки), по URL, который уже был указан при генерации КП — повторно вводить
// его не нужно (п.5 спеки). Результат уходит НЕ сразу клиенту — сначала в
// таб «Ревью пересборок» менеджера (см. /api/kp-generate/[id]/approve-rebuild).
export const runtime = "nodejs";
export const maxDuration = 180;

// Фаза 5: тот же бот, что уже обслуживает платформенные /connect-уведомления
// (@market_radar1_bot) — отдельный /start-payload (kp_<код>), не пересекается
// с форматом MR-XXXXXX. Опционально, в дополнение к email.
const TG_BOT_USERNAME = "market_radar1_bot";

interface Row {
  id: string; url: string; status: string; rebuild_status: string | null; client_tg_code: string | null;
  company_name: string | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;

  // Антиспам по токену — пересборка дороже простого просмотра, лимит жёстче.
  const rl = checkRateLimit(token, { keyPrefix: "kp-share-rebuild", maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Слишком много запросов. Попробуйте позже." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // Телефон опционален — но для менеджера это возможность позвонить, а не писать.
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Укажите корректный email" }, { status: 400 });
  }

  const rows = await query<Row>(
    "SELECT id, url, status, rebuild_status, client_tg_code, company_name FROM kp_generations WHERE share_token = $1",
    [token],
  );
  const r = rows[0];
  if (!r || r.status !== "done") {
    return NextResponse.json({ ok: false, error: "Ссылка недоступна" }, { status: 404 });
  }

  // Код для Telegram-подключения — генерируем один раз и переиспользуем при
  // повторных вызовах (идемпотентная ветка ниже тоже его возвращает).
  const tgCode = r.client_tg_code ?? `kp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const tgConnectUrl = `https://t.me/${TG_BOT_USERNAME}?start=${tgCode}`;

  // Идемпотентно: уже в работе/готово/отправлено — не запускаем вторую
  // пересборку по повторному клику или двойной отправке формы.
  if (r.rebuild_status && r.rebuild_status !== "error" && r.rebuild_status !== "rejected") {
    if (!r.client_tg_code) await query("UPDATE kp_generations SET client_tg_code = $2 WHERE id = $1", [r.id, tgCode]);
    return NextResponse.json({ ok: true, status: r.rebuild_status, tgConnectUrl });
  }

  await query(
    "UPDATE kp_generations SET rebuild_status = 'running', client_email = $2, client_phone = $4, client_tg_code = $3, rebuild_error = NULL WHERE id = $1",
    [r.id, email, tgCode, phone || null],
  );

  // Горячее событие: клиент нажал главный CTA — менеджер должен узнать сразу,
  // а не когда заглянет в таб «Ревью».
  const name = r.company_name || r.url;
  void notifyKpManager(
    `🔥 <b>Новая заявка на пересборку сайта</b>\n` +
    `Компания: ${name.slice(0, 100)}\n` +
    `Email: ${email}${phone ? `\nТелефон: ${phone}` : ""}\n` +
    `Пересборка запущена — результат появится в табе «Ревью пересборок».`,
  );

  try {
    const { id: rebuildId } = await runRebuild(r.url, null);
    await query(
      "UPDATE kp_generations SET rebuild_status = 'pending_review', rebuild_id = $2 WHERE id = $1",
      [r.id, rebuildId],
    );
    void notifyKpManager(`✅ Пересборка «${name.slice(0, 100)}» готова к ревью — можно одобрять.`);
    return NextResponse.json({ ok: true, status: "pending_review", tgConnectUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка пересборки";
    await query(
      "UPDATE kp_generations SET rebuild_status = 'error', rebuild_error = $2 WHERE id = $1",
      [r.id, msg.slice(0, 400)],
    );
    void notifyKpManager(
      `⚠️ <b>Пересборка упала</b>\nКомпания: ${name.slice(0, 100)}\nОшибка: ${msg.slice(0, 200)}\n` +
      `Клиент (${email}) увидел «попробуйте позже» — стоит связаться вручную.`,
    );
    return NextResponse.json({ ok: false, error: "Не удалось собрать новую версию сайта. Попробуйте позже." }, { status: 502 });
  }
}
