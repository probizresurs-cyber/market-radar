import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichDomainData } from "@/lib/enricher";
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

// Фиксированная ценовая сетка — цены НЕ придумывает AI. Меняются здесь,
// в одном месте (или через env, если понадобится). DE-цены — стартовые
// плейсхолдеры, подтвердить у руководителя перед продажами в Германии.
const PRICE_POLICY: Record<KpLocale, {
  marketer: string; ours: string; astro: string; seoGeo: string; smm: string;
}> = {
  ru: {
    marketer: "100 000 ₽/мес",
    ours: "от 25 000 ₽/мес",
    astro: "10 000 ₽",
    seoGeo: "от 25 000 ₽/мес",
    smm: "от 25 000 ₽/мес",
  },
  de: {
    marketer: "4 500 €/Monat",
    ours: "ab 990 €/Monat",
    astro: "150 €",
    seoGeo: "ab 990 €/Monat",
    smm: "ab 990 €/Monat",
  },
};

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
  const p = PRICE_POLICY[locale];
  return `${ANTI_HALLUCINATION_SHORT}

Ты — старший маркетолог-стратег MarketRadar. По РЕАЛЬНЫМ данным анализа сайта собери коммерческое предложение (КП) — структуру PilotBundle. ВЕСЬ текст на ${lang} языке. Цены — в ${currency}. ${geoNote}

ЦЕНЫ — ФИКСИРОВАННАЯ СЕТКА, СВОИ НЕ ПРИДУМЫВАЙ:
- savings: маркетолог в штате ${p.marketer} → мы ${p.ours}
- offers[0] «Перенос сайта на Astro»: ${p.astro} (разовая работа)
- monthly: СЕО+ГЕО ${p.seoGeo}; СММ ${p.smm}
- unitEconomics.entry: про разовый вход ${p.astro} за перенос на Astro

СОГЛАСОВАННОСТЬ ЦИФР (КП с расходящимися цифрами = брак):
- hero.potential = "+{totalLow}–{totalHigh} заявок/мес" — ровно те же числа, что forecast.totalLow/totalHigh
- сумма последних (6-х) значений всех chart.series ≈ totalHigh (допуск ±15%)
- chart.series — те же каналы, что forecast.scenarios (3-4: SEO+GEO сайт, дистрибуция статей, соцсети, AI-видимость — выбери применимые к нише)
- unitEconomics.deals — из totalLow..totalHigh × конверсия (конверсию пометь как ОЦЕНКУ в dealsNote)
- unitEconomics.check — средний чек ТОЛЬКО из реальных данных сайта/ниши; если данных нет, напиши «уточним на созвоне»

ЖЁСТКИЕ ПРАВИЛА:
- Находки (findings) — ТОЛЬКО из переданных данных анализа. Никаких выдуманных цифр, конкурентов, отзывов. Каждая находка: evidence "fact" (проверено анализом) / "estimate" (оценка) / "forecast" (прогноз).
- Прогнозы (forecast, chart, hero.potential) — расчётная модель, честно помеченная. Не выдавай за факт.
- rivals (конкуренты): заполняй ТОЛЬКО если в данных есть реальные конкуренты с метриками. Если нет — верни пустой массив [] (секция скроется).
- guarantee — гарантия возврата за месяц при невыполнении объёма.

ФОРМАТ — СТРОГО валидный JSON PilotBundle без markdown. Соблюдай ФОРМУ вложенных объектов ТОЧНО (иначе КП сломается):
{
 "hero": {"verdict": "...", "potential": "+N заявок/мес", "potentialSub": "...", "badges": ["строка","строка","строка"]},
 "strengths": [{"title":"...","evidence":"fact|estimate","body":"...","leverage":"на что это опираемся в работе"}],
 "findings": [{"severity":"critical|warning","title":"...","evidence":"fact|estimate|forecast","fact":"...","why":"...","action":"...","effect":"..."}],
 "rivals": [{"name":"...","url":"...","strength":"...","weakness":"...","steal":"что у них забрать"}],
 "trump": "...",
 "savings": {"marketerPrice":"из ценовой сетки","ourPrice":"из ценовой сетки","headline":"Столько же работы — в разы дешевле штатного маркетолога","note":"..."},
 "unitEconomics": {"deals":"N–M","dealsNote":"договоров в месяц (конверсия X–Y% — ОЦЕНКА)","check":"... или «уточним на созвоне»","checkNote":"средний чек — откуда цифра","entry":"Разовый вход — ... за перенос на Astro: ..."},
 "geo": {
   "intro":"что такое GEO и почему в ответах ассистентов сейчас конкуренты, а не клиент",
   "whyNow":"почему входить сейчас дешевле",
   "assistants":[{"name":"Алиса / Яндекс Нейро","rewards":"что нужно, чтобы этот ассистент называл бренд"},{"name":"ChatGPT","rewards":"..."},{"name":"Perplexity","rewards":"..."},{"name":"GigaChat (Сбер)","rewards":"..."}],
   "levers":[{"title":"...","detail":"..."}],
   "method":{"intro":"как честно замеряем","metric":"метрика: % ответов с упоминанием бренда","questions":["вопрос 1","...","6-8 контрольных вопросов ассистентам под нишу"]},
   "forecast":[{"month":"1-й месяц","evidence":"estimate","text":"..."},{"month":"3-й месяц","evidence":"forecast","text":"..."},{"month":"6-й месяц","evidence":"forecast","text":"..."}]
 },
 "forecast": {"formula":"...","assumptions":["..."],"example":"...","scenarios":[{"name":"...","desc":"...","m1":"...","m3":"...","m6":"..."}],"totalLow":N,"totalHigh":N},
 "chart": {"months":["мес 1","мес 2","мес 3","мес 4","мес 5","мес 6"],"series":[{"name":"...","values":[6 чисел — ровно 6, без null]}]},
 "offers": [{"n":1,"name":"Перенос сайта на Astro","price":"...","priceNote":"разовая работа","what":["..."],"gets":["..."],"effort":"почему такая цена"}],
 "monthly": [{"name":"...","price":"от ...","items":["..."]}],
 "offersTotal": "...",
 "timeline": [{"week":"Неделя 1","text":"..."}],
 "positionDiagnosis": {"ключевой-запрос-строчными":"короткий диагноз почему такая позиция"},
 "guarantee": "...",
 "articles": [{"title":"...","excerpt":"...","body":"...","geoNotes":["..."]}],
 "articleMechanics": ["..."],
 "month1": ["..."]
}
СТРОГО: geo.assistants/levers — массивы объектов; geo.method — ОБЪЕКТ с массивом questions; geo.forecast — массив объектов {month,evidence,text}. badges — ровно 3 строки. chart: длина values = длине months = 6; сумма серий к 6-му месяцу ≈ forecast.totalHigh. positionDiagnosis — словарь по реальным запросам (ключи строчными). articles — 3 примера статей. Если реальных конкурентов в данных нет — верни "rivals": [].`;
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
  const kws = company.seo?.keywords;
  if (Array.isArray(kws) && kws.length) parts.push(`Ключевые запросы ниши (для positionDiagnosis, ключи строчными): ${kws.slice(0, 12).map(k => typeof k === "string" ? k : (k as { keyword?: string }).keyword).filter(Boolean).join(", ")}`);
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

  // 3. Обогащение домена — ТО ЖЕ, что делает /api/analyze, иначе у авто-КП
  //    пустой Тех-аудит и AI-видимость (пилоты берут это из полного анализа
  //    платформы). Маппинг зеркалит src/app/api/analyze/route.ts.
  try {
    const domain = (company.company.url || scraped.url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const real = await enrichDomainData(domain, scraped.socialLinks || {});
    if (real) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seo = company.seo as any;
      if (real.spywords) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (company as any).spywordsDashboard = {
          overview: real.spywords.overview, competitors: real.spywords.competitors,
          advCompetitors: real.spywords.advCompetitors, ads: real.spywords.ads,
          topPages: real.spywords.topPages, smartKeywords: real.spywords.smartKeywords, organic: real.spywords.organic,
        };
      }
      if (real.keyso) {
        if (real.keyso.yandex.length > 0) { seo.positions = real.keyso.yandex; seo.keywordsSource = "keyso"; }
        if (real.keyso.google.length > 0) seo.googlePositions = real.keyso.google;
        if (real.keyso.dashboard) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (company as any).keysoDashboard = real.keyso.dashboard;
          if (real.keyso.dashboard.yandex && real.keyso.dashboard.yandex.traffic > 0) {
            seo.estimatedTraffic = `~${real.keyso.dashboard.yandex.traffic.toLocaleString("ru-RU")} визитов/мес (Key.so)`;
          }
        }
      }
      if (real.pageSpeed) {
        seo.lighthouseScores = { ...real.pageSpeed, ...(real.pageSpeedDesktop ? { desktop: real.pageSpeedDesktop } : {}) };
      } else if (real.pageSpeedDesktop) {
        seo.lighthouseScores = { ...real.pageSpeedDesktop, desktop: real.pageSpeedDesktop };
      }
      if (real.domainAge) seo.domainAge = real.domainAge;
    }
  } catch { /* энричеры best-effort — не роняем генерацию */ }

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
  // Санитайз — чтобы битый ответ LLM НЕ ронял KpProposal (он читает вложенные
  // .map без защиты). Гарантируем форму каждого поля, которое рендерится.
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : []);
  bundle.rivals = arr(bundle.rivals);
  bundle.positionDiagnosis = bundle.positionDiagnosis && typeof bundle.positionDiagnosis === "object" && !Array.isArray(bundle.positionDiagnosis) ? bundle.positionDiagnosis : {};
  bundle.articles = arr(bundle.articles);
  bundle.articleMechanics = arr(bundle.articleMechanics);
  bundle.month1 = arr(bundle.month1);
  bundle.strengths = arr(bundle.strengths);
  bundle.offers = arr(bundle.offers);
  bundle.monthly = arr(bundle.monthly);
  bundle.timeline = arr(bundle.timeline);

  // geo — источник краша: компонент делает .map по assistants/levers/method.questions/forecast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (bundle.geo ?? {}) as any;
  bundle.geo = {
    intro: g.intro || "", whyNow: g.whyNow || "",
    assistants: arr(g.assistants),
    levers: arr(g.levers),
    method: {
      intro: g.method?.intro || "",
      metric: g.method?.metric || "",
      questions: arr(g.method?.questions),
    },
    forecast: arr(g.forecast),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  // chart — PilotForecastChart падает в NaN при кривых values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (bundle.chart ?? {}) as any;
  const months = arr<string>(ch.months).length === 6 ? ch.months : ["мес 1", "мес 2", "мес 3", "мес 4", "мес 5", "мес 6"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series = arr<any>(ch.series)
    .filter((s) => s && typeof s.name === "string" && Array.isArray(s.values))
    .map((s) => ({ name: s.name, values: (s.values as unknown[]).slice(0, 6).map((n) => (typeof n === "number" && isFinite(n) ? n : 0)) }))
    .filter((s) => s.values.length === 6);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bundle.chart = { months, series } as any;

  // forecast — компонент читает scenarios[].{name,desc,m1,m3,m6} и totalLow/High.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = (bundle.forecast ?? {}) as any;
  fc.assumptions = arr(fc.assumptions);
  fc.scenarios = arr(fc.scenarios);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bundle.forecast = fc;

  return { company, bundle, companyName: company.company.name || scraped.title || rawUrl };
}
