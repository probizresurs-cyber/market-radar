/**
 * POST /api/publish
 *
 * Публикует пост в выбранные соцсети.
 *
 * Body: {
 *   post: GeneratedPost,                  // целиком, не из БД (у нас localStorage)
 *   platforms: Array<"vk" | "telegram">,  // куда публиковать
 * }
 *
 * Returns: {
 *   ok, results: { vk?: PublishResult, telegram?: PublishResult }
 * }
 *
 * Логика выбора текста:
 *   - Если у поста есть platformVariants[platform] — берём адаптированный
 *   - Иначе берём canonical (post.hook + body + hashtags)
 *
 * Telegram chat_id берётся из users.telegram_chat_id; для prod-канала
 * стоит добавить telegram_channel_id (TODO в следующей итерации).
 *
 * VK группа — пока из env (VK_GROUP_ID), позже UI для подключения.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { publishToTelegram } from "@/lib/publishers/telegram";
import { publishToVK } from "@/lib/publishers/vk";
import type { GeneratedPost } from "@/lib/content-types";

export const runtime = "nodejs";
export const maxDuration = 30;

type Platform = "vk" | "telegram";

interface PublishResult {
  ok: boolean;
  postId?: string;
  messageId?: number;
  messageUrl?: string;
  error?: string;
  at: string;
}

function buildText(post: GeneratedPost, platform: Platform): string {
  const v = post.platformVariants?.[platform];
  if (v) {
    const tags = (v.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
    return `${v.hook}\n\n${v.body}${tags ? `\n\n${tags}` : ""}`;
  }
  // Fallback на canonical
  const tags = (post.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
  return `${post.hook}\n\n${post.body}${tags ? `\n\n${tags}` : ""}`;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));
  const post = body.post as GeneratedPost | undefined;
  const platforms: Platform[] = Array.isArray(body.platforms) ? body.platforms : [];

  if (!post || !post.id) {
    return NextResponse.json({ ok: false, error: "Не передан пост" }, { status: 400 });
  }
  if (platforms.length === 0) {
    return NextResponse.json({ ok: false, error: "Не выбрана платформа" }, { status: 400 });
  }

  const results: { vk?: PublishResult; telegram?: PublishResult } = {};

  // Загружаем per-user настройки каналов один раз.
  const userRows = await query<{
    telegram_chat_id: string | null;
    telegram_channel_id: string | null;
    vk_group_id: string | null;
  }>(
    `SELECT telegram_chat_id, telegram_channel_id, vk_group_id FROM users WHERE id = $1`,
    [session.userId],
  );
  const userCfg = userRows[0];

  // Telegram
  if (platforms.includes("telegram")) {
    // Приоритет: production-канал > личный chat_id (тестовый режим).
    // Channel ID может быть "@channel_name" или числовой "-100..." — отдаём как есть.
    const target = userCfg?.telegram_channel_id?.trim() || userCfg?.telegram_chat_id;
    if (!target) {
      results.telegram = {
        ok: false,
        error: "Telegram не подключён. Зайдите в Настройки → Соцсети и укажите канал или подключите бота.",
        at: new Date().toISOString(),
      };
    } else {
      const text = buildText(post, "telegram");
      const r = await publishToTelegram({
        chatId: target,
        text,
        imageUrl: post.imageUrl && post.imageUrl.startsWith("http") ? post.imageUrl : undefined,
      });
      results.telegram = { ...r, at: new Date().toISOString() };
    }
  }

  // VK
  if (platforms.includes("vk")) {
    const groupId = userCfg?.vk_group_id?.trim();
    // Если у юзера нет группы — fallback на env (для админа/демо)
    if (!groupId && !process.env.VK_GROUP_ID) {
      results.vk = {
        ok: false,
        error: "VK не подключён. Зайдите в Настройки → Соцсети и укажите ID сообщества (формат -12345).",
        at: new Date().toISOString(),
      };
    } else {
      const text = buildText(post, "vk");
      const r = await publishToVK({
        text,
        imageUrl: post.imageUrl,
        ownerId: groupId || undefined,
      });
      results.vk = { ...r, at: new Date().toISOString() };
    }
  }

  return NextResponse.json({ ok: true, results });
}
