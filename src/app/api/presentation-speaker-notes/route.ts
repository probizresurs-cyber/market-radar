/**
 * POST /api/presentation-speaker-notes
 *
 * Второй pass над уже сгенерированной презентацией: GPT-4o-mini пишет
 * speaker notes (60-90 секунд каждый слайд — то что говорит ведущий
 * под слайдом). Заполняет поле `slide.note`.
 *
 * Зачем: notes нужны для:
 *   - Пичей живых: ведущий не запоминает 12 слайдов наизусть
 *   - Voice-over озвучки через ElevenLabs (см. #9)
 *
 * Body: { slides: PresentationSlide[], companyName?, audience? }
 * Returns: { ok, data: { notes: string[] } } — массив длиной = slides.length
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

export const runtime = "nodejs";
export const maxDuration = 90;

interface SlideInput {
  title: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  stats?: Array<{ value: string; label: string }>;
  quote?: string;
  items?: Array<{ title: string; description: string }>;
  leftContent?: string;
  rightContent?: string;
  type?: string;
  note?: string; // existing — мы не перезаписываем если уже заполнено
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { slides?: SlideInput[]; companyName?: string; audience?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const slides = Array.isArray(body.slides) ? body.slides.slice(0, 25) : [];
  if (slides.length === 0) {
    return NextResponse.json({ ok: false, error: "Нужен хотя бы один слайд" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY не настроен" }, { status: 500 });
  }

  const companyName = (body.companyName ?? "").trim().slice(0, 120);
  const audience = (body.audience ?? "").trim().slice(0, 200);

  // Подготовка краткого описания каждого слайда — без bullshit, чтобы GPT
  // понимал контекст без огромного промпта.
  const slideSummaries = slides.map((s, i) => {
    const parts: string[] = [`#${i + 1} (${s.type ?? "bullets"}): ${s.title}`];
    if (s.subtitle) parts.push(`Подзаголовок: ${s.subtitle}`);
    if (s.content) parts.push(`Содержание: ${s.content.slice(0, 300)}`);
    if (s.bullets?.length) parts.push(`Тезисы: ${s.bullets.slice(0, 5).join("; ")}`);
    if (s.stats?.length) parts.push(`Цифры: ${s.stats.map(st => `${st.value} ${st.label}`).join("; ")}`);
    if (s.quote) parts.push(`Цитата: "${s.quote.slice(0, 200)}"`);
    if (s.items?.length) parts.push(`Карточки: ${s.items.map(it => it.title).join("; ")}`);
    return parts.join(" / ");
  }).join("\n\n");

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты — ведущий бренд-презентаций. Напиши speaker notes к ${slides.length} слайдам — то что ведущий говорит ВЖИВУЮ под каждым слайдом.

ТРЕБОВАНИЯ:
- 60-90 секунд на слайд (≈ 100-150 слов)
- Естественная речь, не книжный текст. Можно «друзья», «коллеги», риторические вопросы.
- НЕ повторяй буквально текст слайда — раскрывай, расширяй, добавляй живой пример.
- Связка между слайдами — последнее предложение готовит к следующему слайду.
- Без воды и общих фраз вроде «как мы видим на слайде».

${companyName ? `КОМПАНИЯ: ${companyName}` : ""}
${audience ? `АУДИТОРИЯ: ${audience}` : ""}

СЛАЙДЫ:
${slideSummaries}

ВЫХОД — JSON-объект:
{
  "notes": [
    "Текст для слайда 1...",
    "Текст для слайда 2...",
    ...
  ]
}
Массив должен содержать РОВНО ${slides.length} строк.`;

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: Math.min(6000, slides.length * 320),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    await access.log({ endpoint: "presentation-speaker-notes", model: "gpt-4o-mini", success: false, errorMessage: text.slice(0, 200) });
    return NextResponse.json({ ok: false, error: `OpenAI ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const raw = data.choices[0]?.message?.content ?? "{}";

  let parsed: { notes?: unknown };
  try { parsed = JSON.parse(raw); }
  catch {
    return NextResponse.json({ ok: false, error: "Не удалось распарсить ответ GPT" }, { status: 500 });
  }

  const rawNotes: unknown[] = Array.isArray(parsed.notes) ? parsed.notes : [];
  if (rawNotes.length === 0) {
    return NextResponse.json({ ok: false, error: "GPT не вернул массив notes" }, { status: 500 });
  }
  // Нормализуем до slides.length
  const notes: string[] = Array.from({ length: slides.length }, (_, i) =>
    typeof rawNotes[i] === "string" ? (rawNotes[i] as string) : ""
  );

  await access.log({
    endpoint: "presentation-speaker-notes",
    model: "gpt-4o-mini",
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    success: true,
  });

  return NextResponse.json({ ok: true, data: { notes } });
}
