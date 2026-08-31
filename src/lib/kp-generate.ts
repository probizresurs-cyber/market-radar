import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichDomainData } from "@/lib/enricher";
import { findBrandSocials } from "@/lib/brand-socials";
import { safeAnthropicStream, extractJson } from "@/lib/anthropic-safe";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkKpAiVisibility, type KpAiCheckResult } from "@/lib/kp-ai-visibility";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";
import { kpStaticBlocks } from "@/lib/kp-static-blocks";
import { bukvarixCompareDomains } from "@/lib/bukvarix";

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
// в одном месте (или через env, если понадобится).
// DE-цены — прямая конвертация RU-сетки по курсу ~100 ₽/€ (округлено для
// маркетинговых цифр), НЕ калибровка под реальный немецкий рынок услуг —
// это явная просьба владельца («цены прикинь от русских»), а не независимая
// оценка. Перед реальными продажами в Германии стоит свериться с фактическими
// ставками агентств там (обычно выше, чем прямая конвертация РФ-цен).
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
    // Минимум 500 € для Европы — правка владельца 24.07.26 («Анализ Де.docx»):
    // ab 100/250 € выглядели несерьёзно для немецкого рынка.
    marketer: "1 000 €/Monat",
    ours: "ab 500 €/Monat",
    astro: "500 €",
    seoGeo: "ab 500 €/Monat",
    smm: "ab 500 €/Monat",
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
  const assistantsExample = locale === "de"
    ? `[{"name":"ChatGPT","rewards":"..."},{"name":"Claude","rewards":"..."},{"name":"Perplexity","rewards":"..."},{"name":"Google Gemini","rewards":"..."},{"name":"Microsoft Copilot","rewards":"..."}]`
    : `[{"name":"Алиса / Яндекс Нейро","rewards":"..."},{"name":"ChatGPT","rewards":"..."},{"name":"Claude","rewards":"..."},{"name":"Perplexity","rewards":"..."},{"name":"GigaChat (Сбер)","rewards":"..."}]`;
  // Остальные примеры-заглушки в схеме ниже — тоже НЕ переводились по locale
  // и рисковали протечь в бандл буквально (модель копирует форму примера).
  const potentialExample = locale === "de" ? "+N–M % Sichtbarkeit" : "+N–M % к видимости";
  const monthsExample = locale === "de"
    ? `["Monat 1","Monat 2","Monat 3","Monat 4","Monat 5","Monat 6"]`
    : `["мес 1","мес 2","мес 3","мес 4","мес 5","мес 6"]`;
  // DE: без слова «Astro» и без «Umzug/переезд» — клиента пугает миграция
  // (правка владельца). Продаём техническую модернизацию с сохранением дизайна.
  // RU: «перенос сайта» пугает не меньше, чем немцев «Umzug» — продаём
  // ускорение с сохранением дизайна, а не миграцию на фреймворк.
  const offerNameExample = locale === "de" ? "Technische Website-Modernisierung" : "Ускорение сайта — дизайн не меняется";
  const offerPriceNoteExample = locale === "de" ? "einmalige Arbeit" : "разовая работа";
  const weekExample = locale === "de" ? "Woche 1" : "Неделя 1";
  const deferToCallExample = locale === "de" ? "klären wir im Erstgespräch" : "уточним на созвоне";
  return `${ANTI_HALLUCINATION_SHORT}

Ты — старший маркетолог-стратег MarketRadar. По РЕАЛЬНЫМ данным анализа сайта собери коммерческое предложение (КП) — структуру PilotBundle. ВЕСЬ текст на ${lang} языке. Цены — в ${currency}. ${geoNote}

ЦЕНЫ — ФИКСИРОВАННАЯ СЕТКА, СВОИ НЕ ПРИДУМЫВАЙ:
- savings: маркетолог в штате ${p.marketer} → мы ${p.ours}
- offers[0] «${offerNameExample}»: ${p.astro} (разовая работа)
- monthly: СЕО+ГЕО ${p.seoGeo}; СММ ${p.smm}
- unitEconomics.entry: про разовый вход ${p.astro} за ${locale === "de" ? "техническую модернизацию сайта" : "ускорение сайта"}
- ЗАПРЕТ (обе локали): НЕ используй слова "Astro", "перенос", "миграция", "Umzug", "Migration" — клиента пугает «переезд сайта». offers[0].effort объясни через ценность: технические проблемы из находок будут исправлены, дизайн останется 1:1, сайт получит чистую техническую основу для SEO и GEO. Никакого фреймворк-жаргона.

ГЛАВНОЕ ПРАВИЛО ЭТОГО КП: ДОКАЗАТЕЛЬСТВО ИЛИ МОЛЧАНИЕ.
Клиент — человек, который сам проверяет цифры вручную. Любое число, которое он
может перепроверить и не сойтись с нами, обесценивает весь документ целиком.
Поэтому:
- ЗАПРЕЩЕНО сравнивать клиента со «средним по рынку», «средним уровнем», «нормой
  отрасли», «конкурентами в среднем». У нас НЕТ выборки, по которой считается
  среднее, — это выдумка. Сравнивать можно ТОЛЬКО с конкретным конкурентом,
  названным по имени, с его конкретной цифрой из данных анализа.
- ЗАПРЕЩЕНЫ обороты-пустышки: «в современном цифровом мире», «комплексный
  подход», «синергия», «лидер рынка», «уникальная методология», «инновационные
  решения», «выйти на новый уровень» как самостоятельное утверждение. Каждое
  предложение обязано нести проверяемый факт или конкретное действие.
- ЗАПРЕЩЕНО противоречить самому себе. Если в находках сказано «сайт медленный»,
  в сильных сторонах не может быть «быстрый сайт». Перед выдачей перечитай:
  сильные стороны и находки не должны спорить.
- Каждая цифра сопровождается происхождением: откуда взята. Нет источника —
  цифры нет.

СОГЛАСОВАННОСТЬ ПРОГНОЗА:
- Прогноз даётся ТОЛЬКО в ОТНОСИТЕЛЬНЫХ величинах: проценты к текущему
  состоянию (видимость, трафик, доля ответов ассистентов с брендом). Абсолютные
  «+N заявок/мес» ЗАПРЕЩЕНЫ: мы не знаем ни текущего потока обращений клиента,
  ни его конверсии, и для бизнеса с тысячей заявок «+40» звучит издевательски, а
  для микробизнеса — неправдоподобно.
- forecast.totalLow/totalHigh — проценты роста видимости (например 40 и 90).
- сумма последних (6-х) значений всех chart.series ≈ totalHigh (допуск ±15%)
- chart.series — те же каналы, что forecast.scenarios (3-4: SEO+GEO сайт, дистрибуция статей, соцсети, AI-видимость — выбери применимые к нише); values — проценты прироста видимости по каналу нарастающим итогом.
- unitEconomics.deals — НЕ выдумывать абсолют. Если конверсия и текущий поток
  неизвестны, напиши буквально "${deferToCallExample}".
- unitEconomics.check — средний чек ТОЛЬКО из реальных данных сайта/ниши; если данных нет, напиши буквально "${deferToCallExample}" (на ${lang} языке, не на русском)

ЧТО MARKETRADAR РЕАЛЬНО ДЕЛАЕТ (актуально на август 2026) — состав тарифов
собирай ТОЛЬКО из этого списка, услуг «вообще» не придумывай:
- Видео-ролики под ключ: говорящий аватар, озвучка клонированным голосом бренда,
  видеоряд, субтитры по пословным таймингам, музыка, фирменные цвета и логотип
  из брендбука. Это ключевое отличие от обычного SMM-подрядчика — вставляй в
  СММ-тариф обязательно.
- Сторис, карусели, посты; публикация по расписанию.
- Брендбук: банк проверенных фактов о компании и фотобанк клиента — генерация
  опирается на реальные данные заказчика, а не на выдумку.
- Презентации в фирменном стиле с экспортом.
- Сайт: техническое ускорение с сохранением дизайна 1:1 (внутри это перенос на Astro — клиенту эти слова НЕ показывать, см. ЗАПРЕТ) плюс оптимизация скорости
  с замером «было → стало» по Google PageSpeed, перенос ассетов, сжатие в WebP.
- Аналитика: позиции живой проверкой в браузере, GEO-видимость в ассистентах,
  анализ конкурентов, ЦА, отзывов и соцсетей.

ЖЁСТКИЕ ПРАВИЛА:
- Находки (findings) — ТОЛЬКО из переданных данных анализа. Никаких выдуманных цифр, конкурентов, отзывов. Каждая находка: evidence "fact" (проверено анализом) / "estimate" (оценка) / "forecast" (прогноз).
- КАЖДАЯ находка обязана иметь связку: что происходит сейчас (факт с доказательством) → чем это оборачивается для бизнеса → что именно мы делаем → как проверить результат. Находка без четвёртого пункта не продаёт, находка без первого — выдумка.
- НАХОДКА = ТОЧКА ПОТЕРИ ЗАЯВОК, а не технический дефект. Заголовок находки отвечает на вопрос владельца «почему сайт не приносит заявки», человеческим языком; технический термин — внутри, как доказательство. Плохо: «Отсутствует Schema.org». Хорошо: «Ассистенты не могут прочитать ваши услуги — и рекомендуют конкурентов» (внутри: нет разметки Schema.org). Где данные позволяют — оцени потерю (заявки/мес или посетители/мес, evidence "estimate"), НЕ выдумывая точных чисел без основания.
- hero.verdict — ДИАГНОЗ, не комплимент: первым предложением почему сайт сейчас недобирает заявки и кто их забирает. Сильные стороны в вердикте допустимы только после диагноза.
- Прогнозы (forecast, chart, hero.potential) — расчётная модель, честно помеченная. Не выдавай за факт.
- rivals (конкуренты): заполняй ТОЛЬКО если в данных есть реальные конкуренты с метриками. Если нет — верни пустой массив [] (секция скроется).
- socialAudit: НИКОГДА не выставляй балл/оценку соцсетям, если метрик нет. Отсутствие данных — это «данных нет», а не «5 из 100»: выставленный с потолка балл клиент проверит первым и перестанет верить остальному документу. Если в переданных данных ссылок на соцсети нет, это может значить и то, что мы их не нашли, — формулируй как «на сайте не обнаружено ссылок», а не «у компании нет соцсетей».
- socialAudit: по КАЖДОЙ сети из блока «Соцсети компании». stats — ДОСЛОВНО переданные метрики (evidence "fact"); если метрик нет — stats "метрики недоступны" (evidence "estimate"), цифры НЕ выдумывать. Если соцсетей нет вообще — networks: [], а intro честно фиксирует отсутствие соц-присутствия (и добавь находку об этом в findings). summary подводит к СММ-тарифу из ценовой сетки.
- guarantee — гарантия возврата за месяц при невыполнении объёма.
- findings ДЕЛЯТСЯ ЧЁТКО: severity "critical" — то, что прямо сейчас лишает
  клиента обращений и требует срочного решения (3-5 штук, не больше — иначе
  «критично» перестаёт значить критично); severity "warning" — точки роста:
  работает, но недобирает.
- deeperScope — то, что мы видим, но не успели разобрать в этом документе.
  Смысл главы: собранное здесь — ключевые проблемы, требующие срочного решения,
  но за ними стоит слой глубже (аналитика ЦА, путь клиента, отзывы и репутация,
  ассортимент и офферы, воронка внутри сайта, конкурентная разведка). Пиши
  конкретно по ЭТОМУ бизнесу, без общих слов: 3-5 пунктов, каждый — что именно
  посмотрим и какой вопрос это закроет.

ПЕРЕД ВЫДАЧЕЙ ПРОВЕРЬ СЕБЯ (это часть задачи, а не пожелание):
1. Нет ни одного сравнения со «средним по рынку» и ни одной цифры без источника.
2. Сильные стороны не противоречат находкам.
3. Прогноз — в процентах, нигде не обещано абсолютное число заявок.
4. Ни одного предложения, которое можно удалить без потери смысла. Если абзац
   не несёт факта, действия или следствия — удали его сам.
5. Соцсетям и любым другим блокам без данных не выставлен балл.

ФОРМАТ — СТРОГО валидный JSON PilotBundle без markdown. Соблюдай ФОРМУ вложенных объектов ТОЧНО (иначе КП сломается):
{
 "hero": {"verdict": "...", "problem": "ОДНА главная проблема одной строкой — то, что стоит клиенту денег прямо сейчас", "problemSub": "чем именно она оборачивается: кто получает эти обращения вместо него", "badges": ["строка","строка","строка"]},
 "strengths": [{"title":"...","evidence":"fact|estimate","body":"...","leverage":"на что это опираемся в работе"}],
 "findings": [{"severity":"critical|warning","title":"...","evidence":"fact|estimate|forecast","fact":"...","why":"...","action":"...","effect":"..."}],
 "rivals": [{"name":"...","url":"...","strength":"...","weakness":"...","steal":"что у них забрать"}],
 "trump": "...",
 "unitEconomics": {"deals":"N–M","dealsNote":"договоров в месяц (конверсия X–Y% — ОЦЕНКА)","check":"... или '${deferToCallExample}'","checkNote":"средний чек — откуда цифра","entry":"${locale === "de" ? "Einmaliger Einstieg — ... für die technische Modernisierung: ..." : "Разовый вход — ... за ускорение сайта: ..."}"},
 "socialAudit": {"intro":"1-2 предложения о текущем соц-присутствии бренда","networks":[{"name":"Telegram","url":"...","stats":"N подписчиков, M постов за 30 дней","evidence":"fact","verdict":"короткий диагноз канала","action":"что сделать"}],"summary":"общий вывод, мостик к СММ-тарифу из сетки"},
 "geo": {
   "intro":"что такое GEO и почему в ответах ассистентов сейчас конкуренты, а не клиент",
   "whyNow":"почему входить сейчас дешевле",
   "assistants":${assistantsExample},
   "levers":[{"title":"...","detail":"..."}],
   "method":{"intro":"как честно замеряем","metric":"метрика: % ответов с упоминанием бренда","questions":["вопрос 1","...","6-8 контрольных вопросов ассистентам под нишу"]},
   "forecast":[{"month":"1-й месяц","evidence":"estimate","text":"..."},{"month":"3-й месяц","evidence":"forecast","text":"..."},{"month":"6-й месяц","evidence":"forecast","text":"..."}]
 },
 "forecast": {"formula":"...","assumptions":["..."],"example":"...","scenarios":[{"name":"...","desc":"...","m1":"...","m3":"...","m6":"..."}],"totalLow":N,"totalHigh":N},
 "chart": {"months":${monthsExample},"series":[{"name":"...","values":[6 чисел — ровно 6, без null]}]},
 "offers": [{"n":1,"name":"${offerNameExample}","price":"...","priceNote":"${offerPriceNoteExample}","what":["..."],"gets":["..."],"effort":"почему такая цена"}],
 "monthly": [{"name":"...","price":"от ...","items":["..."]}],
 "offersTotal": "...",
 "timeline": [{"week":"${weekExample}","text":"..."}],
 "positionDiagnosis": {"ключевой-запрос-строчными":"короткий диагноз почему такая позиция"},
 "deeperScope": {"intro":"1-2 предложения: здесь ключевые проблемы, но есть слой глубже","items":[{"title":"...","detail":"что именно посмотрим и какой вопрос это закроет"}]},
 "guarantee": "...",
 "articles": [{"title":"...","excerpt":"...","body":"...","geoNotes":["..."]}],
 "articleMechanics": ["..."],
 "month1": ["..."]
}
СТРОГО: geo.assistants/levers — массивы объектов; geo.method — ОБЪЕКТ с массивом questions; geo.forecast — массив объектов {month,evidence,text}. badges — ровно 3 строки. chart: длина values = длине months = 6; сумма серий к 6-му месяцу ≈ forecast.totalHigh. positionDiagnosis — словарь по реальным запросам (ключи строчными). articles — 3 примера статей. Если реальных конкурентов в данных нет — верни "rivals": [].`;
}

/**
 * Реальные соц-метрики для контекста КП. Раньше сюда попадал только список
 * имён сетей («Соцсети: vk, telegram») — энричер при этом честно собирал
 * подписчиков и активность, но данные выбрасывались, и модель писала про
 * соцсети общими словами. Теперь: у Telegram/VK — живые цифры, у остальных
 * найденных сетей — честное «есть ссылка, метрики недоступны».
 */
function describeSocials(
  socialLinks: Record<string, string>,
  social: { telegram?: { subscribers: number; posts30d: number } | null; vk?: { subscribers: number; posts30d: number; engagement: string; trend: string } | null },
): string {
  const found = Object.entries(socialLinks || {});
  if (found.length === 0) return "Соцсети: на сайте НЕ найдено ни одной ссылки на соцсети (это находка для socialAudit).";
  const lines: string[] = [];
  for (const [net, url] of found) {
    if (net === "telegram" && social.telegram) {
      lines.push(`- Telegram ${url}: ${social.telegram.subscribers} подписчиков, ${social.telegram.posts30d} постов за 30 дней (РЕАЛЬНЫЕ данные, evidence fact)`);
    } else if (net === "vk" && social.vk) {
      lines.push(`- VK ${url}: ${social.vk.subscribers} подписчиков, ${social.vk.posts30d} постов за 30 дней, вовлечённость ${social.vk.engagement}, тренд ${social.vk.trend} (РЕАЛЬНЫЕ данные, evidence fact)`);
    } else {
      lines.push(`- ${net} ${url}: ссылка есть, метрики API недоступны (evidence estimate, цифры НЕ выдумывать)`);
    }
  }
  return `Соцсети компании (для socialAudit):\n${lines.join("\n")}`;
}

function buildContext(
  company: AnalysisResult,
  scraped: Awaited<ReturnType<typeof scrapeWebsite>>,
  aiCheck: KpAiCheckResult | null,
  socialsBlock: string,
): string {
  const c = company.company;
  const parts: string[] = [];
  parts.push(`Сайт: ${c.url}`);
  parts.push(`Название: ${c.name}`);
  if (c.description) parts.push(`Описание: ${c.description}`);
  parts.push(`Общий скор: ${c.score}/100. По категориям: ${(c.categories || []).map(x => `${x.name} ${x.score}`).join(", ")}`);
  if (company.seo) parts.push(`SEO/тех: ${JSON.stringify(company.seo).slice(0, 800)}`);
  if (aiCheck?.checked) {
    // РЕАЛЬНАЯ проверка приоритетнее симуляции aiPerception — она перекрывает
    // любые «в ChatGPT вас нет», если бренд там на самом деле есть.
    parts.push(
      `РЕАЛЬНАЯ ПРОВЕРКА ChatGPT (не симуляция, живые ответы API): бренд упомянут в ${aiCheck.mentionedIn} из ${aiCheck.total} ответов на честные пользовательские запросы. ` +
      (aiCheck.mentionedIn > 0
        ? `ChatGPT ЗНАЕТ компанию — НЕ пиши «в ответах ассистентов вас нет». Фрейминг GEO-оффера: закрепить и усилить присутствие, контролировать ЧТО именно ассистенты говорят о бренде. `
        : `ChatGPT не упомянул бренд ни в одном ответе — это честная точка роста для GEO. `) +
      `Пример реального ответа (запрос: «${aiCheck.sampleQuery}»): ${aiCheck.sampleAnswer.slice(0, 700)}`,
    );
  }
  if (company.aiPerception) parts.push(`AI-восприятие бренда (модельная оценка${aiCheck?.checked ? ", ВТОРИЧНА к реальной проверке выше" : ""}): ${JSON.stringify(company.aiPerception).slice(0, 500)}`);
  const rivals = company.spywordsDashboard?.competitors?.yandex ?? company.keysoDashboard?.yandex?.competitors ?? [];
  if (Array.isArray(rivals) && rivals.length) parts.push(`Конкуренты из данных: ${JSON.stringify(rivals).slice(0, 600)}`);
  const kws = company.seo?.keywords;
  if (Array.isArray(kws) && kws.length) parts.push(`Ключевые запросы ниши (для positionDiagnosis, ключи строчными): ${kws.slice(0, 12).map(k => typeof k === "string" ? k : (k as { keyword?: string }).keyword).filter(Boolean).join(", ")}`);
  parts.push(socialsBlock);
  parts.push(`Стек: ${(scraped.techStack || []).join(", ") || "н/д"}`);
  parts.push(`Контент (выдержка): ${(scraped.rawTextSample || "").slice(0, 2500)}`);
  return parts.join("\n");
}

export async function generateKp(rawUrl: string, locale: KpLocale): Promise<KpGenResult> {
  // 1. Скрап
  const scraped = await scrapeWebsite(rawUrl);

  // 2. Глубокий анализ (настоящий движок платформы)
  const company: AnalysisResult = await analyzeWithClaude(scraped, undefined, locale);
  company.company.url = company.company.url || scraped.url;

  // Employer Branding / Arbeitgebermarke для DE — исключаем из КП: у нас нет
  // реального анализа HR-бренда для рынков Европы (в РФ хотя бы HH.ru), а
  // низкий выдуманный балл тянул вниз общий скоринг и порождал «критические»
  // находки на пустом месте (правка владельца, «Анализ Де.docx»). Общий скор
  // пересчитываем по оставшимся категориям.
  if (locale === "de" && Array.isArray(company.company.categories)) {
    const hrRe = /arbeitgebermarke|employer|hr[\s-]?brand|работодател/i;
    const kept = company.company.categories.filter((cat) => !hrRe.test(cat.name));
    if (kept.length > 0 && kept.length < company.company.categories.length) {
      company.company.categories = kept;
      company.company.score = Math.round(kept.reduce((s, cat) => s + cat.score, 0) / kept.length);
    }
  }

  // РЕАЛЬНАЯ проверка видимости в ChatGPT — параллельно с обогащением ниже
  // нельзя (нужно имя компании из анализа), но сама по себе быстрая (3 вызова
  // gpt-4o-mini). Best-effort: без ключа/при ошибке КП строится как раньше.
  const domainForCheck = (company.company.url || scraped.url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const aiCheck = await checkKpAiVisibility(
    company.company.name || scraped.title || domainForCheck,
    domainForCheck,
    company.company.description || "",
    locale,
  ).catch(() => null);

  // Реальный ответ ChatGPT перезаписывает симулированный sampleAnswer —
  // клиент, проверяющий КП руками в GPT, должен видеть согласованную картину.
  if (aiCheck?.checked && company.aiPerception) {
    company.aiPerception.sampleAnswer = aiCheck.sampleAnswer;
    company.aiPerception.knowledgePresence =
      aiCheck.mentionedIn >= 2 ? "strong" : aiCheck.mentionedIn === 1 ? "moderate" : "minimal";
  }

  // 3. Обогащение домена — ТО ЖЕ, что делает /api/analyze, иначе у авто-КП
  //    пустой Тех-аудит и AI-видимость (пилоты берут это из полного анализа
  //    платформы). Маппинг зеркалит src/app/api/analyze/route.ts.
  let socialStats: { telegram?: { subscribers: number; posts30d: number } | null; vk?: { subscribers: number; posts30d: number; engagement: string; trend: string } | null } = {};
  try {
    const domain = (company.company.url || scraped.url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    // Каналы, на которые сайт не ссылается, ищем отдельно по названию бренда
    // и берём только подтверждённые (см. lib/brand-socials.ts). Так у Орлинка
    // находится Telegram, которого нет ни в одной ссылке на сайте — а сам
    // разрыв «канал есть, связи с сайтом нет» становится находкой.
    const offSite = await findBrandSocials({
      companyName: company.company.name || "",
      domain,
    }).catch(() => []);
    const mergedSocialLinks: Record<string, string> = { ...(scraped.socialLinks || {}) };
    for (const hit of offSite) {
      const key = hit.network.toLowerCase();
      if (!mergedSocialLinks[key]) mergedSocialLinks[key] = hit.url;
    }
    const real = await enrichDomainData(domain, mergedSocialLinks, scraped.url);
    if (real) {
      socialStats = { telegram: real.telegram, vk: real.vk };
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
    messages: [{ role: "user", content: buildContext(company, scraped, aiCheck, describeSocials(scraped.socialLinks || {}, socialStats)) }],
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
  const monthsFallback = locale === "de"
    ? ["Monat 1", "Monat 2", "Monat 3", "Monat 4", "Monat 5", "Monat 6"]
    : ["мес 1", "мес 2", "мес 3", "мес 4", "мес 5", "мес 6"];
  const months = arr<string>(ch.months).length === 6 ? ch.months : monthsFallback;
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

  // socialAudit — та же защита формы, что у geo: рендер делает .map по networks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sa = (bundle.socialAudit ?? null) as any;
  bundle.socialAudit = sa && typeof sa === "object"
    ? {
        intro: typeof sa.intro === "string" ? sa.intro : "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        networks: arr<any>(sa.networks)
          .filter((n) => n && typeof n.name === "string")
          .map((n) => ({
            name: n.name,
            url: typeof n.url === "string" ? n.url : undefined,
            stats: typeof n.stats === "string" ? n.stats : "метрики недоступны",
            evidence: n.evidence === "fact" ? "fact" as const : "estimate" as const,
            verdict: typeof n.verdict === "string" ? n.verdict : "",
            action: typeof n.action === "string" ? n.action : "",
          })),
        summary: typeof sa.summary === "string" ? sa.summary : "",
      }
    : undefined;

  // ── Внешний контур, сравнение с рынком и условия — НЕ из генерации ──────
  // Эти три главы описывают наши обязательства (возврат, права на материалы,
  // граница «входит / сверх»), а не данные клиента. Отданные модели, они
  // превращаются в выдуманные гарантии, поэтому берутся фиксированным
  // шаблоном по локали. Присваиваются ПОСЛЕ разбора ответа — даже если модель
  // вернула свои варианты этих полей, они затираются.
  {
    const staticBlocks = kpStaticBlocks(locale, PRICE_POLICY[locale].seoGeo);
    bundle.pr = staticBlocks.pr;
    bundle.market = staticBlocks.market;
    bundle.terms = staticBlocks.terms;
  }

  // ── Реальный разрыв по семантике с конкурентами (Букварикс) ─────────────
  // Брендовые запросы конкурента из разрыва надо выкидывать: «иолла арт» и
  // «иолл» формально попадают в domain2_uniq, но советовать клиенту «забрать
  // себе» чужое имя — бессмыслица, которая обесценивает весь блок. Сверяем с
  // rival.name, а не с доменом: запросы приходят кириллицей, а домен латиницей.
  // Сравнение по 4-символьному префиксу — чтобы ловить огрызки вроде «иолл».
  // Модель описывает «что забрать» словами; здесь под это подкладываются
  // проверяемые цифры: запросы, по которым конкурент в выдаче есть, а клиент
  // нет, с частотностью. Только для ru — база Букварикса по РФ-регионам.
  //
  // Best-effort: сервис бесплатный и на нём есть лимит частоты, поэтому
  // запросы идут ПОСЛЕДОВАТЕЛЬНО (иначе ловим 429 на первом же КП с тремя
  // конкурентами), а любой сбой просто оставляет главу без блока цифр —
  // ронять из-за этого генерацию КП нельзя.
  if (locale === "ru" && bundle.rivals.length) {
    const mine = company.company?.url;
    if (mine) {
      for (const rival of bundle.rivals) {
        if (!rival?.url) continue;
        try {
          const gap = await bukvarixCompareDomains(mine, rival.url, {
            type: "domain2_uniq",
            limit: 100,
            region: "msk",
          });
          // Показываем верхушку по частотности: пять строк читаются, сто — нет.
          rival.keywordGap = gap
            // Порог 10 показов: запросы с частотностью в единицы — это шум, а
            // не «спрос, который забирает конкурент». Заодно снимает «1 показов»
            // в подписи, где число и слово не согласуются.
            .filter(k => k.broadFreq >= 10 && !isBrandQuery(k.keyword, rival.name))
            .sort((a, b) => b.broadFreq - a.broadFreq)
            .slice(0, 5)
            .map(k => ({ keyword: k.keyword, freq: k.broadFreq, position: k.position }));
        } catch {
          /* Букварикс недоступен или упёрлись в лимит — блок цифр не покажем */
        }
      }
    }
  }

  // ── Согласованность цифр — КОДОМ, а не просьбой в промпте ───────────────
  // Промпт требует «hero.potential = forecast.totalLow–totalHigh, сумма серий
  // графика ≈ totalHigh», но модель такие требования нарушает (проверено на
  // ценах DE). Расходящиеся цифры в КП — брак, который клиент замечает первым,
  // поэтому после генерации прогоняем инварианты принудительно.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = bundle.forecast as any;
    const low = Number(f?.totalLow), high = Number(f?.totalHigh);
    if (isFinite(low) && isFinite(high) && high > 0) {
      // 1. Шапка всегда повторяет прогноз — та же пара чисел, что в forecast.
      const heroUnit = locale === "de" ? "Anfragen/Monat" : "заявок/мес";
      const m = /^\+?\d[\d\s]*–[\d\s]*\d\s*(.+)$/.exec(bundle.hero?.potential ?? "");
      bundle.hero.potential = `+${low}–${high} ${m?.[1]?.trim() || heroUnit}`;

      // 2. График сходится к totalHigh: если сумма 6-х значений серий ушла от
      //    прогноза дальше 15%, серии масштабируются пропорционально. Кривые
      //    по форме остаются авторскими, финальная точка — честной.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series = (bundle.chart as any).series as Array<{ name: string; values: number[] }>;
      const last = series.reduce((s, x) => s + (x.values[5] ?? 0), 0);
      if (last > 0 && Math.abs(last - high) / high > 0.15) {
        const k = high / last;
        for (const s of series) s.values = s.values.map((v) => Math.round(v * k));
      }
    }
  }

  // Цены — принудительно перезаписываем из фиксированной сетки кодом, а не
  // доверяем модели их дословно перенести из промпта. Увидено на живом тесте:
  // DE-генерация вернула 4 500 €/990 €/150 € (наши СТАРЫЕ плейсхолдеры) вместо
  // заданных 1 000 €/250 €/100 €, хотя промпт прямо запрещал это — модель
  // подставила «более реалистичные», по её мнению, немецкие рыночные цифры.
  // Для RU та же инструкция всегда соблюдалась, но полагаться на это нельзя.
  const p = PRICE_POLICY[locale];
  bundle.savings = {
    marketerPrice: p.marketer,
    ourPrice: p.ours,
    headline: bundle.savings?.headline,
    note: bundle.savings?.note,
  };
  if (bundle.offers[0]) {
    bundle.offers[0].price = p.astro;
    // DE: страховка кодом от «Astro/Umzug/Migration» в имени оффера — модель
    // может проигнорировать запрет в промпте (уже видели такое с ценами).
    if (locale === "de" && /astro|umzug|migration/i.test(bundle.offers[0].name ?? "")) {
      bundle.offers[0].name = "Technische Website-Modernisierung";
    }
  }
  const seoGeoIdx = bundle.monthly.findIndex((m) => /seo|geo/i.test(m.name));
  const smmIdx = bundle.monthly.findIndex((m, i) => i !== seoGeoIdx && /smm|social|соц/i.test(m.name));
  if (bundle.monthly[seoGeoIdx >= 0 ? seoGeoIdx : 0]) bundle.monthly[seoGeoIdx >= 0 ? seoGeoIdx : 0].price = p.seoGeo;
  if (bundle.monthly[smmIdx >= 0 ? smmIdx : 1]) bundle.monthly[smmIdx >= 0 ? smmIdx : 1].price = p.smm;

  return { company, bundle, companyName: company.company.name || scraped.title || rawUrl };
}

/**
 * Похож ли запрос на брендовый запрос конкурента.
 *
 * Работает по префиксам: имя «Иолла» и запросы «иолла арт», «иолл» должны
 * ловиться одинаково. Токены короче 4 символов игнорируем — на них слишком
 * легко выкинуть нормальный коммерческий запрос.
 */
function isBrandQuery(keyword: string, rivalName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
  const brandTokens = norm(rivalName).split(/[^a-zа-я0-9]+/i).filter(t => t.length >= 4);
  if (!brandTokens.length) return false;

  const words = norm(keyword).split(/[^a-zа-я0-9]+/i).filter(Boolean);
  return words.some(w =>
    brandTokens.some(b => w.slice(0, 4) === b.slice(0, 4)),
  );
}
