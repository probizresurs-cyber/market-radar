/**
 * Разбор одной HTML-страницы в PageAudit — без сети, только текст.
 *
 * Всё, что здесь измеряется, выбрано по одному критерию: влияет ли это на
 * то, вытащит ли ассистент из страницы готовый ответ. Поэтому нет
 * плотности ключевых слов и прочего SEO-наследия, зато есть «лид отвечает
 * прямо», «заголовки — вопросы», «цифры с единицами», «дата обновления»,
 * «реквизиты» — то, что модели действительно цитируют.
 */
import * as cheerio from "cheerio";
import type { FetchProbe, JsonLdSummary, PageAudit } from "./types";

const SOCIAL_HOSTS = [
  "t.me", "telegram.me", "vk.com", "ok.ru", "youtube.com", "youtu.be", "rutube.ru",
  "instagram.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "tiktok.com",
  "dzen.ru", "zen.yandex.ru", "wa.me", "whatsapp.com", "max.ru", "pinterest.com",
];

const QUESTION_RE = /\?\s*$|^(как|что|какой|какая|какие|каких|сколько|почему|зачем|где|когда|чем|кто|кому|нужно ли|можно ли|стоит ли|что делать|how|what|why|which|when|where|who)\b/i;

const FACT_RE = /\d[\d\s.,]*\s?(%|₽|руб\.?|р\.|млн|тыс\.?|млрд|лет|года?|году|дн(?:я|ей)|час(?:а|ов)?|мин(?:ут)?|шт\.?|км|м²|кв\.?\s?м|кг|\$|€|клиент|проект|источник|страниц|запрос)/gi;

/** Лид считается ответом, если он в 20–90 слов и начинается как определение/утверждение о предмете. */
const ANSWER_LEDE_RE = /^([«"]?[A-ZА-ЯЁ][^.!?]{2,80}?)\s(—|–|-|это|является|представляет собой|помогает|позволяет|делает|производит|оказывает|предоставляет|занимается|работает|нужен|нужна|нужно|стоит|включает|состоит|means|is|helps)\b/u;

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function isSocialHost(host: string): boolean {
  return SOCIAL_HOSTS.some(s => host === s || host.endsWith(`.${s}`));
}

function collectTypes(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(n => collectTypes(n, out)); return; }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  else if (Array.isArray(t)) t.forEach(x => typeof x === "string" && out.push(x));
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") collectTypes(v, out);
  }
}

function findByType(node: unknown, type: string): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) { const f = findByType(n, type); if (f) return f; }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (t === type || (Array.isArray(t) && t.includes(type))) return obj;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") { const f = findByType(v, type); if (f) return f; }
  }
  return null;
}

export function summarizeJsonLd(blocks: string[]): JsonLdSummary {
  const types: string[] = [];
  let parseErrors = 0;
  const summary: JsonLdSummary = { types: [], faqQuestions: 0, hasBreadcrumbs: false, hasWebSite: false, parseErrors: 0 };
  for (const raw of blocks) {
    let data: unknown;
    try { data = JSON.parse(raw); } catch { parseErrors++; continue; }
    collectTypes(data, types);

    const org = findByType(data, "Organization") ?? findByType(data, "LocalBusiness") ?? findByType(data, "Corporation");
    if (org && !summary.organization) {
      const sameAs = org.sameAs;
      summary.organization = {
        name: typeof org.name === "string" ? org.name : undefined,
        url: typeof org.url === "string" ? org.url : undefined,
        logo: !!org.logo,
        sameAs: Array.isArray(sameAs) ? sameAs.filter((s): s is string => typeof s === "string") : typeof sameAs === "string" ? [sameAs] : [],
        contact: !!(org.contactPoint || org.telephone || org.email),
        address: !!org.address,
      };
    }
    const faq = findByType(data, "FAQPage");
    if (faq && Array.isArray(faq.mainEntity)) summary.faqQuestions += faq.mainEntity.length;

    const art = findByType(data, "Article") ?? findByType(data, "BlogPosting") ?? findByType(data, "NewsArticle");
    if (art && !summary.article) {
      const author = art.author as Record<string, unknown> | string | undefined;
      summary.article = {
        datePublished: typeof art.datePublished === "string" ? art.datePublished : undefined,
        dateModified: typeof art.dateModified === "string" ? art.dateModified : undefined,
        author: typeof author === "string" ? author : author && typeof author.name === "string" ? author.name : undefined,
      };
    }
  }
  summary.types = Array.from(new Set(types));
  summary.hasBreadcrumbs = summary.types.includes("BreadcrumbList");
  summary.hasWebSite = summary.types.includes("WebSite");
  summary.parseErrors = parseErrors;
  return summary;
}

export interface ParseOptions {
  url: string;
  source: PageAudit["source"];
  browser: FetchProbe;
  aiBot?: FetchProbe;
  html: string;
  domain: string;
}

export function parsePage(opts: ParseOptions): PageAudit {
  const { url, html, domain } = opts;
  const $ = cheerio.load(html);

  const jsonLdBlocks: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => { jsonLdBlocks.push($(el).text()); });
  const jsonLd = summarizeJsonLd(jsonLdBlocks);

  let scriptBytes = 0;
  $("script").each((_, el) => { scriptBytes += $(el).text().length; });

  const title = $("title").first().text().trim();
  const description = ($('meta[name="description"]').attr("content") ?? "").trim();
  const canonical = ($('link[rel="canonical"]').attr("href") ?? "").trim();
  const lang = ($("html").attr("lang") ?? "").trim();
  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const noindex = robotsMeta.includes("noindex");
  const og = {
    title: $('meta[property="og:title"]').length > 0,
    description: $('meta[property="og:description"]').length > 0,
    image: $('meta[property="og:image"]').length > 0,
  };

  // Реквизиты и автора ищем до удаления футера — они там и живут.
  const fullText = $("body").clone().find("script,style,noscript,svg,template").remove().end().text().replace(/\s+/g, " ").trim();
  const entitySignals: string[] = [];
  if (/\bИНН\s*:?\s*\d{10,12}\b/i.test(fullText)) entitySignals.push("ИНН");
  if (/\bОГРН(?:ИП)?\s*:?\s*\d{13,15}\b/i.test(fullText)) entitySignals.push("ОГРН");
  if (/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.test(fullText)) entitySignals.push("телефон");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(fullText)) entitySignals.push("email");
  if (/\b(ул\.|улица|проспект|пр-т|пер\.|переулок|наб\.|шоссе|д\.\s?\d)/i.test(fullText)) entitySignals.push("адрес");
  if (/\b(ООО|ИП|АО|ПАО)\s+[«"]?[А-ЯЁA-Z]/.test(fullText)) entitySignals.push("юрлицо");
  const email = fullText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const phone = fullText.match(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/)?.[0]?.replace(/\s+/g, " ");

  const socialLinks: string[] = [];
  $("a[href^='http']").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const h = hostOf(href);
    if (h && isSocialHost(h) && !socialLinks.includes(href) && socialLinks.length < 12) socialLinks.push(href.split("?")[0]);
  });

  const authorVisible =
    $('[rel="author"], [itemprop="author"], .author, [class*="author"]').length > 0 ||
    $('meta[name="author"]').length > 0 ||
    /\b(автор|author)\s*:/i.test(fullText);

  // Дата: <time datetime>, «обновлено …», dateModified из разметки.
  let visibleDate: string | undefined;
  const timeAttr = $("time[datetime]").first().attr("datetime");
  if (timeAttr) visibleDate = timeAttr;
  else {
    const m = fullText.match(/(обновлен[оа]?|updated|актуально на|по состоянию на)\s*:?\s*([0-9]{1,2}[\s.][а-яё0-9]+[\s.]?[0-9]{2,4}|[а-яё]+\s+20\d\d)/i);
    if (m) visibleDate = m[2];
    else if (jsonLd.article?.dateModified) visibleDate = jsonLd.article.dateModified;
  }

  // Контентная часть: убираем nav/header/footer — лид и заголовки ищем в теле.
  $("script,style,noscript,svg,template,nav,header,footer,aside,form").remove();
  const $root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

  const headings = (sel: string) => $root.find(sel).map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  // H1 берём по всему документу — он может стоять в header.
  const h1 = $("h1").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  const h2 = headings("h2");
  const h3 = headings("h3");
  const subHeads = [...h2, ...h3];
  const questionHeadings = subHeads.filter(h => QUESTION_RE.test(h)).length;
  const questionHeadingShare = subHeads.length ? questionHeadings / subHeads.length : 0;

  const text = $root.text().replace(/\s+/g, " ").trim();
  const textChars = text.length;
  const words = text ? text.split(/\s+/).length : 0;
  const textRatio = html.length ? textChars / html.length : 0;

  // Лид: первый абзац ≥ 15 слов после H1 (или просто первый содержательный).
  let lede = "";
  const paragraphs = $root.find("p").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get();
  for (const p of paragraphs) {
    if (p.split(/\s+/).length >= 15) { lede = p; break; }
  }
  if (!lede) {
    // Лендинги часто без <p>: берём первый длинный текстовый блок после H1.
    const afterH1 = text.slice(text.indexOf(h1[0] ?? "") + (h1[0]?.length ?? 0)).trim();
    lede = afterH1.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 400);
  }
  const ledeWords = lede ? lede.split(/\s+/).length : 0;
  const ledeIsAnswer = ledeWords >= 20 && ledeWords <= 90 && ANSWER_LEDE_RE.test(lede);

  const lists = $root.find("ul,ol").filter((_, el) => $(el).children("li").length >= 3).length;
  const tables = $root.find("table").length;
  const faqBlock =
    jsonLd.faqQuestions > 0 ||
    /\b(faq|часто задаваемые|вопросы и ответы|вопрос[—–-]ответ)\b/i.test(fullText) ||
    $root.find('[id*="faq"],[class*="faq"],details').length > 0;

  const factNumbers = (text.match(FACT_RE) ?? []).length;

  let externalRefs = 0;
  let internalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (href.startsWith("/") || href.startsWith(".")) { internalLinks++; return; }
    const h = hostOf(href);
    if (!h) return;
    if (h === domain || h.endsWith(`.${domain}`)) internalLinks++;
    else if (!isSocialHost(h)) externalRefs++;
  });

  const imgs = $("img");
  const imagesTotal = imgs.length;
  const imagesWithoutAlt = imgs.filter((_, el) => !($(el).attr("alt") ?? "").trim()).length;

  // ── Оценка страницы ────────────────────────────────────────────
  const issues: string[] = [];
  let score = 0;
  const add = (ok: boolean, pts: number, issue: string) => { if (ok) score += pts; else issues.push(issue); };

  add(title.length >= 25 && title.length <= 75, 5, title ? `title ${title.length} симв. (нужно 25–75)` : "нет <title>");
  add(description.length >= 70 && description.length <= 200, 5, description ? `description ${description.length} симв. (нужно 70–200)` : "нет meta description");
  add(h1.length === 1, 5, h1.length === 0 ? "нет H1" : `H1 несколько (${h1.length})`);
  add(h1.length > 0 && /[а-яёa-z]{4,}/i.test(h1[0] ?? "") && (h1[0] ?? "").length >= 15, 5, "H1 короткий или не называет предмет страницы");
  add(subHeads.length >= 3, 5, `подзаголовков H2/H3 мало (${subHeads.length})`);
  add(questionHeadingShare >= 0.3, 10, `лишь ${Math.round(questionHeadingShare * 100)}% подзаголовков сформулированы как вопрос`);
  add(ledeIsAnswer, 15, ledeWords === 0 ? "нет содержательного первого абзаца" : "первый абзац не отвечает прямо (нужно 20–90 слов, формат «X — это…/X делает…»)");
  add(faqBlock, 10, "нет FAQ-блока");
  add(lists + tables >= 2, 5, "мало списков/таблиц (нужно ≥ 2)");
  add(factNumbers >= 3, 5, `мало фактов с единицами измерения (${factNumbers})`);
  add(externalRefs >= 1, 5, "нет ссылок на внешние источники");
  add(!!visibleDate, 10, "не видно даты обновления");
  add(authorVisible, 5, "автор не указан");
  add(jsonLd.types.length > 0 && jsonLd.parseErrors === 0, 5, jsonLd.parseErrors ? "JSON-LD с ошибками разбора" : "нет JSON-LD");
  add(words >= 300, 5, `текста мало (${words} слов)`);

  return {
    url,
    source: opts.source,
    browser: opts.browser,
    aiBot: opts.aiBot,
    title, titleLen: title.length,
    description, descriptionLen: description.length,
    canonical, lang, noindex,
    h1, h2, h3,
    questionHeadingShare,
    textChars, words, textRatio, scriptBytes,
    lede: lede.slice(0, 600), ledeWords, ledeIsAnswer,
    lists, tables, faqBlock, factNumbers, externalRefs, internalLinks,
    imagesTotal, imagesWithoutAlt,
    visibleDate, authorVisible, entitySignals, email, phone, socialLinks,
    jsonLd, og,
    score: Math.min(100, score),
    issues,
  };
}

/** Пустой аудит для страницы, которую не удалось прочитать. */
export function unreadablePage(url: string, source: PageAudit["source"], browser: FetchProbe, aiBot?: FetchProbe): PageAudit {
  return {
    url, source, browser, aiBot,
    title: "", titleLen: 0, description: "", descriptionLen: 0, canonical: "", lang: "", noindex: false,
    h1: [], h2: [], h3: [], questionHeadingShare: 0,
    textChars: 0, words: 0, textRatio: 0, scriptBytes: 0,
    lede: "", ledeWords: 0, ledeIsAnswer: false,
    lists: 0, tables: 0, faqBlock: false, factNumbers: 0, externalRefs: 0, internalLinks: 0,
    imagesTotal: 0, imagesWithoutAlt: 0,
    authorVisible: false, entitySignals: [], socialLinks: [],
    jsonLd: { types: [], faqQuestions: 0, hasBreadcrumbs: false, hasWebSite: false, parseErrors: 0 },
    og: { title: false, description: false, image: false },
    score: 0,
    issues: [browser.error ? `не открывается: ${browser.error}` : `HTTP ${browser.status}`],
  };
}
