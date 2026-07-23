/**
 * POST /api/content/video/plan
 *
 * «Режиссёр» + встроенный QC-проход для конвейера «разобранный контент →
 * вертикальное видео». Берёт уже готовый сценарий рилса (из генератора
 * рилсов или из «Разбор ролика» → «Переписать под компанию») и разбивает
 * его на монтажный план под композицию ContentReel: короткий крючок,
 * призыв к действию и английские поисковые фразы для b-roll (Pexels плохо
 * понимает русский — см. fetch-stock-videos).
 *
 * QC — не отдельный AI-вызов, а проверка плана по чек-листу виральности
 * (крючок короткий и цепляющий, CTA есть и не путается с крючком, хотя бы
 * один b-roll запрос). Если план не проходит — ОДИН повторный запрос к
 * Claude с перечислением конкретных проблем (рефлексия), иначе принимаем
 * лучшую версию с пометкой в qcNotes — пайплайн не должен падать из-за
 * стилистических придирок.
 *
 * Body: { title, scenario, voiceoverScript, companyName?, companyNiche?, brandBook? }
 * Returns: { ok, data: { hookText, ctaText, brollQueries: string[], qcNotes: string[] } }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BrandBook } from "@/lib/content-types";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — режиссёр монтажа коротких вертикальных видео (Reels/Shorts/TikTok).

Тебе дают готовый сценарий (тема + текст озвучки). Твоя задача — выделить из него ТРИ вещи для монтажа:

1. hookText — крючок для ПЕРВЫХ 2-3 секунд, крупный текст на экране. Короткий (до 60 знаков), цепляющий, на языке сценария. НЕ повторяй дословно первую фразу озвучки — это отдельный визуальный крючок, он может быть острее/короче.
2. ctaText — призыв к действию для ПОСЛЕДНИХ 3-4 секунд. Короткий (до 45 знаков), на языке сценария. Не дублирует hookText по смыслу.
3. brollQueries — 3-4 английские короткие поисковые фразы (2-4 слова каждая) для поиска стоковых видео на Pexels, которые визуально иллюстрируют содержание ролика. Конкретные, предметные (например "dentist examining patient", "modern office team meeting"), НЕ абстрактные ("business success").

Отвечай СТРОГО валидным JSON без markdown:
{"hookText":"...","ctaText":"...","brollQueries":["...","...","..."]}`;

interface PlanResult { hookText: string; ctaText: string; brollQueries: string[] }

function buildBrandHints(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.toneOfVoice?.length) lines.push(`Тон: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`НЕ использовать: ${bb.forbiddenWords.join(", ")}`);
  return lines.length ? `\nБРЕНДБУК:\n${lines.join("\n")}\n` : "";
}

async function callClaude(client: Anthropic, userMessage: string): Promise<{ raw: string; parsed: PlanResult | null }> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
  const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  try {
    return { raw, parsed: JSON.parse(cleaned) as PlanResult };
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return { raw, parsed: null };
    try { return { raw, parsed: JSON.parse(m[0]) as PlanResult }; } catch { return { raw, parsed: null }; }
  }
}

/** QC-чек-лист виральности. Возвращает список проблем (пусто = план ок). */
function validate(plan: PlanResult | null): string[] {
  if (!plan) return ["план не распарсился"];
  const issues: string[] = [];
  if (!plan.hookText?.trim()) issues.push("hookText пустой");
  else if (plan.hookText.length > 90) issues.push(`hookText слишком длинный (${plan.hookText.length} знаков, нужно до 60)`);
  if (!plan.ctaText?.trim()) issues.push("ctaText пустой");
  else if (plan.ctaText.length > 70) issues.push(`ctaText слишком длинный (${plan.ctaText.length} знаков, нужно до 45)`);
  if (plan.hookText && plan.ctaText && plan.hookText.trim() === plan.ctaText.trim()) issues.push("hookText и ctaText совпадают дословно");
  if (!Array.isArray(plan.brollQueries) || plan.brollQueries.filter(q => q?.trim()).length === 0) issues.push("нет ни одного brollQuery");
  return issues;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const title: string = (body.title ?? "").trim();
    const scenario: string = (body.scenario ?? "").trim();
    const voiceoverScript: string = (body.voiceoverScript ?? "").trim();
    const companyName: string = (body.companyName ?? "").trim();
    const companyNiche: string = (body.companyNiche ?? "").trim();
    const brandBook: BrandBook | null = body.brandBook ?? null;

    if (!scenario && !voiceoverScript) {
      return NextResponse.json({ ok: false, error: "scenario или voiceoverScript обязателен" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const client = new Anthropic({ apiKey, ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}) });

    const companyContext = companyName ? `Компания: ${companyName}${companyNiche ? ` (ниша: ${companyNiche.slice(0, 200)})` : ""}\n` : "";
    const baseMessage = `${companyContext}Название: ${title || "(без названия)"}

Текст озвучки:
${voiceoverScript || "(не указан)"}

Сценарий/раскадровка:
${scenario || "(не указан)"}
${buildBrandHints(brandBook)}
Составь монтажный план по инструкции.`;

    let { raw, parsed } = await callClaude(client, baseMessage);
    let issues = validate(parsed);

    // QC: одна попытка исправления с явным перечислением проблем (рефлексия),
    // а не молчаливый повтор того же промпта — так шанс на исправление выше.
    if (issues.length > 0) {
      const fixMessage = `${baseMessage}

Твой прошлый ответ не прошёл проверку:
${issues.map(i => `- ${i}`).join("\n")}

Исправь и верни JSON заново, строго по формату.`;
      const retry = await callClaude(client, fixMessage);
      if (retry.parsed) {
        const retryIssues = validate(retry.parsed);
        // Берём вторую попытку, если она строго не хуже первой.
        if (retryIssues.length <= issues.length) { parsed = retry.parsed; issues = retryIssues; raw = retry.raw; }
      }
    }

    if (!parsed) {
      return NextResponse.json({ ok: false, error: "AI не вернул валидный план" }, { status: 500 });
    }

    await access.log({
      endpoint: "content-video-plan",
      model: "claude-sonnet-4-5",
      promptTokens: estimateTokens(SYSTEM_PROMPT + baseMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({
      ok: true,
      data: {
        hookText: (parsed.hookText ?? "").trim().slice(0, 120) || (title || "Смотрите до конца"),
        ctaText: (parsed.ctaText ?? "").trim().slice(0, 90) || "Узнайте подробнее",
        brollQueries: (parsed.brollQueries ?? []).filter(q => q?.trim()).slice(0, 4),
        qcNotes: issues,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
