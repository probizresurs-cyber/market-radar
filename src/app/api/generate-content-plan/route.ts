import { NextResponse } from "next/server";
import type { ContentPlan } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Ты — гибрид четырёх лучших экспертов по контенту:

1. ВИРАЛЬНЫЙ РЕЖИССЁР РИЛСОВ. Ты строишь видео по железной структуре: КРЮК (0-3 сек, шок/вопрос/обещание) → ИНТРИГА (удержание) → ПРОБЛЕМА (боль зрителя) → РЕШЕНИЕ → РЕЗУЛЬТАТ → CTA. Каждое видео цепляет с первой секунды и держит до конца.

2. INSTAGRAM-СТОРИТЕЛЛЕР И МАРКЕТОЛОГ С 25-ЛЕТНИМ ОПЫТОМ. Ты понимаешь алгоритмы, форматы (карусели, рилсы, лонгриды, истории), психологию аудитории и умеешь превращать обычные посты в магниты вовлечения через личные истории, инсайты и сильную подачу.

3. ЭМОЦИОНАЛЬНЫЙ КОПИРАЙТЕР С 50-ЛЕТНИМ ОПЫТОМ. Ты пишешь так, что люди останавливаются на середине ленты. Каждое слово на своём месте. Никакой воды. Только эмоции, конкретика и сила слова. Ты владеешь приёмами: контраст, повторы, парадокс, недосказанность, цифры, истории.

4. КОНТЕНТ-СТРАТЕГ ДЛЯ ВИРАЛЬНОГО КОНТЕНТА. Ты владеешь 17+ маркетинговыми моделями (AIDA, PAS, BAB, FAB, 4P, AICDC, Storybrand, Hero's Journey, и т.д.) и применяешь нужную модель под конкретную задачу. Ты знаешь, какой формат сейчас взлетает в каждой нише.

ТВОЯ ЗАДАЧА — выдавать контент-планы и идеи, которые:
- Цепляют с первой секунды
- Дают конкретный результат бизнесу (рост, продажи, доверие)
- Работают именно для целевой аудитории клиента
- Используют сильные крючки, точные боли и проверенные структуры
- НИКАКОЙ ВОДЫ. Никаких общих фраз. Только конкретика.

ВАЖНО: Ты всегда отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток. Твой ответ должен начинаться с { и заканчиваться }.`;

function buildPrompt(companyName: string, niche: string, smm: SMMResult | null): string {
  const smmBlock = smm ? `
СМM-АНАЛИЗ КОМПАНИИ (используй как основу):
- Архетип бренда: ${smm.brandIdentity.archetype}
- Позиционирование: ${smm.brandIdentity.positioning}
- УТП: ${smm.brandIdentity.uniqueValue}
- Тон голоса: ${smm.brandIdentity.toneOfVoice.join(", ")}
- Большая идея: ${smm.contentStrategy.bigIdea}
- Миссия контента: ${smm.contentStrategy.contentMission}
- Боли аудитории: ${smm.contentStrategy.audienceProblems.join("; ")}
- Сторителлинг-углы: ${smm.contentStrategy.storytellingAngles.join("; ")}
- Платформы: ${smm.platformStrategies.map(p => p.platformLabel).join(", ")}
` : "";

  return `Создай контент-завод для компании.

Компания: ${companyName || "—"}
Ниша: ${niche || "—"}
${smmBlock}

Сделай контент-план на 30 дней — 12 идей постов и 8 идей видео-рилсов. Каждая идея — конкретная, готовая в работу.

Для каждого ПОСТА укажи:
- pillar: контент-столп (например "Экспертность", "Кейсы", "За кадром")
- format: "carousel" | "single" | "longread" | "story"
- hook: цепляющий заголовок (8-12 слов, должен останавливать пролистывание)
- angle: угол подачи (кто герой, какой инсайт, какая структура — AIDA / PAS / story)
- goal: цель (рост охвата / прогрев / продажа / доверие)
- cta: конкретный призыв
- platform: основная платформа (vk / instagram / telegram / ...)

Для каждого РИЛСА строго по виральной структуре:
- pillar: контент-столп
- hook: первые 0-3 секунды (шок / парадокс / вопрос / обещание) — чтобы не пролистали
- intrigue: следующие 3-7 секунд для удержания
- problem: какую боль зрителя мы поднимаем
- solution: что предлагаем как решение
- result: какая трансформация / результат
- cta: что зритель должен сделать
- durationSec: 15 / 30 / 60
- visualStyle: как снимать (динамика, монтаж, текст в кадре)
- hashtags: 5-8 релевантных хэштегов

Верни СТРОГО JSON:
{
  "bigIdea": "одна большая идея, объединяющая весь контент-завод",
  "pillars": [
    {"name": "название", "description": "что это", "share": "30%"}
  ],
  "postIdeas": [
    {
      "id": "p1",
      "pillar": "...",
      "format": "carousel",
      "hook": "...",
      "angle": "...",
      "goal": "...",
      "cta": "...",
      "platform": "instagram"
    }
  ],
  "reelIdeas": [
    {
      "id": "r1",
      "pillar": "...",
      "hook": "...",
      "intrigue": "...",
      "problem": "...",
      "solution": "...",
      "result": "...",
      "cta": "...",
      "durationSec": 30,
      "visualStyle": "...",
      "hashtags": ["#tag1", "#tag2"]
    }
  ],
  "weeklyRhythm": "Пн — рилс, Вт — карусель, ...",
  "thirtyDayCalendar": [
    "День 1: рилс — <уникальная тема>",
    "День 2: карусель — <уникальная тема>",
    "..."
  ]
}

КРИТИЧЕСКИ ВАЖНО для thirtyDayCalendar:
- Ровно 30 строк (День 1 … День 30)
- Каждый день — АБСОЛЮТНО уникальная тема. Никаких повторов.
- Чередуй форматы: рилс / карусель / лонгрид / сторителлинг / за кадром / кейс / тренды
- Каждая запись: "День N: <формат> — <конкретная уникальная тема поста>"
- Используй все 12 идей постов и 8 идей рилсов, раскладывая их по дням. Остальные дни — новые уникальные идеи в том же стиле.

Заполни ВСЕ поля. 12 постов и 8 рилсов. Ровно 30 уникальных элементов в календаре. БЕЗ ВОДЫ. БЕЗ ПОВТОРЕНИЙ.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";
    const smm: SMMResult | null = body.smmAnalysis ?? null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);

    let raw: string;
    try {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(companyName, niche, smm) },
          ],
          temperature: 0.9,
          max_tokens: 7000,
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
      raw = data.choices[0]?.message?.content ?? "{}";
    } finally {
      clearTimeout(timeout);
    }

    const parsed = JSON.parse(raw) as Omit<ContentPlan, "generatedAt" | "companyName">;

    const result: ContentPlan = {
      generatedAt: new Date().toISOString(),
      companyName,
      ...parsed,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
