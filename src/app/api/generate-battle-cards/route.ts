import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BattleCardObjection {
  objection: string;       // типичное возражение клиента в пользу конкурента
  counter: string;         // наш ответный аргумент
}

export interface BattleCardPricing {
  competitorRange: string; // "от 5 000 ₽/мес"
  ourRange: string;        // "от 3 900 ₽/мес"
  positioningNote: string; // краткий комментарий о позиционировании
}

export interface BattleCard {
  competitorName: string;
  competitorUrl: string;
  competitorScore: number;
  strengths: string[];         // 3 сильных стороны конкурента (vs нас)
  weaknesses: string[];        // 3 слабых стороны конкурента (vs нас)
  objections: BattleCardObjection[]; // 2-3 возражения + контраргументы
  pricing: BattleCardPricing;
  migrationTrigger: string;    // когда клиент уходит от конкурента к нам
  winCondition: string;        // ключевое условие победы в сделке
  talkingPoints: string[];     // 3 фразы для продажника (готовые скрипты)
  riskFactors: string[];       // 1-2 риска — когда мы проигрываем
}

export interface BattleCardsResult {
  generatedAt: string;
  myCompanyName: string;
  niche: string;
  cards: BattleCard[];
  executiveSummary: string;    // 2-3 предложения — общая расстановка сил
}

// ─── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM = `Ты — эксперт по конкурентным продажам (competitive intelligence) и battle card‑методологии.
Твоя задача — создать практические карточки конкурентного боя (battle cards) для отдела продаж и маркетинга.

Battle card — инструмент, который помогает менеджеру по продажам:
• быстро найти слабые места конкурента
• парировать возражения клиента ("а у конкурента дешевле / лучше / надёжнее")
• знать точный момент, когда клиент созрел уйти от конкурента к нам
• говорить конкретными скриптами, а не общими фразами

ПРАВИЛА:
1. Каждый battle card должен быть конкретным и боевым — никакой воды.
2. Слабые стороны конкурента — это РЕАЛЬНЫЕ боли их клиентов, а не придуманные.
3. Аргументы должны звучать убедительно, не как реклама.
4. Скрипты (talkingPoints) — живые фразы, которые продажник произнесёт вслух.
5. Ценовое позиционирование — честное, без фантастики.

ВАЖНО: Отвечай ТОЛЬКО валидным JSON без markdown-обёрток. Начинай с { и заканчивай }.`;

function buildPrompt(
  myName: string,
  myUrl: string,
  myScore: number,
  niche: string,
  competitors: Array<{ name: string; url: string; score: number; description?: string; strengths?: string[]; weaknesses?: string[] }>
): string {
  return `Создай battle cards для компании "${myName}" (${myUrl}) в нише: ${niche}.
Оценка нашей компании по платформе MarketRadar: ${myScore}/100.

Конкуренты для battle card:
${competitors.map((c, i) => `${i + 1}. ${c.name} (${c.url}), оценка: ${c.score}/100${c.description ? `\n   Описание: ${c.description}` : ""}${c.strengths?.length ? `\n   Сильные стороны (из анализа): ${c.strengths.join("; ")}` : ""}${c.weaknesses?.length ? `\n   Слабые стороны (из анализа): ${c.weaknesses.join("; ")}` : ""}`).join("\n\n")}

Верни СТРОГО валидный JSON:
{
  "generatedAt": "ISO дата",
  "myCompanyName": "${myName}",
  "niche": "${niche}",
  "executiveSummary": "2-3 предложения общей расстановки сил на рынке",
  "cards": [
    {
      "competitorName": "название",
      "competitorUrl": "url",
      "competitorScore": число,
      "strengths": [
        "Конкретная сильная сторона конкурента (как они выигрывают у нас)",
        "...",
        "..."
      ],
      "weaknesses": [
        "Конкретная слабая сторона конкурента (их боль, которую знают их клиенты)",
        "...",
        "..."
      ],
      "objections": [
        {
          "objection": "У вас дороже / у конкурента X дешевле",
          "counter": "Конкретный встречный аргумент с цифрами или фактами"
        },
        {
          "objection": "Второе типичное возражение",
          "counter": "Наш ответ"
        },
        {
          "objection": "Третье возражение",
          "counter": "Наш ответ"
        }
      ],
      "pricing": {
        "competitorRange": "примерный диапазон цен конкурента",
        "ourRange": "наш диапазон цен",
        "positioningNote": "1 предложение о разнице в ценовом позиционировании"
      },
      "migrationTrigger": "Конкретный момент / ситуация, когда клиент уходит от конкурента к нам",
      "winCondition": "Главное условие победы над этим конкурентом в сделке",
      "talkingPoints": [
        "Живая фраза для продажника #1",
        "Живая фраза для продажника #2",
        "Живая фраза для продажника #3"
      ],
      "riskFactors": [
        "Ситуация, когда мы проигрываем этому конкуренту",
        "Второй фактор риска (если есть)"
      ]
    }
  ]
}

Количество карточек: ${competitors.length} (по одной на каждого конкурента).`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const myCompany: { name: string; url: string; score: number; niche?: string } = body.myCompany;
    const competitors: Array<{
      name: string; url: string; score: number;
      description?: string; strengths?: string[]; weaknesses?: string[];
    }> = body.competitors ?? [];

    if (!myCompany?.name) {
      return NextResponse.json({ ok: false, error: "myCompany.name обязателен" }, { status: 400 });
    }
    if (competitors.length === 0) {
      return NextResponse.json({ ok: false, error: "Список конкурентов пуст" }, { status: 400 });
    }

    const niche = myCompany.niche ?? "не указана";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    const anthropic = new Anthropic({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    const prompt = buildPrompt(
      myCompany.name,
      myCompany.url,
      myCompany.score,
      niche,
      competitors,
    );

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ ok: false, error: "AI вернул невалидный JSON" }, { status: 500 });
    }

    const data: BattleCardsResult = JSON.parse(raw.slice(start, end + 1));

    // Stamp generatedAt server-side
    data.generatedAt = new Date().toISOString();

    await access.log({
      endpoint: "/api/generate-battle-cards",
      model: "claude-sonnet-4-6",
      promptTokens: msg.usage.input_tokens,
      completionTokens: msg.usage.output_tokens,
      durationMs: 0,
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[generate-battle-cards]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
