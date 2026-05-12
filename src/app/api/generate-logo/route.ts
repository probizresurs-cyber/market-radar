/**
 * POST /api/generate-logo
 *
 * Генерирует логотип на основе данных брендбука / описания бренда.
 * Принимает варианты: wordmark (текстовый), monogram (буквенный),
 * symbol (значок), combo (значок + текст).
 *
 * Сначала Claude Haiku пишет тщательный DALL-E-промпт под выбранный
 * вариант + бренд (тон, цвета). Потом OpenAI DALL-E рендерит square.
 *
 * Body: { brandName, tagline?, variant, colors?, style?, count? }
 * Returns: { ok, logos: Array<{ imageUrl: string, prompt: string }> }
 */
import { NextResponse } from "next/server";
import { generateOpenAIImage } from "@/lib/openai-image";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { safeAnthropicCreate, extractJson, proxyErrorMessage } from "@/lib/anthropic-safe";

export const runtime = "nodejs";
export const maxDuration = 180;

type LogoVariant = "wordmark" | "monogram" | "symbol" | "combo";

const VARIANT_PROMPTS: Record<LogoVariant, string> = {
  wordmark:
    "wordmark logo — full brand name in custom typography, no icon. Clean, modern, readable at any size",
  monogram:
    "monogram logo — single letter or 2-3 letter initials styled as a strong mark. Bold, geometric",
  symbol:
    "abstract symbol/icon mark only, no text. Memorable, scalable to favicon. Clean geometry",
  combo:
    "combination mark — icon/symbol on the left, brand name on the right in matching typography",
};

const SYSTEM_PROMPT = `Ты — арт-директор брендингового агентства.

Тебе дают бренд и тип логотипа. Твоя задача — написать ПРОФЕССИОНАЛЬНЫЙ английский DALL-E промпт для генерации логотипа.

ПРАВИЛА ХОРОШЕГО ЛОГО-ПРОМПТА:
1. Стиль: minimalist, vector, flat, professional, clean, geometric — без 3D, без gradient-noise, без реалистичных текстур
2. Композиция: centered on white background, isolated, no watermarks, no extra elements
3. Цвета: указать конкретные hex или название (не более 2-3 цветов)
4. Шрифт (для wordmark/combo): geometric sans-serif, custom letterforms, no decorative fonts
5. Чёткое описание сути бренда — что компания делает (одно прилагательное + сектор)
6. Запретить лишнее: "no text scratches, no skin tones, no realistic objects unless asked"
7. Указать размер mock-up: "pristine logo, vector style, isolated on pure white background, ample padding"

Промпт пиши НА АНГЛИЙСКОМ. Длина 30-80 слов.

Ответ — СТРОГО валидный JSON.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const brandName: string = (body.brandName ?? "").trim();
    const tagline: string = (body.tagline ?? "").trim();
    const variant: LogoVariant = (body.variant ?? "combo") as LogoVariant;
    const colors: string[] = Array.isArray(body.colors) ? body.colors : [];
    const style: string = (body.style ?? "").trim();
    const count: number = Math.min(Math.max(body.count ?? 2, 1), 4);

    if (!brandName) {
      return NextResponse.json({ ok: false, error: "brandName обязателен" }, { status: 400 });
    }

    const userMessage = `Бренд: "${brandName}"
${tagline ? `Слоган: "${tagline}"` : ""}
${colors.length ? `Цвета: ${colors.slice(0, 3).join(", ")}` : ""}
${style ? `Желаемый стиль: ${style}` : ""}

Тип логотипа: ${variant} — ${VARIANT_PROMPTS[variant]}.

Сгенерируй ${count} разных DALL-E промпта (каждый даст уникальный вариант). Верни СТРОГО JSON:
{
  "prompts": [
    "English DALL-E prompt #1 (30-80 words)",
    "English DALL-E prompt #2"
  ]
}`;

    const { text, modelUsed, proxyDegraded, error } = await safeAnthropicCreate({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    if (!text) {
      return NextResponse.json(
        { ok: false, error: proxyDegraded ? proxyErrorMessage() : (error ?? "AI не ответил") },
        { status: proxyDegraded ? 502 : 500 },
      );
    }

    const parsed = extractJson<{ prompts: string[] }>(text);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "AI вернул не-JSON" }, { status: 500 });
    }

    const prompts = (parsed.prompts ?? []).slice(0, count);
    if (prompts.length === 0) {
      return NextResponse.json({ ok: false, error: "AI не сгенерировал промптов" }, { status: 500 });
    }

    await access.log({
      endpoint: "generate-logo",
      model: modelUsed,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(text),
    });

    // Параллельно генерируем картинки. Если какая-то падает — пропускаем.
    const results = await Promise.all(
      prompts.map(async p => {
        const r = await generateOpenAIImage({ prompt: p, format: "square", quality: "hd" });
        if (!r.ok) return null;
        return { imageUrl: r.imageUrl, prompt: p };
      }),
    );

    const logos = results.filter((x): x is { imageUrl: string; prompt: string } => x !== null);
    if (logos.length === 0) {
      return NextResponse.json({ ok: false, error: "Не удалось сгенерировать ни одного логотипа" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
