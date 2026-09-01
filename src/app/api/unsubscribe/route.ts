/**
 * GET/POST /api/unsubscribe?t=<unsub_token> — отписка от писем одним кликом.
 *
 * Ссылка стоит в каждом письме серии дожима. Требований два: работать без
 * логина и без подтверждения (человек не должен доказывать, что это он) и
 * останавливать рассылку немедленно — отзыв согласия по 152-ФЗ не может
 * зависеть от нашего расписания.
 *
 * Токен непубличный и одноразовый по смыслу, но перебор не страшен: худшее,
 * что делает чужой токен, — прекращает нам же рассылку. Обратной операции
 * («подписать») тут нет намеренно.
 */
import { NextRequest } from "next/server";
import { initDb, query } from "@/lib/db";

export const runtime = "nodejs";

function page(title: string, text: string): Response {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — MarketRadar</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;
font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
<div style="max-width:460px;padding:32px;text-align:center">
<h1 style="font-size:22px;margin:0 0 10px">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px">${text}</p>
<a href="https://marketradar24.ru/new" style="color:#4f46e5;font-size:15px">На главную</a>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t")?.trim() ?? "";
  if (!token) return page("Ссылка неполная", "В адресе нет кода отписки. Откройте ссылку из письма целиком.");

  await initDb();
  const rows = await query<{ id: string }>(
    `UPDATE kp_generations
        SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
      WHERE unsub_token = $1
      RETURNING id`,
    [token],
  );
  if (rows.length === 0) {
    return page("Ссылка не найдена", "Возможно, отписка уже сработала раньше. Писем от нас больше не будет.");
  }
  return page("Вы отписаны", "Больше писем от MarketRadar на этот адрес не придёт. Разбор по вашей ссылке остаётся доступным.");
}

/**
 * POST — тот же токен, но для One-Click-отписки Gmail и Outlook (RFC 8058).
 * Почтовик дёргает адрес из заголовка List-Unsubscribe сам, без открытия
 * страницы, и ждёт 2xx. Без этого обработчика заголовок можно не ставить:
 * почтовики проверяют, что адрес отвечает на POST, и наличие нерабочей
 * одноклик-отписки — сигнал против отправителя, а не за него.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t")?.trim() ?? "";
  if (!token) return new Response("no token", { status: 400 });
  await initDb();
  await query(
    `UPDATE kp_generations
        SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
      WHERE unsub_token = $1`,
    [token],
  );
  // 200 даже если токен неизвестен: почтовику нельзя отвечать ошибкой,
  // иначе он засчитает отписку как несработавшую.
  return new Response(null, { status: 200 });
}
