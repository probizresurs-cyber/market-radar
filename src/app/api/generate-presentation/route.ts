import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_PROMPT = `Ты — презентационный дизайнер. Создаёшь структуру бренд-презентации компании.
На основе данных создай 10-14 слайдов. Для каждого:
- title: заголовок
- subtitle: подзаголовок
- type: cover | bullets | stats | quote | two-column | cta
- content: текст (1-3 предложения)
- bullets: массив пунктов
- stats: массив { value, label } (до 4)
- quote: цитата
- note: заметка для спикера

JSON:
{"title":"...","slides":[{"title":"...","subtitle":"...","type":"cover","content":"...","bullets":[],"stats":[],"quote":"","note":""}]}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "No API key" }, { status: 500 });
    const sections: string[] = [];
    if (body.company) {
      const c = body.company;
      sections.push(`КОМПАНИЯ: ${c.name}, ${c.url}, Score ${c.score}/100\n${c.description ?? ""}\nКатегории: ${(c.categories ?? []).map((cat: { name: string; score: number }) => `${cat.name}: ${cat.score}`).join(", ")}`);
    }
    if (body.brandBook) {
      const b = body.brandBook;
      sections.push(`БРЕНД: Слоган: ${b.tagline}, Миссия: ${b.mission}, Тон: ${(b.toneOfVoice ?? []).join(", ")}`);
    }
    if (body.taData?.segments) {
      sections.push(`ЦА: ${body.taData.segments.map((s: { segmentName: string; demographics: { age: string; income: string }; mainProblems: string[] }) => `${s.segmentName} (${s.demographics.age}, ${s.demographics.income})`).join("; ")}`);
    }
    if (body.social) {
      const s = body.social;
      sections.push(`ОТЗЫВЫ: Яндекс ${s.yandexRating > 0 ? s.yandexRating : "—"}, 2ГИС ${s.gisRating > 0 ? s.gisRating : "—"}`);
    }
    if (body.business) sections.push(`БИЗНЕС: ${body.business.employees} сотр., ${body.business.revenue}, с ${body.business.founded}`);
    if (body.nicheForecast) sections.push(`ПРОГНОЗ: ${body.nicheForecast.trend} (${body.nicheForecast.trendPercent}%)`);
    if (body.smmData?.quickWins) sections.push(`SMM: ${body.smmData.quickWins.slice(0, 3).join("; ")}`);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Создай бренд-презентацию:\n\n${sections.join("\n\n")}` }],
        temperature: 0.6, max_tokens: 4000, response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return NextResponse.json({ ok: true, data: JSON.parse(data.choices[0]?.message?.content ?? "{}") });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
