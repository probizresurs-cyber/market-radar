/**
 * POST /api/brand-facts-extract — автозаполнение банка фактов с сайта компании.
 *
 * Body: { url }
 * → { ok, data: { facts: Partial<BrandFacts>, sourceNote } }
 *
 * Зачем: заполнять банк фактов руками с нуля — барьер, из-за которого он
 * останется пустым у большинства, и генераторы продолжат ставить «[уточнить]»
 * там, где на сайте компании факт написан прямым текстом.
 *
 * КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ: это извлечение, а не сочинение. Модель обязана
 * брать только то, что ДОСЛОВНО присутствует в тексте сайта — иначе банк
 * фактов, единственный легальный источник цифр, сам станет источником
 * выдумки, и вся защита от галлюцинаций потеряет смысл. Каждое поле без
 * прямого подтверждения в тексте — null.
 *
 * Роут возвращает данные, но НЕ пишет их в брендбук: слияние делает клиент,
 * и заполненные вручную поля всегда сильнее спарсенных — человек отвечает
 * за факты, парсер лишь экономит ему время.
 */
import { NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scraper";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM = `Ты извлекаешь ФАКТЫ О КОМПАНИИ из текста её сайта.

ЖЕЛЕЗНОЕ ПРАВИЛО: бери только то, что написано в тексте ПРЯМО. Ты не оцениваешь, не додумываешь, не обобщаешь «по смыслу». Каждая цифра в ответе обязана дословно присутствовать во входном тексте. Если факта нет — поле null. Пустой ответ лучше выдуманного: эти данные пойдут в презентации клиента как проверенные.

Поля:
- foundedYear: год основания («работаем с 2014», «основана в 2009») — только сам год строкой
- completedProjects: реализованные объекты/проекты («более 120 объектов»)
- capacity: команда, цеха, производственные мощности
- geography: регионы/города работы
- clients: названные клиенты и партнёры (через запятую)
- certifications: СРО, ISO, ГОСТ, лицензии, допуски
- cases: конкретные кейсы с цифрами, по одному на строку (объект — что сделали — цифры)
- extra: прочие проверяемые цифры (тонны в год, гарантия N лет, сроки)

Ответ строго JSON:
{"foundedYear":null,"completedProjects":null,"capacity":null,"geography":null,"clients":null,"certifications":null,"cases":null,"extra":null}
(null → строка, если факт найден)`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const url = String(body.url ?? "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "url обязателен" }, { status: 400 });

  let site;
  try {
    site = await scrapeWebsite(url);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Не удалось прочитать сайт: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  const sourceText = [
    `Title: ${site.title}`,
    `Description: ${site.metaDescription}`,
    site.h1.length ? `H1: ${site.h1.join(" | ")}` : "",
    site.h2.length ? `H2: ${site.h2.join(" | ")}` : "",
    site.rawTextSample,
  ].filter(Boolean).join("\n").slice(0, 14_000);

  if (sourceText.length < 200) {
    return NextResponse.json(
      { ok: false, error: "С сайта удалось прочитать слишком мало текста — вероятно, он полностью на JavaScript. Заполните факты вручную." },
      { status: 422 },
    );
  }

  const r = await chatJson<Record<string, string | null>>({
    model: CHAT_MODEL_SMART,
    system: SYSTEM,
    user: `Текст сайта ${site.url}:\n\n${sourceText}`,
    maxTokens: 900,
  });
  if (!r.data) {
    await access.log({ endpoint: "brand-facts-extract", model: CHAT_MODEL_SMART, success: false });
    return NextResponse.json({ ok: false, error: `Извлечение не удалось: ${r.error ?? "пустой ответ"}` }, { status: 502 });
  }

  const keys = ["foundedYear", "completedProjects", "capacity", "geography", "clients", "certifications", "cases", "extra"] as const;
  const facts: Record<string, string> = {};
  for (const k of keys) {
    const v = r.data[k];
    if (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null") {
      facts[k] = v.trim().slice(0, 1500);
    }
  }

  await access.log({ endpoint: "brand-facts-extract", model: CHAT_MODEL_SMART, success: true });
  return NextResponse.json({
    ok: true,
    data: {
      facts,
      sourceNote: Object.keys(facts).length
        ? `Найдено на ${site.url}: ${Object.keys(facts).length} полей. Проверьте перед использованием — парсер берёт написанное на сайте как есть.`
        : `На ${site.url} проверяемых фактов не нашлось — заполните вручную.`,
    },
  });
}
