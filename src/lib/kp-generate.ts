import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichCompanyData } from "@/lib/enricher";
import { safeAnthropicStream, extractJson } from "@/lib/anthropic-safe";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";

/**
 * Генерация полного КП по одной ссылке — без предварительного анализа на
 * платформе (для /kp-ru, /kp-de). Глубокий режим:
 *   1. scrapeWebsite — вёрстка/контент/соцсети/стек.
 *   2. analyzeWithClaude — настоящий анализ (SEO, Lighthouse, оценки,
 *      конкуренты, AI-восприятие) → AnalysisResult.
 *   3. enrichCompanyData — реквизиты/индустрия (не критично, best-effort).
 *   4. AI-обёртка: из реального AnalysisResult собираем PilotBundle
 *      (находки, GEO, прогноз, офферы) на языке locale.
 *
 * Анти-галлюцинация обязательна: находки только из реальных данных анализа,
 * прогноз помечается моделью, при нехватке данных секции честно пустые
 * (rivals: [] → «Лидеры ниши» скрывается, как у biglife).
 */

export type KpLocale = "ru" | "de";
const MODEL = "claude-sonnet-4-6";

export interface KpGenResult {
  company: AnalysisResult;
  bundle: PilotBundle;
  companyName: string;
}

function bundleSchemaPrompt(locale: KpLocale): string {
  const lang = locale === "de" ? "НЕМЕЦКОМ" : "РУССКОМ";
  const currency = locale === "de" ? "EUR (€)" : "рублях (₽)";
  const geoNote = locale === "de"
    ? "Рынок — Германия: поиск Google (не Yandex), ассистенты ChatGPT/Perplexity/Gemini."
    : "Рынок — Россия: Яндекс+Google, ассистенты Алиса/Яндекс Нейро/ChatGPT/GigaChat.";
  return `${ANTI_HALLUCINATION_SHORT}

Ты — старший маркетолог-стратег MarketRadar. По РЕАЛЬНЫМ данным анализа сайта собери коммерческое предложение (КП) — структуру PilotBundle. ВЕСЬ текст на ${lang} языке. Цены — в ${currency}. ${geoNote}

ЖЁСТКИЕ ПРАВИЛА:
- Находки (findings) — ТОЛЬКО из переданных данных анализа. Никаких выдуманных цифр, конкурентов, отзывов. Каждая находка: evidence "fact" (проверено анализом) / "estimate" (оценка) / "forecast" (прогноз).
- Прогнозы (forecast, chart, hero.potential) — расчётная модель, честно помеченная. Не выдавай за факт.
- rivals (конкуренты): заполняй ТОЛЬКО если в данных есть реальные конкуренты с метриками. Если нет — верни пустой массив [] (секция скроется).
- В offers обязательно 1-й оффер — перенос сайта на Astro (разовый вход, фикс-цена ~10 000 ₽ / ~120 €), с честной оценкой объёма в effort.
- В monthly — помесячные направления (СЕО+ГЕО, СММ) с ценами «от …».
- guarantee — гарантия возврата за месяц при невыполнении объёма.

ФОРМАТ — СТРОГО валидный JSON PilotBundle без markdown:
{
 "hero": {"verdict": "...", "potential": "+N заявок/мес", "potentialSub": "...", "badges": ["...","...","..."]},
 "strengths": [{"title":"...","detail":"..."}],
 "findings": [{"severity":"critical|warning","title":"...","evidence":"fact|estimate|forecast","fact":"...","why":"...","action":"...","effect":"..."}],
 "rivals": [],
 "trump": "...",
 "geo": {"intro":"...","whyNow":"...","mechanics":["..."],"method":["..."],"forecast":["..."]},
 "forecast": {"formula":"...","assumptions":["..."],"example":"...","scenarios":[{"name":"...","desc":"...","m1":"...","m3":"...","m6":"...","mid":N}],"totalLow":N,"totalHigh":N},
 "chart": {"months":["мес 1",..."мес 6"],"series":[{"name":"...","values":[6 чисел]}]},
 "offers": [{"n":1,"name":"Перенос сайта на Astro","price":"...","priceNote":"...","what":["..."],"gets":["..."],"effort":"..."}],
 "monthly": [{"name":"...","price":"от ...","items":["..."]}],
 "offersTotal": "...",
 "timeline": [{"week":"Неделя 1","text":"..."}],
 "positionDiagnosis": {},
 "guarantee": "...",
 "articles": [{"title":"...","excerpt":"...","body":"...","geoNotes":["..."]}],
 "articleMechanics": ["..."],
 "month1": ["..."]
}
geo.method — 15-20 контрольных вопросов ассистентам под нишу. articles — 3 примера статей. chart.series суммарно даёт forecast.totalLow..totalHigh к 6 мес.`;
}

function buildContext(company: AnalysisResult, scraped: Awaited<ReturnType<typeof scrapeWebsite>>): string {
  const c = company.company;
  const parts: string[] = [];
  parts.push(`Сайт: ${c.url}`);
  parts.push(`Название: ${c.name}`);
  if (c.description) parts.push(`Описание: ${c.description}`);
  parts.push(`Общий скор: ${c.score}/100. По категориям: ${(c.categories || []).map(x => `${x.name} ${x.score}`).join(", ")}`);
  if (company.seo) parts.push(`SEO/тех: ${JSON.stringify(company.seo).slice(0, 800)}`);
  if (company.aiPerception) parts.push(`AI-восприятие бренда: ${JSON.stringify(company.aiPerception).slice(0, 500)}`);
  const rivals = company.spywordsDashboard?.competitors?.yandex ?? company.keysoDashboard?.yandex?.competitors ?? [];
  if (Array.isArray(rivals) && rivals.length) parts.push(`Конкуренты из данных: ${JSON.stringify(rivals).slice(0, 600)}`);
  parts.push(`Соцсети: ${Object.keys(scraped.socialLinks || {}).join(", ") || "нет"}`);
  parts.push(`Стек: ${(scraped.techStack || []).join(", ") || "н/д"}`);
  parts.push(`Контент (выдержка): ${(scraped.rawTextSample || "").slice(0, 2500)}`);
  return parts.join("\n");
}

export async function generateKp(rawUrl: string, locale: KpLocale): Promise<KpGenResult> {
  // 1. Скрап
  const scraped = await scrapeWebsite(rawUrl);

  // 2. Глубокий анализ (настоящий движок платформы)
  const company: AnalysisResult = await analyzeWithClaude(scraped);
  company.company.url = company.company.url || scraped.url;

  // 3. Обогащение (best-effort — не роняем генерацию)
  try {
    const domain = (company.company.url || scraped.url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const enriched = await enrichCompanyData(company.company.name, domain);
    if (enriched) Object.assign(company, { _enriched: enriched });
  } catch { /* игнорируем */ }

  // 4. AI-обёртка в PilotBundle
  const { text, error } = await safeAnthropicStream({
    model: MODEL,
    max_tokens: 16000,
    system: bundleSchemaPrompt(locale),
    messages: [{ role: "user", content: buildContext(company, scraped) }],
    temperature: 0.4,
  });
  if (!text) throw new Error(error || "AI не вернул КП");

  const bundle = extractJson<PilotBundle>(text);
  if (!bundle || !bundle.hero || !Array.isArray(bundle.findings)) {
    throw new Error("AI вернул КП в неожиданном формате");
  }
  // Санитайз обязательных полей — чтобы KpProposal не падал.
  bundle.rivals = Array.isArray(bundle.rivals) ? bundle.rivals : [];
  bundle.positionDiagnosis = bundle.positionDiagnosis && typeof bundle.positionDiagnosis === "object" ? bundle.positionDiagnosis : {};
  bundle.articles = Array.isArray(bundle.articles) ? bundle.articles : [];
  bundle.articleMechanics = Array.isArray(bundle.articleMechanics) ? bundle.articleMechanics : [];
  bundle.month1 = Array.isArray(bundle.month1) ? bundle.month1 : [];
  bundle.strengths = Array.isArray(bundle.strengths) ? bundle.strengths : [];

  return { company, bundle, companyName: company.company.name || scraped.title || rawUrl };
}
