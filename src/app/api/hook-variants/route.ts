/**
 * POST /api/hook-variants
 *
 * Принимает текущий пост (hook + body + pillar + платформа) и возвращает
 * 3 альтернативных крючка для A/B-тестирования. Используется на странице
 * «Готовые посты» — пользователь жмёт «Другие варианты крючка», выбирает
 * лучший из 3-х и обновляет пост одним кликом.
 *
 * Body: { hook, body, pillar?, platform?, brandBook?, count? }
 * Returns: { ok, variants: string[] }
 *
 * Использует Sonnet — у Haiku хуки получаются плоскими.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BrandBook } from "@/lib/content-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 45;

const SYSTEM_PROMPT = `Ты — копирайтер с 20-летним опытом, специалист по крючкам и заголовкам.

Твоя задача — переписать крючок поста в 3 разных вариантах, каждый — по другой механике:
1. **Цифровой/конкретный** — с числом, статистикой, временной рамкой
2. **Эмоциональный/провокативный** — с парадоксом, удивлением, конфликтом
3. **Утилитарный/прямой** — обещание выгоды без воды, в формате how-to

Правила:
- Каждый крючок — самостоятельный, читается без контекста
- Длина: 50-120 символов
- Без эмодзи в начале (можно одно эмодзи внутри, если это уместно)
- Без многоточий "..."
- Не повторяй структуру оригинала — каждый вариант должен звучать по-другому

ВАЖНО: Ответ — СТРОГО валидный JSON без markdown.`;

function buildBrandHints(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.toneOfVoice?.length) lines.push(`Тон: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`НЕ использовать: ${bb.forbiddenWords.join(", ")}`);
  if (bb.goodPhrases?.length) lines.push(`Фирменные фразы: ${bb.goodPhrases.slice(0, 3).join(" / ")}`);
  return lines.length ? `\nБРЕНДБУК:\n${lines.join("\n")}\n` : "";
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const hook: string = (body.hook ?? "").trim();
    const text: string = (body.body ?? "").trim();
    const pillar: string = body.pillar ?? "";
    const platform: string = body.platform ?? "";
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const count: number = Math.min(Math.max(body.count ?? 3, 1), 5);

    if (!hook && !text) {
      return NextResponse.json(
        { ok: false, error: "Передай hook или body" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL
        ? { baseURL: process.env.ANTHROPIC_BASE_URL }
        : {}),
    });

    const brandHints = buildBrandHints(brandBook);
    const userMessage = `Платформа: ${platform || "не указана"}
Контент-столп: ${pillar || "не указан"}
${brandHints}
ТЕКУЩИЙ КРЮЧОК:
«${hook}»

${text ? `КОНТЕКСТ ПОСТА (фрагмент):\n${text.slice(0, 800)}` : ""}

Перепиши крючок в ${count} разных вариантах по трём механикам (цифровой/эмоциональный/утилитарный — добавь больше, если count > 3).

Верни СТРОГО JSON:
{
  "variants": [
    "вариант 1 — цифровой",
    "вариант 2 — эмоциональный",
    "вариант 3 — утилитарный"
  ]
}`;

    const model = "claude-sonnet-4-5";
    const message = await client.messages.create({
      model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw =
      message.content[0]?.type === "text"
        ? message.content[0].text.trim()
        : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: { variants: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json(
          { ok: false, error: "AI вернул не-JSON" },
          { status: 500 },
        );
      }
      parsed = JSON.parse(m[0]);
    }

    const variants = Array.isArray(parsed.variants)
      ? parsed.variants
          .map(v => String(v).trim())
          .filter(v => v.length > 0)
          .slice(0, count)
      : [];

    if (!variants.length) {
      return NextResponse.json(
        { ok: false, error: "AI не вернул варианты" },
        { status: 500 },
      );
    }

    await access.log({
      endpoint: "hook-variants",
      model,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({ ok: true, variants });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({
      endpoint: "hook-variants",
      model: "claude-sonnet-4-5",
      success: false,
      errorMessage: msg.slice(0, 200),
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
