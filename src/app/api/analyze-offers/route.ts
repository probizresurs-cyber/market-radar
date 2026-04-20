import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — маркетинговый аналитик. Тебе дают URL сайта и краткое описание компании.

Проанализируй офферы (предложения / услуги / товары) этой компании с сайта.

Верни СТРОГО валидный JSON без markdown:
{
  "companyName": "название",
  "offers": [
    {
      "title": "название оффера/услуги",
      "description": "краткое описание",
      "price": "цена если указана, иначе пустая строка",
      "uniqueSellingPoint": "чем выделяется это предложение",
      "targetAudience": "на кого направлено"
    }
  ],
  "mainValueProposition": "главное ценностное предложение компании",
  "pricingStrategy": "стратегия ценообразования (низкие цены / премиум / средний сегмент)",
  "strengths": ["сильные стороны офферов"],
  "weaknesses": ["слабые стороны офферов"],
  "missingOffers": ["что стоило бы добавить в линейку"]
}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const companyUrl: string = body.companyUrl ?? "";
    const companyDescription: string = body.companyDescription ?? "";

    if (!companyUrl.trim()) {
      return NextResponse.json({ ok: false, error: "URL компании не передан" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // First, try to fetch the website to give GPT real data
    let siteContent = "";
    try {
      const siteRes = await fetch(companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketRadar/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (siteRes.ok) {
        const html = await siteRes.text();
        // Extract text content, strip HTML tags, limit to 6000 chars
        siteContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 6000);
      }
    } catch {
      // Site fetch failed, GPT will use its knowledge
    }

    const userPrompt = `Компания: «${companyName}»
URL: ${companyUrl}
${companyDescription ? `Описание: ${companyDescription}` : ""}

${siteContent ? `Контент сайта (извлечённый текст):\n${siteContent}` : "Контент сайта не удалось загрузить, используй свои знания и URL."}

Проанализируй офферы этой компании и верни JSON.`;

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
        temperature: 0.4,
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
      endpoint: "analyze-offers",
      model: "gpt-4o",
      promptTokens: estimateTokens(SYSTEM_PROMPT + userPrompt),
      completionTokens: estimateTokens(rawContent),
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "analyze-offers", model: "gpt-4o", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
