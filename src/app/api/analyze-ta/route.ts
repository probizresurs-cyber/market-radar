import { NextResponse } from "next/server";
import type { TAResult } from "@/lib/ta-types";

const SYSTEM_PROMPT = `Ты — лучший в мире маркетинговый аналитик, специализирующийся на глубоком анализе целевой аудитории.

Ты безупречно понимаешь поведение покупателей: их цели, нужды, потребности, страхи, эмоциональные мотивы к покупке, ограничения и возражения. Ты знаешь, что люди покупают руководствуясь эмоциями, а потом оправдывают логикой.

Ты филигранно сегментируешь аудитории, выделяя "золотые" сегменты — тех, кто готов купить прямо сейчас. Ты говоришь языком клиента, проникая в суть их мыслей и эмоций.

ВАЖНО: Ты всегда отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток и пояснительного текста. Твой ответ должен начинаться с { и заканчиваться }.`;

function buildPrompt(companyName: string, companyUrl: string, niche: string, extraContext: string): string {
  return `Проведи глубокий анализ целевой аудитории для следующего бизнеса:

Компания: ${companyName}
Сайт: ${companyUrl}
Ниша / продукт / услуга: ${niche}
${extraContext ? `Дополнительный контекст: ${extraContext}` : ""}

Создай 3 сегмента ЦА (один "золотой" — готов купить прямо сейчас, два дополнительных).

Верни результат строго в JSON формате по следующей схеме:
{
  "niche": "краткое название ниши",
  "summary": "2-3 предложения об аудитории в целом",
  "segments": [
    {
      "id": 1,
      "segmentName": "название сегмента",
      "isGolden": true,
      "goldenReason": "почему этот сегмент приоритетный",
      "demographics": {
        "personaName": "имя персоны, возраст",
        "age": "возрастной диапазон",
        "genderRatio": "соотношение полов",
        "income": "средний доход",
        "lifestyle": "краткое описание образа жизни (2-3 предложения)"
      },
      "worldview": {
        "hopesAndDreams": "надежды и мечты (2-3 предложения)",
        "winsAndLosses": "победы и неудачи (2-3 предложения)",
        "coreBeliefs": "основные убеждения о жизни (3-4 предложения)",
        "values": ["ценность 1", "ценность 2", "ценность 3", "ценность 4"],
        "identity": "основная идентичность не связанная с продуктом",
        "shortDescription": "краткое описание образа (3-4 предложения на языке клиента)"
      },
      "mainProblems": ["проблема 1 (подробно)", "проблема 2 (подробно)", "проблема 3 (подробно)"],
      "topEmotions": ["эмоция 1", "эмоция 2", "эмоция 3", "эмоция 4", "эмоция 5"],
      "topFears": [
        "страх 1 — детально, тот что не признают вслух",
        "страх 2 — детально",
        "страх 3 — детально",
        "страх 4 — детально",
        "страх 5 — детально"
      ],
      "fearRelationshipEffects": [
        "как страх 1 влияет на конкретные отношения — детально и эмоционально",
        "как страх 2 влияет...",
        "как страх 3 влияет...",
        "как страх 4 влияет...",
        "как страх 5 влияет..."
      ],
      "painfulPhrases": [
        {"text": "болезненная фраза которую слышит клиент", "from": "от кого (партнёр, коллега, родитель и т.д.)"},
        {"text": "фраза 2", "from": "от кого"},
        {"text": "фраза 3", "from": "от кого"},
        {"text": "фраза 4", "from": "от кого"},
        {"text": "фраза 5", "from": "от кого"}
      ],
      "painSituations": [
        "конкретная болевая ситуация 1 — жизненная, специфичная",
        "ситуация 2",
        "ситуация 3",
        "ситуация 4",
        "ситуация 5"
      ],
      "obstacles": [
        "препятствие 1 на пути к решению проблемы",
        "препятствие 2",
        "препятствие 3"
      ],
      "myths": [
        "миф 1 который мешает действовать",
        "миф 2",
        "миф 3"
      ],
      "pastSolutions": [
        {
          "name": "название решения которое пробовали",
          "liked": "что нравилось",
          "disliked": "что не нравилось",
          "quote": "цитата на языке ЦА о том почему не сработало"
        }
      ],
      "dontWantToDo": [
        {"text": "что не хочет делать", "quote": "внутренний монолог клиента"},
        {"text": "2", "quote": "цитата"},
        {"text": "3", "quote": "цитата"},
        {"text": "4", "quote": "цитата"},
        {"text": "5", "quote": "цитата"}
      ],
      "magicTransformation": "описание волшебной трансформации — как выглядит жизнь после решения проблемы (4-5 предложений)",
      "transformationImpact": [
        "как трансформация повлияет на отношения 1",
        "на отношения 2",
        "на самооценку",
        "на социальный статус",
        "на ежедневную жизнь"
      ],
      "postTransformationQuotes": [
        {"text": "что скажет поддерживающий человек после трансформации", "from": "кто"},
        {"text": "что скажет скептик который был вынужден признать результат", "from": "кто"},
        {"text": "цитата 3", "from": "кто"},
        {"text": "цитата 4", "from": "кто"}
      ],
      "marketSuccessConditions": [
        "что рынок должен увидеть чтобы считать продукт успешным 1",
        "условие 2",
        "условие 3"
      ],
      "mustLetGo": "что рынок теряет отказываясь от своей проблемы — психологическое удовлетворение от боли (2-3 предложения)",
      "whoBlamedForProblem": [
        "кого винит в проблеме 1",
        "кого винит 2",
        "кого винит 3"
      ],
      "topObjections": [
        "возражение 1 (конкретное)",
        "возражение 2",
        "возражение 3",
        "возражение 4",
        "возражение 5"
      ]
    }
  ]
}

Заполни все поля максимально детально, используй живой язык клиента. Создай ровно 3 сегмента: первый isGolden=true, остальные isGolden=false.`;
}

export async function POST(req: Request) {
  try {
    const { companyName, companyUrl, niche, extraContext } = await req.json();

    if (!niche?.trim()) {
      return NextResponse.json({ ok: false, error: "Укажите нишу / описание продукта" }, { status: 400 });
    }

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
            { role: "user", content: buildPrompt(companyName ?? "", companyUrl ?? "", niche, extraContext ?? "") },
          ],
          temperature: 0.85,
          max_tokens: 7000,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      raw = data.choices[0]?.message?.content ?? "{}";
    } finally {
      clearTimeout(timeout);
    }

    const parsed = JSON.parse(raw) as Omit<TAResult, "generatedAt" | "companyName" | "companyUrl">;

    const result: TAResult = {
      generatedAt: new Date().toISOString(),
      companyName: companyName ?? "",
      companyUrl: companyUrl ?? "",
      ...parsed,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
