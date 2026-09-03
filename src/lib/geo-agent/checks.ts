/**
 * Проверки уровня сайта и скоринг по пяти опорам.
 *
 * Веса выставлены по доказательной базе (см. docs/geo/01-research-techniques.md):
 *   - доступность и индексация в Bing/Яндексе — без них остальное не работает;
 *   - answer-first абзацы, вопросы в H2, факты с источниками — единственные
 *     on-page приёмы с контролируемыми экспериментами (+28…+43 %, KDD 2024);
 *   - свежесть — ChatGPT/Perplexity цитируют контент на год свежее органики;
 *   - Schema.org и llms.txt — гигиена, малый вес: измеримого прироста нет.
 */
import type { CheckStatus, GeoCheck, GeoPillar, GeoScore, SiteCrawl, VisibilityReport } from "./types";

const ANSWER_BOTS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User"];
const SEARCH_BOTS = ["Googlebot", "Bingbot", "YandexBot"];
const COMPARISON_RE = /\bvs\b|против|сравнени|альтернатив|лучшие|лучших|топ[-\s]?\d|рейтинг|обзор|какой выбрать|что выбрать/i;
const ABOUT_RE = /\/(about|o-kompanii|company|kompaniya|team|komanda|contacts?|kontakty|rekvizity|requisites)(\/|$)/i;

const CURRENT_YEAR = new Date().getFullYear();

function pct(n: number): string { return `${Math.round(n * 100)}%`; }

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / 86_400_000);
}

export function buildChecks(crawl: SiteCrawl, vis?: VisibilityReport): GeoCheck[] {
  const out: GeoCheck[] = [];
  const pages = crawl.pages;
  const readable = pages.filter(p => p.browser.ok);
  const home = pages.find(p => p.source === "home") ?? pages[0];
  const n = readable.length || 1;
  const share = (pred: (p: typeof pages[number]) => boolean) => readable.filter(pred).length / n;
  const push = (c: Omit<GeoCheck, "status"> & { status: CheckStatus }) => out.push(c);

  // ── Доступность ──────────────────────────────────────────────
  push({
    key: "home_reachable", pillar: "access", weight: 20,
    label: "Главная отдаётся краулеру",
    status: home?.browser.ok ? "pass" : "fail",
    detail: home?.browser.ok
      ? `HTTP ${home.browser.status}, ${Math.round(home.browser.bytes / 1024)} КБ, TTFB ${home.browser.ttfbMs} мс`
      : `HTTP ${home?.browser.status ?? 0}${home?.browser.botStub ? " — заглушка бот-щита" : ""}${home?.browser.error ? ` (${home.browser.error})` : ""}`,
    fix: "Сайт должен отдавать 200 и полный HTML любому клиенту без JS-челленджа.",
  });

  const parity = pages.filter(p => p.aiBot);
  const botProblems = parity.filter(p => {
    const b = p.aiBot!;
    return b.status !== p.browser.status || b.botStub || (p.browser.bytes > 0 && b.bytes / p.browser.bytes < 0.7);
  });
  push({
    key: "ai_bot_parity", pillar: "access", weight: 15,
    label: "Под UA GPTBot сайт отдаёт то же, что браузеру",
    status: parity.length === 0 ? "na" : botProblems.length === 0 ? "pass" : "fail",
    detail: parity.length === 0 ? "не проверяли"
      : botProblems.length === 0 ? `${parity.length} страниц: статус и размер совпадают`
      : botProblems.map(p => `${p.url}: браузер ${p.browser.status}/${p.browser.bytes} Б, GPTBot ${p.aiBot!.status}/${p.aiBot!.bytes} Б${p.aiBot!.botStub ? " (заглушка)" : ""}`).join("; "),
    fix: "Снять фильтрацию по User-Agent в WAF/CDN (Cloudflare Bot Fight Mode, DDoS-Guard, Qrator) для краулеров ассистентов.",
    urls: botProblems.map(p => p.url),
  });

  const serverErrors = crawl.brokenPages.filter(b => b.status >= 500 || b.status === 0);
  push({
    key: "broken_pages", pillar: "access", weight: 15,
    label: "Проверенные страницы отвечают 200",
    status: crawl.brokenPages.length === 0 ? "pass" : serverErrors.length ? "fail" : "warn",
    detail: crawl.brokenPages.length === 0
      ? `${pages.length} из ${pages.length} страниц открываются`
      : `${crawl.brokenPages.length} из ${pages.length} не открываются: ${crawl.brokenPages.map(b => `${b.url} → ${b.status || "нет ответа"}`).join("; ")}`,
    fix: serverErrors.length
      ? "Ошибки 5xx на страницах из sitemap/llms.txt: краулер ассистента получает пустую страницу и выкидывает URL из индекса. Проверить сборку и логи сервера, пересобрать."
      : "Убрать несуществующие адреса из sitemap и llms.txt или настроить редиректы.",
    urls: crawl.brokenPages.map(b => b.url),
  });

  const blockedSearch = crawl.robots.bots.filter(b => SEARCH_BOTS.includes(b.name) && b.rule === "blocked");
  push({
    key: "robots_search_bots", pillar: "access", weight: 15,
    label: "Поисковые боты (Google, Bing, Яндекс) не закрыты",
    status: !crawl.robots.present ? "pass" : blockedSearch.length ? "fail" : "pass",
    detail: !crawl.robots.present ? "robots.txt нет — значит всё разрешено"
      : blockedSearch.length ? `закрыты: ${blockedSearch.map(b => b.name).join(", ")}` : "Googlebot, Bingbot, YandexBot разрешены",
    fix: "Bing питает ChatGPT Search и Copilot, Яндекс — Алису. Закрытый Bingbot = нет в ChatGPT.",
  });

  const blockedAnswer = crawl.robots.bots.filter(b => ANSWER_BOTS.includes(b.name) && b.rule === "blocked");
  push({
    key: "robots_answer_bots", pillar: "access", weight: 15,
    label: "Краулеры ответов (OAI-SearchBot, PerplexityBot, Claude-SearchBot) не закрыты",
    status: blockedAnswer.length ? "fail" : "pass",
    detail: blockedAnswer.length ? `закрыты: ${blockedAnswer.map(b => b.name).join(", ")}`
      : crawl.robots.bots.filter(b => ANSWER_BOTS.includes(b.name)).map(b => `${b.name}: ${b.rule === "allowed" ? "разрешён" : b.rule === "no-rule" ? "правила нет (разрешён)" : "закрыт"}`).join(", "),
    fix: "Сайты, закрытые от OAI-SearchBot, не показываются в ответах ChatGPT Search — это официальная позиция OpenAI. Аналогично PerplexityBot и Claude-SearchBot.",
    snippet: blockedAnswer.length ? ANSWER_BOTS.map(b => `User-agent: ${b}\nAllow: /`).join("\n\n") : undefined,
  });

  const jsOnly = readable.filter(p => p.words < 150 && p.scriptBytes > 20_000);
  push({
    key: "ssr_content", pillar: "access", weight: 10,
    label: "Контент есть в сыром HTML (без JavaScript)",
    status: jsOnly.length === 0 ? "pass" : jsOnly.length / n > 0.5 ? "fail" : "warn",
    detail: jsOnly.length === 0
      ? `медиана ${Math.round(median(readable.map(p => p.words)))} слов на страницу в HTML`
      : `${jsOnly.length} страниц почти без текста в HTML: ${jsOnly.map(p => `${p.url} (${p.words} слов)`).join("; ")}`,
    fix: "Краулеры OpenAI, Anthropic, Perplexity не исполняют JS (Vercel/MERJ). Нужен SSR/SSG: текст, цены и FAQ — в HTML на сервере, не в аккордеонах по клику.",
    urls: jsOnly.map(p => p.url),
  });

  const sm = crawl.sitemap;
  push({
    key: "sitemap", pillar: "access", weight: 5,
    label: "Sitemap.xml корректный",
    status: !sm.present ? "fail" : sm.anchorUrls > 0 || sm.lastmodUniform ? "warn" : "pass",
    detail: !sm.present ? "sitemap.xml не найден"
      : `${sm.urls} URL, lastmod у ${pct(sm.lastmodShare)}${sm.anchorUrls ? `, якорных URL: ${sm.anchorUrls}` : ""}${sm.lastmodUniform ? ", все lastmod одинаковые (ставятся временем сборки)" : ""}`,
    fix: sm.anchorUrls ? "Убрать из sitemap ссылки с #якорями — это один и тот же документ." : sm.lastmodUniform ? "lastmod должен быть датой реального изменения страницы: одинаковые даты краулер игнорирует, а свежесть — фактор цитирования." : undefined,
  });

  const bing = crawl.bing;
  push({
    key: "bing_index", pillar: "access", weight: 5,
    label: "Сайт есть в индексе Bing (источник ChatGPT Search / Copilot)",
    status: !bing?.ok ? "na" : bing.approxCount === 0 ? "fail" : sm.urls > 0 && bing.approxCount < sm.urls * 0.5 ? "warn" : "pass",
    detail: !bing?.ok ? "Bing не ответил — проверьте вручную: bing.com/search?q=site:" + crawl.domain
      : `около ${bing.approxCount} страниц в Bing${sm.urls ? ` при ${sm.urls} в sitemap` : ""}`,
    fix: "Добавить сайт в Bing Webmaster Tools, отправить sitemap и подключить IndexNow (тот же ключ работает и для Яндекса).",
  });

  // ── Извлекаемость ────────────────────────────────────────────
  const answerShare = share(p => p.ledeIsAnswer);
  push({
    key: "answer_lede", pillar: "extract", weight: 25,
    label: "Первый абзац отвечает прямо (answer-first, 40–70 слов)",
    status: answerShare >= 0.5 ? "pass" : answerShare >= 0.25 ? "warn" : "fail",
    detail: `${pct(answerShare)} страниц начинаются с прямого ответа. ` + (home ? `Главная: «${(home.lede || home.h1[0] || "").slice(0, 140)}…»` : ""),
    fix: "Под H1 и под каждым H2 — самодостаточный абзац 40–70 слов: «X — это …», без ссылок внутри, с названием бренда и предмета. 44 % цитат ChatGPT берутся из первой трети страницы.",
    urls: readable.filter(p => !p.ledeIsAnswer).map(p => p.url),
  });

  const qShare = readable.reduce((s, p) => s + p.questionHeadingShare, 0) / n;
  push({
    key: "question_headings", pillar: "extract", weight: 15,
    label: "Подзаголовки сформулированы как вопросы клиента",
    status: qShare >= 0.3 ? "pass" : qShare >= 0.15 ? "warn" : "fail",
    detail: `в среднем ${pct(qShare)} H2/H3 — вопросы («Сколько стоит…», «Как выбрать…»)`,
    fix: "Переформулировать H2 в вопросы, которые клиент задаёт ассистенту: модель ищет заголовок, совпадающий с запросом, и берёт абзац под ним.",
  });

  const faqShare = share(p => p.faqBlock);
  push({
    key: "faq_blocks", pillar: "extract", weight: 15,
    label: "FAQ-блоки на ключевых страницах",
    status: faqShare >= 0.3 || home?.faqBlock ? "pass" : faqShare > 0 ? "warn" : "fail",
    detail: `FAQ есть на ${pct(faqShare)} проверенных страниц${home?.faqBlock ? ", включая главную" : ""}`,
    fix: "5–8 вопросов на каждой посадочной, ответы по 40–80 слов, в HTML (не в аккордеоне, подгружаемом по клику).",
  });

  const structAvg = readable.reduce((s, p) => s + p.lists + p.tables, 0) / n;
  push({
    key: "structured_blocks", pillar: "extract", weight: 10,
    label: "Списки и таблицы",
    status: structAvg >= 2 ? "pass" : structAvg >= 1 ? "warn" : "fail",
    detail: `в среднем ${structAvg.toFixed(1)} списков/таблиц на страницу, таблиц всего ${readable.reduce((s, p) => s + p.tables, 0)}`,
    fix: "Сравнения и характеристики — в HTML-таблицы, перечисления — в списки: модели вытаскивают структурированные блоки целиком.",
  });

  const factsAvg = readable.reduce((s, p) => s + p.factNumbers, 0) / n;
  push({
    key: "facts", pillar: "extract", weight: 15,
    label: "Факты с единицами измерения",
    status: factsAvg >= 5 ? "pass" : factsAvg >= 2 ? "warn" : "fail",
    detail: `в среднем ${factsAvg.toFixed(1)} числовых фактов на страницу`,
    fix: "Статистика с источником и датой даёт +34 % видимости в ответах (Aggarwal et al., KDD 2024). Цифры без источника модель не цитирует.",
  });

  const srcShare = share(p => p.externalRefs >= 1);
  push({
    key: "sources", pillar: "extract", weight: 10,
    label: "Ссылки на внешние источники",
    status: srcShare >= 0.3 ? "pass" : srcShare > 0 ? "warn" : "fail",
    detail: `${pct(srcShare)} страниц ссылаются на внешние источники (исследования, госорганы, отраслевые отчёты)`,
    fix: "2–3 ссылки на первоисточники в теле статьи (+29 % в эксперименте GEO). Не в answer-абзац — ниже него.",
  });

  const comparison = [...readable.map(p => `${p.title} ${p.h1.join(" ")}`), ...crawl.sitemapUrls].filter(t => COMPARISON_RE.test(t));
  push({
    key: "comparison_pages", pillar: "extract", weight: 10,
    label: "Сравнительные страницы («X vs Y», «альтернативы», «лучшие»)",
    status: comparison.length ? "pass" : "fail",
    detail: comparison.length ? `найдено ${comparison.length}` : "не найдено ни одной",
    fix: "Сравнительный контент даёт в 2,4 раза больше упоминаний бренда в ответах, чем информационный (Semrush). Страница «{бренд} vs {конкурент}» и «альтернативы {конкурент}» с честной таблицей.",
  });

  // ── Сущность и доверие ───────────────────────────────────────
  const org = home?.jsonLd.organization ?? readable.map(p => p.jsonLd.organization).find(Boolean);
  const orgFull = !!org && org.sameAs.length >= 2 && org.logo && (org.contact || org.address);
  push({
    key: "org_schema", pillar: "entity", weight: 20,
    label: "Organization JSON-LD с sameAs, логотипом и контактами",
    status: orgFull ? "pass" : org ? "warn" : "fail",
    detail: !org ? "разметки Organization нет"
      : `name «${org.name ?? "—"}», sameAs: ${org.sameAs.length}, logo: ${org.logo ? "да" : "нет"}, контакты: ${org.contact ? "да" : "нет"}, адрес: ${org.address ? "да" : "нет"}`,
    fix: "sameAs на Яндекс Бизнес, 2ГИС, VK, Telegram, YouTube, Rusprofile, Wikidata — так модель связывает сайт с сущностью, о которой пишут другие. Сама по себе разметка цитирований не прибавляет — это связка.",
  });

  push({
    key: "entity_consistency", pillar: "entity", weight: 10,
    label: "Название компании одинаково во всей разметке",
    status: crawl.entityNames.length <= 1 ? "pass" : "warn",
    detail: crawl.entityNames.length ? crawl.entityNames.join(" / ") : "название в разметке не найдено",
    fix: "Одно написание бренда в Organization, title, футере и профилях: разночтения модель считает разными компаниями.",
  });

  const reqSignals = new Set(readable.flatMap(p => p.entitySignals));
  push({
    key: "requisites", pillar: "entity", weight: 20,
    label: "Реквизиты и контакты видны в HTML (ИНН/ОГРН, юрлицо, адрес, телефон)",
    status: reqSignals.size >= 3 ? "pass" : reqSignals.size >= 1 ? "warn" : "fail",
    detail: reqSignals.size ? `найдено: ${Array.from(reqSignals).join(", ")}` : "ни одного реквизита в тексте страниц",
    fix: "Для Алисы и GigaChat проверяемый юрстатус — фильтр доверия: ИНН/ОГРН, юрлицо, адрес и телефон в футере каждой страницы и на странице «Реквизиты».",
  });

  const articleLike = readable.filter(p => p.jsonLd.article || /\/(blog|news|articles?|stati|journal|glossary|wiki)\//i.test(p.url));
  const authorShare = articleLike.length ? articleLike.filter(p => p.authorVisible).length / articleLike.length : share(p => p.authorVisible);
  push({
    key: "author", pillar: "entity", weight: 15,
    label: "Автор указан на статьях",
    status: authorShare >= 0.7 ? "pass" : authorShare > 0 ? "warn" : articleLike.length === 0 ? "na" : "fail",
    detail: articleLike.length ? `автор виден на ${pct(authorShare)} из ${articleLike.length} статейных страниц` : "статейных страниц в выборке нет",
    fix: "Реальный автор с должностью и страницей-профилем (Person + sameAs), а не «Команда компании»: у Яндекса это ЭПОС, у Google — E-E-A-T.",
  });

  const aboutUrl = [...crawl.sitemapUrls, ...pages.map(p => p.url)].find(u => ABOUT_RE.test(u));
  push({
    key: "about_page", pillar: "entity", weight: 10,
    label: "Страница «О компании / Контакты / Реквизиты»",
    status: aboutUrl ? "pass" : "fail",
    detail: aboutUrl ? aboutUrl : "в sitemap и среди проверенных страниц нет /about, /contacts, /rekvizity",
    fix: "Отдельная страница с фактами о компании: кто, с какого года, где, чем занимается, кто руководит. Это то, что модель пересказывает на вопрос «что за компания X».",
  });

  const titles = readable.map(p => p.title).filter(Boolean);
  const dupTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
  push({
    key: "title_uniqueness", pillar: "entity", weight: 10,
    label: "Уникальные title у страниц",
    status: dupTitles.length === 0 ? "pass" : "warn",
    detail: dupTitles.length ? `дубли: ${Array.from(new Set(dupTitles)).join(" | ")}` : `${titles.length} уникальных title`,
    fix: "Дубли title — модель не различает страницы и цитирует не ту.",
  });

  push({
    key: "og_meta", pillar: "entity", weight: 5,
    label: "Open Graph на главной",
    status: home && home.og.title && home.og.description && home.og.image ? "pass" : "warn",
    detail: home ? `og:title ${home.og.title ? "да" : "нет"}, og:description ${home.og.description ? "да" : "нет"}, og:image ${home.og.image ? "да" : "нет"}` : "—",
  });

  const ldErrors = readable.reduce((s, p) => s + p.jsonLd.parseErrors, 0);
  const ldShare = share(p => p.jsonLd.types.length > 0);
  push({
    key: "jsonld_valid", pillar: "entity", weight: 10,
    label: "JSON-LD валидный и есть на большинстве страниц",
    status: ldErrors ? "fail" : ldShare >= 0.5 ? "pass" : "warn",
    detail: `${pct(ldShare)} страниц с разметкой, ошибок разбора: ${ldErrors}; типы: ${Array.from(new Set(readable.flatMap(p => p.jsonLd.types))).slice(0, 10).join(", ") || "—"}`,
    fix: "Article/BlogPosting с datePublished, dateModified и author на статьях; Service/Product с Offer на страницах услуг; FAQPage там, где есть FAQ.",
  });

  // ── Свежесть ─────────────────────────────────────────────────
  const dateShare = share(p => !!p.visibleDate);
  push({
    key: "visible_dates", pillar: "freshness", weight: 35,
    label: "Видимая дата обновления на страницах",
    status: dateShare >= 0.5 ? "pass" : dateShare > 0 ? "warn" : "fail",
    detail: `дата видна на ${pct(dateShare)} страниц`,
    fix: "«Обновлено: дд.мм.гггг» в HTML + dateModified в разметке. ChatGPT и Perplexity цитируют контент в среднем на 458 дней свежее органики (Ahrefs).",
    urls: readable.filter(p => !p.visibleDate).map(p => p.url),
  });

  push({
    key: "sitemap_lastmod_real", pillar: "freshness", weight: 25,
    label: "lastmod в sitemap — реальные даты",
    status: !sm.present ? "na" : sm.lastmodShare >= 0.8 && !sm.lastmodUniform ? "pass" : sm.lastmodShare > 0 ? "warn" : "fail",
    detail: !sm.present ? "sitemap нет" : sm.lastmodUniform ? "все lastmod одинаковые — это время сборки, а не правки" : `lastmod у ${pct(sm.lastmodShare)} URL, новейший ${sm.newestLastmod ?? "—"}`,
    fix: "lastmod из даты правки контента (git/CMS), а не new Date() при сборке.",
  });

  const realDates = readable
    .map(p => daysSince(p.jsonLd.article?.dateModified ?? p.jsonLd.article?.datePublished ?? (p.visibleDate && /^\d{4}-\d{2}/.test(p.visibleDate) ? p.visibleDate : undefined)))
    .filter((d): d is number => d != null);
  const newestDays = realDates.length ? Math.min(...realDates) : null;
  push({
    key: "recent_update", pillar: "freshness", weight: 25,
    label: "Контент обновлялся за последние 90 дней",
    status: newestDays == null ? "na" : newestDays <= 90 ? "pass" : newestDays <= 180 ? "warn" : "fail",
    detail: newestDays == null ? "проверяемых дат в разметке/тексте нет" : `самая свежая дата — ${newestDays} дн. назад`,
    fix: "Ежеквартальный рефреш цифр и дат в 5–10 ключевых материалах; контент, обновлённый за 3 месяца, цитируется в ChatGPT вдвое чаще (SE Ranking).",
  });

  const staleYear = readable.filter(p => { const m = p.title.match(/\b(20\d\d)\b/); return m && parseInt(m[1], 10) < CURRENT_YEAR; });
  push({
    key: "stale_year", pillar: "freshness", weight: 15,
    label: "В title нет прошлых годов",
    status: staleYear.length ? "warn" : "pass",
    detail: staleYear.length ? staleYear.map(p => `${p.url}: «${p.title}»`).join("; ") : "устаревших годов в заголовках нет",
    fix: "Год в заголовке — только если содержимое действительно обновлено под этот год.",
    urls: staleYear.map(p => p.url),
  });

  // ── Внешние сигналы ──────────────────────────────────────────
  const sameAs = org?.sameAs ?? [];
  const hasVideo = sameAs.some(s => /youtube|rutube|vk\.com\/video/.test(s));
  const hasProfiles = sameAs.filter(s => /vc\.ru|habr|dzen|tenchat|yandex\.ru\/business|2gis|yandex\.ru\/maps|rusprofile|wikidata/.test(s)).length;
  push({
    key: "profiles", pillar: "external", weight: 15,
    label: "Связь с внешними профилями (YouTube, Яндекс Бизнес, 2ГИС, vc.ru/Хабр, Wikidata)",
    status: hasVideo && hasProfiles >= 2 ? "pass" : hasVideo || hasProfiles ? "warn" : "fail",
    detail: sameAs.length ? `sameAs: ${sameAs.map(s => s.replace(/^https?:\/\/(www\.)?/, "")).join(", ")}` : "sameAs пуст",
    fix: "Упоминания на YouTube — сильнейший коррелят видимости в ChatGPT/AI Mode (r≈0,74, Ahrefs, 75 000 брендов). Канал с длинными видео по главам + карточки в Яндекс Бизнес/2ГИС + профили на vc.ru/Хабре, всё — в sameAs.",
  });

  if (!vis || vis.answers.length === 0) {
    for (const key of ["mention_rate", "citation_rate", "competitor_dominance", "source_gap"]) {
      push({ key, pillar: "external", weight: key === "mention_rate" ? 30 : key === "citation_rate" ? 25 : 15, label: key, status: "na", detail: "опрос ассистентов не проводился" });
    }
    return out;
  }

  push({
    key: "mention_rate", pillar: "external", weight: 30,
    label: "Ассистенты называют бренд в ответах на вопросы клиентов",
    status: vis.mentionRate >= 40 ? "pass" : vis.mentionRate >= 15 ? "warn" : "fail",
    detail: `${vis.mentionRate}% ответов (${vis.answers.filter(a => !a.unavailable).length} ответов, ${vis.llmsChecked.length} ассистентов: ${Object.entries(vis.byLlm).map(([k, v]) => `${k} ${v.checked ? Math.round(v.mentioned / v.checked * 100) : 0}%`).join(", ")})`,
    fix: "Метрика меняется медленно: контент под незакрытые промпты + внешние упоминания, замер раз в месяц по тому же набору промптов.",
  });

  const withCites = vis.answers.filter(a => !a.unavailable && a.citations.length > 0);
  push({
    key: "citation_rate", pillar: "external", weight: 25,
    label: "Ассистенты с поиском цитируют наш сайт как источник",
    status: withCites.length === 0 ? "na" : vis.citationRate >= 20 ? "pass" : vis.citationRate > 0 ? "warn" : "fail",
    detail: withCites.length === 0 ? "ни один из опрошенных ассистентов не вернул источники" : `${vis.citationRate}% ответов с источниками содержат ссылку на ${crawl.domain}`,
    fix: "Цитирование зависит от позиций в Bing/Яндексе по подзапросам (query fan-out) и от наличия страницы-ответа под каждый промпт.",
  });

  const topComp = vis.competitorsNamed[0];
  const usCount = vis.answers.filter(a => a.mentioned).length;
  push({
    key: "competitor_dominance", pillar: "external", weight: 15,
    label: "Конкуренты не доминируют в ответах",
    status: !topComp ? "pass" : topComp.count > usCount * 2 ? "fail" : topComp.count > usCount ? "warn" : "pass",
    detail: topComp ? `чаще всех называют: ${vis.competitorsNamed.slice(0, 5).map(c => `${c.name} (${c.count})`).join(", ")}; нас — ${usCount}` : "конкурентов в ответах не выделено",
    fix: "Сравнительные страницы «{мы} vs {лидер}» и размещения там, откуда ассистент берёт мнение о лидере (см. список площадок).",
  });

  const others = vis.citedDomains.filter(d => !d.isUs);
  const usRank = vis.citedDomains.findIndex(d => d.isUs);
  push({
    key: "source_gap", pillar: "external", weight: 15,
    label: "Мы среди источников, которые ассистенты цитируют по нашим темам",
    status: others.length === 0 ? "na" : usRank >= 0 && usRank < 5 ? "pass" : usRank >= 0 ? "warn" : "fail",
    detail: others.length ? `цитируют: ${others.slice(0, 8).map(d => `${d.domain} (${d.count})`).join(", ")}${usRank >= 0 ? `; ${crawl.domain} на ${usRank + 1}-м месте` : `; ${crawl.domain} не цитируется`}` : "источников нет",
    fix: "Это и есть список площадок для размещений: статьи, профили, отзывы там, откуда модель берёт ответ сейчас.",
  });

  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const PILLAR_WEIGHTS: Record<GeoPillar, number> = { access: 25, extract: 30, entity: 15, freshness: 10, external: 20 };

export function scoreChecks(checks: GeoCheck[]): GeoScore {
  const pillars = {} as Record<GeoPillar, number>;
  let total = 0;
  let totalW = 0;
  for (const pillar of Object.keys(PILLAR_WEIGHTS) as GeoPillar[]) {
    const items = checks.filter(c => c.pillar === pillar && c.status !== "na");
    const avail = items.reduce((s, c) => s + c.weight, 0);
    const earned = items.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
    if (avail === 0) { pillars[pillar] = -1; continue; } // -1 = нет данных
    pillars[pillar] = Math.round((earned / avail) * 100);
    total += pillars[pillar] * PILLAR_WEIGHTS[pillar];
    totalW += PILLAR_WEIGHTS[pillar];
  }
  return { total: totalW ? Math.round(total / totalW) : 0, pillars };
}
