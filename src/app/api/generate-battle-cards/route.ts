import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { friendlyAiError } from "@/lib/ai-error";
import Anthropic from "@anthropic-ai/sdk";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BattleCardObjection {
  objection: string;       // типичное возражение клиента в пользу конкурента
  counter: string;         // наш ответный аргумент
}

export interface BattleCardPricing {
  competitorRange: string; // "от 5 000 ₽/мес"
  ourRange: string;        // "от 3 900 ₽/мес"
  positioningNote: string; // краткий комментарий о позиционировании
}

export interface BattleCard {
  competitorName: string;
  competitorUrl: string;
  competitorScore: number;
  strengths: string[];         // 3 сильных стороны конкурента (vs нас)
  weaknesses: string[];        // 3 слабых стороны конкурента (vs нас)
  objections: BattleCardObjection[]; // 2-3 возражения + контраргументы
  pricing: BattleCardPricing;
  migrationTrigger: string;    // когда клиент уходит от конкурента к нам
  winCondition: string;        // ключевое условие победы в сделке
  talkingPoints: string[];     // 3 фразы для продажника (готовые скрипты)
  riskFactors: string[];       // 1-2 риска — когда мы проигрываем
  /** 3-5 квалификационных вопросов prospect-у, чтобы понять, выиграем ли мы */
  discoveryQuestions?: string[];
  /** TL;DR-сводка для продажника на 1 строку — где ловить, где избегать */
  cheatSheet?: string;
}

export interface BattleCardsResult {
  generatedAt: string;
  myCompanyName: string;
  niche: string;
  cards: BattleCard[];
  executiveSummary: string;    // 2-3 предложения — общая расстановка сил
}

// ─── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM = `Ты — эксперт по конкурентным продажам (competitive intelligence) и battle card‑методологии.

Battle card — инструмент, который помогает менеджеру по продажам:
• быстро найти слабые места конкурента
• парировать возражения клиента ("а у конкурента дешевле / лучше / надёжнее")
• знать точный момент, когда клиент созрел уйти от конкурента к нам
• говорить конкретными скриптами, а не общими фразами

ПРАВИЛА:
1. Каждый battle card должен быть конкретным и боевым — никакой воды.
2. Слабые стороны конкурента — это РЕАЛЬНЫЕ боли их клиентов, а не придуманные.
3. Аргументы должны звучать убедительно, не как реклама.
4. Скрипты (talkingPoints) — живые фразы, которые продажник произнесёт вслух.
5. Ценовое позиционирование — честное, без фантастики.

ВАЖНО: Отвечай ТОЛЬКО валидным JSON без markdown-обёрток. Начинай с { и заканчивай }.`;

/** Промпт для отдельной карточки (одного конкурента). */
function buildSingleCardPrompt(
  myName: string,
  myUrl: string,
  myScore: number,
  niche: string,
  comp: { name: string; url: string; score: number; description?: string; strengths?: string[]; weaknesses?: string[] },
): string {
  return `${ANTI_HALLUCINATION_SHORT}

Создай ОДНУ battle card для нашей компании "${myName}" (${myUrl}) в нише: ${niche}.
Оценка нашей компании: ${myScore}/100.

КОНКУРЕНТ:
Название: ${comp.name}
Сайт: ${comp.url}
Оценка: ${comp.score}/100${comp.description ? `\nОписание: ${comp.description}` : ""}${comp.strengths?.length ? `\nИзвестные сильные стороны: ${comp.strengths.join("; ")}` : ""}${comp.weaknesses?.length ? `\nИзвестные слабые стороны: ${comp.weaknesses.join("; ")}` : ""}

Верни СТРОГО валидный JSON одной карточки:
{
  "competitorName": "${comp.name}",
  "competitorUrl": "${comp.url}",
  "competitorScore": ${comp.score},
  "strengths": ["сильная сторона #1", "сильная сторона #2", "сильная сторона #3"],
  "weaknesses": ["слабая сторона #1", "слабая сторона #2", "слабая сторона #3"],
  "objections": [
    {"objection": "У вас дороже / у конкурента X дешевле", "counter": "Конкретный встречный аргумент с цифрами"},
    {"objection": "Второе типичное возражение", "counter": "Наш ответ"},
    {"objection": "Третье возражение", "counter": "Наш ответ"}
  ],
  "pricing": {
    "competitorRange": "диапазон цен конкурента",
    "ourRange": "наш диапазон цен",
    "positioningNote": "1 предложение о разнице в позиционировании"
  },
  "migrationTrigger": "Конкретный момент когда клиент уходит от конкурента к нам",
  "winCondition": "Главное условие победы над этим конкурентом",
  "talkingPoints": ["Фраза для продажника #1", "Фраза #2", "Фраза #3"],
  "riskFactors": ["Ситуация когда мы проигрываем", "Второй риск"],
  "discoveryQuestions": [
    "Квалификационный вопрос #1 — о боли клиента",
    "Вопрос #2 — о текущем опыте с конкурентом",
    "Вопрос #3 — о критериях выбора",
    "Вопрос #4 — о бюджете и сроках"
  ],
  "cheatSheet": "Одна строка: где ловить, где избегать, главный аргумент"
}`;
}

/** Промпт для общей расстановки сил (executive summary). */
function buildSummaryPrompt(
  myName: string,
  niche: string,
  competitors: Array<{ name: string; score: number }>,
  myScore: number,
): string {
  return `${ANTI_HALLUCINATION_SHORT}

Сформулируй краткую расстановку сил на рынке для отдела продаж.

Наша компания: ${myName} (${myScore}/100), ниша: ${niche}
Конкуренты:
${competitors.map(c => `- ${c.name} (${c.score}/100)`).join("\n")}

Верни JSON:
{"executiveSummary":"2-3 предложения — где мы сильны, где конкуренты сильны, главная ставка для продаж"}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Достаёт текст из ответа Claude — ищет ПЕРВЫЙ text-блок, а не content[0].
 *  content[0] может быть thinking/tool_use блоком — тогда .text undefined. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(msg: any): string {
  const content = msg?.content;
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      return block.text.trim();
    }
  }
  return "";
}

/** Извлекает JSON из ответа Claude — снимает markdown, walk-back, repair. */
function extractJson<T>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== "string") return null;
  const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) return null;
  const candidate = stripped.slice(start);
  // 1. Прямой парс полного среза
  const end = candidate.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(candidate.slice(0, end + 1)) as T; } catch { /* fallthrough */ }
  }
  // 2. Walk-back — ищем последний валидный }
  for (let i = candidate.length - 1; i > 0; i--) {
    if (candidate[i] === "}") {
      try { return JSON.parse(candidate.slice(0, i + 1)) as T; } catch { /* continue */ }
    }
  }
  return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const myCompany: { name: string; url: string; score: number; niche?: string } = body.myCompany;
    const competitors: Array<{
      name: string; url: string; score: number;
      description?: string; strengths?: string[]; weaknesses?: string[];
    }> = body.competitors ?? [];

    if (!myCompany?.name) {
      return NextResponse.json({ ok: false, error: "myCompany.name обязателен" }, { status: 400 });
    }
    if (competitors.length === 0) {
      return NextResponse.json({ ok: false, error: "Список конкурентов пуст" }, { status: 400 });
    }
    // Защита от DoS: N конкурентов = N параллельных Anthropic-вызовов.
    // Ограничиваем до 10 — при 50 можно сжечь rate-limit за один запрос.
    const limitedCompetitors = competitors.slice(0, 10);

    const niche = myCompany.niche ?? "не указана";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    const anthropic = new Anthropic({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    // ─── Параллельная генерация: 1 запрос на executive summary + 1 на каждую карточку ─
    // Это надёжнее чем единый монолитный JSON: каждый запрос укладывается в
    // комфортные 4096 токенов, ошибка в одной карточке не валит остальные,
    // 3 карточки генерируются за то же время что 1 (параллельно).

    const summaryPromise = anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: buildSummaryPrompt(
        myCompany.name,
        niche,
        limitedCompetitors.map(c => ({ name: c.name, score: c.score })),
        myCompany.score,
      ) }],
    });

    const cardPromises = limitedCompetitors.map(comp =>
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        // 4096 — потолок per-card. Структура одной карточки ~2000-2500 токенов
        // даже на сложных нишах. Запас 1.5x обеспечивает что JSON всегда
        // помещается целиком и не обрезается.
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: buildSingleCardPrompt(
          myCompany.name,
          myCompany.url,
          myCompany.score,
          niche,
          comp,
        ) }],
      }),
    );

    const [summaryResult, ...cardResults] = await Promise.allSettled([
      summaryPromise,
      ...cardPromises,
    ]);

    // Executive summary — если упал, ставим заглушку
    let executiveSummary = "";
    let summaryTokensIn = 0;
    let summaryTokensOut = 0;
    if (summaryResult.status === "fulfilled") {
      const msg = summaryResult.value;
      summaryTokensIn = msg.usage.input_tokens;
      summaryTokensOut = msg.usage.output_tokens;
      const parsed = extractJson<{ executiveSummary?: string }>(extractText(msg));
      executiveSummary = parsed?.executiveSummary ?? "";
    } else {
      console.warn("[generate-battle-cards] executive summary не сгенерилось:", summaryResult.reason);
    }

    // Карточки — собираем только успешные. competitors[i] ↔ cardResults[i]
    const cards: BattleCard[] = [];
    let totalCardTokensIn = 0;
    let totalCardTokensOut = 0;
    const failedCompetitors: string[] = [];
    // Собираем первую реальную причину провала чтобы показать юзеру (не общее «попробуйте снова»)
    let firstFailReason = "";

    cardResults.forEach((result, idx) => {
      const comp = limitedCompetitors[idx];
      if (result.status === "fulfilled") {
        const msg = result.value;
        totalCardTokensIn += msg.usage.input_tokens;
        totalCardTokensOut += msg.usage.output_tokens;
        const text = extractText(msg);
        const card = extractJson<BattleCard>(text);
        if (card && card.competitorName) {
          // Гарантируем, что URL/score из исходных данных
          card.competitorUrl = card.competitorUrl || comp.url;
          card.competitorScore = typeof card.competitorScore === "number" ? card.competitorScore : comp.score;
          cards.push(card);
        } else {
          console.warn(`[generate-battle-cards] карточка для ${comp.name} не распарсилась. stop_reason: ${msg.stop_reason}, raw:`, text.slice(0, 300));
          if (!firstFailReason) {
            firstFailReason = text
              ? `AI вернул нераспознаваемый JSON (stop_reason: ${msg.stop_reason})`
              : `AI вернул пустой ответ (stop_reason: ${msg.stop_reason})`;
          }
          failedCompetitors.push(comp.name);
        }
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.warn(`[generate-battle-cards] карточка для ${comp.name} не сгенерилась:`, reason);
        if (!firstFailReason) firstFailReason = reason;
        failedCompetitors.push(comp.name);
      }
    });

    if (cards.length === 0) {
      // Показываем реальную причину — обычно это лимит/ошибка Anthropic API.
      const detail = firstFailReason ? ` Причина: ${firstFailReason}` : "";
      return NextResponse.json(
        { ok: false, error: `Не удалось сгенерировать ни одной карточки.${detail} Попробуйте повторить запрос.` },
        { status: 500 },
      );
    }

    const data: BattleCardsResult = {
      generatedAt: new Date().toISOString(),
      myCompanyName: myCompany.name,
      niche,
      executiveSummary: executiveSummary || `Расстановка сил в нише «${niche}» среди ${limitedCompetitors.length} конкурентов.`,
      cards,
    };

    await access.log({
      endpoint: "/api/generate-battle-cards",
      model: "claude-sonnet-4-6",
      promptTokens: summaryTokensIn + totalCardTokensIn,
      completionTokens: summaryTokensOut + totalCardTokensOut,
      durationMs: 0,
    });

    if (failedCompetitors.length > 0) {
      console.warn(`[generate-battle-cards] частичный успех: ${cards.length}/${limitedCompetitors.length} карточек, упали: ${failedCompetitors.join(", ")}`);
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[generate-battle-cards]", err);
    const { message, status } = friendlyAiError(err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
