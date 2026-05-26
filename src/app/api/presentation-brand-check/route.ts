/**
 * POST /api/presentation-brand-check
 *
 * Перед экспортом презентации в PPTX/PDF юзер может нажать «Проверить
 * соответствие брендбуку» — Claude Haiku смотрит слайды + брендбук
 * (цвета/шрифты/тон голоса/запрещённые слова) и выдаёт список нарушений
 * с предложениями исправить.
 *
 * Дешёвая операция (Haiku, ~$0.001 за презентацию), большая ценность
 * для корпоративных клиентов которые ценят brand-consistency.
 *
 * Body:
 *   slides: PresentationSlide[]
 *   brandBook: BrandBook
 *   primary, secondary: текущие цвета в презентации
 *   fontH, fontB: текущие шрифты
 *
 * Returns:
 *   { ok, data: { issues: [...], score: 0-100, summary: string } }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 30;

interface BrandCheckIssue {
  slideIndex: number;
  category: "color" | "font" | "tone" | "forbidden-word" | "tagline" | "logo" | "other";
  severity: "low" | "medium" | "high";
  issue: string;
  suggestion: string;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: {
    slides?: Array<Record<string, unknown>>;
    brandBook?: {
      tagline?: string;
      mission?: string;
      colors?: string[];
      fontHeader?: string;
      fontBody?: string;
      toneOfVoice?: string[];
      forbiddenWords?: string[];
    };
    primary?: string;
    secondary?: string;
    fontH?: string;
    fontB?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const slides = body.slides ?? [];
  const bb = body.brandBook ?? {};
  if (slides.length === 0) {
    return NextResponse.json({ ok: false, error: "Нет слайдов для проверки" }, { status: 400 });
  }

  // Уменьшаем JSON слайдов — без объёмных полей которые AI не нужны для проверки.
  const slidesCompact = slides.slice(0, 25).map((s, i) => ({
    i,
    title: s.title,
    subtitle: s.subtitle,
    type: s.type,
    content: typeof s.content === "string" ? (s.content as string).slice(0, 400) : s.content,
    bullets: Array.isArray(s.bullets) ? (s.bullets as string[]).slice(0, 8) : undefined,
    quote: s.quote,
  }));

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты — brand-consistency аудитор презентаций. Проверь слайды на соответствие брендбуку компании. Найди реальные нарушения, НЕ выдумывай.

БРЕНДБУК:
- Слоган: ${bb.tagline || "—"}
- Миссия: ${bb.mission || "—"}
- Цвета бренда: ${bb.colors?.join(", ") || "—"}
- Шрифт заголовков: ${bb.fontHeader || "—"}
- Шрифт текста: ${bb.fontBody || "—"}
- Тон голоса: ${bb.toneOfVoice?.join(", ") || "—"}
- Запрещённые слова/выражения: ${bb.forbiddenWords?.join(", ") || "—"}

ТЕКУЩИЕ НАСТРОЙКИ ПРЕЗЕНТАЦИИ:
- Primary: ${body.primary || "—"}
- Secondary: ${body.secondary || "—"}
- Шрифт заголовков: ${body.fontH || "—"}
- Шрифт текста: ${body.fontB || "—"}

СЛАЙДЫ:
${JSON.stringify(slidesCompact, null, 2)}

Найди нарушения и верни СТРОГО JSON:
{
  "score": 0-100 (общая оценка соответствия брендбуку),
  "summary": "1-2 предложения о состоянии",
  "issues": [
    {
      "slideIndex": число (i из слайдов),
      "category": "color" | "font" | "tone" | "forbidden-word" | "tagline" | "logo" | "other",
      "severity": "low" | "medium" | "high",
      "issue": "Что не так — конкретно",
      "suggestion": "Как исправить — конкретно"
    }
  ]
}

ПРАВИЛА:
- Проверяй ТОЛЬКО то что видишь в слайдах. НЕ выдумывай.
- "tone" — если стиль текста противоречит заявленному тону голоса.
- "forbidden-word" — если используются запрещённые слова из брендбука.
- Если всё ок — верни {"score": 95-100, "summary": "...", "issues": []}.
- Максимум 15 issues. Сортируй по severity (high → low).`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claude не вернул JSON");
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      score: number;
      summary: string;
      issues: BrandCheckIssue[];
    };

    await access.log({
      endpoint: "presentation-brand-check",
      model: "claude-haiku-4-5",
      promptTokens: msg.usage?.input_tokens,
      completionTokens: msg.usage?.output_tokens,
      success: true,
    });

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    console.error("[brand-check] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка" },
      { status: 500 },
    );
  }
}
