/**
 * GET/POST /api/publish-config
 *
 * Per-user конфиг каналов прямого постинга:
 *   - telegram_channel_id — @channel или -100xxxxxx (числовой)
 *   - vk_group_id — "-12345" (с минусом для группы)
 *
 * GET — возвращает текущие значения для авторизованного юзера.
 * POST — обновляет (пустая строка = очистить).
 *
 * Чтение перекрывает auth-флоу: эти поля не возвращаются session-объектом
 * (там только то, что юзеру вернули при login), поэтому Settings-страница
 * грузит их этим endpoint'ом при mount.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<{ telegram_channel_id: string | null; vk_group_id: string | null }>(
    `SELECT telegram_channel_id, vk_group_id FROM users WHERE id = $1`,
    [session.userId],
  );
  const row = rows[0];
  return NextResponse.json({
    ok: true,
    telegramChannelId: row?.telegram_channel_id ?? "",
    vkGroupId: row?.vk_group_id ?? "",
  });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));
  const telegramChannelId: string | undefined = body.telegramChannelId;
  const vkGroupId: string | undefined = body.vkGroupId;

  // Базовая валидация
  if (telegramChannelId !== undefined) {
    const t = telegramChannelId.trim();
    if (t && !/^(@[A-Za-z0-9_]+|-?\d{6,})$/.test(t)) {
      return NextResponse.json(
        { ok: false, error: "Telegram channel: укажите @имя_канала или числовой ID (-100...)" },
        { status: 400 },
      );
    }
    await query(`UPDATE users SET telegram_channel_id = $1 WHERE id = $2`, [t || null, session.userId]);
  }
  if (vkGroupId !== undefined) {
    const v = vkGroupId.trim();
    if (v && !/^-?\d+$/.test(v)) {
      return NextResponse.json(
        { ok: false, error: "VK group: укажите числовой ID сообщества (например, -123456789)" },
        { status: 400 },
      );
    }
    await query(`UPDATE users SET vk_group_id = $1 WHERE id = $2`, [v || null, session.userId]);
  }

  return NextResponse.json({ ok: true });
}
