/**
 * POST /api/chat
 *
 * AI-assistant chat inside the dashboard. Has full context of the
 * company's analysis, competitors, TA, SMM data.
 *
 * Body:
 *   message:  string          — user's new message
 *   history:  ChatMessage[]   — last N previous messages (max 20)
 *   context:  DashboardContext — snapshot of user's current data
 *
 * Returns:
 *   { ok: true, message: string }
 */

import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DashboardContext {
  companyName?: string;
  companyUrl?: string;
  companyScore?: number;
  companyDescription?: string;
  niche?: string;

  // Recommendations (top high-priority)
  topRecommendations?: Array<{ text: string; effect: string; priority: string; category: string }>;

  // SEO
  seoKeywords?: string[];
  seoTraffic?: string;
  seoDomainAge?: string;
  seoIssues?: string[];

  // Categories (SEO, Social, Content, HR, Tech scores)
  categories?: Array<{ name: string; score: number; icon: string }>;

  // Competitors
  competitors?: Array<{ name: string; url: string; score: number }>;

  // TA summary
  taSummary?: string;
  taSegments?: Array<{ name: string; isGolden: boolean; mainProblems: string[] }>;

  // SMM summary
  smmStrategy?: string;
  smmPlatforms?: string[];

  // Business
  businessRevenue?: string;
  businessEmployees?: string;
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: DashboardContext): string {
  const lines: string[] = [
    `Ты — AI-ассистент платформы MarketRadar. Ты помогаешь пользователю анализировать данные его компании и отвечаешь на вопросы по маркетингу, конкурентам, аудитории и стратегии.`,
    `Ты разговариваешь на русском языке. Отвечаешь конкретно, без воды — как опытный маркетолог-консультант.`,
    ``,
    `=== ДАННЫЕ КОМПАНИИ ПОЛЬЗОВАТЕЛЯ ===`,
  ];

  if (ctx.companyName) lines.push(`Компания: ${ctx.companyName}`);
  if (ctx.companyUrl) lines.push(`Сайт: ${ctx.companyUrl}`);
  if (ctx.companyScore !== undefined) lines.push(`Общий рейтинг MarketRadar: ${ctx.companyScore}/100`);
  if (ctx.companyDescription) lines.push(`Описание: ${ctx.companyDescription}`);
  if (ctx.niche) lines.push(`Ниша: ${ctx.niche}`);

  if (ctx.categories && ctx.categories.length > 0) {
    lines.push(`\nОценки по категориям:`);
    ctx.categories.forEach(cat => lines.push(`  ${cat.icon} ${cat.name}: ${cat.score}/100`));
  }

  if (ctx.businessRevenue) lines.push(`\nВыручка (по данным): ${ctx.businessRevenue}`);
  if (ctx.businessEmployees) lines.push(`Сотрудников: ${ctx.businessEmployees}`);

  if (ctx.seoDomainAge) lines.push(`\nВозраст домена: ${ctx.seoDomainAge}`);
  if (ctx.seoTraffic) lines.push(`Трафик (оценка): ${ctx.seoTraffic}`);

  if (ctx.seoKeywords && ctx.seoKeywords.length > 0) {
    lines.push(`Ключевые слова: ${ctx.seoKeywords.slice(0, 10).join(", ")}`);
  }

  if (ctx.seoIssues && ctx.seoIssues.length > 0) {
    lines.push(`\nSEO-проблемы:`);
    ctx.seoIssues.slice(0, 5).forEach(issue => lines.push(`  • ${issue}`));
  }

  if (ctx.topRecommendations && ctx.topRecommendations.length > 0) {
    lines.push(`\nТоп-рекомендации (AI):`);
    ctx.topRecommendations.slice(0, 8).forEach(r => {
      lines.push(`  [${r.priority.toUpperCase()}] ${r.text} → ${r.effect}`);
    });
  }

  if (ctx.competitors && ctx.competitors.length > 0) {
    lines.push(`\nКонкуренты (отслеживаемые):`);
    ctx.competitors.slice(0, 8).forEach(comp => {
      lines.push(`  • ${comp.name} (${comp.url}) — рейтинг ${comp.score}/100`);
    });
  }

  if (ctx.taSummary) {
    lines.push(`\nАнализ ЦА:`);
    lines.push(ctx.taSummary);
  }

  if (ctx.taSegments && ctx.taSegments.length > 0) {
    lines.push(`\nСегменты ЦА:`);
    ctx.taSegments.slice(0, 4).forEach(seg => {
      const golden = seg.isGolden ? " ⭐ ЗОЛОТОЙ" : "";
      lines.push(`  ${seg.name}${golden}`);
      if (seg.mainProblems.length > 0) {
        lines.push(`    Боли: ${seg.mainProblems.slice(0, 2).join("; ")}`);
      }
    });
  }

  if (ctx.smmStrategy) {
    lines.push(`\nСММ-стратегия: ${ctx.smmStrategy}`);
  }

  if (ctx.smmPlatforms && ctx.smmPlatforms.length > 0) {
    lines.push(`Платформы: ${ctx.smmPlatforms.join(", ")}`);
  }

  lines.push(`\n=== КОНЕЦ ДАННЫХ ===`);
  lines.push(`\nИспользуй эти данные при ответах. Если данных нет — говори об этом честно. Не выдумывай цифры.`);
  lines.push(`Если пользователь спрашивает про конкурентов, ЦА или стратегию — опирайся на реальные данные выше.`);
  lines.push(`Будь лаконичен: ответы до 300-400 слов, если не просят развёрнуто.`);

  return lines.join("\n");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const message: string = (body.message ?? "").trim();
    const history: ChatMessage[] = (body.history ?? []).slice(-20); // last 20 msgs max
    const ctx: DashboardContext = body.context ?? {};

    if (!message) {
      return NextResponse.json({ ok: false, error: "Сообщение не может быть пустым" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    const anthropic = new Anthropic({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    // Build messages array from history + new message
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: buildSystemPrompt(ctx),
      messages,
    });

    const reply = (response.content[0] as { type: string; text: string }).text;

    await access.log({
      endpoint: "/api/chat",
      model: "claude-sonnet-4-6",
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      durationMs: 0,
    });

    return NextResponse.json({ ok: true, message: reply });
  } catch (err) {
    console.error("[/api/chat]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
