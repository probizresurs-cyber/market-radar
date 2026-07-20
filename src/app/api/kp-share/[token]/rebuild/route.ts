import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { runRebuild } from "@/app/api/rebuild-astro/route";

// POST /api/kp-share/<token>/rebuild { email } — клиент нажал «Да, интересно»
// на своей КП-странице и просит собрать новую версию сайта на Astro. Запускает
// тот же конвейер, что /api/rebuild-astro (сохранение дизайна 1:1 + технические
// правки), по URL, который уже был указан при генерации КП — повторно вводить
// его не нужно (п.5 спеки). Результат уходит НЕ сразу клиенту — сначала в
// таб «Ревью пересборок» менеджера (см. /api/kp-generate/[id]/approve-rebuild).
export const runtime = "nodejs";
export const maxDuration = 180;

interface Row {
  id: string; url: string; status: string; rebuild_status: string | null;
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Укажите корректный email" }, { status: 400 });
  }

  const rows = await query<Row>(
    "SELECT id, url, status, rebuild_status FROM kp_generations WHERE share_token = $1",
    [token],
  );
  const r = rows[0];
  if (!r || r.status !== "done") {
    return NextResponse.json({ ok: false, error: "Ссылка недоступна" }, { status: 404 });
  }

  // Идемпотентно: уже в работе/готово/отправлено — не запускаем вторую
  // пересборку по повторному клику или двойной отправке формы.
  if (r.rebuild_status && r.rebuild_status !== "error" && r.rebuild_status !== "rejected") {
    return NextResponse.json({ ok: true, status: r.rebuild_status });
  }

  await query(
    "UPDATE kp_generations SET rebuild_status = 'running', client_email = $2, rebuild_error = NULL WHERE id = $1",
    [r.id, email],
  );

  try {
    const { id: rebuildId } = await runRebuild(r.url, null);
    await query(
      "UPDATE kp_generations SET rebuild_status = 'pending_review', rebuild_id = $2 WHERE id = $1",
      [r.id, rebuildId],
    );
    return NextResponse.json({ ok: true, status: "pending_review" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка пересборки";
    await query(
      "UPDATE kp_generations SET rebuild_status = 'error', rebuild_error = $2 WHERE id = $1",
      [r.id, msg.slice(0, 400)],
    );
    return NextResponse.json({ ok: false, error: "Не удалось собрать новую версию сайта. Попробуйте позже." }, { status: 502 });
  }
}
