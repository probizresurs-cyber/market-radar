import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as cheerio from "cheerio";
import { checkAiAccess } from "@/lib/with-ai-security";
import { friendlyAiError } from "@/lib/ai-error";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { safeAnthropicStream, extractJson } from "@/lib/anthropic-safe";
import { scrapeForRebuild, type RebuildScrape } from "@/lib/rebuild-scrape";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

// Пересборка сайта в Astro. Модель делает ОДНУ самодостаточную HTML-страницу
// (инлайн-CSS, реальные картинки, якорная навигация, Schema/meta) — это живое
// превью. Astro-проект для zip собираем из неё в коде (Layout + index через
// set:html), чтобы zip выглядел идентично превью и не падал на путях к CSS.
export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";

export interface AstroFile {
  path: string;
  content: string;
}

export interface RebuildAstroResult {
  ok: true;
  id: string;
  previewUrl: string;
  source: { url: string; title: string; issues: string[] };
  files: AstroFile[];
  fixes: string[];
  summary: string;
  modelUsed: string;
}

function detectIssues(s: RebuildScrape): string[] {
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

Ты — топовый веб-дизайнер и frontend-инженер. Пересобираешь существующий сайт как ОДНУ красивую, современную, адаптивную HTML-страницу, сохраняя весь реальный контент, но исправляя технические SEO-дыры и делая дизайн привлекательным.

ЖЁСТКИЕ ПРАВИЛА:
1. Контент — ТОЛЬКО из предоставленных данных. НЕ выдумывай услуги, цены, телефоны, адреса, отзывы, цифры. Что не дано — не пиши.
2. Возвращаешь ОДИН самодостаточный HTML-документ (полный: <!doctype html> … </html>):
   - Весь CSS — ВНУТРИ страницы, в теге <style> в <head>. НИКАКИХ внешних .css файлов и CDN.
   - Реальные изображения из списка ниже — вставляй по их абсолютным URL (<img src="https://…" alt="осмысленный alt" loading="lazy">). Hero-изображение используй крупным фоном или в первом экране. НЕ выдумывай URL картинок — бери только из списка.
   - Дизайн: современный, чистый, с продуманной типографикой, отступами, секциями, hover-эффектами, адаптивом (flex/grid, media-queries). Приятная палитра (если дан themeColor — отталкивайся от него). Это должно выглядеть как хороший коммерческий сайт, а не как черновик.
   - Навигация: <header> с меню; пункты меню — якоря на секции этой же страницы (href="#section-id"), чтобы всё листалось и кликалось в пределах одной страницы. Каждой секции — id.
   - Секции по смыслу контента: hero, о компании/услугах, проекты/портфолио (галерея реальных картинок), преимущества, отзывы (если есть в данных), контакты, footer.
   - SEO в <head>: <title>, <meta name="description">, <meta name="viewport">, <link rel="canonical"> (URL дан ниже), Open Graph, и <script type="application/ld+json"> со Schema.org (тип по смыслу: Organization/LocalBusiness/Article).
   - Семантика: header/main/section/nav/footer, один <h1>, alt у всех <img>, aria-label у интерактивных элементов.
   - Не подключай внешний JS. Небольшой инлайн-скрипт допустим только для мелочей (например, мобильное меню), но сайт должен полностью работать и без JS.

ФОРМАТ ОТВЕТА — СТРОГО валидный JSON, без markdown-обёртки:
{
  "summary": "1-2 предложения: что за сайт и что сделано",
  "fixes": ["исправление 1", "исправление 2", ...],
  "html": "<!doctype html>…полный документ…"
}
Поле html — ПОЛНАЯ готовая страница. Экранируй кавычки и переносы строк по правилам JSON.`;
}

function buildUserPrompt(s: RebuildScrape, issues: string[]): string {
  const parts: string[] = [];
  parts.push(`Пересобери этот сайт в одну красивую HTML-страницу.`);
  parts.push(`URL (для canonical и site): ${s.url}`);
  parts.push(`Заголовок (title): ${s.title || "(пусто)"}`);
  parts.push(`Meta description исходная: ${s.metaDescription || "(отсутствует)"}`);
  if (s.themeColor) parts.push(`Фирменный цвет (theme-color): ${s.themeColor}`);
  if (s.h1.length) parts.push(`H1: ${s.h1.join(" | ")}`);
  if (s.h2.length) parts.push(`H2 (секции): ${s.h2.join(" | ")}`);
  if (s.h3.length) parts.push(`H3: ${s.h3.slice(0, 20).join(" | ")}`);
  if (s.navLinks.length) parts.push(`Пункты меню исходного сайта: ${s.navLinks.map(n => n.text).join(", ")}`);
  if (s.heroImage) parts.push(`Hero-изображение (главный визуал, крупно): ${s.heroImage}`);
  if (s.images.length) {
    parts.push(`Доступные изображения (используй по абсолютным URL, только из этого списка):`);
    parts.push(s.images.map((im, i) => `${i + 1}. ${im.src}${im.alt ? ` — «${im.alt}»` : ""}`).join("\n"));
  }
  if (Object.keys(s.socialLinks).length)
    parts.push(`Соцсети: ${Object.entries(s.socialLinks).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  parts.push(`\nТекстовый контент страницы (источник смысла):\n"""\n${s.textContent}\n"""`);
  parts.push(`\nОбязательно исправь эти найденные проблемы:\n${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`);
  parts.push(`\nВерни JSON {summary, fixes, html}. html — цельная современная адаптивная страница на реальном контенте и реальных картинках выше.`);
  return parts.join("\n");
}

// Экранируем строку для вставки в шаблонный литерал Astro (`...`).
function escapeForTemplate(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// Собираем Astro-проект из готового HTML: Layout несёт <head>, index — <body>
// (оба через set:html, чтобы Astro не парсил произвольный HTML как шаблон).
function assembleAstroProject(html: string, origin: string, title: string): AstroFile[] {
  const $ = cheerio.load(html);
  const headInner = $("head").html() ?? `<meta charset="utf-8"><title>${title}</title>`;
  const bodyInner = $("body").html() ?? html;

  const layout = `---
const { head = "" } = Astro.props;
---
<!doctype html>
<html lang="ru">
  <head set:html={head}></head>
  <body>
    <slot />
  </body>
</html>
`;

  const index = `---
import Layout from '../layouts/Layout.astro';
const head = \`${escapeForTemplate(headInner)}\`;
const body = \`${escapeForTemplate(bodyInner)}\`;
---
<Layout head={head}>
  <Fragment set:html={body} />
</Layout>
`;

  const astroConfig = `import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// site обязателен для @astrojs/sitemap — без него сборка падает.
export default defineConfig({
  site: '${origin}',
  integrations: [sitemap()],
});
`;

  const pkg = JSON.stringify({
    name: "rebuilt-site",
    type: "module",
    version: "1.0.0",
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
    dependencies: { astro: "^5.0.0", "@astrojs/sitemap": "^3.2.0" },
  }, null, 2) + "\n";

  const tsconfig = JSON.stringify({ extends: "astro/tsconfigs/strict" }, null, 2) + "\n";
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap-index.xml\n`;
  const readme = `# Пересобранный сайт (Astro)\n\nСборка:\n\n\`\`\`\nnpm install\nnpm run build\n\`\`\`\n\nЛокальный просмотр: \`npm run preview\`.\n`;

  return [
    { path: "package.json", content: pkg },
    { path: "astro.config.mjs", content: astroConfig },
    { path: "tsconfig.json", content: tsconfig },
    { path: "src/layouts/Layout.astro", content: layout },
    { path: "src/pages/index.astro", content: index },
    { path: "public/robots.txt", content: robots },
    { path: "README.md", content: readme },
  ];
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    await initDb();
    const body = await req.json().catch(() => ({}));
    const rawUrl: string = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ ok: false, error: "Укажите URL сайта" }, { status: 400 });

    // 1) Скрейпим сайт (с картинками)
    let scraped: RebuildScrape;
    try {
      scraped = await scrapeForRebuild(rawUrl);
    } catch (e) {
      await access.log({ endpoint: "rebuild-astro", model: "-", success: false, errorMessage: "scrape failed" });
      return NextResponse.json(
        { ok: false, error: `Не удалось загрузить сайт: ${e instanceof Error ? e.message : "ошибка"}. Проверьте URL.` },
        { status: 502 },
      );
    }
    const issues = detectIssues(scraped);

    // 2) Генерируем одну самодостаточную страницу
    const started = Date.now();
    const { text, modelUsed, error } = await safeAnthropicStream({
      model: MODEL,
      max_tokens: 32000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(scraped, issues) }],
      temperature: 0.5,
    });
    if (!text) {
      await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: false, errorMessage: error?.slice(0, 200) });
      const fe = friendlyAiError(error);
      return NextResponse.json({ ok: false, error: fe.message }, { status: fe.status });
    }

    const parsed = extractJson<{ summary?: string; fixes?: string[]; html?: string }>(text);
    const html = parsed?.html?.trim();
    if (!html || !/<html[\s>]/i.test(html)) {
      await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: false, errorMessage: "bad JSON / no html" });
      return NextResponse.json(
        { ok: false, error: "Модель вернула ответ в неожиданном формате. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    const files = assembleAstroProject(html, scraped.origin, scraped.title || "Сайт");

    // 3) Сохраняем для живого превью
    const id = randomUUID();
    const session = await getSessionUser().catch(() => null);
    const snapshot = {
      previewHtml: html,
      files,
      fixes: Array.isArray(parsed?.fixes) ? parsed.fixes : [],
      summary: typeof parsed?.summary === "string" ? parsed.summary : "",
      source: { url: scraped.url, title: scraped.title, issues },
      createdAt: new Date().toISOString(),
    };
    try {
      await query(
        `INSERT INTO astro_rebuilds (id, user_id, source_url, title, snapshot, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, session?.userId ?? null, scraped.url, scraped.title || "", JSON.stringify(snapshot)],
      );
    } catch (e) {
      console.error("[rebuild-astro] persist failed:", e);
      // Не роняем — превью-ссылки не будет, но файлы вернём
    }

    await access.log({ endpoint: "rebuild-astro", model: modelUsed, success: true, durationMs: Date.now() - started });

    const result: RebuildAstroResult = {
      ok: true,
      id,
      previewUrl: `/api/site-preview/${id}`,
      source: { url: scraped.url, title: scraped.title, issues },
      files,
      fixes: snapshot.fixes,
      summary: snapshot.summary,
      modelUsed,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("rebuild-astro error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Ошибка сервера" }, { status: 500 });
  }
}
