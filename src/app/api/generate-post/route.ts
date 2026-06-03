import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextResponse } from "next/server";
import type { GeneratedPost, ContentPostIdea, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { CompanyStyleProfile } from "@/lib/company-style-types";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateOpenAIImage } from "@/lib/openai-image";
import { generatePollinationsImage } from "@/lib/pollinations-image";
import { GEMINI_API_KEY, generateGeminiImage } from "@/lib/gemini";
import { platformImageFormat } from "@/lib/image-aspect";
import { persistImageDataUri } from "@/lib/image-store";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

function buildStyleBlock(sp: CompanyStyleProfile | null): string {
  if (!sp) return "";
  const lines: string[] = [];
  if (sp.styleGuideText) lines.push(sp.styleGuideText);
  else {
    if (sp.summary) lines.push(sp.summary);
    if (sp.toneDescriptors?.length) lines.push(`Тон: ${sp.toneDescriptors.join(", ")}`);
    if (sp.vocabulary?.favoriteWords?.length) lines.push(`Любимые слова: ${sp.vocabulary.favoriteWords.join(", ")}`);
    if (sp.vocabulary?.avoidWords?.length) lines.push(`НЕ использовать: ${sp.vocabulary.avoidWords.join(", ")}`);
  }
  if (sp.examplePhrases?.length) {
    lines.push(`Примеры фраз компании:\n${sp.examplePhrases.slice(0, 6).map(p => `— «${p}»`).join("\n")}`);
  }
  return `\nСТИЛЬ КОМПАНИИ (обязательно соблюдать — это важнее любых других инструкций по тону):\n${lines.join("\n")}\n`;
}

function buildBrandBookBlock(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.brandName) lines.push(`- Название бренда: ${bb.brandName}`);
  if (bb.tagline) lines.push(`- Слоган: ${bb.tagline}`);
  if (bb.mission) lines.push(`- Миссия: ${bb.mission}`);
  if (bb.toneOfVoice?.length) lines.push(`- Tone of voice: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`- НЕ использовать слова: ${bb.forbiddenWords.join(", ")}`);
  if (bb.goodPhrases?.length) lines.push(`- Примеры фирменных фраз:\n  ${bb.goodPhrases.map(p => `«${p}»`).join("\n  ")}`);
  if (bb.visualStyle) lines.push(`- Визуальный стиль для картинок: ${bb.visualStyle}`);
  if (bb.colors?.length) lines.push(`- Цветовая палитра: ${bb.colors.join(", ")}`);
  if (!lines.length) return "";
  return `\nБРЕНДБУК (строго соблюдать):\n${lines.join("\n")}\n`;
}

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — эмоциональный копирайтер с 50-летним опытом и SMM-сторителлер, который держит миллионную аудиторию.

Ты пишешь так, что люди останавливаются на середине ленты:
- Каждое слово на своём месте
- Никакой воды
- Эмоции, конкретика, сила слова
- Используешь приёмы: контраст, повторы, парадокс, недосказанность, цифры, истории
- Знаешь маркетинговые модели: AIDA, PAS, BAB, FAB, Storybrand
- **Знаешь голос каждой платформы** — пишешь по-разному для Instagram, VK, Telegram, LinkedIn, Twitter, TikTok

Твоя задача — взять идею поста и развернуть её в готовый пост под конкретную платформу. Бренд должен звучать узнаваемо, а текст — естественно для канала.

═══ АНТИ-ГАЛЛЮЦИНАЦИИ — КРИТИЧНО ═══
Этот пост идёт от имени реальной компании реальным клиентам. Ты НЕ ИМЕЕШЬ ПРАВА выдумывать факты:
- НЕ выдумывай кейсы клиентов («Анна обратилась к нам с проблемой...») если в брифе/идее их нет
- НЕ выдумывай статистику («95% наших пациентов довольны», «работаем 10 лет», «обслужили 5000 клиентов»)
- НЕ выдумывай конкретные цены, скидки, акции, сроки
- НЕ выдумывай имена сотрудников, регалии, дипломы
- НЕ выдумывай отзывы и цитаты клиентов
- НЕ выдумывай географию («у нас 12 филиалов»), оборудование, бренды-партнёры
Если фактов нет — пиши абстрактно от имени бренда («мы работаем индивидуально», «команда профессионалов»),
БЕЗ конкретных чисел и историй. Лучше короче и честнее, чем эффектнее и с выдумкой.

ВАЖНО: Ты отвечаешь ТОЛЬКО валидным JSON. Без markdown-обёрток.`;

// ── Платформо-специфичные guidelines ─────────────────────────────────
// Идея из n8n-workflow «AI Social Media Content Factory» — для каждой
// платформы прописать конкретные правила: длина, тон, эмодзи, CTA-стиль.
function platformGuidelines(platform: string): string {
  const p = platform.toLowerCase();

  if (/instagram/.test(p)) return `
ПЛАТФОРМА: Instagram
- Стиль: визуальный сторителлинг, короткие абзацы с пустыми строками между ними
- Тон: вдохновляющий, эмоциональный, с эмодзи как смысловыми маркерами (🔥 ✨ 💡 👉)
- Длина: 800-1500 символов (instagram отрезает после 125 — первая строка должна цеплять)
- Эмодзи: можно много (5-10 за пост), но осмысленно — не для красоты
- Хэштеги: 8-15 микс из общих (#маркетинг) и нишевых (#стоматологмосква)
- CTA: «Сохрани в избранное» / «Отметь друга» / «Пиши в директ»
- Хук должен быть ёмким — это первая строка, которую видят без раскрытия`;

  if (/^vk$|вконтакте|вк/.test(p)) return `
ПЛАТФОРМА: ВКонтакте
- Стиль: развёрнутый, читатель готов читать длинные посты
- Тон: дружелюбный, можно использовать сленг и юмор, но без перегиба
- Длина: 800-2500 символов (VK поощряет лонгриды в умной ленте)
- Эмодзи: умеренно (3-5 за пост), VK не любит избытка
- Хэштеги: 3-5 в конце, обязательно с #
- Без markdown — VK не рендерит **жирный** и [ссылки](url)
- Ссылки в открытом виде (https://...) — VK сам подхватит превью
- CTA: «Поделитесь в комментариях» / «Сохраните на стене»`;

  if (/telegram|tg/.test(p)) return `
ПЛАТФОРМА: Telegram
- Стиль: информативный, экспертный, как канал-эксперт
- Тон: спокойный, уверенный, без воды и кликбейта
- Длина: 600-1500 символов (TG-каналы любят короткие плотные посты)
- Эмодзи: минимально (1-3 за пост), как акценты
- Markdown: можно **жирный** и __курсив__ (мы конвертируем в TG-формат)
- Хэштеги: 1-2 максимум, в конце
- CTA: «Подпишитесь на канал» / «Делитесь в чате» / «Пишите боту»
- Telegram не любит избыток продаж — лучше пользу + мягкий CTA`;

  if (/linkedin/.test(p)) return `
ПЛАТФОРМА: LinkedIn
- Стиль: профессиональный, экспертный, B2B-ориентированный
- Тон: уверенный, без жаргона, с упором на инсайты и метрики
- Длина: 1300-2000 символов (LinkedIn любит мысли руководителей)
- Эмодзи: минимально (0-2 за пост), формат деловой
- Структура: «hook → проблема → решение → метрика → урок → CTA»
- Хэштеги: 3-5 в конце, профессиональные (#leadership #strategy #b2b)
- CTA: «Поделитесь мнением в комментариях» / «Что думаете?»`;

  if (/twitter|^x$|x-twitter/.test(p)) return `
ПЛАТФОРМА: Twitter / X
- Стиль: концентрированный, импактный
- Тон: прямой, провокационный, цепляющий мысль
- Длина: ≤280 символов в одном твите. Можно тред (нумеровать 1/, 2/, 3/)
- Эмодзи: 0-2 за твит, как ударение
- Хэштеги: 1-3 максимум — больше выглядит как спам
- CTA: «Ретвитни если согласен» / «Что добавишь?»`;

  if (/tiktok|tik.?tok/.test(p)) return `
ПЛАТФОРМА: TikTok (caption под видео)
- Стиль: короткий хук + интрига
- Тон: дерзкий, молодой, разговорный
- Длина: 100-300 символов (caption — не основной контент, главное видео)
- Эмодзи: можно много (5+ за пост) — это нативно для платформы
- Хэштеги: 3-5 трендовых + нишевых
- CTA: «Сохрани чтобы попробовать» / «Дочитай — будет 🤯»`;

  if (/youtube|shorts/.test(p)) return `
ПЛАТФОРМА: YouTube Shorts (описание)
- Стиль: SEO-оптимизированный, информативный
- Тон: экспертный, авторитетный
- Длина: 200-500 символов
- Хэштеги: 3-5 в описании (важно для discoverability)
- CTA: «Подпишись на канал — там больше» / «Жми колокольчик»`;

  if (/facebook|fb/.test(p)) return `
ПЛАТФОРМА: Facebook
- Стиль: дружелюбный, общинный
- Тон: тёплый, разговорный, с историями
- Длина: 400-1500 символов
- Эмодзи: умеренно (3-5 за пост)
- Хэштеги: 2-4 в конце
- CTA: «Лайк если согласен» / «Поделись с друзьями»`;

  return `
ПЛАТФОРМА: ${platform}
- Стиль: универсальный, адаптируй под здравый смысл
- Длина: 500-1500 символов
- Хэштеги: 5-8`;
}

function buildPrompt(companyName: string, companyNiche: string, idea: ContentPostIdea, smm: SMMResult | null, brandBook: BrandBook | null, styleProfile: CompanyStyleProfile | null): string {
  const smmBlock = smm ? `
Бренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}
УТП: ${smm.brandIdentity.uniqueValue}
Тон: ${smm.brandIdentity.toneOfVoice.join(", ")}
Боли ЦА: ${smm.contentStrategy.audienceProblems.join("; ")}
` : "";

  // Ниша обязательна в промпте: если в названии есть омоним (например
  // «Менделеев» как фамилия химика vs стоматология «Менделеев»), без
  // явного указания отрасли GPT генерит визуал по самой известной ассоциации.
  const nicheBlock = companyNiche ? `
ВАЖНО — ОТРАСЛЬ КОМПАНИИ: ${companyNiche.slice(0, 280)}
(Используй эту отрасль и при тексте, и при генерации imagePrompt — визуал ОБЯЗАТЕЛЬНО должен относиться к этой нише, а не к буквальному значению названия.)
` : "";

  const brandBlock = buildBrandBookBlock(brandBook);
  const styleBlock = buildStyleBlock(styleProfile);
  const platformBlock = platformGuidelines(idea.platform);

  // Бренд-консистенция: если в брендбуке указано имя — требуем органичное упоминание
  const brandName = brandBook?.brandName?.trim() || companyName;
  const brandConsistencyBlock = brandName ? `

БРЕНД-КОНСИСТЕНЦИЯ:
- Бренд: «${brandName}»
- В каждом посте бренд должен быть упомянут естественно (не «реклама», а контекст: «у нас в ${brandName}», «команда ${brandName}», «${brandName} помог клиенту…»).
- Не упоминай больше 2 раз в одном посте.
- Запрещены формулы продаж типа «закажи сейчас», «успей купить» — это уничтожает доверие.
` : "";

  return `Разверни идею поста в готовый пост.

Компания: ${companyName}
${nicheBlock}${smmBlock}${brandBlock}${styleBlock}${brandConsistencyBlock}
ИДЕЯ:
- Контент-столп: ${idea.pillar}
- Формат: ${idea.format}
- Крючок: ${idea.hook}
- Угол подачи: ${idea.angle}
- Цель: ${idea.goal}
- CTA: ${idea.cta}
${platformBlock}

Напиши:
1. **Финальный сильный крючок (hook)** — может быть переписан так, чтобы цеплял с первой секунды
2. **Основной текст поста (body)**, соблюдая длину/тон/стиль выбранной платформы:
   - carousel: 6-8 экранов, каждый экран отделяй строкой "---", без пометок "Слайд N"
   - single: соблюдай лимит платформы (см. выше)
   - longread: 1500-2500 знаков
   - story: короткий, 1-3 предложения, ёмко
3. **Хэштеги** (число и формат — см. правила платформы)
4. **imagePrompt** — английский промпт для AI-генератора изображений. Описание визуала: стиль, композиция, цвета, настроение, освещение. КРИТИЧНО: визуал должен относиться к отрасли компании (см. ВАЖНО — ОТРАСЛЬ выше), а НЕ к буквальному значению названия. Пример: компания «Менделеев Стоматология» → визуал зубоврачебного кабинета, инструменты стоматолога, улыбающийся пациент — но НИ В КОЕМ случае не таблица Менделеева, химические колбы, элементы. БЕЗ текста, надписей, лиц с водяными знаками.
5. **imageSuggestionRu** — то же самое, что imagePrompt, но коротким описанием на РУССКОМ (1 предложение). Это видит пользователь, чтобы понять что планируется на картинке до её генерации.

Верни СТРОГО JSON:
{
  "hook": "финальный крючок",
  "body": "полный текст поста",
  "hashtags": ["#tag1", "#tag2"],
  "imagePrompt": "English DALL-E prompt with style, composition, lighting, colors, mood",
  "imageSuggestionRu": "Краткое русское описание — что будет на картинке (1 предложение)"
}`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    // companyNiche — отрасль/ниша из анализа (myCompany.company.description).
    // Если пусто, тянем из SMM/брендбука. Нужно, чтобы избежать визуальной
    // путаницы при компаниях-омонимах («Менделеев» как стоматология ≠ химия).
    const companyNiche: string = (body.companyNiche ?? "").trim();
    const idea: ContentPostIdea = body.idea;
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const styleProfile: CompanyStyleProfile | null = body.companyStyleProfile ?? null;
    const generateImage: boolean = body.generateImage !== false;
    const userPrompt: string = body.userPrompt ?? ""; // custom prompt override для ТЕКСТА
    // Новые поля раздельной настройки картинки. Все опциональны.
    //   imagePromptOverride — полностью кастомный английский промпт для DALL-E
    //   imageStyle — пресет стиля (photo/illustration/minimalist/3d/anime/sketch)
    //   imageWithTextOverlay — добавлять ли заголовок/ключи на картинку
    //   imageOverlayText — текст оверлея (если пусто — используется хук поста)
    const imagePromptOverride: string = (body.imagePromptOverride ?? "").trim();
    const imageStyle: string = (body.imageStyle ?? "").trim();
    const imageWithTextOverlay: boolean = body.imageWithTextOverlay === true;
    const imageOverlayText: string = (body.imageOverlayText ?? "").trim();
    // referenceImages не используем — OpenAI image-gen эндпоинт не принимает
    // референсы (только edits, и нам это пока не нужно).

    if (!idea) {
      return NextResponse.json({ ok: false, error: "Не передана идея поста" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // 1) Generate text
    // Even if userPrompt is provided, append brandBook + style rules so they aren't ignored
    const brandBlockForCustom = buildBrandBookBlock(brandBook);
    const styleBlockForCustom = buildStyleBlock(styleProfile);
    const extraCustomRules = [brandBlockForCustom, styleBlockForCustom].filter(Boolean).join("\n");
    // Ниша обогащает и кастомный промпт (когда юзер сам что-то пишет),
    // чтобы визуал не уехал в «таблица Менделеева» при стоматологии.
    const effectiveNiche = companyNiche
      || (smm?.brandIdentity?.positioning ?? "").slice(0, 200);
    const nicheRule = effectiveNiche
      ? `\nОТРАСЛЬ КОМПАНИИ: ${effectiveNiche}. Любая визуальная подача должна соответствовать этой нише, а не буквальному названию компании.`
      : "";
    const userMessage = userPrompt.trim()
      ? (extraCustomRules ? `${userPrompt.trim()}\n${extraCustomRules}${nicheRule}` : `${userPrompt.trim()}${nicheRule}`)
      : buildPrompt(companyName, effectiveNiche, idea, smm, brandBook, styleProfile);
    const textRes = await fetchWithTimeout(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 3500,
        response_format: { type: "json_object" },
      }),
    });

    if (!textRes.ok) {
      const errBody = await textRes.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI text error ${textRes.status}: ${errBody.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const textData = await textRes.json() as { choices: Array<{ message: { content: string } }> };
    const rawContent = textData.choices[0]?.message?.content ?? "{}";
    let parsed: { hook: string; body: string; hashtags: string[]; imagePrompt: string; imageSuggestionRu?: string };
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      return NextResponse.json(
        { ok: false, error: `Не удалось распарсить ответ AI: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Preview: ${rawContent.slice(0, 100)}` },
        { status: 500 },
      );
    }

    // 2) Generate image via OpenAI DALL-E — opt-in, не фейлим пост, если картинка не вышла.
    // Раньше использовали Gemini, но free-tier выгорает за 10-20 картинок в день.
    let imageUrl: string | undefined;
    if (generateImage && parsed.imagePrompt) {
      try {
        const brandVisual = brandBook?.visualStyle?.trim();
        const brandColors = brandBook?.colors?.length
          ? `Brand colors: ${brandBook.colors.join(", ")}.`
          : "";
        // Жёсткое префиксирование ниши на уровне самого image-prompt-а.
        // Даже если GPT в `imagePrompt` забыл указать отрасль, эта строка
        // развернёт визуал в сторону реальной ниши. Помогает против
        // компаний-омонимов («Менделеев» — стоматология, не химия).
        const nichePrefix = effectiveNiche
          ? `Industry/niche context: ${effectiveNiche}. The image MUST visually depict this industry, not the literal meaning of the company name.`
          : "";
        // Какой базовый promp используем для DALL-E:
        //   1. Если юзер дал imagePromptOverride — это полностью его текст,
        //      берём его как есть, к нему только nichePrefix приклеиваем.
        //   2. Иначе — то что сгенерировал GPT в parsed.imagePrompt.
        const basePrompt = imagePromptOverride || parsed.imagePrompt;

        // Стиль картинки — пресет, превращается в английскую фразу для DALL-E.
        const STYLE_PHRASES: Record<string, string> = {
          photo:        "Photorealistic photo, natural lighting, professional photography",
          illustration: "Flat vector illustration, modern style, bright colors",
          minimalist:   "Minimalist composition, clean background, single focal subject",
          "3d":         "3D render, soft shadows, modern isometric style",
          anime:        "Anime / manga illustration style, vibrant",
          sketch:       "Hand-drawn pencil sketch style, monochrome",
          watercolor:   "Soft watercolor painting style, pastel palette",
        };
        const stylePhrase = imageStyle && STYLE_PHRASES[imageStyle] ? STYLE_PHRASES[imageStyle] : "";

        // Текст на картинке. По умолчанию запрещаем (так чище для соцсетей).
        // Если юзер явно попросил — добавляем инструкцию с конкретным текстом.
        const textInstruction = imageWithTextOverlay
          ? `Render this exact text large and clearly on the image (without any spelling mistakes), in a bold modern sans-serif: "${(imageOverlayText || parsed.hook || "").slice(0, 60)}". The text should be the main focal point and easily readable.`
          : "No text, letters, words or watermarks in the image.";

        const enrichedPrompt = [
          nichePrefix,
          basePrompt,
          stylePhrase,
          brandVisual && `Brand visual style: ${brandVisual}.`,
          brandColors,
          textInstruction,
        ].filter(Boolean).join(" ");

        // Platform-aware aspect: helper смотрит и на платформу, и на формат идеи.
        //   - stories/reels/tiktok/shorts → portrait (9:16)
        //   - linkedin/youtube/twitter/facebook → landscape (16:9)
        //   - instagram feed / vk / telegram / default → square (1:1)
        const format = platformImageFormat(idea.platform, idea.format);
        const isVertical = format === "portrait";

        // Chain: OpenAI → Gemini (если quota) → Pollinations (free, last resort).
        // Картинка опциональна, ни одна ошибка не должна валить пост.
        const imgResult = await generateOpenAIImage({ prompt: enrichedPrompt, format });
        if (imgResult.ok) {
          imageUrl = imgResult.imageUrl;
        } else {
          const isQuota = /billing|quota|rate.?limit|Лимит OpenAI|квота OpenAI/i.test(imgResult.error ?? "");
          if (isQuota) {
            // Try Gemini
            if (GEMINI_API_KEY) {
              const aspectHint =
                format === "portrait" ? " Vertical 9:16 portrait orientation." :
                format === "landscape" ? " Horizontal 16:9 landscape orientation." :
                " Square 1:1 aspect ratio.";
              const gem = await generateGeminiImage({
                prompt: enrichedPrompt + aspectHint,
              });
              if (gem.ok) imageUrl = gem.imageUrl;
            }
            // Then Pollinations (free, last resort)
            if (!imageUrl) {
              const poll = await generatePollinationsImage({
                prompt: enrichedPrompt,
                format,
                model: "flux",
              });
              if (poll.ok) imageUrl = poll.imageUrl;
            }
          }
        }
      } catch { /* image is optional */ }
    }

    // Конвертируем base64 data-URI картинку в стабильный `/api/image/{id}` URL.
    // Иначе ~1.5 MB base64 ушло бы в `GeneratedPost.imageUrl` → переполнило
    // localStorage и POST /api/data → пост терялся бы после reload.
    // Если userId нет (анонимный поток) или DB-инсёрт упал — возвращается
    // исходный data-URI: лучше показать пост, чем не показать ничего.
    const persistedImageUrl = await persistImageDataUri(imageUrl, access.userId);

    const result: GeneratedPost = {
      id: `post-${Date.now()}`,
      ideaId: idea.id,
      pillar: idea.pillar,
      hook: parsed.hook ?? idea.hook,
      body: parsed.body ?? "",
      hashtags: parsed.hashtags ?? [],
      imagePrompt: parsed.imagePrompt ?? "",
      imageSuggestionRu: parsed.imageSuggestionRu?.trim() || undefined,
      imageUrl: persistedImageUrl,
      platform: idea.platform,
      generatedAt: new Date().toISOString(),
    };

    // Используется gpt-4o (см. payload выше), не claude. Раньше логировалось
    // ошибочное claude-sonnet-4-6 → admin-аналитика по моделям была кривая.
    await access.log({ endpoint: "generate-post", model: "gpt-4o-mini" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
