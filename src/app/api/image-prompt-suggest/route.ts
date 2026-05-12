/**
 * POST /api/image-prompt-suggest
 *
 * Claude Haiku пишет детальный английский промпт для DALL-E из контекста поста,
 * НО НЕ генерирует картинку. Используется в UI: сначала пользователь видит и
 * может отредактировать промпт, потом нажимает «Сгенерировать».
 *
 * Body: same as /api/generate-image-anthropic, минус результат.
 *   { postText, hook, format, platform, brandColors, brandStyle }
 *
 * Returns: { ok, prompt }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const postText: string = (body.postText ?? body.prompt ?? "").trim();
    const hook: string = (body.hook ?? "").trim();
    const format: string = body.format ?? "пост";
    const platform: string = body.platform ?? "instagram";
    const brandColors: string[] = body.brandColors ?? [];
    const brandStyle: string = (body.brandStyle ?? "").trim();

    if (!postText && !hook) {
      return NextResponse.json(
        { ok: false, error: "Нет текста для промпта" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    const imageFormat: "square" | "portrait" =
      (format === "сторис" || format === "рилс") ? "portrait" : "square";

    const contextBlock = [
      `Формат контента: ${format} для ${platform}`,
      hook && `Заголовок: «${hook}»`,
      postText && `Текст: ${postText.slice(0, 400)}`,
      brandColors.length > 0 && `Цвета бренда: ${brandColors.join(", ")}`,
      brandStyle && `Визуальный стиль бренда: ${brandStyle}`,
    ].filter(Boolean).join("\n");

    const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений (DALL-E / OpenAI).

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (photorealistic / flat design / 3D render / illustration / minimalist / cinematic etc.)
- Укажи освещение, цветовую палитру, композицию, детали
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : "square 1:1"}
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

    // Пробуем сначала Haiku (быстро/дёшево). Если worker/Anthropic вернёт
    // HTML/SyntaxError или модель временно недоступна — fallback на Sonnet
    // (его маршрут стабилен и используется в других продакшен-эндпоинтах).
    const MODELS = ["claude-haiku-4-5", "claude-sonnet-4-5"] as const;
    let prompt = "";
    let lastError = "";
    for (const model of MODELS) {
      try {
        const message = await client.messages.create({
          model,
          max_tokens: 400,
          messages: [{ role: "user", content: claudePrompt }],
        });
        const text =
          message.content[0]?.type === "text"
            ? message.content[0].text.trim()
            : "";
        if (text) {
          prompt = text;
          break;
        }
        lastError = `Модель ${model} вернула пустой ответ`;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // Cloudflare Worker иногда отдаёт HTML вместо JSON — SDK падает с
        // "Unexpected token '<'". Распознаём это и пробуем следующую модель.
        const looksLikeHtml = /Unexpected token '?<'?|"<html|is not valid JSON/i.test(raw);
        lastError = looksLikeHtml
          ? `Прокси AI вернул HTML вместо ответа модели ${model} — пробую другую модель…`
          : raw;
        // Дальше переключимся на следующую модель в цикле
      }
    }

    if (!prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: lastError || "Не удалось получить промпт от AI. Попробуйте ещё раз через минуту.",
        },
        { status: 502 }, // 502 — bad gateway: проблема на прокси/upstream
      );
    }

    return NextResponse.json({ ok: true, prompt });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    // Финальный catch — обычно сюда не должны дойти. Если HTML просочился,
    // показываем понятный текст вместо "Unexpected token '<'".
    const looksLikeHtml = /Unexpected token '?<'?|"<html|is not valid JSON/i.test(raw);
    const userMessage = looksLikeHtml
      ? "Прокси AI временно вернул HTML вместо JSON. Это разовый сбой Cloudflare — повторите запрос через 30 секунд."
      : raw;
    return NextResponse.json(
      { ok: false, error: userMessage },
      { status: looksLikeHtml ? 502 : 500 },
    );
  }
}
