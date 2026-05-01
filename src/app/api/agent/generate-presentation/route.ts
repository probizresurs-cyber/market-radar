/**
 * POST /api/agent/generate-presentation
 *
 * Accepts multipart/form-data:
 *   - companyName: string
 *   - niche?: string
 *   - data: JSON string of analysis result
 *   - style?: "premium-dark" | "minimal" | "corporate" | "bold-startup" | "custom"
 *   - customDesignNotes?: string  (free-form design instructions)
 *   - slides?: number
 *   - model?: "claude-opus-4-6" | "claude-sonnet-4-5"
 *   - references[]: image files (jpg/png) used as visual references
 *
 * Workflow: HTML-first (frontend-slides skill) → Playwright headless renders to
 * PNG → packaged into PDF + PPTX via agent-helpers/render-deck.sh.
 *
 * Returns: { ok, jobId }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startAgentJob, type ContextFile } from "@/lib/agent-runner";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 600;

// Absolute path to the helper scripts directory (deployed alongside the app)
const HELPER_DIR = join(process.cwd(), "agent-helpers");

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "premium-dark":
    "Премиум-тёмная тема в духе Linear / Vercel / Stripe. Тёмный фон, продуманные градиенты, типографика на уровне Apple keynote, neon-акценты. Шрифты должны быть выразительными — НЕ используй Inter/Roboto/Arial. Подойдут: Space Grotesk, Geist, Söhne, Fraunces, Cabinet Grotesk.",
  minimal:
    "Утончённый минимализм в духе Notion / Airbnb / Stripe Press. Editorial-подача с большой типографикой, очень много белого пространства, ровно ОДИН цветовой акцент. Подойдут шрифты: Fraunces, Editorial New, GT Sectra, Söhne.",
  corporate:
    "Современный B2B-стиль (НЕ скучный enterprise). Глубокий тёмный фон или premium-светлый, золотой/серебряный акцент. Smartтипографика — Playfair Display + Inter, или Cabinet Grotesk + Fraunces.",
  "bold-startup":
    "Дерзкий стартап-стиль. Высокий контраст, неоновые акценты (yellow/lime/cyan), огромные заголовки (clamp 80–160px). Подойдут: Druk, Migra, JetBrains Mono для accents.",
  custom: "Стиль задаётся через customDesignNotes пользователя.",
};

const DESIGN_SYSTEM_PROMPT = `Ты — frontend-дизайнер презентаций уровня Linear / Stripe / Apple keynote. Создаёшь HTML-презентации с настоящей визуальной глубиной — никакого "AI slop".

# ВАЖНО: РАБОТАЕШЬ ТОЛЬКО ЧЕРЕЗ HTML

Финальный артефакт — один self-contained HTML-файл с несколькими блоками \`.slide\`. Из него helper-скрипт автоматически собирает PDF и PPTX. Питон-pptx НЕ ИСПОЛЬЗУЙ для генерации слайдов — это даёт дешёвый "офисный" вид.

# ОБЯЗАТЕЛЬНЫЕ ШАГИ (НЕ ПРОПУСКАТЬ!)

## ШАГ 1 — ПРОЧИТАЙ frontend-slides skill ЦЕЛИКОМ

Это твой главный инструмент. Прочитай через Read:
- \`~/.claude/skills/frontend-slides/SKILL.md\` — методология
- \`~/.claude/skills/frontend-slides/html-template.md\` — структура HTML
- \`~/.claude/skills/frontend-slides/viewport-base.css\` — обязательный CSS (вставь полностью в \`<style>\` презентации)
- \`~/.claude/skills/frontend-slides/animation-patterns.md\` — паттерны анимации
- \`~/.claude/skills/frontend-slides/STYLE_PRESETS.md\` — готовые стили

## ШАГ 2 — ПРОЧИТАЙ ОСТАЛЬНЫЕ ДИЗАЙН-СКИЛЛЫ

- \`~/.claude/skills/canvas-design/SKILL.md\` — дизайн-принципы
- \`~/.claude/skills/brand-guidelines/SKILL.md\` — визуальный язык бренда
- \`~/.claude/skills/theme-factory/SKILL.md\` — темы и палитры
- \`~/.claude/skills/algorithmic-art/SKILL.md\` — декоративные паттерны (если уместно)

После всех Read скажи в одной строке: \`Прочитал N скиллов: [список]\`. Это контрольный чекпоинт.

## ШАГ 3 — ПРОЧИТАЙ ВХОДНЫЕ ДАННЫЕ

- \`data.json\` через Read
- ВСЕ файлы в \`references/\` через Read (Claude мультимодален — открой каждое изображение и опиши себе композицию, палитру, типографику, декоративные элементы)

## ШАГ 4 — СПЛАНИРУЙ через TodoWrite

- Палитра (с hex): primary, secondary, accent, bg, surface, text
- Шрифты (Fontshare/Google Fonts — НЕ Inter/Roboto/Arial!): один основной для headings, один для body
- Список слайдов: для каждого — тип (Hero/Stat/Quote/Grid/Comparison/Timeline/CTA), 1 строка контента
- Animations: какие \`@keyframes\` и \`.reveal\` будут на каких слайдах

## ШАГ 5 — СОЗДАЙ HTML

Файл: \`presentation/index.html\` (создай папку \`presentation/\` в рабочей директории)

ВАЖНЫЕ ПРАВИЛА из frontend-slides skill:
- Single self-contained HTML, ВСЁ inline (CSS + JS в \`<style>\` и \`<script>\`)
- ВСТАВЬ полное содержимое \`viewport-base.css\` в \`<style>\`
- Каждый слайд: \`<section class="slide">…</section>\` или \`<div class="slide">\`
- Каждый \`.slide\` имеет: \`height: 100vh; height: 100dvh; overflow: hidden;\`
- Все размеры через \`clamp(min, preferred, max)\` — НИКАКИХ фиксированных px
- Шрифты — Fontshare или Google Fonts через \`<link>\` или \`@import\`
- Контент в плотности из density-таблицы (см. SKILL.md): title slide = 1 heading + 1 subtitle, content slide = max 4–6 bullets, и т.д.
- Используй \`.reveal\` элементы с \`animation-delay\` для staggered appearance
- НИКОГДА не используй generic-purple-on-white, НИКОГДА Inter/Roboto/Arial

## ШАГ 6 — ОТРЕНДЕРИ И ПРОВЕРЬ

Запусти helper:
\`\`\`bash
bash ${HELPER_DIR}/render-deck.sh presentation/index.html .
\`\`\`

Это создаст:
- \`slides/slide-001.png\` … \`slides/slide-NNN.png\` (превью каждого слайда)
- \`presentation.pdf\`
- \`presentation.pptx\` (PNG-слайды как фон)

## ШАГ 7 — VISUAL QA (МИНИМУМ 1 ИТЕРАЦИЯ)

Прочитай ВСЕ slides/slide-*.png через Read. Применяй принципы из canvas-design и frontend-slides:
- Текст не обрезан, не вылезает за viewport
- Контраст AA+ (минимум 4.5:1)
- Шрифты загрузились (нет fallback на system)
- Анимации настроились (нет невидимого контента)
- Уникальные layouts (если 5 слайдов выглядят одинаково — переделай)

Если что-то плохо — исправь HTML, снова запусти render-deck.sh, снова проверь.

# DEALBREAKER'Ы

❌ python-pptx для генерации (только helper-скрипт собирает PPTX из PNG)
❌ Inter, Roboto, Arial, system-ui (используй Fontshare/Google Fonts)
❌ Generic фиолетовый градиент на белом
❌ Lorem ipsum, [Insert text]
❌ Дефис-линии под заголовками
❌ Одинаковые layouts подряд
❌ Текст за пределами viewport (всегда clamp() и max-height)

# ВЫХОДНЫЕ ФАЙЛЫ

В корне рабочей директории должны лежать:
- \`presentation/index.html\` — оригинал HTML
- \`presentation.pptx\` — PowerPoint версия
- \`presentation.pdf\` — PDF версия
- \`slides/slide-NNN.png\` — превью

Качество должно быть на уровне «можно показать инвесторам Y Combinator без стыда».`;

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") || "";

  let companyName = "";
  let niche = "";
  let dataObj: Record<string, unknown> = {};
  let style = "premium-dark";
  let customDesignNotes = "";
  let slides = 12;
  let model = "claude-sonnet-4-5";
  const referenceFiles: ContextFile[] = [];

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    companyName = String(fd.get("companyName") || "");
    niche = String(fd.get("niche") || "");
    style = String(fd.get("style") || "premium-dark");
    customDesignNotes = String(fd.get("customDesignNotes") || "");
    slides = Math.min(20, Math.max(6, Number(fd.get("slides") || 12)));
    model = String(fd.get("model") || "claude-sonnet-4-5");

    const dataRaw = String(fd.get("data") || "{}");
    try {
      dataObj = JSON.parse(dataRaw);
    } catch {
      dataObj = { raw: dataRaw };
    }

    const refs = fd.getAll("references");
    let idx = 1;
    for (const r of refs) {
      if (r instanceof File && r.size > 0) {
        const ext = r.name.split(".").pop()?.toLowerCase() || "jpg";
        if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        referenceFiles.push({
          name: `references/ref-${idx}.${ext === "jpeg" ? "jpg" : ext}`,
          content: buf,
        });
        idx++;
      }
    }
  } else {
    const body = (await req.json()) as {
      companyName: string;
      niche?: string;
      data: Record<string, unknown>;
      style?: string;
      customDesignNotes?: string;
      slides?: number;
      model?: string;
    };
    companyName = body.companyName;
    niche = body.niche || "";
    dataObj = body.data || {};
    style = body.style || "premium-dark";
    customDesignNotes = body.customDesignNotes || "";
    slides = Math.min(20, Math.max(6, body.slides || 12));
    model = body.model || "claude-sonnet-4-5";
  }

  if (!companyName) {
    return NextResponse.json({ ok: false, error: "companyName обязателен" }, { status: 400 });
  }

  const styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS["premium-dark"];

  const referencesNote = referenceFiles.length > 0
    ? `\n\n# ВИЗУАЛЬНЫЕ РЕФЕРЕНСЫ\nВ папке \`references/\` лежит ${referenceFiles.length} изображение(й). ОБЯЗАТЕЛЬНО прочитай каждое через Read и копируй стиль композиции, типографики, цветовых акцентов в HTML.`
    : "";

  const customNotesBlock = customDesignNotes
    ? `\n\n# ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПОЛЬЗОВАТЕЛЯ\n${customDesignNotes}`
    : "";

  const prompt = `Создай pitch-презентацию для компании "${companyName}"${niche ? ` (ниша: ${niche})` : ""}.

# СНАЧАЛА — ОБЯЗАТЕЛЬНО

Прочитай frontend-slides skill ЦЕЛИКОМ (SKILL.md, html-template.md, viewport-base.css, animation-patterns.md, STYLE_PRESETS.md), потом остальные дизайн-скиллы (canvas-design, brand-guidelines, theme-factory).

Подтверди прочтение строкой "Прочитал N скиллов: [список]".

# Источник данных
В рабочей директории лежит \`data.json\`. Прочитай через Read.${referencesNote}

# Стиль
${styleDesc}${customNotesBlock}

# Объём
${slides} слайдов.

# Структура (адаптируй под данные)
1. Cover — название, оффер, дата
2. Проблема рынка
3. Решение / уникальное предложение
4. Целевая аудитория
5. Конкурентный ландшафт
6. Метрики / трактив
7. Команда
8. Roadmap
9. CTA / контакты

(Меньше данных — сократи. Больше — добавь продукт/кейсы/отзывы.)

# Финал
1. Создай \`presentation/index.html\` (single self-contained HTML с N \`.slide\` блоками)
2. Запусти: \`bash ${HELPER_DIR}/render-deck.sh presentation/index.html .\`
3. Прочитай все \`slides/slide-*.png\` для visual QA
4. Если есть проблемы — исправь HTML и перезапусти render-deck.sh

Начинай с чтения скиллов!`;

  const contextFiles: ContextFile[] = [
    { name: "data.json", content: JSON.stringify(dataObj, null, 2) },
    ...referenceFiles,
  ];

  const jobId = startAgentJob({
    prompt,
    systemPrompt: DESIGN_SYSTEM_PROMPT,
    contextFiles,
    model,
    maxTurns: 120,
  });

  return NextResponse.json({ ok: true, jobId });
}
