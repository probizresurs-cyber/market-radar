import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TAResult } from "@/lib/ta-types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CJMTouchpoint {
  channel: string;
  action: string;
  icon: string;
}

export interface CJMStage {
  id:
    | "awareness"
    | "interest"
    | "consideration"
    | "decision"
    | "purchase"
    | "retention"
    | "loyalty";
  name: string;
  emoji: string;
  duration: string;
  goal: string;
  emotion: string;
  emotionValence: "positive" | "neutral" | "negative" | "mixed";
  touchpoints: CJMTouchpoint[];
  customerThoughts: string[];
  painPoints: string[];
  opportunities: string[];
  kpi: string;
}

export interface CJMResult {
  generatedAt: string;
  companyName: string;
  stages: CJMStage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");

  const end = stripped.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  // Truncated response — walk backward to find last valid closing brace
  const partial = stripped.slice(start);
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try {
        return JSON.parse(partial.slice(0, i + 1));
      } catch {
        // continue
      }
    }
  }

  throw new Error("Failed to parse AI response as JSON");
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  companyName: string,
  niche: string,
  taData?: TAResult,
  companyData?: { description: string; url: string }
): string {
  const taSection = taData
    ? `
ДАННЫЕ О ЦЕЛЕВОЙ АУДИТОРИИ:
- Общее описание ЦА: ${taData.summary}
- Сегменты:
${taData.segments
  .map(
    (s) => `  • ${s.segmentName}${s.isGolden ? " (золотой)" : ""}
    Демография: ${s.demographics.age}, ${s.demographics.genderRatio}, доход ${s.demographics.income}
    Главные проблемы: ${s.mainProblems.slice(0, 3).join("; ")}
    Топ страхи: ${s.topFears.slice(0, 3).join("; ")}
    Возражения: ${s.topObjections.slice(0, 3).join("; ")}
    Эмоции: ${s.topEmotions.slice(0, 5).join(", ")}`
  )
  .join("\n")}`
    : "";

  const companySection =
    companyData?.description || companyData?.url
      ? `
ДАННЫЕ О КОМПАНИИ:
${companyData.url ? `- Сайт: ${companyData.url}` : ""}
${companyData.description ? `- Описание: ${companyData.description}` : ""}`
      : "";

  return `Ты — эксперт по Customer Journey Map и пользовательскому опыту для российского рынка.

Создай детальную, реалистичную и специфичную для данного бизнеса карту пути клиента (CJM).
НЕ используй шаблонные и общие формулировки — каждый пункт должен отражать конкретную нишу.

КОМПАНИЯ: ${companyName}
НИША / ПРОДУКТ / УСЛУГА: ${niche}
${companySection}
${taSection}

Построй CJM из ровно 7 этапов в следующем порядке:
1. awareness    — Осведомлённость
2. interest     — Интерес
3. consideration — Рассмотрение
4. decision     — Решение
5. purchase     — Покупка
6. retention    — Удержание
7. loyalty      — Лояльность

Для каждого этапа учитывай:
- Специфику ниши «${niche}» — какие именно каналы, действия и мысли актуальны именно для этого рынка
- Реальные точки контакта для данного типа бизнеса (не абстрактные «соцсети», а конкретные платформы и форматы)
- Психологию покупателя из целевой аудитории — что реально думает и чувствует клиент
- Конкретные барьеры и возможности именно в этой нише

Верни СТРОГО валидный JSON без markdown, комментариев и пояснений:
{
  "stages": [
    {
      "id": "awareness",
      "name": "Осведомлённость",
      "emoji": "👁️",
      "duration": "1–14 дней",
      "goal": "цель клиента на этом этапе — конкретная и специфичная для ниши",
      "emotion": "доминирующая эмоция (одно слово или короткая фраза)",
      "emotionValence": "neutral",
      "touchpoints": [
        { "channel": "название канала", "action": "конкретное действие клиента", "icon": "эмодзи" },
        { "channel": "...", "action": "...", "icon": "..." }
      ],
      "customerThoughts": [
        "конкретная мысль клиента на живом языке 1",
        "мысль 2",
        "мысль 3"
      ],
      "painPoints": [
        "конкретный барьер/препятствие 1",
        "барьер 2"
      ],
      "opportunities": [
        "что компания может сделать для улучшения опыта 1",
        "возможность 2",
        "возможность 3"
      ],
      "kpi": "ключевая метрика для отслеживания этого этапа"
    }
  ]
}

Требования к качеству:
- Каждый этап: минимум 3 точки контакта, 3 мысли клиента, 2 болевые точки, 3 возможности
- emotionValence: "positive" | "neutral" | "negative" | "mixed"
- Мысли клиента — живым разговорным языком, от первого лица
- KPI — конкретная измеримая метрика (не абстрактная "вовлечённость")
- Иконки (icon) — актуальные эмодзи, отражающие канал
- Продолжительность (duration) — реалистичная для данной ниши, например "1–7 дней", "2–4 недели", "3–6 месяцев"

Ответ должен начинаться с { и заканчиваться }.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const companyName: string = (body.companyName ?? "").toString().trim();
    const niche: string = (body.niche ?? "").toString().trim();
    const taData: TAResult | undefined = body.taData ?? undefined;
    const companyData:
      | { description: string; url: string }
      | undefined = body.companyData ?? undefined;

    if (!companyName) {
      return NextResponse.json(
        { ok: false, error: "Укажите название компании" },
        { status: 400 }
      );
    }

    if (!niche) {
      return NextResponse.json(
        { ok: false, error: "Укажите нишу / описание продукта или услуги" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY не настроен на сервере" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const userPrompt = buildPrompt(companyName, niche, taData, companyData);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system:
        "Ты — эксперт по Customer Journey Map. Отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток, комментариев и пояснений. Твой ответ должен начинаться с { и заканчиваться }.",
    });

    const rawContent = message.content[0];
    if (!rawContent || rawContent.type !== "text") {
      return NextResponse.json(
        { ok: false, error: "Пустой ответ от Claude" },
        { status: 500 }
      );
    }

    const parsed = extractJson(rawContent.text) as { stages?: unknown[] };

    if (!Array.isArray(parsed?.stages) || parsed.stages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Claude вернул некорректную структуру CJM" },
        { status: 500 }
      );
    }

    // Validate and normalise each stage
    const stageIds = [
      "awareness",
      "interest",
      "consideration",
      "decision",
      "purchase",
      "retention",
      "loyalty",
    ] as const;

    const stageNames: Record<string, string> = {
      awareness: "Осведомлённость",
      interest: "Интерес",
      consideration: "Рассмотрение",
      decision: "Решение",
      purchase: "Покупка",
      retention: "Удержание",
      loyalty: "Лояльность",
    };

    const stageEmojis: Record<string, string> = {
      awareness: "👁️",
      interest: "💡",
      consideration: "🔍",
      decision: "⚖️",
      purchase: "🛒",
      retention: "🔄",
      loyalty: "❤️",
    };

    const stages: CJMStage[] = (parsed.stages as Record<string, unknown>[]).map(
      (s, idx) => {
        const id = (
          typeof s.id === "string" && stageIds.includes(s.id as CJMStage["id"])
            ? s.id
            : stageIds[idx] ?? "awareness"
        ) as CJMStage["id"];

        const valence = s.emotionValence as string;
        const emotionValence: CJMStage["emotionValence"] = [
          "positive",
          "neutral",
          "negative",
          "mixed",
        ].includes(valence)
          ? (valence as CJMStage["emotionValence"])
          : "neutral";

        const touchpoints: CJMTouchpoint[] = Array.isArray(s.touchpoints)
          ? (s.touchpoints as Record<string, unknown>[]).map((t) => ({
              channel:
                typeof t.channel === "string" ? t.channel : String(t.channel ?? ""),
              action:
                typeof t.action === "string" ? t.action : String(t.action ?? ""),
              icon: typeof t.icon === "string" ? t.icon : "📌",
            }))
          : [];

        const toStringArray = (v: unknown): string[] =>
          Array.isArray(v)
            ? (v as unknown[]).map((x) => String(x))
            : typeof v === "string"
            ? [v]
            : [];

        return {
          id,
          name:
            typeof s.name === "string" && s.name.trim()
              ? s.name.trim()
              : stageNames[id] ?? id,
          emoji:
            typeof s.emoji === "string" && s.emoji.trim()
              ? s.emoji.trim()
              : stageEmojis[id] ?? "📍",
          duration:
            typeof s.duration === "string" && s.duration.trim()
              ? s.duration.trim()
              : "—",
          goal:
            typeof s.goal === "string" && s.goal.trim()
              ? s.goal.trim()
              : "—",
          emotion:
            typeof s.emotion === "string" && s.emotion.trim()
              ? s.emotion.trim()
              : "—",
          emotionValence,
          touchpoints,
          customerThoughts: toStringArray(s.customerThoughts),
          painPoints: toStringArray(s.painPoints),
          opportunities: toStringArray(s.opportunities),
          kpi:
            typeof s.kpi === "string" && s.kpi.trim()
              ? s.kpi.trim()
              : "—",
        };
      }
    );

    const result: CJMResult = {
      generatedAt: new Date().toISOString(),
      companyName,
      stages,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
