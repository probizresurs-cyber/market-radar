import { NextResponse } from "next/server";
import type { ContentPlan } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { TASegment } from "@/lib/ta-types";
import { buildSegmentsSummary } from "@/lib/ta-segment-prompt";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — гибрид четырёх лучших экспертов по контенту:

1. ВИРАЛЬНЫЙ РЕЖИССЁР РИЛСОВ. Ты строишь видео по железной структуре: КРЮК (0-3 сек, шок/вопрос/обещание) → ИНТРИГА (удержание) → ПРОБЛЕМА (боль зрителя) → РЕШЕНИЕ → РЕЗУЛЬТАТ → CTA. Каждое видео цепляет с первой секунды и держит до конца.

2. INSTAGRAM-СТОРИТЕЛЛЕР И МАРКЕТОЛОГ С 25-ЛЕТНИМ ОПЫТОМ. Ты понимаешь алгоритмы, форматы (карусели, рилсы, лонгриды, истории), психологию аудитории и умеешь превращать обычные посты в магниты вовлечения через личные истории, инсайты и сильную подачу.

3. ЭМОЦИОНАЛЬНЫЙ КОПИРАЙТЕР С 50-ЛЕТНИМ ОПЫТОМ. Ты пишешь так, что люди останавливаются на середине ленты. Каждое слово на своём месте. Никакой воды. Только эмоции, конкретика и сила слова. Ты владеешь приёмами: контраст, повторы, парадокс, недосказанность, цифры, истории.

4. КОНТЕНТ-СТРАТЕГ ДЛЯ ВИРАЛЬНОГО КОНТЕНТА. Ты владеешь 17+ маркетинговыми моделями (AIDA, PAS, BAB, FAB, 4P, AICDC, Storybrand, Hero's Journey, и т.д.) и применяешь нужную модель под конкретную задачу. Ты знаешь, какой формат сейчас взлетает в каждой нише.

ТВОЯ ЗАДАЧА — выдавать контент-планы и идеи, которые:
- Цепляют с первой секунды
- Дают конкретный результат бизнесу (рост, продажи, доверие)
- Работают именно для целевой аудитории клиента
- Используют сильные крючки, точные боли и проверенные структуры
- НИКАКОЙ ВОДЫ. Никаких общих фраз. Только конкретика.

ВАЖНО: Ты всегда отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток. Твой ответ должен начинаться с { и заканчиваться }.`;

/** Свежие тренды ниши — чтобы план опирался на то, что обсуждают СЕЙЧАС. */
interface TrendInput { title: string; source?: string; description?: string }

function buildPrompt(
  companyName: string,
  niche: string,
  smm: SMMResult | null,
  taSegments: TASegment[] | null = null,
  trends: TrendInput[] = [],
): string {
  const segmentsBlock = buildSegmentsSummary(taSegments);
  const smmBlock = smm ? `
СМM-АНАЛИЗ КОМПАНИИ (используй как основу):
- Архетип бренда: ${smm.brandIdentity.archetype}
- Позиционирование: ${smm.brandIdentity.positioning}
- УТП: ${smm.brandIdentity.uniqueValue}
- Тон голоса: ${smm.brandIdentity.toneOfVoice.join(", ")}
- Большая идея: ${smm.contentStrategy.bigIdea}
- Миссия контента: ${smm.contentStrategy.contentMission}
- Боли аудитории: ${smm.contentStrategy.audienceProblems.join("; ")}
- Сторителлинг-углы: ${smm.contentStrategy.storytellingAngles.join("; ")}
- Платформы: ${smm.platformStrategies.map(p => p.platformLabel).join(", ")}
` : "";

  const trendsBlock = trends.length > 0 ? `
СВЕЖИЕ ТРЕНДЫ НИШИ (собраны из новостей и соцсетей — привяжи к ним часть идей,
чтобы контент попадал в текущую повестку, а не был вне времени):
${trends.slice(0, 15).map((t, i) => `${i + 1}. ${t.title}${t.source ? ` [${t.source}]` : ""}${t.description ? ` — ${t.description.slice(0, 120)}` : ""}`).join("\n")}
` : "";

  return `Создай контент-завод для компании.

Компания: ${companyName || "—"}
Ниша: ${niche || "—"}
${smmBlock}${segmentsBlock}${trendsBlock}

Сделай контент-план на 30 дней — 12 идей постов и 8 идей видео-рилсов. Каждая идея — конкретная, готовая в работу.

Для каждого ПОСТА укажи:
- pillar: контент-столп (например "Экспертность", "Кейсы", "За кадром")
- format: "carousel" | "single" | "longread" | "story"
- hook: цепляющий заголовок (8-12 слов, должен останавливать пролистывание)
- angle: угол подачи (кто герой, какой инсайт, какая структура — AIDA / PAS / story)
- goal: цель (рост охвата / прогрев / продажа / доверие)
- cta: конкретный призыв
- platform: основная платформа (vk / instagram / telegram / ...)

Для каждого РИЛСА строго по виральной структуре:
- pillar: контент-столп
- hook: первые 0-3 секунды (шок / парадокс / вопрос / обещание) — чтобы не пролистали
- intrigue: следующие 3-7 секунд для удержания
- problem: какую боль зрителя мы поднимаем
- solution: что предлагаем как решение
- result: какая трансформация / результат
- cta: что зритель должен сделать
- durationSec: 15 / 30 / 60
- visualStyle: как снимать (динамика, монтаж, текст в кадре)
- hashtags: 5-8 релевантных хэштегов

Верни СТРОГО JSON:
{
  "bigIdea": "одна большая идея, объединяющая весь контент-завод",
  "pillars": [
    {"name": "название", "description": "что это", "share": "30%"}
  ],
  "postIdeas": [
    {
      "id": "p1",
      "pillar": "...",
      "format": "carousel",
      "hook": "...",
      "angle": "...",
      "goal": "...",
      "cta": "...",
      "platform": "instagram"
    }
  ],
  "reelIdeas": [
    {
      "id": "r1",
      "pillar": "...",
      "hook": "...",
      "intrigue": "...",
      "problem": "...",
      "solution": "...",
      "result": "...",
      "cta": "...",
      "durationSec": 30,
      "visualStyle": "...",
      "hashtags": ["#tag1", "#tag2"]
    }
  ],
  "weeklyRhythm": "Пн — рилс, Вт — карусель, ...",
  "thirtyDayCalendar": [
    "День 1: рилс — <уникальная тема>",
    "День 2: карусель — <уникальная тема>",
    "..."
  ]
}

КРИТИЧЕСКИ ВАЖНО для thirtyDayCalendar:
- Ровно 30 строк (День 1 … День 30)
- Каждый день — АБСОЛЮТНО уникальная тема. Никаких повторов.
- Чередуй форматы: рилс / карусель / лонгрид / сторителлинг / за кадром / кейс / тренды
- Каждая запись: "День N: <формат> — <конкретная уникальная тема поста>"
- Используй все 12 идей постов и 8 идей рилсов, раскладывая их по дням. Остальные дни — новые уникальные идеи в том же стиле.

Заполни ВСЕ поля. 12 постов и 8 рилсов. Ровно 30 уникальных элементов в календаре. БЕЗ ВОДЫ. БЕЗ ПОВТОРЕНИЙ.`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";
    // SMM-анализ — опциональное обогащение, не обязательный вход: без него
    // план строится из ниши + трендов + сегментов ЦА.
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    // Сегменты ЦА — рубрики/темы плана привязываются к конкретным аватарам.
    const taSegments: TASegment[] | null = Array.isArray(body.taSegments) ? body.taSegments : null;
    // Свежие тренды из /api/content/trends — часть идей плана привязывается
    // к текущей повестке ниши.
    const trends: TrendInput[] = Array.isArray(body.trends)
      ? (body.trends as unknown[])
          .filter((t): t is TrendInput => typeof t === "object" && t !== null && typeof (t as TrendInput).title === "string")
          .slice(0, 15)
      : [];

    // Claude вместо OpenAI: gpt-4o-mini не работает с прода (гео-блок на
    // уровне Cloudflare самого OpenAI, воркером не обходится — см. lib/ai-chat.ts).
    // Sonnet, не Haiku: план на 30 дней с 20 идеями — большой связный JSON,
    // Haiku на таком объёме терял поля.
    const r = await chatJson<Omit<ContentPlan, "generatedAt" | "companyName">>({
      system: SYSTEM_PROMPT,
      user: buildPrompt(companyName, niche, smm, taSegments, trends),
      model: CHAT_MODEL_SMART,
      temperature: 0.9,
      // 7000 обрезало JSON при большом числе идей (30 дней × поля).
      maxTokens: 10000,
    });

    if (!r.data) {
      return NextResponse.json(
        { ok: false, error: `Не удалось получить план контента: ${r.error ?? "нет ответа модели"}. Preview: ${r.raw.slice(0, 100)}` },
        { status: 500 },
      );
    }

    const result: ContentPlan = {
      generatedAt: new Date().toISOString(),
      companyName,
      ...r.data,
    };

    await access.log({ endpoint: "generate-content-plan", model: r.modelUsed });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
