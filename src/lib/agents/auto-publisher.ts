/**
 * Auto-Publisher агент.
 *
 * Закрывает связку «Календарь публикаций → реальный пост в соцсети».
 *
 * Логика:
 *   1. Читает per-user конфиг telegram_channel_id + vk_group_id.
 *   2. Принимает в `params.userPosts` массив постов (платформа localStorage —
 *      cron сам не знает что у юзера запланировано). На MVP воркфлоу такой:
 *      фронт отправляет в endpoint список постов где scheduledFor ≤ now;
 *      агент публикует каждый.
 *   3. Для каждого due-поста:
 *      - подбирает текст: platformVariants > canonical
 *      - дёргает publishToTelegram / publishToVK
 *      - возвращает результат: где опубликовано, ошибки
 *
 * Поскольку источник правды о scheduledFor — localStorage (у нас всё ещё
 * нет server-side хранилища постов), агент работает в hybrid-режиме:
 * фронт-страница (открытая в браузере у юзера) триггерит запуск с
 * текущим списком due-постов. Дополнительно cron-trigger проверяет
 * «возможные публикации» по DB-таблицам в будущем (когда переедем).
 *
 * Сейчас агент НЕ ходит в localStorage за постами — он принимает их
 * через `params.duePosts: GeneratedPost[]`. Фронт-runner раз в 15 минут
 * проверяет localStorage и шлёт батч на /api/agents/auto-publisher/run.
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { publishToTelegram } from "@/lib/publishers/telegram";
import { publishToVK } from "@/lib/publishers/vk";
import type { GeneratedPost } from "@/lib/content-types";

interface DueResult {
  postId: string;
  hook: string;
  scheduledFor?: string;
  telegram?: { ok: boolean; messageUrl?: string; error?: string };
  vk?: { ok: boolean; messageUrl?: string; error?: string };
}

function buildText(post: GeneratedPost, platform: "vk" | "telegram"): string {
  const v = post.platformVariants?.[platform];
  if (v) {
    const tags = (v.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
    return `${v.hook}\n\n${v.body}${tags ? `\n\n${tags}` : ""}`;
  }
  const tags = (post.hashtags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
  return `${post.hook}\n\n${post.body}${tags ? `\n\n${tags}` : ""}`;
}

registerAgent({
  name: "auto-publisher",
  label: "Auto-Publisher",
  description: "Автоматически публикует запланированные посты в VK и Telegram, когда наступает их scheduledFor.",
  icon: "Send",
  defaultSchedule: "hourly",
  category: "content",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    // Список due-постов передаётся фронтом через params (см. JSdoc файла).
    const duePosts = Array.isArray(ctx.params.duePosts)
      ? (ctx.params.duePosts as GeneratedPost[])
      : [];
    const wantTelegram = ctx.params.publishTelegram !== false;
    const wantVk = ctx.params.publishVk !== false;

    if (duePosts.length === 0) {
      return { summary: "Нет постов на публикацию.", skipped: true };
    }

    // Загружаем каналы юзера один раз
    const userRows = await query<{
      telegram_chat_id: string | null;
      telegram_channel_id: string | null;
      vk_group_id: string | null;
    }>(
      `SELECT telegram_chat_id, telegram_channel_id, vk_group_id FROM users WHERE id = $1`,
      [ctx.userId],
    );
    const cfg = userRows[0];
    const tgTarget = cfg?.telegram_channel_id?.trim() || cfg?.telegram_chat_id;
    const vkGroup = cfg?.vk_group_id?.trim();

    const results: DueResult[] = [];

    for (const post of duePosts) {
      const r: DueResult = {
        postId: post.id,
        hook: post.hook?.slice(0, 80) ?? "",
        scheduledFor: post.scheduledFor,
      };

      if (wantTelegram) {
        if (!tgTarget) {
          r.telegram = { ok: false, error: "Telegram канал не подключён" };
        } else {
          const text = buildText(post, "telegram");
          const tg = await publishToTelegram({
            chatId: tgTarget,
            text,
            imageUrl: post.imageUrl && post.imageUrl.startsWith("http") ? post.imageUrl : undefined,
          });
          r.telegram = { ok: tg.ok, messageUrl: tg.messageUrl, error: tg.error };
        }
      }

      if (wantVk) {
        if (!vkGroup && !process.env.VK_GROUP_ID) {
          r.vk = { ok: false, error: "VK сообщество не подключено" };
        } else {
          const text = buildText(post, "vk");
          const vk = await publishToVK({
            text,
            imageUrl: post.imageUrl,
            ownerId: vkGroup || undefined,
          });
          r.vk = { ok: vk.ok, messageUrl: vk.messageUrl, error: vk.error };
        }
      }

      results.push(r);
    }

    const okTg = results.filter(r => r.telegram?.ok).length;
    const okVk = results.filter(r => r.vk?.ok).length;
    const failed = results.filter(r => (r.telegram && !r.telegram.ok) || (r.vk && !r.vk.ok)).length;

    const summary =
      `Опубликовано ${duePosts.length} пост(а): TG ✓${okTg}, VK ✓${okVk}` +
      (failed > 0 ? `, ошибок ${failed}` : "");

    return {
      summary,
      result: {
        publishedCount: duePosts.length,
        telegramOk: okTg,
        vkOk: okVk,
        failedCount: failed,
        results,
      },
      // Сразу финально, без approval — пользователь сам выбрал scheduledFor.
      needsApproval: false,
    };
  },
});
