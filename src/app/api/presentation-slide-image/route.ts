/**
 * POST /api/presentation-slide-image
 *
 * Генерация иллюстрации для конкретного слайда презентации — теперь тем
 * же пайплайном, что и картинки для постов/сторис/каруселей
 * (/api/generate-image-anthropic): Claude Haiku пишет детальный
 * англоязычный промпт из контекста слайда + брендбука, дальше общий
 * провайдер-чейн (src/lib/image-gen.ts) — Gemini → OpenAI → Gemini-фолбэк
 * → Pollinations.ai. Раньше здесь были только Gemini/OpenAI напрямую без
 * Pollinations — если у Gemini кончалась бесплатная квота (частый случай
 * на shared-ключе), а OpenAI недоступен с российского VPS («Country,
 * region, or territory not supported»), кнопка «AI-иллюстрация» падала
 * целиком, хотя ровно то же самое сочетание сбоев в постах/сторис уже
 * умело фолбэчиться на Pollinations.
 *
 * Body: { slide: PresentationSlide, brandBook?, style? }
 * Returns: { ok, data: { imageUrl, prompt } }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import { generateImageWithFallback } from "@/lib/image-gen";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SlideInput {
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  type?: string;
}

interface BrandBookInput {
  colors?: string[];
  visualStyle?: string;
  mood?: string;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { slide?: SlideInput; brandBook?: BrandBookInput; style?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const slide = body.slide;
  if (!slide?.title) {
    return NextResponse.json({ ok: false, error: "slide.title required" }, { status: 400 });
  }
  const brand = body.brandBook ?? {};

  const styleHints: string[] = [];
  if (brand.visualStyle) styleHints.push(brand.visualStyle);
  if (brand.mood) styleHints.push(brand.mood);
  if (body.style === "photo") styleHints.push("photorealistic, premium photography");
  else if (body.style === "illustration") styleHints.push("flat illustration, vector style");
  else if (body.style === "minimal") styleHints.push("minimalist, lots of whitespace, geometric");
  else if (body.style === "3d") styleHints.push("3D render, octane-style lighting");
  else styleHints.push("clean professional illustration");

  const contextParts: string[] = [];
  if (slide.title) contextParts.push(slide.title);
  if (slide.subtitle) contextParts.push(slide.subtitle);
  if (slide.content) contextParts.push(slide.content.slice(0, 200));
  if (slide.bullets?.length) contextParts.push(slide.bullets.slice(0, 3).join(". "));

  const palette = brand.colors?.length ? brand.colors.slice(0, 4).join(", ") : "";

  // Fallback-промпт без AI-вызова — используется если Claude не ответил.
  const fallbackPrompt = [
    `Editorial illustration for a business presentation slide.`,
    `Topic: ${contextParts.join(" — ").slice(0, 400)}`,
    palette && `Brand palette: ${palette}.`,
    styleHints.join(", "),
    "Aspect ratio 16:9, no text overlay, clean composition with room for layout, high quality.",
  ].filter(Boolean).join(" ");

  // Тот же арт-директорский промпт, что и в generate-image-anthropic для
  // постов — просто с контекстом слайда вместо контекста поста.
  const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений.

Создай детальный промпт на английском языке для иллюстрации к слайду презентации:

Заголовок слайда: ${slide.title}
${slide.subtitle ? `Подзаголовок: ${slide.subtitle}\n` : ""}${contextParts.length > 1 ? `Контекст: ${contextParts.slice(1).join(" — ").slice(0, 300)}\n` : ""}${palette ? `Цвета бренда: ${palette}\n` : ""}${styleHints.length ? `Визуальный стиль: ${styleHints.join(", ")}\n` : ""}
Правила:
- Опиши конкретную визуальную сцену или метафору, усиливающую смысл слайда
- Укажи художественный стиль, освещение, цветовую палитру, композицию
- Ориентация: horizontal 16:9 (landscape), оставь место под текст поверх картинки
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры, watermarks
- Длина промпта: 2-4 предложения, конкретные детали

Ответь ТОЛЬКО промптом на английском, без пояснений или префикса.`;

  let usedPrompt = fallbackPrompt;
  try {
    const { text } = await safeAnthropicCreate({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      messages: [{ role: "user", content: claudePrompt }],
    });
    if (text?.trim()) usedPrompt = text.trim();
  } catch { /* Claude недоступен — едем на fallbackPrompt */ }

  if (!/no text|without text|no letters/i.test(usedPrompt)) {
    usedPrompt += " No text, letters, words, or watermarks in the image.";
  }

  const result = await generateImageWithFallback({
    prompt: usedPrompt,
    format: "landscape", // 16:9
    userId: access.userId,
  });

  if (!result.ok) {
    await access.log({ endpoint: "presentation-slide-image", model: "none", success: false });
    return NextResponse.json({ ok: false, error: `Генерация не удалась — ${result.error}` }, { status: 502 });
  }

  await access.log({ endpoint: "presentation-slide-image", model: result.provider ?? "unknown", success: true });
  return NextResponse.json({ ok: true, data: { imageUrl: result.imageUrl, prompt: usedPrompt } });
}
