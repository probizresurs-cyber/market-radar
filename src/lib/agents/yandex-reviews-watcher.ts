/**
 * Yandex Reviews Watcher агент.
 *
 * Ежедневно проверяет отзывы организации в Яндекс.Картах через публичный
 * reviews-widget endpoint (тот же, что встраивается на сайты). Сравнивает
 * с прошлым прогоном — для новых отзывов Claude рисует draft ответа и
 * кладёт в inbox юзера (needs_approval=true).
 *
 * Параметры (params в agent_configs):
 *   - companyName: string (если не задано — берём из текущего AnalysisResult компании)
 *   - orgId: string (обязательно — Yandex Org ID; agent сам найдёт при первом запуске)
 *
 * Стратегия:
 *   1. Если orgId нет → search-maps API находит → пишем в params
 *   2. Fetch reviews-widget HTML → cheerio → парсим отзывы (text, author, rating, date)
 *   3. Хэш каждого отзыва (author+date+text-fp) сравниваем с прошлой пачкой
 *   4. Для новых → Claude draft ответа (учитывает brandBook tone if available)
 *   5. summary: «5 новых отзывов: 3 ★5, 2 ★3 — ответы готовы»
 *   6. result.drafts[] кладётся в needs_approval inbox
 *
 * Yandex Maps Reviews не имеет официального публичного API для текстов
 * отзывов — мы используем widget-endpoint, который Яндекс предоставляет
 * для встройки на сайты бизнесов. Это легально и не подпадает под TOS.
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import * as cheerio from "cheerio";
import { randomUUID } from "crypto";
import type { BrandBook } from "@/lib/content-types";

interface YandexReview {
  id: string;            // стабильный хэш для дедупа
  author: string;
  rating: number;        // 1-5
  text: string;
  date: string;          // human-readable от Yandex
  fetchedAt: string;     // ISO когда мы его впервые увидели
}

interface DraftReply {
  reviewId: string;
  author: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  draftReply: string;
  tone: "positive" | "neutral" | "negative";
}

/** Дешёвый стабильный хэш строки. */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Ищет orgId по названию через search-maps API.
 * Возвращает null если ключа нет или организация не найдена.
 */
async function findYandexOrgId(name: string): Promise<string | null> {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://search-maps.yandex.ru/v1/?text=${encodeURIComponent(name)}&type=biz&lang=ru_RU&apikey=${apiKey}&results=1`,
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      features?: Array<{
        properties?: { CompanyMetaData?: { id?: string } };
      }>;
    };
    return data.features?.[0]?.properties?.CompanyMetaData?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Скачивает публичный reviews-widget Яндекс.Карт и парсит отзывы.
 * URL формата: https://yandex.ru/maps-reviews-widget/<orgId>?comments
 * Возвращает массив свежих отзывов (сверху — самые новые).
 */
async function fetchYandexWidget(orgId: string): Promise<YandexReview[]> {
  const url = `https://yandex.ru/maps-reviews-widget/${encodeURIComponent(orgId)}?comments`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const out: YandexReview[] = [];
    // Виджет рендерит отзывы как .comment с классами .comment__rating,
    // .comment__author, .comment__date, .comment__text
    $(".comment").each((_, el) => {
      const $el = $(el);
      const text = $el.find(".comment__text").text().trim();
      const author = $el.find(".comment__author").text().trim() || "Аноним";
      const date = $el.find(".comment__date").text().trim();
      // Rating: считаем класс ".stars--rating_<n>" или нативные star elements
      const starsClass = $el.find(".stars").attr("class") ?? "";
      const ratingMatch = starsClass.match(/_rating_(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

      if (!text) return; // пропускаем без текста (rating-only)
      const id = hashString(`${author}|${date}|${text.slice(0, 60)}`);
      out.push({
        id,
        author,
        rating: Math.max(0, Math.min(5, rating)),
        text,
        date,
        fetchedAt: new Date().toISOString(),
      });
    });

    return out;
  } catch {
    return [];
  }
}

/** Чтобы Claude знал тон бренда (если брендбук задан). */
async function loadBrandBookForUser(userId: string): Promise<BrandBook | null> {
  // BrandBook у нас в localStorage клиента, но Telegram chat-id/users есть в DB.
  // На MVP читаем company_name + tagline + tone из users + параметров агента
  // (params.brandBook если кто-то заслал). На втором этапе можно вынести
  // брендбук в DB-таблицу.
  try {
    const rows = await query<{ company_name: string | null }>(
      `SELECT company_name FROM users WHERE id = $1`,
      [userId],
    );
    if (rows[0]?.company_name) {
      return {
        brandName: rows[0].company_name,
        tagline: "",
        mission: "",
        colors: [],
        fontHeader: "",
        fontBody: "",
        toneOfVoice: ["дружелюбный", "профессиональный"],
        forbiddenWords: [],
        goodPhrases: [],
        visualStyle: "",
      };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Claude рисует ответ на один отзыв.
 * Тон зависит от rating: 4-5 — благодарность; 3 — нейтрально, узнать детали;
 * 1-2 — извинения, конкретный шаг.
 */
async function draftReplyForReview(
  review: YandexReview,
  brandName: string,
  brandBook: BrandBook | null,
): Promise<DraftReply> {
  const tone: DraftReply["tone"] =
    review.rating >= 4 ? "positive" :
    review.rating <= 2 ? "negative" :
    "neutral";

  const toneOfVoice = brandBook?.toneOfVoice?.length
    ? brandBook.toneOfVoice.join(", ")
    : "дружелюбный, профессиональный, без канцелярита";

  const goodPhrases = brandBook?.goodPhrases?.slice(0, 3).join(" / ") ?? "";

  const systemPrompt = `Ты — менеджер по работе с клиентами компании «${brandName}». Пишешь публичные ответы на отзывы в Яндекс.Картах.

Тон голоса: ${toneOfVoice}.
${goodPhrases ? `Фирменные обороты бренда: ${goodPhrases}.` : ""}

ПРАВИЛА:
- Не повторять имя клиента 3 раза, достаточно 1 раза в начале
- Без канцелярита, без «уважаемый клиент», без «приносим извинения за неудобства»
- На негатив — извинение + конкретный шаг (написать в директ / позвонить / ссылка на форму)
- На позитив — короткая благодарность с искренним «приходите ещё», без шаблонов
- Длина: 2-4 предложения максимум
- Ответ от первого лица команды («мы», «нам»), не от компании

Ответ — только текст ответа, без подписи и без обрамления.`;

  const userMessage = `Отзыв на Яндекс.Карты:
Автор: ${review.author}
Оценка: ${review.rating} из 5
Дата: ${review.date}
Текст: «${review.text}»

Напиши короткий ответ от лица компании.`;

  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 350,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return {
    reviewId: review.id,
    author: review.author,
    rating: review.rating,
    reviewText: review.text,
    reviewDate: review.date,
    draftReply: text || "(AI не смог сгенерировать ответ — отредактируйте вручную)",
    tone,
  };
}

// ─── Регистрация агента ─────────────────────────────────────────────
registerAgent({
  name: "yandex-reviews-watcher",
  label: "Yandex Reviews Watcher",
  description: "Ежедневно проверяет новые отзывы в Яндекс.Картах и кладёт AI-черновики ответов в Inbox для вашего одобрения.",
  icon: "Star",
  defaultSchedule: "daily",
  category: "reviews",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    // ── Резолвим companyName ──────────────────────────────────────
    // Приоритет:
    //   1. params.companyName (юзер явно зафиксировал в настройках агента)
    //   2. users.last_analyzed_company.name (текущая анализируемая компания)
    //   3. users.company_name (компания из реквизитов аккаунта — fallback)
    const params = ctx.params as { companyName?: string; orgId?: string };
    let companyName = params.companyName?.trim();
    let orgId = params.orgId?.trim();

    if (!companyName) {
      const rows = await query<{
        company_name: string | null;
        last_analyzed_company: { name?: string } | null;
      }>(
        `SELECT company_name, last_analyzed_company FROM users WHERE id = $1`,
        [ctx.userId],
      );
      // last_analyzed побеждает — это реально активная компания
      companyName =
        rows[0]?.last_analyzed_company?.name?.trim() ||
        rows[0]?.company_name?.trim();
    }

    if (!companyName) {
      return {
        summary: "Не нашёл активную компанию. Запустите анализ компании или укажите params.companyName в настройках агента.",
        skipped: true,
      };
    }

    // Если активная компания сменилась — сбрасываем orgId, ищем новую организацию
    const knownCompany = (ctx.params as { _lastCompanyName?: string })._lastCompanyName;
    if (knownCompany && knownCompany !== companyName) {
      orgId = undefined;
    }

    // ── Резолвим orgId (Yandex) ────────────────────────────────────
    if (!orgId) {
      const found = await findYandexOrgId(companyName);
      if (!found) {
        return {
          summary: `Не нашёл организацию «${companyName}» в Яндекс.Картах. Уточните название в настройках агента.`,
          skipped: true,
        };
      }
      orgId = found;
      // Сохраняем orgId + companyName-маркер в params: при смене компании
      // (например, юзер запустил новый анализ другого бизнеса) мы это
      // обнаружим и переоткроем organization id.
      await query(
        `UPDATE agent_configs
            SET params = params || jsonb_build_object('orgId', $1::text, '_lastCompanyName', $2::text, 'seenIds', '[]'::jsonb),
                updated_at = NOW()
          WHERE user_id = $3 AND agent_name = 'yandex-reviews-watcher'`,
        [orgId, companyName, ctx.userId],
      );
    }

    // ── Тянем отзывы из widget ────────────────────────────────────
    const reviews = await fetchYandexWidget(orgId);
    if (reviews.length === 0) {
      return {
        summary: "Виджет Яндекса не вернул отзывов. Возможно блок anti-bot — повторите завтра.",
        skipped: true,
      };
    }

    // ── Дедуп: ищем только новые с прошлого прогона ──────────────
    // Храним seenIds в params агента (json массив).
    const seenIds = new Set<string>(Array.isArray(params.orgId)
      ? []
      : (Array.isArray((params as Record<string, unknown>).seenIds)
          ? (params as { seenIds: string[] }).seenIds
          : []));

    const fresh = reviews.filter(r => !seenIds.has(r.id));

    if (fresh.length === 0) {
      return {
        summary: `Новых отзывов нет (всего видно ${reviews.length}, все уже обработаны).`,
        skipped: true,
      };
    }

    // ── Черновики ответов через Claude ────────────────────────────
    const brandBook = await loadBrandBookForUser(ctx.userId);
    const drafts: DraftReply[] = [];
    // Параллельно, но небольшими батчами — чтобы не выгребать quota
    const batchSize = 3;
    for (let i = 0; i < fresh.length; i += batchSize) {
      const batch = fresh.slice(i, i + batchSize);
      const batchDrafts = await Promise.all(
        batch.map(r => draftReplyForReview(r, companyName!, brandBook)),
      );
      drafts.push(...batchDrafts);
    }

    // ── Обновляем seenIds в params (сохраняем все увиденные за всё время) ──
    const allSeen = Array.from(new Set([...seenIds, ...reviews.map(r => r.id)])).slice(-200);
    await query(
      `UPDATE agent_configs SET params = jsonb_set(params, '{seenIds}', $1::jsonb), updated_at = NOW()
         WHERE user_id = $2 AND agent_name = 'yandex-reviews-watcher'`,
      [JSON.stringify(allSeen), ctx.userId],
    );

    // ── Сохраняем каждый draft как отдельный inbox-item ──────────
    // Делаем отдельные agent_runs записи чтобы юзер мог approve/dismiss
    // каждый ответ независимо.
    for (const d of drafts) {
      const runId = randomUUID();
      const summary =
        `${d.tone === "negative" ? "⚠️" : d.tone === "positive" ? "⭐" : "•"} ` +
        `${d.author} (${d.rating}★): ${d.reviewText.slice(0, 100)}${d.reviewText.length > 100 ? "…" : ""}`;
      await query(
        `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                                 summary, result, needs_approval)
           VALUES ($1, $2, 'yandex-reviews-watcher', NOW(), NOW(), 'ok', $3, $4::jsonb, true)`,
        [runId, ctx.userId, summary.slice(0, 500), JSON.stringify(d)],
      );
    }

    const positives = drafts.filter(d => d.tone === "positive").length;
    const negatives = drafts.filter(d => d.tone === "negative").length;
    const neutrals = drafts.length - positives - negatives;

    return {
      summary:
        `${drafts.length} новых отзывов · ${positives} позитив${positives === 1 ? "" : "ов"}, ` +
        `${negatives} негатив${negatives === 1 ? "" : "ов"}, ${neutrals} нейтрально. ` +
        `Черновики ответов в Inbox.`,
      result: { drafts, total: reviews.length, fresh: drafts.length },
      needsApproval: true,
    };
  },
});
