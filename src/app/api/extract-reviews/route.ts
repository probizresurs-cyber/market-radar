import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { chatJson, chatJsonVision, CHAT_MODEL_SMART, type VisionMimeType } from "@/lib/ai-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — парсер отзывов. Из скриншота или текста извлекаешь структурированные отзывы.

Для каждого отзыва определи:
- author: имя автора
- rating: оценка 1-5 (если видно звёзды, число, или определи по тону)
- text: полный текст отзыва
- date: дата (если видна, иначе "")
- reply: ответ компании (если есть, иначе "")

Возвращай СТРОГО валидный JSON без markdown:
{
  "platform": "определённая платформа (yandex_maps / 2gis / otzovik / avito / google / unknown)",
  "reviews": [
    { "author": "...", "rating": 5, "text": "...", "date": "...", "reply": "..." }
  ]
}

Если не можешь разобрать — верни пустой массив reviews.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const screenshot: string | undefined = body.screenshot; // base64 data URL
    const pastedText: string | undefined = body.pastedText;

    if (!screenshot && !pastedText) {
      return NextResponse.json({ ok: false, error: "Нет данных для извлечения" }, { status: 400 });
    }

    type ParsedReviews = { platform: string; reviews: Array<{ author: string; rating: number; text: string; date: string; reply?: string }> };

    let aiResult: { data: ParsedReviews | null; raw: string; modelUsed: string; error?: string };
    if (screenshot) {
      // screenshot приходит как data URL ("data:image/png;base64,...") — Claude
      // vision, в отличие от OpenAI image_url, хочет mime и base64 раздельно.
      const m = screenshot.match(/^data:([^;]+);base64,(.+)$/s);
      if (!m) {
        return NextResponse.json({ ok: false, error: "Скриншот должен быть data URL (data:image/...;base64,...)" }, { status: 400 });
      }
      const allowedMime: VisionMimeType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const mimeType = (allowedMime as string[]).includes(m[1]) ? (m[1] as VisionMimeType) : "image/png";
      aiResult = await chatJsonVision<ParsedReviews>({
        system: SYSTEM_PROMPT,
        userText: "Извлеки все отзывы из этого скриншота. Определи платформу по дизайну.",
        imageBase64: m[2],
        mimeType,
        model: CHAT_MODEL_SMART,
        temperature: 0.2,
        maxTokens: 4000,
      });
    } else {
      aiResult = await chatJson<ParsedReviews>({
        system: SYSTEM_PROMPT,
        user: `Извлеки все отзывы из этого текста. Определи платформу если возможно.\n\n${pastedText}`,
        model: CHAT_MODEL_SMART,
        temperature: 0.2,
        maxTokens: 4000,
      });
    }
    if (!aiResult.data) {
      return NextResponse.json({ ok: false, error: aiResult.error ?? "Не удалось извлечь отзывы" }, { status: 500 });
    }
    const parsed = aiResult.data;

    const reviews: Review[] = (parsed.reviews ?? []).map((r, i) => ({
      id: `rev-${Date.now()}-${i}`,
      platform: parsed.platform ?? "unknown",
      author: r.author ?? "Аноним",
      rating: Math.min(5, Math.max(1, Math.round(r.rating ?? 3))),
      text: r.text ?? "",
      date: r.date ?? "",
      reply: r.reply,
    }));

    await access.log({
      endpoint: "extract-reviews",
      model: aiResult.modelUsed,
      promptTokens: estimateTokens(SYSTEM_PROMPT + (pastedText ?? "")) + (screenshot ? 1000 : 0),
      completionTokens: estimateTokens(aiResult.raw),
    });
    return NextResponse.json({
      ok: true,
      data: { platform: parsed.platform ?? "unknown", reviews },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "extract-reviews", model: "claude", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
