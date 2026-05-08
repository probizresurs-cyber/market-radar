/**
 * POST /api/adapt-post
 *
 * Принимает один canonical-пост (hook + body + hashtags) и возвращает 3
 * адаптации под конкретные платформы:
 *   - **Instagram:** ≤2200 символов всего, эмодзи как разделители абзацев,
 *     5-15 хэштегов в конце или в первом комментарии
 *   - **VK:** ≤16K, plain text, ссылки разрешены, 3-5 хэштегов в конце
 *   - **Telegram:** ≤4096 символов, MarkdownV2-форматирование (жирный/курсив),
 *     1-2 хэштега, ссылки через [текст](url)
 *
 * Идея заимствована из n8n-workflow "Automated AI News Video Creation":
 * там были отдельные Code-ноды Clean Instagram Caption / Clean Facebook /
 * Clean YouTube — каждый с своими лимитами и форматированием. Мы делаем
 * умнее через Claude Sonnet, который не просто обрезает текст, а
 * **переписывает** его с учётом особенностей платформы.
 *
 * Body: { hook, body, hashtags?: string[], imagePrompt?: string }
 * Returns: {
 *   ok, data: {
 *     instagram: { hook, body, hashtags, charCount },
 *     vk: { hook, body, hashtags, charCount },
 *     telegram: { hook, body, hashtags, charCount },
 *   }
 * }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface PlatformVariant {
  hook: string;
  body: string;
  hashtags: string[];
  charCount: number;
}

export interface PlatformVariants {
  instagram: PlatformVariant;
  vk: PlatformVariant;
  telegram: PlatformVariant;
}

const SYSTEM_PROMPT = `Ты — эксперт по адаптации текстов под социальные сети.

Твоя задача: взять один и тот же пост и переписать его 3 раза — так, как будто его пишут 3 разных копирайтера, каждый эксперт в своей платформе.

ПРАВИЛА ДЛЯ КАЖДОЙ ПЛАТФОРМЫ:

**INSTAGRAM (≤2200 символов всего)**
- Заголовок: цепляющий, с эмодзи в начале или в конце
- Тело: короткие абзацы 1-3 строки, разделённые ВИЗУАЛЬНО (пустая строка + эмодзи)
- Эмодзи как маркеры списка (👉 ✨ 💡 🔥)
- 5-15 хэштегов в конце поста (mix популярных и нишевых)
- CTA в последнем абзаце: «Сохрани, чтобы не потерять» / «Поделись с тем, кому актуально»

**VK (до 16000 символов, plain text)**
- Заголовок: чуть длиннее, описательный, без избытка эмодзи
- Тело: можно длинные параграфы, развёрнутые мысли, читатель готов читать
- Без markdown-форматирования (VK не поддерживает)
- Ссылки в открытом виде (https://...) — VK сам их подхватит
- 3-5 хэштегов в конце с символом # (короткие, по теме)
- CTA: «Что думаете? Напишите в комментарии»

**TELEGRAM (≤4096 символов)**
- Заголовок жирным **через двойные звёздочки** (для MarkdownV2)
- Тело: компактные абзацы, можно использовать __курсив__, ссылки [текст](url)
- 1-2 хэштега максимум (TG не любит много)
- Стиль: информативный, без лишней воды, как в каналах экспертов
- CTA: «Подписывайтесь на канал, чтобы не пропустить»

ВАЖНО:
- НЕ переводи и не меняй язык — оставь как в оригинале
- НЕ выдумывай факты, которых нет в оригинале
- Сохрани суть и ключевые идеи поста
- Каждая платформа — отдельная переписка, не копия
- Ответь СТРОГО валидным JSON без markdown.`;

interface AdaptResponse {
  instagram: { hook: string; body: string; hashtags: string[] };
  vk: { hook: string; body: string; hashtags: string[] };
  telegram: { hook: string; body: string; hashtags: string[] };
}

function countChars(v: { hook: string; body: string; hashtags: string[] }): number {
  // Подсчёт примерно как видит платформа: hook + body + хэштеги через пробел
  const hashtagText = v.hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
  return `${v.hook}\n\n${v.body}\n\n${hashtagText}`.length;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const hook: string = (body.hook ?? "").trim();
    const text: string = (body.body ?? "").trim();
    const hashtags: string[] = Array.isArray(body.hashtags) ? body.hashtags : [];

    if (!hook && !text) {
      return NextResponse.json({ ok: false, error: "Не передан текст поста" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    const userMessage = `Оригинальный пост:

ЗАГОЛОВОК: ${hook}

ТЕКСТ:
${text}

ХЭШТЕГИ: ${hashtags.join(" ")}

Перепиши этот пост в 3 версиях — для Instagram, VK и Telegram. Каждая версия с учётом особенностей платформы.

Верни СТРОГО валидный JSON:
{
  "instagram": { "hook": "...", "body": "...", "hashtags": ["#тег1", "#тег2", ...] },
  "vk":        { "hook": "...", "body": "...", "hashtags": ["#тег1", "#тег2", "#тег3"] },
  "telegram":  { "hook": "...", "body": "...", "hashtags": ["#тег1"] }
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: AdaptResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ ok: false, error: "Claude вернул не-JSON" }, { status: 500 });
      }
      parsed = JSON.parse(m[0]);
    }

    const result: PlatformVariants = {
      instagram: {
        hook: parsed.instagram?.hook ?? hook,
        body: parsed.instagram?.body ?? text,
        hashtags: parsed.instagram?.hashtags ?? hashtags,
        charCount: 0,
      },
      vk: {
        hook: parsed.vk?.hook ?? hook,
        body: parsed.vk?.body ?? text,
        hashtags: parsed.vk?.hashtags ?? hashtags,
        charCount: 0,
      },
      telegram: {
        hook: parsed.telegram?.hook ?? hook,
        body: parsed.telegram?.body ?? text,
        hashtags: parsed.telegram?.hashtags ?? hashtags,
        charCount: 0,
      },
    };

    // Counter
    result.instagram.charCount = countChars(result.instagram);
    result.vk.charCount = countChars(result.vk);
    result.telegram.charCount = countChars(result.telegram);

    await access.log({ endpoint: "adapt-post", model: "claude-sonnet-4-5" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
