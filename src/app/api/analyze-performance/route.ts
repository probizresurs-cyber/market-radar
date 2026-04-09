import { NextResponse } from "next/server";
import type { GeneratedPost, GeneratedReel } from "@/lib/content-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — старший SMM-аналитик с 10-летним опытом.

Тебе дают сырые метрики постов и рилсов компании. Твоя задача — найти ЗАКОНОМЕРНОСТИ и дать ЖЁСТКИЕ практические рекомендации.

Не лей воды. Не пиши "рекомендуем рассмотреть возможность...". Пиши конкретно: "Делайте 3 карусели в неделю на тему X. Перестаньте делать Y — ER в 4 раза ниже среднего."

Цифры цитируй точно. Сравнивай: "Карусели дают ER 6.2% против 2.8% у одиночных постов — в 2.2 раза больше."

Возвращаешь СТРОГО валидный JSON без markdown.`;

interface AnalyzeBody {
  posts: GeneratedPost[];
  reels: GeneratedReel[];
  companyName?: string;
}

function buildPostSummary(p: GeneratedPost): string {
  const m = p.metrics;
  if (!m) return "";
  const parts = [
    `[POST] pillar=${p.pillar}`,
    `format=${p.body.includes("---") ? "carousel" : "single"}`,
    `platform=${p.platform}`,
    `hook="${p.hook.slice(0, 80)}"`,
  ];
  if (m.reach != null) parts.push(`reach=${m.reach}`);
  if (m.impressions != null) parts.push(`imp=${m.impressions}`);
  if (m.likes != null) parts.push(`likes=${m.likes}`);
  if (m.comments != null) parts.push(`com=${m.comments}`);
  if (m.shares != null) parts.push(`sh=${m.shares}`);
  if (m.saves != null) parts.push(`sv=${m.saves}`);
  if (m.clicks != null) parts.push(`clk=${m.clicks}`);
  if (m.leads != null) parts.push(`leads=${m.leads}`);
  if (m.revenue != null) parts.push(`rev=${m.revenue}`);
  if (m.adSpend != null) parts.push(`ad=${m.adSpend}`);
  return parts.join(" ");
}

function buildReelSummary(r: GeneratedReel): string {
  const m = r.metrics;
  if (!m) return "";
  const parts = [
    `[REEL] pillar=${r.pillar}`,
    `dur=${r.durationSec}s`,
    `title="${r.title.slice(0, 80)}"`,
  ];
  if (m.views != null) parts.push(`views=${m.views}`);
  if (m.reach != null) parts.push(`reach=${m.reach}`);
  if (m.likes != null) parts.push(`likes=${m.likes}`);
  if (m.comments != null) parts.push(`com=${m.comments}`);
  if (m.shares != null) parts.push(`sh=${m.shares}`);
  if (m.saves != null) parts.push(`sv=${m.saves}`);
  if (m.avgWatchTimeSec != null) parts.push(`avgWatch=${m.avgWatchTimeSec}s`);
  if (m.watchedFullPct != null) parts.push(`fullWatch=${m.watchedFullPct}%`);
  if (m.clicks != null) parts.push(`clk=${m.clicks}`);
  if (m.leads != null) parts.push(`leads=${m.leads}`);
  if (m.revenue != null) parts.push(`rev=${m.revenue}`);
  if (m.adSpend != null) parts.push(`ad=${m.adSpend}`);
  return parts.join(" ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as AnalyzeBody;
    const posts = (body.posts ?? []).filter(p => p.metrics);
    const reels = (body.reels ?? []).filter(r => r.metrics);
    const companyName = body.companyName ?? "";

    if (posts.length === 0 && reels.length === 0) {
      return NextResponse.json({ ok: false, error: "Нет ни одного поста или рилса с метриками. Сначала внесите статистику хотя бы по 3-5 публикациям." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const dataDump = [
      ...posts.map(buildPostSummary),
      ...reels.map(buildReelSummary),
    ].filter(Boolean).join("\n");

    const userPrompt = `Проанализируй данные публикаций компании ${companyName ? `«${companyName}»` : ""}.

Всего: ${posts.length} постов и ${reels.length} рилсов с метриками.

ДАННЫЕ:
${dataDump}

Верни СТРОГО JSON в формате:
{
  "summary": "1-2 предложения главного вывода",
  "topPillars": [
    { "name": "название столпа", "avgER": число (%), "totalReach": число, "why": "почему работает (1 предложение)" }
  ],
  "topFormats": [
    { "format": "carousel|single|reel-15s|reel-30s|...", "avgER": число (%), "why": "почему" }
  ],
  "topHooks": [
    { "pattern": "паттерн крючка", "examples": ["пример 1", "пример 2"], "why": "почему цепляет" }
  ],
  "underperformers": [
    { "what": "что не работает", "metric": "по какой метрике", "fix": "что делать" }
  ],
  "recommendations": [
    "конкретная рекомендация 1",
    "конкретная рекомендация 2",
    "конкретная рекомендация 3",
    "конкретная рекомендация 4",
    "конкретная рекомендация 5"
  ],
  "nextWeekPlan": [
    "пн: тип публикации + тема",
    "вт: ...",
    "ср: ...",
    "чт: ...",
    "пт: ...",
    "сб: ...",
    "вс: ..."
  ]
}

Все числа — реальные, посчитанные из данных. ER = (likes+comments+shares+saves)/(reach или views) × 100.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
      return NextResponse.json(
        { ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}");

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
