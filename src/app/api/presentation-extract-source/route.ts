/**
 * POST /api/presentation-extract-source
 *
 * Извлечение текста из источников данных для генератора презентаций:
 *  - multipart/form-data: files[] (PDF / DOCX / TXT / MD / HTML, до 3 шт,
 *    до 5 MB каждый) и/или поле url (лендинг / страница-источник)
 *  - application/json: { url }
 *
 * Возвращает { ok, sources: [{ name, text }], warnings: [] } — text уже
 * обрезан до ~8000 символов на источник, дальше generate-presentation
 * капит общую длину сам.
 *
 * Безопасность:
 *  - checkAiAccess — эндпоинт зовёт fetch наружу и парсит файлы, анонимам нельзя
 *  - SSRF-защита URL через checkSafeUrl (только http/https, приватные IP запрещены)
 *  - лимиты размера файлов и ответа страницы (cap чтения)
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { checkSafeUrl } from "@/lib/url-guard";
import { htmlToText, extractDocxText, extractPdfText } from "@/lib/doc-extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Cap текста одного источника — больше в промпт всё равно не влезет. */
const MAX_SOURCE_CHARS = 8000;
/** Cap скачиваемой страницы — защита от гигантских ответов. */
const MAX_PAGE_BYTES = 500_000;

interface ExtractedSource {
  name: string;
  text: string;
}

async function fetchPageText(rawUrl: string): Promise<{ source?: ExtractedSource; warning?: string }> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  // SSRF: только http/https, приватные IP и localhost запрещены (checkSafeUrl
  // резолвит DNS и проверяет каждый адрес).
  const guard = await checkSafeUrl(url, { allowedProtocols: ["http:", "https:"] });
  if (!guard.ok) {
    return { warning: `URL отклонён: ${guard.reason}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8",
      },
    });
    if (!res.ok) return { warning: `Страница ответила ${res.status}` };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { warning: `Неподдерживаемый тип страницы: ${contentType || "неизвестно"}` };
    }
    const raw = await res.text();
    const html = raw.length > MAX_PAGE_BYTES ? raw.slice(0, MAX_PAGE_BYTES) : raw;
    const text = (contentType.includes("text/plain") ? html : htmlToText(html)).slice(0, MAX_SOURCE_CHARS).trim();
    if (!text) return { warning: "На странице не нашлось текста (возможно, всё рендерится JS)" };
    let host = url;
    try { host = new URL(res.url || url).hostname; } catch { /* оставим url как есть */ }
    return { source: { name: host, text } };
  } catch (e) {
    return { warning: `Не удалось загрузить страницу: ${e instanceof Error ? e.message : "ошибка сети"}` };
  } finally {
    clearTimeout(timer);
  }
}

function extractFileText(name: string, mime: string, buf: Buffer): { text?: string; warning?: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const t = extractDocxText(buf);
    return t ? { text: t } : { warning: `${name}: не удалось прочитать .docx` };
  }
  if (lower.endsWith(".pdf") || mime.includes("pdf")) {
    const t = extractPdfText(buf);
    return t ? { text: t } : { warning: `${name}: не удалось извлечь текст из PDF (возможно, это скан — скопируйте текст в .txt)` };
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm") || mime.includes("html")) {
    return { text: htmlToText(buf.toString("utf8")) };
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".csv") || mime.startsWith("text/")) {
    return { text: buf.toString("utf8") };
  }
  return { warning: `${name}: неподдерживаемый формат (нужен PDF / DOCX / TXT)` };
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const ct = req.headers.get("content-type") || "";
    const sources: ExtractedSource[] = [];
    const warnings: string[] = [];
    let url = "";

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      url = String(fd.get("url") || "");

      const files = fd.getAll("files");
      let taken = 0;
      for (const f of files) {
        if (!(f instanceof File) || f.size === 0) continue;
        if (taken >= MAX_FILES) { warnings.push(`Файлов больше ${MAX_FILES} — лишние пропущены`); break; }
        if (f.size > MAX_FILE_BYTES) {
          warnings.push(`${f.name}: слишком большой (${Math.round(f.size / 1024 / 1024)} MB > 5 MB)`);
          continue;
        }
        taken++;
        const buf = Buffer.from(await f.arrayBuffer());
        const r = extractFileText(f.name, (f.type || "").toLowerCase(), buf);
        if (r.warning) { warnings.push(r.warning); continue; }
        const text = (r.text ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_SOURCE_CHARS);
        if (!text) { warnings.push(`${f.name}: файл пустой`); continue; }
        sources.push({ name: f.name.slice(0, 120), text });
      }
    } else {
      const body = await req.json().catch(() => ({})) as { url?: string };
      url = String(body.url || "");
    }

    if (url.trim()) {
      const r = await fetchPageText(url);
      if (r.source) sources.push(r.source);
      if (r.warning) warnings.push(r.warning);
    }

    if (sources.length === 0 && warnings.length === 0) {
      return NextResponse.json({ ok: false, error: "Передайте files и/или url" }, { status: 400 });
    }
    if (sources.length === 0) {
      // Всё, что передали, не удалось обработать — это ошибка, а не успех.
      return NextResponse.json({ ok: false, error: warnings.join("; ") }, { status: 422 });
    }
    return NextResponse.json({ ok: true, sources, warnings });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
