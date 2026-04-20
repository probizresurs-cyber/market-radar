import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — парсер метрик соцсетей. Тебе показывают скриншот статистики поста или рилса (VK / Instagram / Telegram / TikTok / YouTube Shorts).

Твоя задача — вытащить ВСЕ числовые метрики, которые видны на скрине, и вернуть их в строгом JSON.

ПРАВИЛА:
1. Числа: возвращай как обычные integer (без "K", "M", "тыс."). 12.5K → 12500, 1,2M → 1200000.
2. Если метрика не видна — НЕ ставь её в результат (опускай поле, а не ставь 0).
3. Различай:
   - reach (охват, уникальные пользователи) ≠ impressions (показы, всего)
   - views (просмотры рилса) — для видео-формата
   - saves (сохранения) ≠ shares (репосты/поделились)
4. Источник определи по дизайну интерфейса: vk / instagram / telegram / tiktok / youtube
5. Если на скрине НЕТ метрик (это не статистика), верни { "ok": false, "error": "На изображении не видно метрик статистики" }

Возвращай СТРОГО JSON без markdown, без комментариев.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const imageBase64: string = body.imageBase64 ?? ""; // raw base64, без префикса
    const mimeType: string = body.mimeType ?? "image/png";
    const contentType: "post" | "reel" = body.contentType ?? "post";

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "Не передан скриншот" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const fieldsHint = contentType === "reel"
      ? `{
  "source": "vk|instagram|telegram|tiktok|youtube",
  "views": число,
  "reach": число,
  "likes": число,
  "comments": число,
  "shares": число,
  "saves": число,
  "avgWatchTimeSec": число (среднее время просмотра в секундах),
  "watchedFullPct": число (процент досмотров до конца, 0-100),
  "clicks": число
}`
      : `{
  "source": "vk|instagram|telegram|tiktok|youtube",
  "reach": число,
  "impressions": число,
  "likes": число,
  "comments": число,
  "shares": число,
  "saves": число,
  "clicks": число
}`;

    const userPrompt = `Извлеки все метрики со скриншота статистики ${contentType === "reel" ? "рилса/видео" : "поста"}.

Верни JSON в формате:
${fieldsHint}

Включай только те поля, которые реально видны на скрине. Если метрика не видна — НЕ добавляй её. Не выдумывай.`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Если модель сказала что нет метрик
    if (parsed.ok === false) {
      return NextResponse.json({ ok: false, error: parsed.error ?? "На скрине не видно метрик" });
    }

    // Очистим: оставим только числовые поля и source
    const result: Record<string, number | string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (key === "source" && typeof val === "string") {
        result.source = val;
      } else if (typeof val === "number" && Number.isFinite(val)) {
        result[key] = val;
      } else if (typeof val === "string") {
        // попробуем распарсить "12.5K", "1,2M"
        const num = parseHumanNumber(val);
        if (num !== null) result[key] = num;
      }
    }
    result.capturedAt = new Date().toISOString();

    await access.log({
      endpoint: "extract-metrics",
      model: "gpt-4o",
      // Vision images are ~1000 tokens regardless of text length
      promptTokens: estimateTokens(userPrompt + SYSTEM_PROMPT) + 1000,
      completionTokens: estimateTokens(raw),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "extract-metrics", model: "gpt-4o", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function parseHumanNumber(s: string): number | null {
  const cleaned = s.replace(/\s/g, "").replace(",", ".").toLowerCase();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)(k|тыс|m|млн|b|млрд)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const suffix = m[2];
  if (!suffix) return Math.round(n);
  if (suffix === "k" || suffix === "тыс") return Math.round(n * 1_000);
  if (suffix === "m" || suffix === "млн") return Math.round(n * 1_000_000);
  if (suffix === "b" || suffix === "млрд") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}
