/**
 * /api/scheduled-posts — серверное зеркало запланированных постов.
 *
 * Фронт хранит посты в localStorage, но auto-publisher по крону работает на
 * сервере и localStorage не видит. Поэтому фронт синхронизирует сюда все посты
 * с выставленным scheduledFor, а agent auto-publisher читает их из БД.
 *
 * POST  — sync «replace pending set»: принимает текущий список запланированных
 *         постов профиля. Upsert каждого (status pending), а pending-строки,
 *         которых больше нет в списке, помечает canceled. published/failed не трогаем.
 * GET    — список постов профиля (для отладки/будущего UI статусов).
 * DELETE — отменить конкретный пост по id (?id=...).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface IncomingPost {
  id: string;
  scheduledFor: string;        // ISO
  platforms?: string[];        // ['telegram','vk']
  payload: Record<string, unknown>;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let body: { profileSuffix?: string; posts?: IncomingPost[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const profileSuffix = typeof body.profileSuffix === "string" ? body.profileSuffix : "";
  const posts = Array.isArray(body.posts) ? body.posts : [];

  await initDb();

  // Валидируем + нормализуем входящие посты
  const valid = posts.filter(
    p => p && typeof p.id === "string" && p.id && typeof p.scheduledFor === "string" && p.payload,
  );

  // Upsert каждого присланного поста. status сбрасываем в pending только если
  // он ещё не опубликован — published/failed/canceled НЕ воскрешаем (иначе
  // повторная синхронизация переотправила бы пост).
  for (const p of valid) {
    const platforms = Array.isArray(p.platforms)
      ? p.platforms.filter(x => x === "telegram" || x === "vk")
      : [];
    const sched = new Date(p.scheduledFor);
    if (isNaN(sched.getTime())) continue;
    await query(
      `INSERT INTO scheduled_posts (id, user_id, profile_suffix, scheduled_for, platforms, payload, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', NOW())
       ON CONFLICT (id) DO UPDATE
         SET scheduled_for = EXCLUDED.scheduled_for,
             platforms     = EXCLUDED.platforms,
             payload       = EXCLUDED.payload,
             updated_at    = NOW()
       WHERE scheduled_posts.status = 'pending'`,
      [p.id, session.userId, profileSuffix, sched.toISOString(), platforms, JSON.stringify(p.payload)],
    );
  }

  // Отменяем pending-посты профиля, которых больше нет в присланном списке
  // (юзер удалил/разпланировал их на фронте).
  const keepIds = valid.map(p => p.id);
  if (keepIds.length > 0) {
    await query(
      `UPDATE scheduled_posts SET status = 'canceled', updated_at = NOW()
        WHERE user_id = $1 AND profile_suffix = $2 AND status = 'pending'
          AND id <> ALL($3::text[])`,
      [session.userId, profileSuffix, keepIds],
    );
  } else {
    await query(
      `UPDATE scheduled_posts SET status = 'canceled', updated_at = NOW()
        WHERE user_id = $1 AND profile_suffix = $2 AND status = 'pending'`,
      [session.userId, profileSuffix],
    );
  }

  return NextResponse.json({ ok: true, synced: valid.length });
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const url = new URL(req.url);
  const profileSuffix = url.searchParams.get("profileSuffix") ?? "";
  const rows = await query(
    `SELECT id, scheduled_for, platforms, status, last_error, published_at
       FROM scheduled_posts
      WHERE user_id = $1 AND profile_suffix = $2
      ORDER BY scheduled_for DESC LIMIT 200`,
    [session.userId, profileSuffix],
  );
  return NextResponse.json({ ok: true, posts: rows });
}

export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query(
    `UPDATE scheduled_posts SET status = 'canceled', updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [id, session.userId],
  );
  return NextResponse.json({ ok: true });
}
