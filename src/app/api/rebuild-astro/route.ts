import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { friendlyAiError } from "@/lib/ai-error";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { safeAnthropicStream, extractJson } from "@/lib/anthropic-safe";
import { scrapeWebsite } from "@/lib/scraper";

// Пересборка сайта в Astro-проект. Скрейпим реальный сайт → отдаём Claude его
// контент + найденные SEO/структурные дыры → получаем полный Astro-проект
// (набор файлов), который воспроизводит контент, но ЧИНИТ проблемы.
//
// Большой JSON-вывод (несколько файлов) — держим maxDuration высоким и
// max_tokens большим. Модель — основная Sonnet проекта.
export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";

export interface AstroFile {
  path: string;
  content: string;
}

export interface RebuildAstroResult {
  ok: true;
  source: {
    url: string;
    title: string;
    issues: string[];
  };
  files: AstroFile[];
  fixes: string[];
  summary: string;
  modelUsed: string;
}

// Собираем список объективных дыр из ScrapedData — это ФАКТЫ со страницы,
// не гипотезы. Их же передаём модели как «что обязательно исправить».
function detectIssues(s: Awaited<ReturnType<typeof scrapeWebsite>>): string[] {
  const issues: string[] = [];
  if (!s.metaDescription?.trim()) issues.push("Отсутствует meta description");
  if (s.h1.length === 0) issues.push("Нет ни одного H1 на странице");
  else if (s.h1.length > 1) issues.push(`H1 несколько (${s.h1.length}) — должен быть один смысловой`);
  if (s.imageCount > 0 && s.imagesWithAlt < s.imageCount)
    issues.push(`alt заполнен у ${s.imagesWithAlt} из ${s.imageCount} изображений`);
  if (!s.hasSchemaMarkup) issues.push("Нет разметки Schema.org (structured data)");
  if (!s.hasCanonical) issues.push("Нет canonical-ссылки");
  if (!s.hasViewport) issues.push("Нет viewport meta (не адаптивен под мобильные)");
  if (!s.hasSitemap) issues.push("Нет sitemap.xml");
  if (!s.hasRobotsTxt) issues.push("Нет robots.txt");
  if (!s.isHttps) issues.push("Сайт не на HTTPS");
  if (s.jsHeavy) issues.push("Тяжёлый JS-рендеринг — контент недоступен без выполнения скриптов (плохо для SEO/GEO)");
  return issues;
}

function buildSystemPrompt(): string {
  return `${ANTI_HALLUCINATION_SHORT}

Ты — senior frontend-инженер, эксперт по Astro (astro.build) и техническому SEO. Твоя задача — пересобрать существующий сайт как чистый, быстрый, SEO-безупречный проект Astro, сохранив ВЕСЬ реальный контент исходной страницы, но исправив технические дыры.

ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО контент, который есть в предоставленных данных страницы. НЕ выдумывай услуги, цены, телефоны, адреса, отзывы, цифры, названия компаний, которых нет во входных данных. Если чего-то нет — не добавляй заглушки с выдуманными фактами; оставь нейтральный текст или пропусти секцию.
2. Собери НАСТОЯЩИЙ Astro-проект, который собирается командой \`npm install && npm run build\` без ошибок:
   - package.json (astro в dependencies, актуальная мажорная версия, scripts dev/build/preview)
   - astro.config.mjs
   - tsconfig.json
   - src/layouts/Layout.astro — общий layout с корректными <head>: charset, viewport, title, meta description, canonical, Open Graph, JSON-LD Schema.org
   - src/pages/index.astro — главная, использующая Layout
   - при необходимости src/components/*.astro (Header, Hero, Footer и секции по контенту)
   - public/robots.txt
   - astro.config или интеграция @astrojs/sitemap для sitemap.xml
   - src/styles/global.css (или inline-стили) — аккуратная адаптивная вёрстка
3. Исправь ВСЕ перечисленные в задаче проблемы: один смысловой H1, заполненная meta description, alt у всех <img>, Schema.org (подходящий тип: Organization/LocalBusiness/Article — выбери по смыслу контента), viewport, canonical, семантические теги (header/main/section/footer), доступность.
4. Семантика и производительность: статический HTML (Astro island только если реально нужно), картинки с alt, ленивую загрузку где уместно.

ФОРМАТ ОТВЕТА — СТРОГО валидный JSON, без markdown-обёртки, без комментариев:
{
  "summary": "1-2 предложения: что за сайт и что сделано",
  "fixes": ["исправление 1", "исправление 2", ...],
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "src/pages/index.astro", "content": "..." }
  ]
}
Каждый файл — полный, готовый к работе. Экранируй переносы строк и кавычки в content по правилам JSON.`;
}

function buildUserPrompt(s: Awaited<ReturnType<typeof scrapeWebsite>>, issues: string[]): string {
  const parts: string[] = [];
  parts.push(`Пересобери этот сайт в Astro-проект.`);
  parts.push(`URL: ${s.url}`);
  parts.push(`Заголовок (title): ${s.title || "(пусто)"}`);
  parts.push(`Meta description: ${s.metaDescription || "(отсутствует)"}`);
  if (s.h1.length) parts.push(`H1 на странице: ${s.h1.join(" | ")}`);
  if (s.h2.length) parts.push(`H2 на странице: ${s.h2.slice(0, 20).join(" | ")}`);
  if (Object.keys(s.socialLinks).length)
    parts.push(`Соцсети: ${Object.entries(s.socialLinks).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  if (s.techStack.length) parts.push(`Текущий стек: ${s.techStack.join(", ")}`);
  parts.push(`\nТекстовый контент страницы (выдержка, используй как источник смысла):\n"""\n${s.rawTextSample.slice(0, 6000)}\n"""`);
  parts.push(`\nОбязательно исправь эти найденные проблемы:\n${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`);
  parts.push(`\nВерни JSON по заданному формату. Собери связный, современный, адаптивный сайт на реальном контенте выше.`);
  return parts.join("\n");
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl: string = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: "Укажите URL сайта" }, { status: 400 });
    }

    // 1) Скрейпим реальный сайт
    let scraped: Awaited<ReturnType<typeof scrapeWebsite>>;
    try {
      scraped = await scrapeWebsite(rawUrl);
    } catch (e) {
      await access.log({ endpoint: "rebuild-astro", model: "-", success: false, errorMessage: "scrape failed" });
      return NextResponse.json(
        { ok: false, error: `Не удалось загрузить сайт: ${e instanceof Error ? e.message : "ошибка"}. Проверьте URL.` },
        { status: 502 },
      );
    }

    const issues = detectIssues(scraped);

    // 2) Генерируем Astro-проект
    const started = Date.now();
    // Стриминг обязателен: при max_tokens 32k SDK иначе бросает
    // «Streaming is required for operations that may take longer than 10 minutes».
    const { text, modelUsed, error } = await safeAnthropicStream({
      model: MODEL,
      max_tokens: 32000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(scraped, issues) }],
      temperature: 0.4,
    });

    if (!text) {
      await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: false, errorMessage: error?.slice(0, 200) });
      const fe = friendlyAiError(error);
      return NextResponse.json({ ok: false, error: fe.message }, { status: fe.status });
    }

    // 3) Парсим JSON-ответ модели
    const parsed = extractJson<{ summary?: string; fixes?: string[]; files?: AstroFile[] }>(text);
    if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: false, errorMessage: "bad JSON / no files" });
      return NextResponse.json(
        { ok: false, error: "Модель вернула ответ в неожиданном формате. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    // Санитизация: только валидные файлы с относительными путями (без ../, без абсолютных)
    const files = parsed.files
      .filter((f): f is AstroFile =>
        !!f && typeof f.path === "string" && typeof f.content === "string" && f.path.length > 0)
      .map((f) => ({ path: f.path.replace(/^\/+/, "").replace(/\.\.[/\\]/g, ""), content: f.content }))
      .filter((f) => f.path.length > 0);

    if (files.length === 0) {
      await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: false, errorMessage: "no valid files" });
      return NextResponse.json({ ok: false, error: "Модель не вернула валидных файлов проекта." }, { status: 502 });
    }

    await access.log({
      endpoint: "rebuild-astro",
      model: modelUsed,
      success: true,
      durationMs: Date.now() - started,
    });

    const result: RebuildAstroResult = {
      ok: true,
      source: { url: scraped.url, title: scraped.title, issues },
      files,
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      modelUsed,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("rebuild-astro error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 },
    );
  }
}
