/**
 * /api/check-ai-mention
 *
 * Честная проверка: знает ли ChatGPT (и Claude) о компании?
 * Никакого coaching — запрос идёт без подсказок про бренд.
 * Возвращаем сырой ответ + флаг упоминания.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

function detectMention(response: string, brandName: string): boolean {
  const resp = response.toLowerCase();
  const brand = brandName.toLowerCase();

  // Check full name
  if (resp.includes(brand)) return true;

  // Check significant words (≥5 chars) of the brand name
  const words = brand.split(/\s+/).filter(w => w.length >= 5);
  return words.length > 0 && words.every(w => resp.includes(w));
}

export async function POST(req: Request) {
  try {
    const { companyName, niche, url } = await req.json() as {
      companyName: string;
      niche?: string;
      url?: string;
    };

    if (!companyName) {
      return NextResponse.json({ ok: false, error: "companyName required" }, { status: 400 });
    }

    const results: Array<{
      llm: string;
      query: string;
      response: string;
      mentioned: boolean;
      isReal: boolean;
    }> = [];

    const nicheCtx = niche ? ` в нише "${niche}"` : "";
    const queries = [
      `Расскажи мне о компании "${companyName}"${url ? ` (сайт ${url})` : ""}. Что ты о ней знаешь?`,
      `Какие компании${nicheCtx} ты можешь порекомендовать? Назови 5–7 лучших вариантов с кратким описанием.`,
    ];

    // ── 1. Реальный ChatGPT (если есть ключ) ──────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
      for (const query of queries) {
        try {
          const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 600,
              temperature: 0.7,
              messages: [
                // Никакого system-prompt с подсказками о бренде!
                { role: "user", content: query },
              ],
            }),
          });

          if (res.ok) {
            const json = await res.json();
            const text: string = json.choices?.[0]?.message?.content ?? "";
            results.push({
              llm: "ChatGPT",
              query,
              response: text,
              mentioned: detectMention(text, companyName),
              isReal: true,
            });
          }
        } catch {
          // skip on error
        }
      }
    }

    // ── 2. Claude — только честный запрос без биас-промпта ────────────
    // (Используем claude-haiku для скорости и дешевизны)
    for (const query of queries.slice(0, 1)) {
      try {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          messages: [{ role: "user", content: query }],
        });
        const text = (msg.content[0] as { type: string; text: string }).text;
        results.push({
          llm: "Claude",
          query,
          response: text,
          mentioned: detectMention(text, companyName),
          isReal: true,
        });
      } catch {
        // skip
      }
    }

    // ── Если совсем нет реальных данных — вернём ошибку ───────────────
    if (results.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Нет доступных AI-ключей для проверки",
      }, { status: 503 });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
