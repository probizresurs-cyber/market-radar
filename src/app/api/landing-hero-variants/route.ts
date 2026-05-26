/**
 * POST /api/landing-hero-variants
 *
 * Генерирует 5 вариаций hero-секции (heading + subheading + CTA) для
 * лендинга. Юзер выбирает 2 для A/B-теста.
 *
 * Каждая вариация играет на разном эмоциональном триггере:
 *   - Срочность ("Сегодня — последний день...")
 *   - Соц-доказательство ("1247 клиентов уже...")
 *   - Конкретный результат ("X 30% за 14 дней")
 *   - Боль ("Перестаньте терять...")
 *   - Простая ценность ("Готовое решение для X")
 *
 * Body: { topic, audience?, productType?, currentHero? }
 * Returns: { ok, data: { variants: HeroVariant[] } }
 *
 * Для реального A/B на проде нужен split-tracking + conversion_events
 * — это отдельная фича (см. /api/presentation-view-event как образец).
 * Здесь — только генерация вариантов.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

interface HeroVariant {
  trigger: "urgency" | "social-proof" | "outcome" | "pain" | "value";
  heading: string;     // до 70 символов
  subheading: string;  // до 140 символов
  cta: string;         // до 30 символов
  rationale: string;   // почему это сработает
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { topic?: string; audience?: string; productType?: string; currentHero?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const topic = (body.topic ?? "").trim().slice(0, 200);
  if (!topic) return NextResponse.json({ ok: false, error: "topic required" }, { status: 400 });
  const audience = (body.audience ?? "").slice(0, 300);
  const productType = (body.productType ?? "").slice(0, 100);
  const currentHero = (body.currentHero ?? "").slice(0, 300);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

  const client = new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  });

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты — конверсионный копирайтер, специализация — hero-секции лендингов.

Создай 5 вариаций hero-блока для лендинга, каждая играет на РАЗНОМ эмоциональном триггере:

1. URGENCY — срочность, дедлайн, ограниченное предложение
2. SOCIAL-PROOF — упоминание числа клиентов / отзывов / years на рынке (БЕЗ выдумок — оставь placeholder если данных нет)
3. OUTCOME — конкретный измеримый результат
4. PAIN — обращение к боли клиента, проблеме
5. VALUE — простое и понятное value-proposition

КОНТЕКСТ:
Тема: ${topic}
${productType ? `Продукт: ${productType}` : ""}
${audience ? `ЦА: ${audience}` : ""}
${currentHero ? `Текущий hero: ${currentHero}` : ""}

ТРЕБОВАНИЯ:
- heading ≤ 70 символов, цепляющий
- subheading ≤ 140 символов, раскрывает ценность
- cta ≤ 30 символов, действие (НЕ «Узнать больше»; используйте «Получить», «Записаться», «Скачать», etc)
- rationale 1-2 предложения почему этот трюк работает для данной ЦА
- НЕ выдумывай числа («1247 клиентов») — если нет данных, используй placeholder «N» в обоих heading и rationale

ВЫХОД — JSON:
{
  "variants": [
    {
      "trigger": "urgency",
      "heading": "...",
      "subheading": "...",
      "cta": "...",
      "rationale": "..."
    },
    ... 5 объектов всего
  ]
}`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ ok: false, error: "Claude не вернул JSON" }, { status: 500 });
  }
  let parsed: { variants?: HeroVariant[] };
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch {
    return NextResponse.json({ ok: false, error: "Parse error" }, { status: 500 });
  }
  const validTriggers = new Set(["urgency", "social-proof", "outcome", "pain", "value"]);
  const variants: HeroVariant[] = (Array.isArray(parsed.variants) ? parsed.variants : [])
    .slice(0, 5)
    .filter(v => v && typeof v.heading === "string" && validTriggers.has(v.trigger))
    .map(v => ({
      trigger: v.trigger,
      heading: String(v.heading).slice(0, 140),
      subheading: String(v.subheading || "").slice(0, 280),
      cta: String(v.cta || "").slice(0, 50),
      rationale: String(v.rationale || "").slice(0, 400),
    }));

  await access.log({
    endpoint: "landing-hero-variants",
    model: "claude-haiku-4-5",
    promptTokens: msg.usage?.input_tokens,
    completionTokens: msg.usage?.output_tokens,
    success: true,
  });

  return NextResponse.json({ ok: true, data: { variants } });
}
