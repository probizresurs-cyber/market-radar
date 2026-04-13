import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

const BASE_SYSTEM_PROMPT = `Ты — топ-презентационный дизайнер уровня Pitch.com / Beautiful.ai. Создаёшь структуру бренд-презентации компании.

ТРЕБОВАНИЯ К КАЧЕСТВУ:
- 11–14 слайдов, НЕ однообразных — чередуй типы: cover → bullets → stats → two-column → grid → quote → bullets → stats → cta
- Каждый слайд должен ВИЗУАЛЬНО ОТЛИЧАТЬСЯ от соседних по типу
- Контент должен быть конкретным и насыщенным: реальные цифры, факты, сильные тезисы
- НЕ пиши банальности типа "Мы лучшие". Пиши конкретику.

ТИПЫ СЛАЙДОВ:
- cover: обложка. bullets: [] нет, stats: [] нет. Заполни subtitle (категория/позиционирование) и content (короткое УТП).
- bullets: список 4–7 конкретных пунктов. Каждый пункт — законченная мысль, 8–15 слов.
- stats: ОБЯЗАТЕЛЬНО 3–4 числовых показателя. Поле value ВСЕГДА число или число+единица (например "87%", "2 400", "×3"). Поле label — что это за показатель.
- quote: сильная цитата или инсайт (поле quote). content — автор/контекст.
- two-column: два блока. Заполни bullets (6–8 пунктов) — они поровну разделятся на колонки. Или leftContent + rightContent.
- grid: карточки услуг/преимуществ/возможностей. Заполни items: [{title, description}] — 3–6 карточек с конкретными названиями и описаниями.
- cta: финальный призыв. bullets — 2–4 контактных/следующих шага.

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА (в таком порядке):
1. cover — Название + позиционирование
2. bullets — Проблема клиента / боль рынка (конкретно)
3. stats — Ключевые цифры компании или рынка
4. grid — Услуги / продукты (3–6 карточек с описанием)
5. two-column — Преимущества / почему мы
6. bullets — Целевая аудитория / кому подходим
7. stats — Результаты / кейсы (конкретные цифры)
8. quote — Инсайт / цитата клиента или эксперта
9. two-column — Как работаем / процесс
10. grid — Команда / компетенции ИЛИ тарифы / пакеты
11. bullets — Дорожная карта / планы
12. cta — Следующий шаг / контакты

JSON-формат (строго):
{"title":"...","slides":[{
  "title":"...","subtitle":"...","type":"cover|bullets|stats|quote|two-column|grid|cta",
  "content":"...","bullets":[],"stats":[{"value":"...","label":"..."}],
  "quote":"","items":[{"title":"...","description":"..."}],
  "leftContent":"","rightContent":"","note":""
}]}`;

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

    // Build style-aware system prompt
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (body.style) {
      const s = body.style;
      systemPrompt += `\n\nСТИЛЬ ПРЕЗЕНТАЦИИ:
Название стиля: ${s.name}
Настроение: ${s.mood}
Шрифт заголовков: ${s.fontHeader}
Шрифт текста: ${s.fontBody}
Учитывай стиль "${s.mood}" при написании текстов — подбирай лексику и тон соответственно.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Создай бренд-презентацию:\n\n${sections.join("\n\n")}` }],
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
