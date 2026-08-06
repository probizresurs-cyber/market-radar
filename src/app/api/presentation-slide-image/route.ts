/**
 * POST /api/presentation-slide-image
 *
 * Генерация иллюстрации для конкретного слайда презентации. AI пишет
 * prompt из контекста слайда (title + content + bullets) + brandBook
 * (colors, mood), потом gpt-image-2 / Gemini рендерит.
 *
 * Body: { slide: PresentationSlide, brandBook?, style? }
 * Returns: { ok, data: { imageUrl, prompt } }
 *
 * Картинку юзер вставит как фон/иллюстрацию в слайде (поле slide.imageUrl —
 * добавим на клиенте).
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateOpenAIImage } from "@/lib/openai-image";
import { generateGeminiImage } from "@/lib/gemini";
import { persistImageDataUri } from "@/lib/image-store";

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

  // Построим prompt из контекста слайда. Без AI-вызова (быстро + дёшево).
  // Это просто умная конкатенация — gpt-image-2 сам поймёт.
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

  const palette = brand.colors?.length
    ? `Brand palette: ${brand.colors.slice(0, 4).join(", ")}.`
    : "";

  const prompt = [
    `Editorial illustration for a business presentation slide.`,
    `Topic: ${contextParts.join(" — ").slice(0, 400)}`,
    palette,
    styleHints.join(", "),
    "Aspect ratio 16:9, no text overlay, clean composition with room for layout, high quality.",
  ].filter(Boolean).join(" ");

  // Gemini первым: с RU-VPS OpenAI недостижим (сам за Cloudflare, воркер не
  // помогает), а Gemini через свой воркер работает. OpenAI — фолбэк на случай
  // деплоя вне РФ. Результат сохраняем в user_images и отдаём короткий URL —
  // base64 в слайде раздувал бы localStorage-историю презентаций.
  //
  // ВАЖНО: НЕ гейтимся на process.env.GEMINI_API_KEY — lib/gemini.ts имеет
  // собственный фолбэк-ключ, и на проде переменной может не быть вообще
  // (из-за этого кнопка «AI-иллюстрация» отвечала «нет провайдера», хотя
  // генерация сторис через тот же Gemini работала). Пробуем по факту.
  const errors: string[] = [];

  const gem = await generateGeminiImage({ prompt, referenceImages: [] }).catch((e: unknown) => ({ ok: false as const, imageUrl: null, error: e instanceof Error ? e.message : String(e) }));
  if (gem.ok && gem.imageUrl) {
    const shortUrl = await persistImageDataUri(gem.imageUrl, access.userId);
    await access.log({ endpoint: "presentation-slide-image", model: "gemini-2.5-flash-image", success: true });
    return NextResponse.json({ ok: true, data: { imageUrl: shortUrl, prompt } });
  }
  errors.push(`gemini: ${("error" in gem && gem.error) || "пустой ответ"}`);

  if (process.env.OPENAI_API_KEY) {
    const res = await generateOpenAIImage({
      prompt,
      format: "landscape", // 16:9 → 1792x1024 (см. pickSize в lib/openai-image.ts)
      quality: "high",
    }).catch((e: unknown) => ({ ok: false as const, imageUrl: null, error: e instanceof Error ? e.message : String(e) }));
    if (res.ok && res.imageUrl) {
      const shortUrl = await persistImageDataUri(res.imageUrl, access.userId);
      await access.log({ endpoint: "presentation-slide-image", model: "gpt-image-2", success: true });
      return NextResponse.json({ ok: true, data: { imageUrl: shortUrl, prompt } });
    }
    errors.push(`openai: ${("error" in res && res.error) || "пустой ответ"}`);
  }

  await access.log({ endpoint: "presentation-slide-image", model: "none", success: false });
  return NextResponse.json({ ok: false, error: `Генерация не удалась — ${errors.join("; ")}` }, { status: 502 });
}
