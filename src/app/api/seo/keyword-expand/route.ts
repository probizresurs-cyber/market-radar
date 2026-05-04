/**
 * POST /api/seo/keyword-expand
 *
 * Body: { seed: string, niche?: string, count?: number, lang?: "ru" | "en" }
 *
 * NebulaKeyword-style mass keyword generator. Uses Claude to expand a seed
 * keyword into a structured semantic core: long-tail variations, intent
 * groups, modifiers, and seasonal/regional variants.
 *
 * Returns clusters by intent (informational, commercial, navigational,
 * transactional) so the user can plan content + ads accordingly.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

interface KeywordExpansion {
  seed: string;
  totalCount: number;
  clusters: {
    informational: string[];     // "что такое", "как", обучающие
    commercial: string[];        // "лучший", "сравнение", "обзор"
    transactional: string[];     // "купить", "цена", "заказать"
    navigational: string[];      // "название бренда", "сайт"
    longTail: string[];          // 4+ слова, специфические запросы
    questions: string[];         // вопросительные
  };
  modifiers: {
    geography: string[];         // "москва", "спб", "онлайн"
    audience: string[];          // "для бизнеса", "для физлиц", "b2b"
    quality: string[];           // "лучший", "топ-10", "рейтинг"
    price: string[];             // "недорого", "акция", "со скидкой"
  };
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const seed: string = (body.seed || "").trim();
    const niche: string = (body.niche || "").trim();
    const count: number = Math.min(150, Math.max(30, Number(body.count) || 80));
    const lang: "ru" | "en" = body.lang === "en" ? "en" : "ru";

    if (!seed) {
      return NextResponse.json({ ok: false, error: "seed required" }, { status: 400 });
    }
    if (seed.length > 100) {
      return NextResponse.json({ ok: false, error: "seed too long" }, { status: 400 });
    }

    const langInstr =
      lang === "ru"
        ? "ВСЕ ключевые слова должны быть на русском языке (русские поисковые запросы реальных пользователей)."
        : "ALL keywords must be in English (real search queries used by real users).";

    const nicheBlock = niche
      ? `\nНиша/тематика: ${niche}\n`
      : "";

    const prompt = `Ты — SEO-специалист уровня MOZ/Ahrefs. Расширь семантическое ядро для запроса "${seed}"${nicheBlock}
Цель: ${count} реальных поисковых запросов, которые пользователи реально вводят в Google и Yandex.

${langInstr}

# СТРУКТУРА (верни строго JSON, без markdown-обёртки)

Группы по интенту (минимум 8 запросов в каждой группе кроме longTail/questions, в этих минимум 15):

\`\`\`json
{
  "clusters": {
    "informational": ["…что такое, как, обзоры, обучение…"],
    "commercial": ["…сравнение, лучший, vs, рейтинг…"],
    "transactional": ["…купить, заказать, оформить, цена…"],
    "navigational": ["…бренд+сайт, бренд+отзывы, бренд+личный кабинет…"],
    "longTail": ["…4+ слова, узкие запросы, низкая конкуренция…"],
    "questions": ["…вопросы со словами что/как/почему/зачем/когда/где/кто…"]
  },
  "modifiers": {
    "geography": ["москва", "спб", "онлайн", "доставка по России"],
    "audience": ["для бизнеса", "для физлиц", "b2b", "малому бизнесу"],
    "quality": ["лучший", "топ-10", "рейтинг", "отзывы"],
    "price": ["недорого", "со скидкой", "акция", "стоимость"]
  }
}
\`\`\`

# ПРАВИЛА КАЧЕСТВА

- Используй только реальные запросы — не выдумывай абсурдные комбинации
- Ключи должны быть разной длины: 2-3 слова (50%), 4-5 слов (30%), 6+ слов (20%)
- НЕ повторяй один и тот же запрос в разных группах
- Включи синонимы и парафразы (если "купить" — добавь "приобрести", "заказать")
- Учитывай интент: informational ≠ transactional
- Все запросы строчными буквами

Верни ТОЛЬКО JSON, без markdown ' code fences и без любых комментариев.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    // Try to find pure JSON in case the model wrapped it anyway
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: "Не удалось извлечь JSON из ответа модели" },
        { status: 500 }
      );
    }

    let parsed: { clusters: KeywordExpansion["clusters"]; modifiers: KeywordExpansion["modifiers"] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: "Ответ модели не валидный JSON: " + String(err) },
        { status: 500 }
      );
    }

    const totalCount =
      Object.values(parsed.clusters).reduce((s, arr) => s + arr.length, 0);

    const result: KeywordExpansion = {
      seed,
      totalCount,
      clusters: parsed.clusters,
      modifiers: parsed.modifiers,
    };

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
