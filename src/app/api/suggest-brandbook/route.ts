import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — бренд-стратег. На основе портрета целевой аудитории ты даёшь рекомендации по визуальному и вербальному стилю бренда.

Учитывай возраст, пол, доход, ценности, страхи и предпочтения аудитории. Предлагай конкретные решения, не абстрактные.

Верни СТРОГО валидный JSON без markdown:
{
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "reasoning": "почему эти цвета подходят для этой ЦА"
  },
  "aesthetics": {
    "style": "название визуального стиля (минимализм / корпоративный / тёплый / дерзкий / и т.д.)",
    "moodKeywords": ["слово1", "слово2", "слово3"],
    "avoidKeywords": ["что избегать"],
    "reasoning": "почему этот стиль"
  },
  "typography": {
    "headerFont": "рекомендуемый шрифт заголовков",
    "bodyFont": "рекомендуемый шрифт основного текста",
    "reasoning": "почему такие шрифты"
  },
  "toneOfVoice": {
    "adjectives": ["прилагательные тона: дружелюбный, экспертный и т.д."],
    "goodPhrases": ["примеры фраз которые работают для ЦА"],
    "forbiddenPhrases": ["фразы которые оттолкнут ЦА"],
    "communicationStyle": "общее описание стиля коммуникации",
    "reasoning": "почему именно такой тон"
  },
  "visualContent": {
    "photoStyle": "стиль фото (реальные / студийные / lifestyle / и т.д.)",
    "illustrations": "нужны ли иллюстрации и какие",
    "icons": "стиль иконок",
    "reasoning": "почему"
  },
  "socialMedia": {
    "bestPlatforms": ["платформы по приоритету"],
    "contentTypes": ["типы контента"],
    "postingFrequency": "рекомендуемая частота",
    "reasoning": "почему"
  },
  "summary": "2-3 предложения — краткая рекомендация по брендбуку для этой аудитории"
}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";
    const segments: Array<{
      segmentName: string;
      demographics: { age: string; genderRatio: string; income: string; lifestyle: string };
      worldview: { values: string[]; identity: string };
      topEmotions: string[];
      topFears: string[];
    }> = body.segments ?? [];

    if (segments.length === 0) {
      return NextResponse.json({ ok: false, error: "Нет данных о сегментах ЦА" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const segmentsDump = segments.map((s, i) => {
      return `Сегмент ${i + 1}: ${s.segmentName}
  Возраст: ${s.demographics.age}, Пол: ${s.demographics.genderRatio}
  Доход: ${s.demographics.income}, Лайфстайл: ${s.demographics.lifestyle}
  Ценности: ${s.worldview.values.join(", ")}
  Идентичность: ${s.worldview.identity}
  Эмоции: ${s.topEmotions.join(", ")}
  Страхи: ${s.topFears.join(", ")}`;
    }).join("\n\n");

    const userPrompt = `Компания: «${companyName}»
Ниша: ${niche}

СЕГМЕНТЫ ЦЕЛЕВОЙ АУДИТОРИИ:
${segmentsDump}

На основе этих данных предложи рекомендации по визуальному стилю и коммуникации бренда.`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const rawContent = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawContent);

    await access.log({
      endpoint: "suggest-brandbook",
      model: "gpt-4o",
      promptTokens: estimateTokens(SYSTEM_PROMPT + userPrompt),
      completionTokens: estimateTokens(rawContent),
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "suggest-brandbook", model: "gpt-4o", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
