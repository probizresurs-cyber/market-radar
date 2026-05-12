/**
 * POST /api/generate-broll-prompts
 *
 * Принимает сценарий рилса (title + scenario + voiceoverScript) и
 * возвращает 3-4 b-roll-промпта для HeyGen Video Agent — визуальные
 * сцены, которые дополняют говорящего аватара.
 *
 * Каждый промпт:
 *   - Английский (HeyGen / Veo лучше понимают английский)
 *   - Содержит motion: dolly, drone, orbit, zoom, parallax, push, glide
 *   - Кинематографичный stil — film grain, golden hour, shallow depth
 *   - 5-сек длина по умолчанию (HeyGen рендерит ~5 сек на провайдере Veo)
 *
 * Используется Claude Sonnet — на Haiku промпты получаются плоскими.
 *
 * Body: { title, scenario, voiceoverScript?, brandBook?, count? }
 * Returns: { ok, prompts: Array<{prompt, motionHint, position}> }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BrandBook } from "@/lib/content-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — режиссёр-оператор (DOP) с опытом TikTok и рекламной режиссуры.

Тебе дают сценарий короткого вертикального видео (рилс/Shorts). Твоя задача — составить b-roll промпты, которые будут вставляться между кадрами с говорящим аватаром.

ПРАВИЛА B-ROLL ПРОМПТОВ для AI video (Veo 3.1 / Sora / Kling):
1. **English only** — модели лучше понимают английский
2. **Visual specificity** — конкретный объект + конкретное действие + конкретное окружение. Без абстракций.
3. **Camera motion обязателен** — какой движение камеры (dolly in, drone shot, orbit, parallax pan, zoom out, glide, push, static)
4. **Cinematic lighting** — golden hour / soft light / neon / studio / dramatic shadows
5. **Style anchor** — film grain, shallow depth of field, 35mm lens, 9:16 vertical
6. **No people talking** — b-roll не дублирует говорящего аватара. Это видео-иллюстрация, метафора, фоновое действие.
7. **Длина 5 секунд** — компактные scene-промпты

Каждый промпт описывает ОДИН непрерывный кадр.

Pposition бывает:
  - "opener" — первые 1-3 секунды рилса, hook
  - "support" — иллюстрация к ключевой мысли
  - "transition" — переход между секциями
  - "closer" — финальный кадр перед CTA

motionHint — лейбл для UI ("Dolly in", "Drone shot", "Orbit", "Parallax").

Ответ — СТРОГО валидный JSON.`;

function buildBrandHints(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.visualStyle) lines.push(`Visual style: ${bb.visualStyle}`);
  if (bb.colors?.length) lines.push(`Brand colors: ${bb.colors.join(", ")}`);
  return lines.length ? `\nBrand visual context:\n${lines.join("\n")}\n` : "";
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const title: string = (body.title ?? "").trim();
    const scenario: string = (body.scenario ?? "").trim();
    const voiceoverScript: string = (body.voiceoverScript ?? "").trim();
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const count: number = Math.min(Math.max(body.count ?? 3, 1), 5);

    if (!scenario && !voiceoverScript) {
      return NextResponse.json(
        { ok: false, error: "scenario или voiceoverScript обязателен" },
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

    const brandHints = buildBrandHints(brandBook);
    const userMessage = `Reel title: ${title || "(не указан)"}

Voiceover script (что говорит аватар):
${voiceoverScript || "(не указан)"}

Scenario / shot list (если есть, формат [00:00] голос — действие — текст на экране):
${scenario || "(не указан)"}
${brandHints}
Сгенерируй ${count} b-roll промпта для вставки между кадрами с говорящим аватаром.

Верни СТРОГО JSON:
{
  "prompts": [
    {
      "prompt": "English cinematic b-roll prompt — full scene description with camera motion, lighting, subject, environment",
      "motionHint": "Dolly in",
      "position": "opener"
    }
  ]
}`;

    const model = "claude-sonnet-4-5";
    const message = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: {
      prompts: Array<{ prompt: string; motionHint: string; position: string }>;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ ok: false, error: "AI вернул не-JSON" }, { status: 500 });
      }
      parsed = JSON.parse(m[0]);
    }

    const prompts = (parsed.prompts ?? [])
      .filter(p => p?.prompt?.trim().length > 10)
      .slice(0, count);
    if (prompts.length === 0) {
      return NextResponse.json({ ok: false, error: "AI не сгенерировал промптов" }, { status: 500 });
    }

    await access.log({
      endpoint: "generate-broll-prompts",
      model,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({ ok: true, prompts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
