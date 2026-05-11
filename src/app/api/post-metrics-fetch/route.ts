/**
 * POST /api/post-metrics-fetch
 *
 * Принимает публичный URL опубликованного поста и возвращает свежие
 * metrics (likes/comments/views/etc), которые можно сохранить в
 * GeneratedPost.metrics. Закрывает P1-пробел «метрики вводятся вручную».
 *
 * Поддерживаемые источники:
 *   - VK (vk.com/wall<owner_id>_<post_id> или vk.com/feed?w=wall...) — через wall.getById
 *   - Telegram (t.me/<channel>/<message_id>) — публичный preview-эндпоинт
 *     t.me/<channel>/<id>?embed=1 содержит views в og:description
 *
 * Без авторизации пользователя — пост должен быть публичным. Это
 * сознательный trade-off: вместо OAuth-флоу мы просто читаем то, что
 * виден любому посетителю канала/группы.
 *
 * Body: { url }
 * Returns: { ok, metrics: { likes?, comments?, shares?, views?, source } }
 */
import { NextResponse } from "next/server";
import type { PostMetrics } from "@/lib/content-types";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── VK URL parsing ───────────────────────────────────────────────────
// Поддерживаемые форматы:
//   https://vk.com/wall-12345_678
//   https://vk.com/community?w=wall-12345_678
//   https://m.vk.com/wall-12345_678
//   vk.com/feed?w=wall12345_678 (личная стена)
const VK_PATTERNS = [
  /vk\.com\/wall(-?\d+)_(\d+)/,
  /vk\.com\/.*?[?&]w=wall(-?\d+)_(\d+)/,
];

function parseVkUrl(url: string): { ownerId: string; postId: string } | null {
  for (const p of VK_PATTERNS) {
    const m = url.match(p);
    if (m) return { ownerId: m[1], postId: m[2] };
  }
  return null;
}

async function fetchVkMetrics(url: string): Promise<PostMetrics | null> {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new Error("VK_ACCESS_TOKEN не настроен");

  const parsed = parseVkUrl(url);
  if (!parsed) throw new Error("Не распознал VK-URL");

  const postId = `${parsed.ownerId}_${parsed.postId}`;
  const apiUrl = `https://api.vk.com/method/wall.getById?posts=${encodeURIComponent(
    postId,
  )}&extended=0&access_token=${token}&v=5.199`;

  const r = await fetch(apiUrl);
  const j = (await r.json()) as {
    response?: Array<{
      likes?: { count: number };
      comments?: { count: number };
      reposts?: { count: number };
      views?: { count: number };
    }>;
    error?: { error_msg: string; error_code: number };
  };

  if (j.error) throw new Error(`VK API: ${j.error.error_msg}`);
  const post = j.response?.[0];
  if (!post) throw new Error("Пост не найден на стене");

  return {
    likes: post.likes?.count ?? 0,
    comments: post.comments?.count ?? 0,
    shares: post.reposts?.count ?? 0,
    reach: post.views?.count ?? 0,
    impressions: post.views?.count ?? 0,
    source: "vk",
    capturedAt: new Date().toISOString(),
  };
}

// ── Telegram URL parsing ─────────────────────────────────────────────
// t.me/<channel>/<msg_id> — публичный канал
// Telegram отдаёт публичный preview через ?embed=1, где в og:description
// и data-* атрибутах лежит количество просмотров. Реакции (лайки)
// доступны только через bot API getMessageReactions для канала с админ-доступом.
const TG_PATTERN = /t\.me\/([A-Za-z0-9_]+)\/(\d+)/;

function parseTelegramUrl(url: string): { channel: string; msgId: string } | null {
  const m = url.match(TG_PATTERN);
  if (!m) return null;
  return { channel: m[1], msgId: m[2] };
}

async function fetchTelegramMetrics(url: string): Promise<PostMetrics | null> {
  const parsed = parseTelegramUrl(url);
  if (!parsed) throw new Error("Не распознал Telegram-URL");

  // Запрос на public-embed страницу
  const embedUrl = `https://t.me/${parsed.channel}/${parsed.msgId}?embed=1&mode=tme`;
  const r = await fetch(embedUrl, {
    headers: {
      // Без User-Agent Telegram отдаёт укороченный HTML
      "User-Agent":
        "Mozilla/5.0 (compatible; MarketRadar/1.0; +https://marketradar24.ru)",
    },
  });
  if (!r.ok) throw new Error(`Telegram вернул ${r.status}`);
  const html = await r.text();

  // Views: <span class="tgme_widget_message_views">1.2K</span>
  // или   data-views="1234" на span/div
  // Извлекаем оба варианта.
  let views: number | undefined;
  const viewsRe1 = /tgme_widget_message_views"[^>]*>([\d.,KM\s]+)</;
  const viewsRe2 = /data-views="(\d+)"/;
  const m1 = html.match(viewsRe1);
  const m2 = html.match(viewsRe2);
  if (m2) {
    views = parseInt(m2[1], 10);
  } else if (m1) {
    views = parseTelegramNumber(m1[1]);
  }

  // Reactions block: tgme_reactions_count or em.tgme_widget_message_emoji ... + count
  // У публичных каналов реакции отображаются как:
  //   <a class="tgme_reaction"><span class="tgme_reaction_counter">12</span>...</a>
  let likes = 0;
  const reactRe = /tgme_reaction_counter[^>]*>([\d.,KM\s]+)</g;
  let rm: RegExpExecArray | null;
  while ((rm = reactRe.exec(html))) {
    likes += parseTelegramNumber(rm[1]) ?? 0;
  }

  // Comments aren't shown directly in public preview unless the channel
  // has a discussion-group; if `tgme_widget_message_link_preview` followed
  // by "comments" appears, we'd need the discussion group API. Skip for now.

  if (views === undefined && likes === 0) {
    throw new Error("Не удалось распарсить metrics из публичного preview");
  }

  return {
    likes,
    reach: views,
    impressions: views,
    source: "telegram",
    capturedAt: new Date().toISOString(),
  };
}

function parseTelegramNumber(s: string): number | undefined {
  if (!s) return undefined;
  const trimmed = s.trim().replace(/\s+/g, "").replace(",", ".");
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) return undefined;
  if (/K$/i.test(trimmed)) return Math.round(num * 1_000);
  if (/M$/i.test(trimmed)) return Math.round(num * 1_000_000);
  return Math.round(num);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url: string = (body.url ?? "").trim();
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "URL обязателен" },
        { status: 400 },
      );
    }

    let metrics: PostMetrics | null = null;
    if (/vk\.com/.test(url)) {
      metrics = await fetchVkMetrics(url);
    } else if (/t\.me\//.test(url)) {
      metrics = await fetchTelegramMetrics(url);
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Поддерживаются только VK (vk.com/wall...) и Telegram (t.me/<channel>/<id>) ссылки",
        },
        { status: 400 },
      );
    }

    if (!metrics) {
      return NextResponse.json(
        { ok: false, error: "Не удалось получить metrics" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, metrics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
