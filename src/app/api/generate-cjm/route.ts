import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TAResult } from "@/lib/ta-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

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
    .replace(/^\uFEFF/, "") // strip BOM
    .trim();

  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");

  const candidate = stripped.slice(start);

  // 1. Try clean parse of full slice up to last }
  const end = candidate.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(candidate.slice(0, end + 1)); } catch { /* fall through */ }
  }

  // 2. Walk backward from end to find last valid closing brace
  for (let i = candidate.length - 1; i > 0; i--) {
    if (candidate[i] === "}") {
      try { return JSON.parse(candidate.slice(0, i + 1)); } catch { /* continue */ }
    }
  }

  // 3. Truncated JSON recovery — close any open arrays/objects
  try {
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastGoodPos = 0;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") { depth++; }
      if (ch === "}" || ch === "]") { depth--; if (depth === 0) lastGoodPos = i; }
    }
    if (lastGoodPos > 0) {
      try { return JSON.parse(candidate.slice(0, lastGoodPos + 1)); } catch { /* fall through */ }
    }
    // Try auto-closing
    const closing = "}]".repeat(10);
    for (let trim = candidate.length - 1; trim > 10; trim--) {
      if (candidate[trim] === "," || candidate[trim] === " ") continue;
      const attempt = candidate.slice(0, trim + 1) + closing;
      try { return JSON.parse(attempt); } catch { /* continue */ }
    }
  } catch { /* fall through */ }

  throw new Error(`Failed to parse AI response as JSON. Preview: ${stripped.slice(0, 200)}`);
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

  return `Создай CJM для бизнеса. Отвечай ТОЛЬКО JSON объектом, без markdown и пояснений.

КОМПАНИЯ: ${companyName}
НИША: ${niche}${companySection}${taSection}

Верни строго этот JSON (7 этапов, каждое поле обязательно):
{"companyName":"${companyName}","stages":[{"id":"awareness","name":"Осведомлённость","emoji":"👁️","duration":"1–7 дней","goal":"...","emotion":"...","emotionValence":"neutral","touchpoints":[{"channel":"...","action":"...","icon":"📱"},{"channel":"...","action":"...","icon":"🔍"},{"channel":"...","action":"...","icon":"📢"}],"customerThoughts":["...","...","..."],"painPoints":["...","..."],"opportunities":["...","..."],"kpi":"..."},{"id":"interest",...},{"id":"consideration",...},{"id":"decision",...},{"id":"purchase",...},{"id":"retention",...},{"id":"loyalty",...}]}

emotionValence: positive|neutral|negative|mixed. Специфика ниши обязательна.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
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

    const client = new Anthropic({ apiKey, baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com" });

    const userPrompt = buildPrompt(companyName, niche, taData, companyData);

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system:
        "Ты — эксперт по Customer Journey Map. Отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток, комментариев и пояснений. Твой ответ должен начинаться с { и заканчиваться }.",
      stream: true,
    });

    let rawText = "";
    for await (const event of streamResponse) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        rawText += event.delta.text;
      }
    }
    if (!rawText) {
      return NextResponse.json(
        { ok: false, error: "Пустой ответ от Claude" },
        { status: 500 }
      );
    }

    const parsed = extractJson(rawText) as { stages?: unknown[] };

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

    await access.log({
      endpoint: "generate-cjm",
      model: "claude-sonnet-4-6",
      promptTokens: estimateTokens(userPrompt),
      completionTokens: estimateTokens(rawText),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "generate-cjm", model: "claude-sonnet-4-6", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
