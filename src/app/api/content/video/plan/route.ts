/**
 * POST /api/content/video/plan
 *
 * «Режиссёр» + встроенный QC-проход для конвейера «разобранный контент →
 * вертикальное видео». Берёт уже готовый сценарий рилса (из генератора
 * рилсов или из «Разбор ролика» → «Переписать под компанию») и разбивает
 * его на монтажный план под композицию ContentReel: короткий крючок,
 * призыв к действию и английские поисковые фразы для b-roll (Pexels плохо
 * понимает русский — см. fetch-stock-videos).
 *
 * QC — не отдельный AI-вызов, а проверка плана по чек-листу виральности
 * (крючок короткий и цепляющий, CTA есть и не путается с крючком, хотя бы
 * один b-roll запрос). Если план не проходит — ОДИН повторный запрос к
 * Claude с перечислением конкретных проблем (рефлексия), иначе принимаем
 * лучшую версию с пометкой в qcNotes — пайплайн не должен падать из-за
 * стилистических придирок.
 *
 * Body: { title, scenario, voiceoverScript, companyName?, companyNiche?, brandBook? }
 * Returns: { ok, data: { hookText, ctaText, brollQueries: string[], qcNotes: string[] } }
 */
import { NextResponse } from "next/server";
import type { BrandBook } from "@/lib/content-types";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { safeAnthropicStream, extractJson } from "@/lib/anthropic-safe";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
// 120 сек: промпт вырос (словарь styleSpec + запрет текста), плюс QC-ретрай
// может удвоить время. На 60 сек живой тест ловил таймаут.
export const maxDuration = 120;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — режиссёр монтажа коротких вертикальных видео (Reels/Shorts/TikTok).

Тебе дают готовый сценарий (тема + текст озвучки). Твоя задача — выделить из него ТРИ вещи для монтажа:

1. hookText — крючок для ПЕРВЫХ 2-3 секунд, крупный текст на экране. Короткий (до 60 знаков), цепляющий, на языке сценария. НЕ повторяй дословно первую фразу озвучки — это отдельный визуальный крючок, он может быть острее/короче.
2. ctaText — призыв к действию для ПОСЛЕДНИХ 3-4 секунд. Короткий (до 45 знаков), на языке сценария. Не дублирует hookText по смыслу.
3. brollQueries — 3-4 английские короткие фразы (2-5 слов каждая) — сцены, которыми AI-видеогенератор проиллюстрирует ролик. Конкретные, предметные (например "dentist examining patient", "musician recording session"), НЕ абстрактные ("business success").
   ЗАПРЕТ НА ТЕКСТ В КАДРЕ: не проси сцены, где по смыслу обязана быть надпись — вывески, витрины с названиями, экраны с текстом, документы крупным планом, доски с записями, книги разворотом. Видео-модель рисует вместо букв нечитаемый мусор (а кириллицу не умеет вовсе). Вместо "laptop screen with analytics dashboard" проси "hands typing on laptop, screen out of focus"; вместо "shop signboard" — "storefront at dusk, shallow depth of field".
4. mood — настроение фоновой музыки, СТРОГО одно из: "upbeat" (энергичное, продающее), "calm" (спокойное, доверительное), "corporate" (нейтрально-деловое), "dramatic" (напряжённое, для проблема→решение), "playful" (лёгкое, с юмором).

Отвечай СТРОГО валидным JSON без markdown, БЕЗ пояснений:
{"hookText":"...","ctaText":"...","brollQueries":["...","...","..."],"mood":"corporate"}`;

// Арт-директор — ОТДЕЛЬНЫЙ короткий вызов. Раньше стиль генерился в одном
// запросе с планом: ответ раздувался, генерация не укладывалась в лимит
// прокси, и падало ВСЁ — включая критичные brollQueries, без которых ролик
// остаётся без видеоряда. Теперь провал стиля стоит только дефолтного
// оформления, а не пустого ролика.
const STYLE_PROMPT = `Ты — арт-директор коротких вертикальных видео. Собери визуальную манеру под ролик из словаря ниже. Комбинируй под тему и аудиторию (клиника ≠ стритвир ≠ финтех), не бери один и тот же шаблон. Если задан стиль от пользователя — он ГЛАВНЕЕ твоего вкуса, переведи его буквально.

Словарь (ТОЛЬКО эти ключи и значения):
{
 "palette": {"accentIndex": 0..4, "baseIndex": 0..4, "baseTint": 0..1, "light": bool},
 "layout": {"hookPosition": "center"|"top"|"bottom", "hookAlign": "center"|"left", "captionPosition": "low"|"middle"|"high"},
 "voice": {"preset": "female-warm"|"female-energetic"|"male-calm"|"male-bold"|"neutral-narrator", "stability": 0..1, "expressiveness": 0..1},
 "typography": {"uppercase": bool, "weight": 700|800|900, "letterSpacing": -3..4, "fontScale": 0.8..1.25},
 "hook": {"wordAnimation": "spring-up"|"blur-in"|"slide-left"|"scale-pop"|"typewriter", "accentTarget": "longest"|"last"|"first"|"none", "underline": bool},
 "broll": {"transition": "fade"|"slide-left"|"slide-right"|"slide-up"|"wipe"|"flip"|"clock-wipe"|"punch"|"whip", "kenBurns": "subtle"|"strong"|"off"},
 "decor": {"grain": 0..1, "vignette": 0..1, "shapes": bool, "lightLeak": bool},
 "captions": {"mode": "pill"|"bare"|"boxed", "karaoke": bool},
 "progressBar": bool
}

О цветах: palette.accentIndex / baseIndex — это НОМЕРА цветов в палитре брендбука, которую тебе дали во входных данных (0 — первый цвет). Ты не задаёшь HEX, ты выбираешь, какой из брендовых цветов станет акцентом, а какой — подложкой фона. baseTint — насколько сильно фон окрашен в брендовый цвет (0 — почти чёрный/белый, 1 — насыщенный). light: true — светлая схема (тёмный текст на светлом), false — тёмная.

О голосе: voice.preset — тембр диктора, подбирай под тему и аудиторию. stability ниже (0.2-0.4) = живее и эмоциональнее, выше (0.6-0.8) = ровнее и солиднее. expressiveness выше = ярче интонации.

Подсказки по связкам:
- премиум/доверие/B2B: blur-in, fade, grain 0-0.2, pill, male-calm или neutral-narrator, stability 0.6-0.75, baseTint 0.1-0.25, hookPosition center
- энергия/продажа/акция: spring-up или scale-pop, punch/whip, grain 0.4-0.7, boxed, female-energetic или male-bold, stability 0.25-0.4, expressiveness 0.7-0.9, baseTint 0.4-0.7
- дерзко/молодёжно: uppercase, slide-left, whip, boxed, hookAlign left, hookPosition bottom, captionPosition middle, male-bold
- ностальгия/тепло/лайфстайл: lightLeak true, grain 0.6+, female-warm, light true возможен, baseTint 0.5+
- техно/футуризм: typewriter или blur-in, wipe/clock-wipe, letterSpacing 2-4, neutral-narrator, baseTint 0.15-0.3
- обучение/инструкция: progressBar true, captionPosition low, neutral-narrator, stability 0.7

Важно: два ролика на одну тему НЕ должны получить одинаковый набор. Меняй хотя бы по одному значению в каждой группе — цвет, положение текста, анимацию, переход, голос.

Ответ — ТОЛЬКО JSON словаря, без пояснений и markdown.`;

const VALID_MOODS = new Set(["upbeat", "calm", "corporate", "dramatic", "playful"]);

interface PlanResult { hookText: string; ctaText: string; brollQueries: string[]; mood?: string }

function buildBrandHints(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.toneOfVoice?.length) lines.push(`Тон: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`НЕ использовать: ${bb.forbiddenWords.join(", ")}`);
  return lines.length ? `\nБРЕНДБУК:\n${lines.join("\n")}\n` : "";
}

// Стриминг, а не messages.create: между нами и Anthropic стоит Cloudflare
// Worker (обход гео-блока РФ), и он рубит долгие нестриминговые запросы.
// Модель — haiku: план короткий и структурный, качества хватает, а скорость
// решает — на sonnet генерация не укладывалась в лимит прокси и падала с
// «Request timed out» даже на минимальном входе (проверено живым тестом).
async function callClaude(userMessage: string): Promise<{ raw: string; parsed: PlanResult | null; error?: string }> {
  const { text, error } = await safeAnthropicStream({
    model: "claude-haiku-4-5",
    max_tokens: 700, // только план: hook/cta/broll/mood, стиль отдельным вызовом
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  if (!text) return { raw: "", parsed: null, error };
  return { raw: text, parsed: extractJson<PlanResult>(text), error };
}

/**
 * Стиль — отдельный короткий вызов, best-effort. Возвращает undefined при
 * любой проблеме: композиция подставит свои дефолты, ролик всё равно
 * соберётся (см. resolveStyleSpec в remotion/src/style-spec.ts).
 */
async function callStyleDirector(context: string): Promise<Record<string, unknown> | undefined> {
  try {
    const { text } = await safeAnthropicStream({
      model: "claude-haiku-4-5",
      max_tokens: 700, // словарь вырос (palette/layout/voice) — 400 обрезало JSON
      system: STYLE_PROMPT,
      messages: [{ role: "user", content: context }],
    });
    if (!text) return undefined;
    const parsed = extractJson<Record<string, unknown>>(text);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** QC-чек-лист виральности. Возвращает список проблем (пусто = план ок). */
function validate(plan: PlanResult | null): string[] {
  if (!plan) return ["план не распарсился"];
  const issues: string[] = [];
  if (!plan.hookText?.trim()) issues.push("hookText пустой");
  else if (plan.hookText.length > 90) issues.push(`hookText слишком длинный (${plan.hookText.length} знаков, нужно до 60)`);
  if (!plan.ctaText?.trim()) issues.push("ctaText пустой");
  else if (plan.ctaText.length > 70) issues.push(`ctaText слишком длинный (${plan.ctaText.length} знаков, нужно до 45)`);
  if (plan.hookText && plan.ctaText && plan.hookText.trim() === plan.ctaText.trim()) issues.push("hookText и ctaText совпадают дословно");
  if (!Array.isArray(plan.brollQueries) || plan.brollQueries.filter(q => q?.trim()).length === 0) issues.push("нет ни одного brollQuery");
  return issues;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const title: string = (body.title ?? "").trim();
    const scenario: string = (body.scenario ?? "").trim();
    const voiceoverScript: string = (body.voiceoverScript ?? "").trim();
    const companyName: string = (body.companyName ?? "").trim();
    const companyNiche: string = (body.companyNiche ?? "").trim();
    const brandBook: BrandBook | null = body.brandBook ?? null;
    // Пользовательский стиль-промпт («неон и глитч», «мягкий пастельный») —
    // арт-директор переводит его в styleSpec, приоритет над авто-выбором.
    const stylePrompt: string = (body.stylePrompt ?? "").trim().slice(0, 300);

    if (!scenario && !voiceoverScript) {
      return NextResponse.json({ ok: false, error: "scenario или voiceoverScript обязателен" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const companyContext = companyName ? `Компания: ${companyName}${companyNiche ? ` (ниша: ${companyNiche.slice(0, 200)})` : ""}\n` : "";
    const baseMessage = `${companyContext}Название: ${title || "(без названия)"}

Текст озвучки:
${voiceoverScript || "(не указан)"}

Сценарий/раскадровка:
${scenario || "(не указан)"}
${buildBrandHints(brandBook)}
Составь монтажный план по инструкции.`;

    // План и стиль — параллельно и независимо: стиль не должен ни тормозить
    // план, ни ронять его при своём провале.
    // Палитру отдаём с номерами: арт-директор выбирает accentIndex/baseIndex
    // ИЗ НЕЁ, а не выдумывает HEX. Без этого блока индексы были бы игрой в
    // угадайку, и цвет ролика не зависел бы от брендбука клиента.
    const paletteHint = Array.isArray(brandBook?.colors) && brandBook.colors.length
      ? `\nПАЛИТРА БРЕНДБУКА (индексы для palette.accentIndex/baseIndex):\n${brandBook.colors.slice(0, 5).map((c, i) => `${i}: ${c}`).join("\n")}\n`
      : "\nПалитра брендбука не задана — цвета возьмутся нейтральные, но palette.light/baseTint всё равно влияют на схему.\n";

    const styleContext = `${companyContext}Тема ролика: ${title || scenario.slice(0, 200)}
Текст озвучки: ${voiceoverScript.slice(0, 400) || "(не указан)"}
${paletteHint}${stylePrompt ? `\nСТИЛЬ ОТ ПОЛЬЗОВАТЕЛЯ (приоритет): ${stylePrompt}` : ""}`;

    const [first, styleSpec] = await Promise.all([
      callClaude(baseMessage),
      callStyleDirector(styleContext),
    ]);
    let { raw, parsed } = first;
    let issues = validate(parsed);

    // QC-ретрай ТОЛЬКО при фатальном (нет плана / нет ни одного brollQuery).
    // Раньше он срабатывал на любую придирку вроде «hookText длинноват» и
    // удваивал время — из-за чего весь роут не укладывался в лимит прокси.
    // Стилистические замечания теперь просто уезжают в qcNotes.
    const fatal = !parsed || issues.some(i => i.includes("не распарсился") || i.includes("brollQuery"));
    if (fatal && issues.length > 0) {
      const fixMessage = `${baseMessage}

Твой прошлый ответ не прошёл проверку:
${issues.map(i => `- ${i}`).join("\n")}

Исправь и верни JSON заново, строго по формату.`;
      const retry = await callClaude(fixMessage);
      if (retry.parsed) {
        const retryIssues = validate(retry.parsed);
        // Берём вторую попытку, если она строго не хуже первой.
        if (retryIssues.length <= issues.length) { parsed = retry.parsed; issues = retryIssues; raw = retry.raw; }
      }
    }

    if (!parsed) {
      // Отдаём реальную причину (таймаут прокси, HTML от воркера и т.п.) —
      // без неё в job-статусе был безликий «plan: failed» без диагностики.
      return NextResponse.json(
        { ok: false, error: first.error ? `AI не вернул план: ${first.error}` : "AI не вернул валидный план" },
        { status: 502 },
      );
    }

    await access.log({
      endpoint: "content-video-plan",
      model: "claude-haiku-4-5",
      promptTokens: estimateTokens(SYSTEM_PROMPT + baseMessage + STYLE_PROMPT),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({
      ok: true,
      data: {
        hookText: (parsed.hookText ?? "").trim().slice(0, 120) || (title || "Смотрите до конца"),
        ctaText: (parsed.ctaText ?? "").trim().slice(0, 90) || "Узнайте подробнее",
        brollQueries: (parsed.brollQueries ?? []).filter(q => q?.trim()).slice(0, 4),
        mood: VALID_MOODS.has(parsed.mood ?? "") ? parsed.mood : "corporate",
        // styleSpec — из отдельного вызова арт-директора; undefined, если тот
        // не успел/упал (тогда композиция берёт дефолты). Отдаём как есть —
        // жёсткий санитайз (enum-whitelist, клампы) делает render-content-reel.
        styleSpec,
        qcNotes: styleSpec ? issues : [...issues, "стиль не сгенерирован — дефолтное оформление"],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
