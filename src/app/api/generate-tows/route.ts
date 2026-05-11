/**
 * POST /api/generate-tows
 *
 * Принимает SwotReport (точнее — компактный snapshot S/W/O/T) и
 * генерирует TOWS-матрицу: 4 квадранта стратегий.
 *
 *   SO (maxi-maxi):  использовать сильные стороны для захвата возможностей
 *   ST (maxi-mini):  использовать сильные стороны для отражения угроз
 *   WO (mini-maxi):  использовать возможности для устранения слабостей
 *   WT (mini-mini):  оборонительная стратегия — минимизировать оба
 *
 * Закрывает P0-пробел из аудита: «нет TOWS-матрицы — половина ценности
 * SWOT отсутствует».
 *
 * Body: { reportId?: string, items: SwotItems, companyName?: string }
 * Returns: { ok, tows: TowsMatrix }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import type { SwotItems } from "@/lib/swot";

export const runtime = "nodejs";
export const maxDuration = 90;

export interface TowsStrategy {
  /** Короткое название стратегии (3-6 слов). */
  title: string;
  /** Опирающиеся S/W пункты (цитаты из items). */
  fromInternal: string[];
  /** Опирающиеся O/T пункты. */
  fromExternal: string[];
  /** Конкретное действие на 30-60 дней (1-2 предложения). */
  action: string;
  /** Приоритет: 1 (наивысший) — 5. */
  priority: number;
}

export interface TowsQuadrant {
  label: string;       // "SO" / "ST" / "WO" / "WT"
  strategy: string;    // одно-предложное описание квадранта
  strategies: TowsStrategy[];
}

export interface TowsMatrix {
  so: TowsQuadrant;
  st: TowsQuadrant;
  wo: TowsQuadrant;
  wt: TowsQuadrant;
  /** Общий стратегический вывод 2-3 предложения. */
  synthesis: string;
  generatedAt: string;
}

const SYSTEM_PROMPT = `Ты — стратегический консультант уровня McKinsey/BCG. Тебе дают результат SWOT-анализа.

Твоя работа — сгенерировать TOWS-матрицу: 4 квадранта стратегий, где каждый квадрант
пересекает один из факторов:

— **SO (maxi-maxi)** — как использовать СИЛЬНЫЕ стороны для захвата ВОЗМОЖНОСТЕЙ
— **ST (maxi-mini)** — как использовать СИЛЬНЫЕ стороны для отражения УГРОЗ
— **WO (mini-maxi)** — как использовать ВОЗМОЖНОСТИ для устранения СЛАБОСТЕЙ
— **WT (mini-mini)** — оборонительная — как минимизировать СЛАБОСТИ И УГРОЗЫ

В каждый квадрант выдай 2-3 конкретных стратегии. Каждая стратегия:
— title: 3-6 слов
— fromInternal: 1-2 цитаты из S или W
— fromExternal: 1-2 цитаты из O или T
— action: что сделать за 30-60 дней (одно действие, конкретно)
— priority: 1-5 (1 — самый приоритет)

Стиль: уверенный, прямой, без воды. Без эмодзи и markdown.

Ответ — СТРОГО валидный JSON.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const items = body.items as SwotItems | undefined;
    const companyName: string = body.companyName ?? "Компания";
    if (!items || !items.strengths || !items.opportunities) {
      return NextResponse.json(
        { ok: false, error: "Не передан items (SwotItems)" },
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

    const userMessage = `Компания: ${companyName}

S (сильные стороны):
${items.strengths.map((s, i) => `${i + 1}. ${s}`).join("\n")}

W (слабые стороны):
${items.weaknesses.map((s, i) => `${i + 1}. ${s}`).join("\n")}

O (возможности):
${items.opportunities.map((s, i) => `${i + 1}. ${s}`).join("\n")}

T (угрозы):
${items.threats.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Сгенерируй TOWS-матрицу. Верни СТРОГО JSON:
{
  "so": {
    "label": "SO",
    "strategy": "Одно-предложное описание стратегии квадранта",
    "strategies": [
      {
        "title": "Название стратегии",
        "fromInternal": ["цитата S1", "цитата S2"],
        "fromExternal": ["цитата O1"],
        "action": "Конкретное действие на 30-60 дней",
        "priority": 1
      }
    ]
  },
  "st": { ... },
  "wo": { ... },
  "wt": { ... },
  "synthesis": "Общий стратегический вывод 2-3 предложения"
}`;

    const model = "claude-sonnet-4-5";
    const message = await client.messages.create({
      model,
      max_tokens: 4500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: Omit<TowsMatrix, "generatedAt">;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ ok: false, error: "AI вернул не-JSON" }, { status: 500 });
      }
      parsed = JSON.parse(m[0]);
    }

    const tows: TowsMatrix = {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };

    await access.log({
      endpoint: "generate-tows",
      model,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({ ok: true, tows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
