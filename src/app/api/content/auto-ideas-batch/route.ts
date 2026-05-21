/**
 * POST /api/content/auto-ideas-batch
 *
 * Генерирует пакет из 5-10 идей контента на основе ВСЕХ имеющихся анализов:
 *   • myCompany (ниша, продукт, рекомендации)
 *   • taResult (сегменты ЦА, их боли)
 *   • smmResult (архетип бренда, ToV, идентичность)
 *   • brandBook (цвета, голос, ценности)
 *
 * Идеи универсальны — каждую можно потом превратить в пост / сторис /
 * карусель / рилс одной кнопкой («Создать из идеи»).
 *
 * Body: {
 *   format: "post" | "story" | "carousel" | "reel",
 *   count?: number (default 5, max 10),
 *   pillarHint?: string  // конкретный pillar если нужен
 * }
 *
 * Response: { ok, ideas: ContentIdea[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

interface IdeaRequest {
  format: "post" | "story" | "carousel" | "reel";
  count?: number;
  pillarHint?: string;
  // Контекст — фронт собирает из всех имеющихся state'ов
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  myCompany?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taResult?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smmResult?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brandBook?: any;
}

export async function POST(req: NextRequest) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json() as IdeaRequest;
    const format = body.format;
    const count = Math.max(3, Math.min(10, body.count ?? 5));

    if (!["post", "story", "carousel", "reel"].includes(format)) {
      return NextResponse.json({ ok: false, error: "format must be post/story/carousel/reel" }, { status: 400 });
    }

    // Собираем контекст компактно
    const company = body.myCompany?.company;
    const niche = company?.description?.slice(0, 200) || "";
    const companyName = company?.name || "";
    const recommendations = (body.myCompany?.recommendations ?? []).slice(0, 5).map((r: { text: string }) => r.text).join("; ");
    const opportunities = (body.myCompany?.nicheForecast?.opportunities ?? []).slice(0, 5).join("; ");

    // ЦА сегменты с болями
    const segments = (body.taResult?.segments ?? []).slice(0, 3).map((s: { segmentName: string; mainProblems?: string[]; jtbd?: string }) => ({
      name: s.segmentName,
      problems: (s.mainProblems ?? []).slice(0, 3).join("; "),
      jtbd: s.jtbd ?? "",
    }));

    // Бренд
    const archetype = body.smmResult?.brandIdentity?.archetype || "";
    const uniqueValue = body.smmResult?.brandIdentity?.uniqueValue || "";
    const toneOfVoice = (body.brandBook?.toneOfVoice ?? []).join(", ");

    const formatDescriptions: Record<typeof format, string> = {
      post: "Одиночный пост: цепляющий заголовок (hook), основная мысль, CTA. 1 идея = 1 пост на 200-500 слов.",
      story: "Серия из 3-5 сторис-слайдов: открывашка → конфликт/польза → CTA. 9:16, короткие тексты на каждом слайде.",
      carousel: "Карусель из 5-10 слайдов: обложка → блок контента (1 тезис на слайд) → CTA. Образовательный формат.",
      reel: "Короткое вертикальное видео 15-30 секунд: открывашка-хук в первые 3 секунды → польза → CTA.",
    };

    const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты — топовый контент-стратег для B2B/B2C бренда. Сгенерируй ${count} ГОТОВЫХ к публикации идей контента в формате "${format}".

КОМПАНИЯ:
- Название: ${companyName}
- Ниша: ${niche}
${body.pillarHint ? `- Тематика (pillar): ${body.pillarHint}` : ""}
${recommendations ? `- Точки роста: ${recommendations}` : ""}
${opportunities ? `- Возможности в нише: ${opportunities}` : ""}

ЦЕЛЕВАЯ АУДИТОРИЯ:
${segments.length > 0 ? segments.map((s: { name: string; problems: string; jtbd: string }, i: number) =>
  `${i + 1}. ${s.name} — боли: ${s.problems}. JTBD: ${s.jtbd}`,
).join("\n") : "Не определена — пиши универсально для ниши."}

БРЕНД:
${archetype ? `- Архетип: ${archetype}` : ""}
${uniqueValue ? `- УТП: ${uniqueValue}` : ""}
${toneOfVoice ? `- Тон голоса: ${toneOfVoice}` : ""}

ФОРМАТ ВЫХОДНЫХ ИДЕЙ:
${formatDescriptions[format]}

Требования к каждой идее:
1. Каждая идея — это РЕАЛЬНАЯ боль одного из сегментов ЦА (если они заданы)
2. Заголовок (hook) обязательно цепляющий — вопрос, обещание, число, шок-факт
3. Тематически отвечает нише — никаких общих советов «как быть успешным»
4. Если архетип задан — выдерживай его тон

Верни СТРОГО валидный JSON-массив (без markdown):
[
  {
    "id": "idea-1",
    "title": "Краткое название идеи для внутренней навигации",
    "hook": "Цепляющий заголовок поста",
    "angle": "Под каким углом раскрываем тему (1-2 предложения)",
    "pillar": "К какой тематике относится",
    "targetSegment": "Кому адресовано (имя сегмента или общее)",
    "format": "${format}",
    "summary": "2-3 предложения о чём будет контент"
  }
]

Сгенерируй ${count} разнообразных идей, чтобы не повторялись.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    // Чистим markdown-обёртку если есть + извлекаем JSON-массив
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```\s*$/g, "").trim();
    let ideas: unknown[] = [];
    try {
      ideas = JSON.parse(cleaned);
    } catch {
      // Попробуем извлечь массив из текста
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) {
        try { ideas = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }
    if (!Array.isArray(ideas) || ideas.length === 0) {
      return NextResponse.json({ ok: false, error: "Не удалось разобрать ответ модели" }, { status: 500 });
    }

    await access.log({ endpoint: "content-auto-ideas-batch", model: "claude-sonnet-4-6" });
    return NextResponse.json({ ok: true, ideas: ideas.slice(0, count) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
