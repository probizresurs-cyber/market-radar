import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`;

function toSlug(text: string): string {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"j",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return text.toLowerCase()
    .split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function POST(req: NextRequest) {
  try {
    const { h1, intro, focusKeyword, platform, topic } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

    const prompt = `Ты — SEO-специалист. Напиши мета-теги для статьи.

ТЕМА: ${topic}
H1: ${h1}
ЛИД: ${(intro || "").slice(0, 300)}
ФОКУС-КЛЮЧ: ${focusKeyword}
ПЛАТФОРМА: ${platform}

Верни ТОЛЬКО валидный JSON:
{
  "title": "SEO-заголовок страницы до 60 символов, содержит ключ",
  "metaDescription": "meta-описание до 160 символов с ключом и призывом читать",
  "ogTitle": "OG-заголовок (можно чуть длиннее title)",
  "ogDescription": "OG-описание до 200 символов"
}`;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const json = await res.json();
    const data = JSON.parse(json.choices[0].message.content);
    data.focusKeyword = focusKeyword;
    data.slug = toSlug(h1 || topic);

    return NextResponse.json({ meta: data });
  } catch (e) {
    console.error("seo-generate-meta error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
