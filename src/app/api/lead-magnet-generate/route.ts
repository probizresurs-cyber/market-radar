/**
 * POST /api/lead-magnet-generate
 *
 * Генерация lead-magnet PDF: чек-лист / гайд / шпаргалка по теме лендинга.
 * Posted на лендинге как «Скачать чек-лист → введи email» → пользователь
 * заполняет форму → /api/landing-submit пишет lead → этот PDF отдаётся.
 *
 * Body:
 *   { topic, audience?, brandBook?, type? }
 *   type: "checklist" | "guide" | "framework"
 *
 * Returns:
 *   { ok, data: { pdfDataUrl, title, sections } }
 *
 * AI пишет структуру через Claude, рендеринг через простой HTML + headless
 * Chrome (переиспользуем существующий /api/export-slides-pdf flow).
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

interface MagnetSection {
  heading: string;
  items: string[];
}

interface BrandBookLite {
  colors?: string[];
  fontHeader?: string;
  fontBody?: string;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { topic?: string; audience?: string; brandBook?: BrandBookLite; type?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const topic = (body.topic ?? "").trim().slice(0, 200);
  if (!topic) return NextResponse.json({ ok: false, error: "topic required" }, { status: 400 });

  const audience = (body.audience ?? "").slice(0, 300);
  const type = ["checklist", "guide", "framework"].includes(body.type ?? "") ? body.type! : "checklist";
  const brand = body.brandBook ?? {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

  const client = new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  });

  const typeDescription = {
    checklist: "Чек-лист — 4-6 разделов по 4-8 пунктов в каждом. Каждый пункт — конкретное действие/проверка.",
    guide: "Гайд — 3-5 разделов с пояснениями (1-2 предложения на пункт). Не сухой список, а лёгкий мини-курс.",
    framework: "Фреймворк — 4-7 шагов методологии. Каждый шаг с кратким описанием логики и результата.",
  }[type];

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты — эксперт-копирайтер по лид-магнитам. Создай ${typeDescription}

ТЕМА: ${topic}
${audience ? `АУДИТОРИЯ: ${audience}` : ""}

ТРЕБОВАНИЯ:
- Конкретика, никакой воды. Каждый пункт — реальная польза.
- Тон — экспертный, дружелюбный.
- Без выдуманной статистики.

ВЫХОД — JSON:
{
  "title": "Заголовок лид-магнита (до 80 символов)",
  "subtitle": "Подзаголовок (до 150 символов)",
  "sections": [
    { "heading": "Раздел 1", "items": ["Пункт 1", "Пункт 2", ...] },
    ...
  ]
}`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ ok: false, error: "Claude не вернул JSON" }, { status: 500 });
  }
  let parsed: { title?: string; subtitle?: string; sections?: MagnetSection[] };
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch {
    return NextResponse.json({ ok: false, error: "Не удалось распарсить JSON" }, { status: 500 });
  }

  const title = (parsed.title ?? topic).slice(0, 120);
  const subtitle = (parsed.subtitle ?? "").slice(0, 200);
  const sections = Array.isArray(parsed.sections) ? parsed.sections.slice(0, 8) : [];

  // Простой HTML для PDF-rendering. /api/export-slides-pdf уже умеет
  // принимать HTML и возвращать PDF через headless Chrome. Но это
  // отдельный сервис, и проще завести fallback: возвращаем HTML + клиент
  // может через window.print() сохранить как PDF.
  const primary = brand.colors?.[0] ?? "#6366f1";
  const fontH = brand.fontHeader ?? "Georgia, serif";
  const fontB = brand.fontBody ?? "Inter, sans-serif";

  const esc = (s: string) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sectionsHtml = sections.map((s, i) => `
    <section style="margin: 32px 0;">
      <h2 style="font-family: ${fontH}; font-size: 22px; color: ${primary}; margin: 0 0 12px;">
        ${i + 1}. ${esc(s.heading)}
      </h2>
      <ul style="margin: 0; padding-left: 0; list-style: none;">
        ${s.items.map(it => `
          <li style="padding: 8px 0 8px 28px; position: relative; font-size: 14px; line-height: 1.6;">
            <span style="position: absolute; left: 0; top: 9px; width: 16px; height: 16px; border: 2px solid ${primary}; border-radius: 3px;"></span>
            ${esc(it)}
          </li>
        `).join("")}
      </ul>
    </section>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  body { font-family: ${fontB}; max-width: 720px; margin: 0 auto; padding: 60px 40px; color: #1e293b; }
  .hero { text-align: center; padding-bottom: 32px; border-bottom: 2px solid ${primary}; }
  .hero h1 { font-family: ${fontH}; font-size: 36px; margin: 0 0 12px; color: ${primary}; line-height: 1.2; }
  .hero .subtitle { font-size: 16px; color: #64748b; margin: 0; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="hero">
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
  </div>
  ${sectionsHtml}
  <div class="footer">
    Создано на marketradar24.ru
  </div>
</body>
</html>`;

  await access.log({
    endpoint: "lead-magnet-generate",
    model: "claude-haiku-4-5",
    promptTokens: msg.usage?.input_tokens,
    completionTokens: msg.usage?.output_tokens,
    success: true,
  });

  return NextResponse.json({
    ok: true,
    data: {
      title,
      subtitle,
      sections,
      html, // клиент может вставить в iframe и window.print() для PDF
    },
  });
}
