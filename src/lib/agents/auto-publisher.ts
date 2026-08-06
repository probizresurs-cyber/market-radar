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
import type { GeneratedPost, GeneratedReel, GeneratedStory, GeneratedCarousel } from "@/lib/content-types";
import { randomUUID } from "crypto";

export type ScheduledKind = "post" | "reel" | "story" | "carousel";
export type ScheduledPayload = GeneratedPost | GeneratedReel | GeneratedStory | GeneratedCarousel;

export interface DueItem {
  id: string;
  kind: ScheduledKind;
  hook: string;              // краткое превью для inbox-карточки/summary
  scheduledFor?: string;
  payload: ScheduledPayload;
  platforms?: string[];      // из scheduled_posts.platforms (override глобальных тоглов)
}

interface DueResult {
  postId: string;
  hook: string;
  scheduledFor?: string;
  telegram?: { ok: boolean; messageUrl?: string; error?: string };
  vk?: { ok: boolean; messageUrl?: string; error?: string };
}

const hashtagLine = (tags: string[] | undefined): string =>
  (tags ?? []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");

/** Первая http(s)-картинка слайда серии (сторис/карусель) — data:URL Telegram/VK
 *  API не примут, поэтому data: намеренно не берём (публикация уйдёт без фото). */
function firstSlideImage(slides: Array<{ backgroundImageUrl?: string }>): string | undefined {
  const url = slides.find(s => s.backgroundImageUrl?.startsWith("http"))?.backgroundImageUrl;
  return url;
}

/**
 * Текст + картинка под конкретный формат/платформу. Разные форматы контента
 * (пост/рилс/сторис/карусель) имеют разную форму данных — единая точка,
 * где это учитывается, чтобы сам цикл публикации ниже не разрастался
 * в четыре почти одинаковых ветки.
 */
export function buildContent(kind: ScheduledKind, payload: ScheduledPayload, platform: "vk" | "telegram"): { text: string; imageUrl?: string } {
  if (kind === "post") {
    const post = payload as GeneratedPost;
    const v = post.platformVariants?.[platform];
    if (v) {
      return { text: `${v.hook}\n\n${v.body}${hashtagLine(v.hashtags) ? `\n\n${hashtagLine(v.hashtags)}` : ""}`, imageUrl: post.imageUrl };
    }
    return { text: `${post.hook}\n\n${post.body}${hashtagLine(post.hashtags) ? `\n\n${hashtagLine(post.hashtags)}` : ""}`, imageUrl: post.imageUrl };
  }
  if (kind === "reel") {
    const reel = payload as GeneratedReel;
    // Видео мы сами не заливаем (нет upload-flow для VK/TG видео в publishers/*) —
    // публикуем текстом со ссылкой на готовый ролик, если она абсолютная.
    const link = reel.videoUrl?.startsWith("http") ? `\n\n▶ ${reel.videoUrl}` : "";
    return { text: `${reel.title}${link}${hashtagLine(reel.hashtags) ? `\n\n${hashtagLine(reel.hashtags)}` : ""}` };
  }
  if (kind === "story") {
    const story = payload as GeneratedStory;
    const first = story.slides[0];
    const body = [first?.headlineText, first?.bodyText].filter(Boolean).join(" — ");
    return { text: `${story.title}${body ? `\n\n${body}` : ""}${hashtagLine(story.hashtags) ? `\n\n${hashtagLine(story.hashtags)}` : ""}`, imageUrl: firstSlideImage(story.slides) };
  }
  const carousel = payload as GeneratedCarousel;
  return { text: `${carousel.caption}${hashtagLine(carousel.hashtags) ? `\n\n${hashtagLine(carousel.hashtags)}` : ""}`, imageUrl: firstSlideImage(carousel.slides) };
}

registerAgent({
  name: "auto-publisher",
  label: "Auto-Publisher",
  description: "Автоматически публикует запланированные посты в VK и Telegram, когда наступает их scheduledFor.",
  icon: "Send",
  defaultSchedule: "hourly",
  category: "content",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    // Источник due-элементов:
    //  1) params.duePosts — фронт может явно прислать батч постов (ручной
    //     запуск/legacy, всегда kind:"post" — этот путь появился раньше
    //     формата rельс/сторис/каруселей и им не пользуется);
    //  2) иначе читаем серверную таблицу scheduled_posts (status pending,
    //     scheduled_for ≤ now) — так агент работает АВТОНОМНО по крону, без
    //     открытого браузера. id строк запоминаем, чтобы пометить статус после.
    let dueItems: DueItem[] = Array.isArray(ctx.params.duePosts)
      ? (ctx.params.duePosts as GeneratedPost[]).map(p => ({ id: p.id, kind: "post" as const, hook: p.hook, scheduledFor: p.scheduledFor, payload: p }))
      : [];
    // Маппинг item.id → id строки scheduled_posts (только для server-source).
    const dbRowById = new Map<string, string>();

    // Лимит элементов за один прогон (защита от флуда). Настраивается в UI.
    const maxPerRun =
      typeof ctx.params.maxPerRun === "number" && ctx.params.maxPerRun >= 1 && ctx.params.maxPerRun <= 50
        ? Math.floor(ctx.params.maxPerRun)
        : 25;

    if (dueItems.length === 0) {
      const dueRows = await query<{ id: string; payload: ScheduledPayload; platforms: string[]; kind: ScheduledKind }>(
        `SELECT id, payload, platforms, kind FROM scheduled_posts
          WHERE user_id = $1 AND status = 'pending' AND scheduled_for <= NOW()
          ORDER BY scheduled_for ASC LIMIT $2`,
        [ctx.userId, maxPerRun],
      );
      dueItems = dueRows.map(r => {
        dbRowById.set(r.id, r.id);
        const hook = r.kind === "post" ? (r.payload as GeneratedPost).hook
          : r.kind === "reel" ? (r.payload as GeneratedReel).title
          : r.kind === "story" ? (r.payload as GeneratedStory).title
          : (r.payload as GeneratedCarousel).title;
        return {
          id: r.id,
          kind: r.kind,
          hook,
          payload: r.payload,
          // Платформы из строки переопределяют дефолт, только если заданы —
          // пустой массив (например у рилсов, у которых нет своего поля
          // platform) НЕ должен трактоваться как «нигде не публиковать».
          platforms: Array.isArray(r.platforms) && r.platforms.length > 0 ? r.platforms : undefined,
        };
      });
    }

    const wantTelegram = ctx.params.publishTelegram !== false;
    const wantVk = ctx.params.publishVk !== false;
    // По умолчанию требуем approval для безопасности (юзер вручную apply
    // каждый пост из inbox). Можно отключить через params.requireApproval=false
    // для полностью автоматического режима.
    const requireApproval = ctx.params.requireApproval !== false;

    if (dueItems.length === 0) {
      return { summary: "Нет контента на публикацию.", skipped: true };
    }

    const KIND_LABEL: Record<ScheduledKind, string> = { post: "Пост", reel: "Рилс", story: "Сторис", carousel: "Карусель" };

    // ── Approval mode: каждый элемент → отдельный inbox-item, ждёт approve ──
    if (requireApproval) {
      for (const item of dueItems) {
        const runId = randomUUID();
        const platforms: ("telegram" | "vk")[] = [];
        if (item.platforms ? item.platforms.includes("telegram") : wantTelegram) platforms.push("telegram");
        if (item.platforms ? item.platforms.includes("vk") : wantVk) platforms.push("vk");
        const summary =
          `📤 ${KIND_LABEL[item.kind]}: ${item.hook.slice(0, 70)}${item.hook.length > 70 ? "…" : ""} · ${platforms.join("+")}`;
        await query(
          `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                                   summary, result, needs_approval)
             VALUES ($1, $2, 'auto-publisher', NOW(), NOW(), 'ok', $3, $4::jsonb, true)`,
          [
            runId,
            ctx.userId,
            summary.slice(0, 500),
            JSON.stringify({
              _publishOnApprove: { item, platforms },
              preview: { id: item.id, kind: item.kind, hook: item.hook, scheduledFor: item.scheduledFor },
            }),
          ],
        );
        // Server-source: помечаем 'queued', чтобы следующий cron не создал
        // дубль inbox-карточки. Публикация произойдёт при approve в Inbox.
        const rowId = dbRowById.get(item.id);
        if (rowId) {
          await query(`UPDATE scheduled_posts SET status = 'queued', updated_at = NOW() WHERE id = $1`, [rowId]);
        }
      }
      return {
        summary:
          `${dueItems.length} элемент${dueItems.length === 1 ? "" : "ов"} ждут одобрения в Inbox. ` +
          `Нажмите «Одобрить» — мы опубликуем в выбранные платформы.`,
        result: { queued: dueItems.length, mode: "approval" },
      };
    }

    // ── Auto mode (по запросу через params.requireApproval=false) ─────

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

    for (const item of dueItems) {
      const r: DueResult = {
        postId: item.id,
        hook: item.hook?.slice(0, 80) ?? "",
        scheduledFor: item.scheduledFor,
      };

      // Платформы конкретного элемента (из scheduled_posts) переопределяют
      // глобальные тоглы агента, если заданы.
      const postWantTg = item.platforms ? item.platforms.includes("telegram") : wantTelegram;
      const postWantVk = item.platforms ? item.platforms.includes("vk") : wantVk;

      if (postWantTg) {
        if (!tgTarget) {
          r.telegram = { ok: false, error: "Telegram канал не подключён" };
        } else {
          const { text, imageUrl } = buildContent(item.kind, item.payload, "telegram");
          const tg = await publishToTelegram({
            chatId: tgTarget,
            text,
            imageUrl: imageUrl && imageUrl.startsWith("http") ? imageUrl : undefined,
          });
          r.telegram = { ok: tg.ok, messageUrl: tg.messageUrl, error: tg.error };
        }
      }

      if (postWantVk) {
        if (!vkGroup && !process.env.VK_GROUP_ID) {
          r.vk = { ok: false, error: "VK сообщество не подключено" };
        } else {
          const { text, imageUrl } = buildContent(item.kind, item.payload, "vk");
          const vk = await publishToVK({
            text,
            imageUrl,
            ownerId: vkGroup || undefined,
          });
          r.vk = { ok: vk.ok, messageUrl: vk.messageUrl, error: vk.error };
        }
      }

      // Server-source: фиксируем итог в scheduled_posts.
      const rowId = dbRowById.get(item.id);
      if (rowId) {
        const anyOk = Boolean(r.telegram?.ok || r.vk?.ok);
        const errText = [r.telegram?.error, r.vk?.error].filter(Boolean).join("; ") || null;
        await query(
          `UPDATE scheduled_posts
              SET status = $1, last_error = $2, published_at = CASE WHEN $1 = 'published' THEN NOW() ELSE published_at END, updated_at = NOW()
            WHERE id = $3`,
          [anyOk ? "published" : "failed", anyOk ? null : errText, rowId],
        );
      }

      results.push(r);
    }

    const okTg = results.filter(r => r.telegram?.ok).length;
    const okVk = results.filter(r => r.vk?.ok).length;
    const failed = results.filter(r => (r.telegram && !r.telegram.ok) || (r.vk && !r.vk.ok)).length;

    const summary =
      `Опубликовано ${dueItems.length} шт.: TG ✓${okTg}, VK ✓${okVk}` +
      (failed > 0 ? `, ошибок ${failed}` : "");

    return {
      summary,
      result: {
        publishedCount: dueItems.length,
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
