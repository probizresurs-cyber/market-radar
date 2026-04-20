import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

function toSlug(text: string): string {
  // Basic transliteration + slug
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"j",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return text.toLowerCase()
    .split("").map(c => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const { h1, intro, focusKeyword, platform, topic } = await req.json();

    const prompt = `Ты — SEO-специалист. Напиши мета-теги для статьи.

ТЕМА: ${topic}
H1: ${h1}
ЛИД: ${intro?.slice(0, 300)}
ФОКУС-КЛЮЧ: ${focusKeyword}
ПЛАТФОРМА: ${platform}

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "title": "SEO-заголовок страницы (title тег), до 60 символов, содержит ключ",
  "metaDescription": "meta-описание до 160 символов, содержит ключ и призыв читать",
  "ogTitle": "OG-заголовок (можно чуть длиннее основного title)",
  "ogDescription": "OG-описание до 200 символов"
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(rawText); } catch { /* continue */ }
    if (!data) {
      const m = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      try { data = JSON.parse(m); } catch { /* continue */ }
    }
    if (!data) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) try { data = JSON.parse(match[0]); } catch { /* continue */ }
    }
    if (!data) throw new Error("Не удалось разобрать JSON из ответа модели");

    data.focusKeyword = focusKeyword;
    data.slug = toSlug(h1 || topic);

    await access.log({
      endpoint: "seo-generate-meta",
      model: "claude-sonnet-4-6",
      promptTokens: estimateTokens(prompt),
      completionTokens: estimateTokens(rawText),
    });
    return NextResponse.json({ meta: data });
  } catch (e) {
    console.error("seo-generate-meta error:", e);
    await access.log({ endpoint: "seo-generate-meta", model: "claude-sonnet-4-6", success: false, errorMessage: String(e).slice(0, 200) });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
