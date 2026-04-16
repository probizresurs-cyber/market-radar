import { NextResponse } from "next/server";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import { getRealVKStats, getRealTelegramStats } from "@/lib/enricher";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Ты — ведущий ментор по личному и корпоративному брендингу в социальных сетях. Ты помогаешь компаниям и экспертам строить мощные, узнаваемые, прибыльные бренды в соцсетях.

Ты глубоко понимаешь:
- архетипы брендов, позиционирование и УТП
- особенности каждой платформы (ВКонтакте, Instagram, Telegram, Facebook, TikTok, YouTube) — какие форматы работают, какая аудитория, какие алгоритмы
- сторителлинг и контент-стратегию
- психологию аудитории и триггеры доверия
- как через контент превращать подписчиков в клиентов

Ты всегда даёшь конкретные, практические рекомендации с примерами, а не общие фразы. Ты говоришь чётко, как опытный наставник: без воды, по делу.

ВАЖНО: Ты всегда отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток. Твой ответ должен начинаться с { и заканчиваться }.`;

const PLATFORM_LABELS: Record<string, string> = {
  vk: "ВКонтакте",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

type RealSocialData = {
  vk: SMMRealStats["vk"] | null;
  telegram: SMMRealStats["telegram"] | null;
};

function buildPrompt(
  companyName: string,
  companyUrl: string,
  niche: string,
  socialLinks: SMMSocialLinks,
  websiteContext: string,
  realData: RealSocialData,
): string {
  const providedPlatforms = Object.entries(socialLinks)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${PLATFORM_LABELS[k] ?? k}: ${v}`)
    .join("\n");

  const platformList = Object.keys(socialLinks)
    .filter(k => socialLinks[k as keyof SMMSocialLinks]?.trim())
    .map(k => `"${k}"`)
    .join(", ");

  // Build real data block
  const realLines: string[] = [];
  if (realData.vk) {
    realLines.push(`ВКонтакте — реальные данные:`);
    realLines.push(`  • Подписчиков: ${realData.vk.subscribers.toLocaleString("ru-RU")}`);
    if (realData.vk.posts30d > 0) realLines.push(`  • Постов за 30 дней: ${realData.vk.posts30d}`);
  }
  if (realData.telegram) {
    realLines.push(`Telegram — реальные данные:`);
    realLines.push(`  • Подписчиков: ${realData.telegram.subscribers.toLocaleString("ru-RU")}`);
    if (realData.telegram.posts30d > 0) realLines.push(`  • Постов на странице: ${realData.telegram.posts30d}`);
  }
  const realBlock = realLines.length > 0
    ? `\nРеальная статистика (получена автоматически):\n${realLines.join("\n")}\n`
    : "";

  return `Проведи глубокий брендинг-анализ и разработай SMM-стратегию для следующей компании.

Компания: ${companyName || "—"}
Сайт: ${companyUrl || "—"}
Ниша / описание: ${niche || "—"}

Социальные сети компании:
${providedPlatforms || "(пока не указаны — нужно дать рекомендации с нуля)"}
${realBlock}
${websiteContext ? `Дополнительный контекст по сайту:\n${websiteContext}\n` : ""}
Твоя задача:
1. Определить архетип бренда и позиционирование
2. Разработать общую контент-стратегию
3. Для КАЖДОЙ указанной соцсети дать отдельную стратегию (форматы, тон, контент-столпы, примеры постов, тактики роста). Используй реальную статистику, чтобы оценить текущее состояние аккаунта.
4. Дать quick wins на первую неделю и план на 30 дней
5. Указать ошибки и примеры аккаунтов для вдохновения

Верни результат СТРОГО в JSON формате:
{
  "brandIdentity": {
    "archetype": "название архетипа (Творец / Мудрец / Бунтарь / Заботливый / ...)",
    "positioning": "позиционирование бренда в 1-2 предложениях",
    "uniqueValue": "уникальное торговое предложение",
    "toneOfVoice": ["характеристика 1", "характеристика 2", "характеристика 3", "характеристика 4"],
    "visualStyle": "описание визуального стиля бренда (цвета, эстетика, настроение)",
    "brandKeywords": ["слово 1", "слово 2", "слово 3", "слово 4", "слово 5"]
  },
  "contentStrategy": {
    "bigIdea": "большая идея бренда — что объединяет весь контент",
    "contentMission": "миссия контента — зачем компания вообще создаёт контент",
    "audienceProblems": ["боль 1 которую решает контент", "боль 2", "боль 3", "боль 4"],
    "storytellingAngles": ["угол 1", "угол 2", "угол 3", "угол 4", "угол 5"],
    "contentMatrix": [
      {"type": "Образовательный", "goal": "формирование экспертности", "share": "30%"},
      {"type": "Развлекательный", "goal": "охваты и виральность", "share": "25%"},
      {"type": "Продающий", "goal": "конверсия", "share": "20%"},
      {"type": "Вдохновляющий", "goal": "эмоциональная связь", "share": "15%"},
      {"type": "За кадром", "goal": "доверие и человечность", "share": "10%"}
    ]
  },
  "platformStrategies": [
    // ОБЯЗАТЕЛЬНО создай по объекту для каждой из платформ: ${platformList || "ни одной не указано — придумай рекомендации"}
    {
      "platform": "vk | instagram | telegram | facebook | tiktok | youtube",
      "platformLabel": "ВКонтакте | Instagram | ...",
      "url": "оригинальная ссылка из ввода",
      "audienceFit": "насколько ЦА сидит здесь и почему — 2-3 предложения",
      "contentFormat": "основные форматы которые работают именно здесь",
      "postingFrequency": "оптимальная частота постинга",
      "toneOfVoice": "тон коммуникации именно для этой платформы",
      "contentPillars": ["столп 1", "столп 2", "столп 3", "столп 4", "столп 5"],
      "examplePosts": [
        "пример готового поста 1 — конкретный, как будто завтра публиковать",
        "пример поста 2",
        "пример поста 3"
      ],
      "hashtagStrategy": "стратегия хэштегов / тегов / SEO для платформы",
      "growthTactics": ["тактика роста 1", "тактика 2", "тактика 3", "тактика 4"],
      "metricsToTrack": ["KPI 1", "KPI 2", "KPI 3"],
      "warnings": ["чего НЕ делать на этой платформе 1", "чего не делать 2"]
    }
  ],
  "quickWins": [
    "конкретное действие на день 1",
    "действие на день 2",
    "действие на день 3",
    "действие на день 4",
    "действие на день 5"
  ],
  "thirtyDayPlan": [
    "Неделя 1: фокус и задачи",
    "Неделя 2: фокус и задачи",
    "Неделя 3: фокус и задачи",
    "Неделя 4: фокус и задачи"
  ],
  "redFlags": [
    "ошибка которую сейчас может совершать компания 1",
    "ошибка 2",
    "ошибка 3"
  ],
  "inspirationAccounts": [
    "аккаунт 1 (платформа) — почему стоит изучить",
    "аккаунт 2",
    "аккаунт 3",
    "аккаунт 4"
  ]
}

Заполни ВСЕ поля максимально конкретно и практично. Никакой воды. Примеры постов должны быть готовыми к публикации.`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const companyUrl: string = body.companyUrl ?? "";
    const niche: string = body.niche ?? "";
    const websiteContext: string = body.websiteContext ?? "";
    const socialLinks: SMMSocialLinks = body.socialLinks ?? {};

    const hasAny = Object.values(socialLinks).some(v => typeof v === "string" && v.trim());
    if (!hasAny && !niche.trim()) {
      return NextResponse.json(
        { ok: false, error: "Укажите хотя бы одну ссылку на соцсеть или опишите нишу" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // Fetch real VK + Telegram data in parallel before calling AI
    const [vkReal, tgReal] = await Promise.all([
      socialLinks.vk?.trim() ? getRealVKStats(socialLinks.vk).catch(() => null) : Promise.resolve(null),
      socialLinks.telegram?.trim() ? getRealTelegramStats(socialLinks.telegram).catch(() => null) : Promise.resolve(null),
    ]);

    const realData: RealSocialData = { vk: vkReal, telegram: tgReal };

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);

    let raw: string;
    try {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(companyName, companyUrl, niche, socialLinks, websiteContext, realData) },
          ],
          temperature: 0.85,
          max_tokens: 7000,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return NextResponse.json(
          { ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` },
          { status: 500 },
        );
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      raw = data.choices[0]?.message?.content ?? "{}";
    } finally {
      clearTimeout(timeout);
    }

    const parsed = JSON.parse(raw) as Omit<SMMResult, "generatedAt" | "companyName" | "companyUrl" | "realStats" >;

    const result: SMMResult = {
      generatedAt: new Date().toISOString(),
      companyName,
      companyUrl,
      ...parsed,
      // Store real stats so UI can display them
      realStats: {
        vk: vkReal ?? undefined,
        telegram: tgReal ?? undefined,
      },
    };

    await access.log({ endpoint: "analyze-smm", model: "claude-sonnet-4-6" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
