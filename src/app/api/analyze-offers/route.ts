import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — маркетинговый аналитик. Тебе дают URL сайта и краткое описание компании.

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

    // SSRF-защита: разрешаем только публичные веб-URL.
    // Блокируем localhost, link-local (169.254.x), RFC 1918 (10.x, 172.16.x, 192.168.x).
    let normalizedUrl: string;
    try {
      normalizedUrl = companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`;
      const parsed = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ ok: false, error: "Недопустимый протокол URL" }, { status: 400 });
      }
      const h = parsed.hostname.toLowerCase();
      if (
        h === "localhost" || h === "127.0.0.1" || h === "::1" ||
        /^169\.254\./.test(h) ||
        /^10\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^192\.168\./.test(h)
      ) {
        return NextResponse.json({ ok: false, error: "URL указывает на внутреннюю сеть" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Невалидный URL компании" }, { status: 400 });
    }

    // First, try to fetch the website to give GPT real data
    let siteContent = "";
    try {
      const siteRes = await fetch(normalizedUrl, {
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
      // Site fetch failed → siteContent остаётся пустой
    }

    // КРИТИЧНО: если контент не загрузился — НЕ просим AI «использовать свои
    // знания», это прямая инструкция выдумать офферы. Возвращаем явную ошибку,
    // юзер видит «не удалось загрузить сайт» вместо вымышленных услуг с
    // правдоподобными ценами.
    if (!siteContent || siteContent.length < 100) {
      return NextResponse.json({
        ok: false,
        error: "Не удалось загрузить сайт конкурента (timeout/403/404). Анализ офферов невозможен без контента — попробуйте позже или укажите другой URL.",
        reason: "site_unavailable",
      }, { status: 422 });
    }

    const userPrompt = `Компания: «${companyName}»
URL: ${companyUrl}
${companyDescription ? `Описание: ${companyDescription}` : ""}

Контент сайта (извлечённый текст):
${siteContent}

Проанализируй офферы по ФАКТИЧЕСКОМУ тексту сайта. Не выдумывай несуществующие услуги. Если какой-то блок (цены / гарантии / отзывы) не найден на сайте — верни пустой массив или «—», НЕ генерируй гипотетические значения. Верни JSON.`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      model: "gpt-4o-mini",
      promptTokens: estimateTokens(SYSTEM_PROMPT + userPrompt),
      completionTokens: estimateTokens(rawContent),
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "analyze-offers", model: "gpt-4o-mini", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
