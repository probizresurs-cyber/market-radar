/**
 * POST /api/landing-translate
 *
 * Переводит уже сгенерированный лендинг на другой язык (RU ↔ EN).
 *
 * Flow:
 *   1. Скачиваем HTML по htmlUrl (с SSRF-проверкой через checkSafeUrl)
 *   2. Достаём текстовые ноды (контент в title/h1-h6/p/li/button/a)
 *   3. Переводим через Claude Haiku (один batch-вызов: массив строк → массив переводов)
 *   4. Заменяем обратно в HTML
 *   5. Возвращаем переведённый HTML + alternate hreflang link
 *
 * НЕ требует второй Stitch run (дорого + долго). Просто на стороне HTML.
 *
 * Body: { htmlUrl, targetLang: "en" | "ru" }
 * Returns: { ok, data: { translatedHtml, alternateLinkTag } }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { fetchWithTimeout, NORMAL_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { checkSafeUrl } from "@/lib/url-guard";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRANSLATABLE_TAGS = ["title", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "button", "span", "div", "a"];
const MIN_TEXT_LEN = 2;
const MAX_STRINGS = 250; // лимит на лендинг

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { htmlUrl?: string; targetLang?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const htmlUrl = (body.htmlUrl ?? "").trim();
  const targetLang = (body.targetLang ?? "en").toLowerCase();
  if (!["en", "ru"].includes(targetLang)) {
    return NextResponse.json({ ok: false, error: "targetLang must be 'en' or 'ru'" }, { status: 400 });
  }
  if (!htmlUrl) {
    return NextResponse.json({ ok: false, error: "htmlUrl required" }, { status: 400 });
  }

  // SSRF guard
  const guard = await checkSafeUrl(htmlUrl, { allowedProtocols: ["https:"], resolveDns: true });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: `htmlUrl rejected: ${guard.reason}` }, { status: 400 });
  }

  // Скачиваем HTML
  let html: string;
  try {
    const res = await fetchWithTimeout(htmlUrl, {}, NORMAL_TIMEOUT_MS);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Не удалось скачать HTML: ${res.status}` }, { status: 502 });
    }
    html = await res.text();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Fetch failed: ${e instanceof Error ? e.message : "error"}`,
    }, { status: 502 });
  }

  // Извлекаем text nodes — упрощённый regex-парсер (не пытается быть полным
  // HTML-парсером, лишь ищет содержимое разрешённых тегов).
  const tagPattern = new RegExp(`<(${TRANSLATABLE_TAGS.join("|")})\\b[^>]*>([^<]+)<\\/\\1>`, "gi");
  const strings: string[] = [];
  const replacements: Array<{ index: number; original: string; placeholder: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(html)) !== null) {
    const inner = m[2].trim();
    if (inner.length < MIN_TEXT_LEN) continue;
    if (/^[\d\s.,:;!?$%€₽\-]+$/.test(inner)) continue; // только цифры/пунктуация
    if (strings.length >= MAX_STRINGS) break;
    const idx = strings.length;
    strings.push(inner);
    replacements.push({
      index: idx,
      original: m[2],
      placeholder: `__I18N_${idx}__`,
    });
  }

  if (strings.length === 0) {
    return NextResponse.json({ ok: false, error: "Не нашли текста для перевода" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
  }
  const client = new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  });

  const targetLangFull = targetLang === "en" ? "English" : "Russian";
  const sourceLangFull = targetLang === "en" ? "Russian" : "English";

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Переведи массив строк с ${sourceLangFull} на ${targetLangFull}. Сохраняй:
- Маркетинговый тон (живой, продающий)
- Структуру (если строка короткая — перевод короткий; если призыв к действию — оставь призывом)
- Названия брендов / компаний / собственных имён — НЕ переводи
- HTML-сущности (&amp; &nbsp; &mdash;) — оставь как есть
- Эмодзи — оставь как есть

ВХОДНОЙ МАССИВ (JSON):
${JSON.stringify(strings)}

ВЫХОД — строго JSON-массив переводов в том же порядке (та же длина = ${strings.length}):
{"translations": ["перевод 1", "перевод 2", ...]}`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = (msg.content[0] as { type: string; text: string }).text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ ok: false, error: "Claude не вернул JSON" }, { status: 500 });
  }
  let parsed: { translations?: string[] };
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch {
    return NextResponse.json({ ok: false, error: "Не удалось распарсить ответ Claude" }, { status: 500 });
  }
  const translations = Array.isArray(parsed.translations) ? parsed.translations : [];

  // Заменяем обратно в HTML — простая последовательная замена.
  let translatedHtml = html;
  for (let i = 0; i < replacements.length; i++) {
    const r = replacements[i];
    const t = translations[i];
    if (typeof t !== "string") continue;
    // Заменяем первый вхождение original (внутри тега)
    translatedHtml = translatedHtml.replace(r.original, t);
  }

  // Добавим lang attribute и hreflang link
  translatedHtml = translatedHtml.replace(/<html\s+lang=["'][^"']*["']/i, `<html lang="${targetLang}"`);
  if (!/<html\s+lang=/i.test(translatedHtml)) {
    translatedHtml = translatedHtml.replace(/<html/i, `<html lang="${targetLang}"`);
  }

  const alternateLinkTag = `<link rel="alternate" hreflang="${targetLang === "en" ? "ru" : "en"}" href="${htmlUrl}" />`;

  await access.log({
    endpoint: "landing-translate",
    model: "claude-haiku-4-5",
    promptTokens: msg.usage?.input_tokens,
    completionTokens: msg.usage?.output_tokens,
    success: true,
  });

  return NextResponse.json({
    ok: true,
    data: {
      translatedHtml,
      alternateLinkTag,
      stringsTranslated: translations.length,
    },
  });
}
