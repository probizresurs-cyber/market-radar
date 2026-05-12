/**
 * POST /api/agents/runs/<id>/approve
 *
 * Подтверждает результат запуска агента (inbox-card). Используется когда
 * агент сгенерировал что-то требующее approval (драфт ответа на отзыв,
 * email для отправки и т.п.).
 *
 * Body: { action: "approve" | "dismiss" }
 *
 * На approve runner-агента может посмотреть `approved_at` в DB и выполнить
 * финальное действие (например, отправить ответ).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { publishToTelegram } from "@/lib/publishers/telegram";
import { publishToVK } from "@/lib/publishers/vk";
import type { GeneratedPost } from "@/lib/content-types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildText(post: GeneratedPost, platform: "vk" | "telegram"): string {
  const v = post.platformVariants?.[platform];
  if (v) {
    const tags = (v.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
    return `${v.hook}\n\n${v.body}${tags ? `\n\n${tags}` : ""}`;
  }
  const tags = (post.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
  return `${post.hook}\n\n${post.body}${tags ? `\n\n${tags}` : ""}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "approve" | "dismiss" | undefined;

  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ ok: false, error: "action должен быть approve или dismiss" }, { status: 400 });
  }

  // Проверяем что run принадлежит юзеру + читаем result для post-approve action
  const rows = await query<{
    user_id: string;
    needs_approval: boolean;
    agent_name: string;
    result: Record<string, unknown>;
  }>(
    `SELECT user_id, needs_approval, agent_name, result FROM agent_runs WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Запуск не найден" }, { status: 404 });
  }
  if (rows[0].user_id !== session.userId) {
    return NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 403 });
  }

  if (action === "dismiss") {
    await query(
      `UPDATE agent_runs SET approved_at = NOW(), approved_by = $1, needs_approval = false WHERE id = $2`,
      [session.userId, id],
    );
    return NextResponse.json({ ok: true, dismissed: true });
  }

  // ── action = "approve" ─────────────────────────────────────────────
  // Проверяем нужно ли выполнить post-approve action (опубликовать пост,
  // отправить ответ на отзыв, etc). Это магическое поле _publishOnApprove
  // в result — агент кладёт его если требуется автоматическое действие.

  const publishOnApprove = rows[0].result?._publishOnApprove as
    | { post: GeneratedPost; platforms: Array<"vk" | "telegram"> }
    | undefined;

  let publishResult: Record<string, unknown> | null = null;

  if (publishOnApprove && publishOnApprove.post) {
    // Грузим per-user конфиг каналов
    const userRows = await query<{
      telegram_chat_id: string | null;
      telegram_channel_id: string | null;
      vk_group_id: string | null;
    }>(
      `SELECT telegram_chat_id, telegram_channel_id, vk_group_id FROM users WHERE id = $1`,
      [session.userId],
    );
    const cfg = userRows[0];
    const post = publishOnApprove.post;
    const platforms = publishOnApprove.platforms ?? [];
    const result: Record<string, unknown> = {};

    if (platforms.includes("telegram")) {
      const target = cfg?.telegram_channel_id?.trim() || cfg?.telegram_chat_id;
      if (!target) {
        result.telegram = { ok: false, error: "Telegram канал не подключён" };
      } else {
        const tg = await publishToTelegram({
          chatId: target,
          text: buildText(post, "telegram"),
          imageUrl: post.imageUrl && post.imageUrl.startsWith("http") ? post.imageUrl : undefined,
        });
        result.telegram = tg;
      }
    }

    if (platforms.includes("vk")) {
      const groupId = cfg?.vk_group_id?.trim();
      if (!groupId && !process.env.VK_GROUP_ID) {
        result.vk = { ok: false, error: "VK сообщество не подключено" };
      } else {
        const vk = await publishToVK({
          text: buildText(post, "vk"),
          imageUrl: post.imageUrl,
          ownerId: groupId || undefined,
        });
        result.vk = vk;
      }
    }

    publishResult = result;
  }

  // Финализируем run: помечаем approved + кладём результат публикации
  if (publishResult) {
    // Объединяем существующий result + publishResult, убираем _publishOnApprove
    // чтобы повторный approve ничего не делал
    const newResult = { ...rows[0].result, _publishOnApprove: undefined, published: publishResult };
    await query(
      `UPDATE agent_runs
          SET approved_at = NOW(), approved_by = $1, needs_approval = false,
              result = $2::jsonb
        WHERE id = $3`,
      [session.userId, JSON.stringify(newResult), id],
    );
  } else {
    await query(
      `UPDATE agent_runs SET approved_at = NOW(), approved_by = $1, needs_approval = false WHERE id = $2`,
      [session.userId, id],
    );
  }

  return NextResponse.json({
    ok: true,
    approved: true,
    publishResult,
  });
}
