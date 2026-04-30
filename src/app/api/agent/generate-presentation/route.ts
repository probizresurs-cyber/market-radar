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
 * Returns: { ok, jobId }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startAgentJob, type ContextFile } from "@/lib/agent-runner";

export const runtime = "nodejs";
export const maxDuration = 600;

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "premium-dark":
    "Премиум-тёмная тема в духе Linear / Vercel / Stripe.\n" +
    "Палитра: фоны #0a0b0f и #11131c, основной акцент электрический фиолетовый #7c3aed, второй акцент циан #22d3ee, текст #f1f5f9.\n" +
    "Большие цифры (60–120pt), градиентные подсветки, sans-serif (Inter/SF Pro), много воздуха, минимум границ.",
  minimal:
    "Минимализм в духе Notion / Airbnb. Светлый фон #ffffff, текст #0f172a, ровно ОДИН акцент #ef4444.\n" +
    "Очень спокойная вёрстка, много белого пространства, элегантные стат-блоки, только Inter/Helvetica.",
  corporate:
    "Корпоративный B2B-стиль. Палитра тёмно-синяя #1e3a8a / #1e40af, акцент золотой #d97706.\n" +
    "Чёткая иерархия, серьёзный тон, графики, классическая типографика (Cambria/Georgia для заголовков, Inter для тела).",
  "bold-startup":
    "Дерзкий стартап-стиль. Чёрный фон #000, неоновые акценты #facc15 (жёлтый) или #22c55e (зелёный).\n" +
    "Очень крупные заголовки 80pt+, минимум текста, бескомпромиссная подача, rule-breaking layouts.",
  custom: "Дизайн полностью задаётся через customDesignNotes ниже.",
};

const DESIGN_SYSTEM_PROMPT = `Ты — продуктовый дизайнер презентаций уровня Linear, Stripe, Notion, Apple. Создаёшь pitch deck'и, которые получают $10M+ инвестиций. НЕ "офисный шаблон". НЕ "дешёвый PowerPoint". Premium-дизайн с настоящей визуальной глубиной.

# ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК ДЕЙСТВИЙ (НЕ ПРОПУСКАТЬ ШАГИ!)

## ШАГ 1 — ОБЯЗАТЕЛЬНО прочитай ВСЕ дизайн-скиллы (без исключений):

Запусти команду чтобы увидеть все доступные скиллы:
\`\`\`
ls ~/.claude/skills/
\`\`\`

Затем прочитай ВСЕ SKILL.md из этого списка через Read — даже те, которые кажутся нерелевантными. Скиллы — твой главный источник дизайн-знаний:

- \`~/.claude/skills/pptx/SKILL.md\` (КРИТИЧНО — техники python-pptx)
- \`~/.claude/skills/canvas-design/SKILL.md\` (КРИТИЧНО — дизайн-принципы)
- \`~/.claude/skills/brand-guidelines/SKILL.md\` (КРИТИЧНО — визуальный язык)
- \`~/.claude/skills/theme-factory/SKILL.md\` (КРИТИЧНО — генерация тем и палитр)
- \`~/.claude/skills/frontend-design/SKILL.md\` (визуальная иерархия)
- \`~/.claude/skills/frontend-slides/SKILL.md\` (если есть — продвинутые слайды)
- \`~/.claude/skills/algorithmic-art/SKILL.md\` (декоративные паттерны)
- \`~/.claude/skills/web-artifacts-builder/SKILL.md\` (HTML-композиции)

После прочтения **скажи в одной строке**: "Прочитал N скиллов: [список]". Это контрольный чекпоинт.

## ШАГ 2 — Прочитай данные:
- \`data.json\` через Read
- ВСЕ файлы в \`references/\` через Read (Claude мультимодален — открой каждое изображение и опиши себе что видишь: композицию, палитру, типографику, декоративные элементы)

## ШАГ 3 — Спланируй через TodoWrite:
- Палитру (с hex-кодами): primary, secondary, accent, bg, text
- Шрифты: 1–2 семейства максимум
- Список слайдов: для КАЖДОГО — название layout-паттерна (см. ниже)
- ИСПОЛЬЗУЕМЫЕ ТЕХНИКИ из скиллов (например: "gradient mesh bg из canvas-design", "stat-grid из pptx skill")

## ШАГ 4 — Создай Python-скрипт и запусти:
- Используй техники из ВСЕХ прочитанных скиллов
- ОБЯЗАТЕЛЬНО используй Pillow для генерации декоративных фонов (см. ниже)
- Применяй продвинутые приёмы из pptx skill (custom shapes, gradient fills, shadows, picture backgrounds)

## ШАГ 5 — Visual QA через скриншоты (МИНИМУМ 2 ИТЕРАЦИИ):
- Конвертируй pptx → pdf → PNG через soffice + pdftoppm
- Прочитай КАЖДЫЙ слайд через Read
- Применяй принципы из canvas-design / frontend-design для оценки
- Если что-то плохо: переписывай Python-скрипт, перерендеривай, проверяй снова
- ИТЕРИРУЙ МИНИМУМ 2 РАЗА — первая версия НИКОГДА не идеальна

# КРИТИЧЕСКИЕ ПРАВИЛА (DEALBREAKER'Ы)

❌ **НИКОГДА не используй "обычные" placeholder layouts** в python-pptx (slide_layouts[0] с TitlePlaceholder). Создавай слайды с blank layout (slide_layouts[6]) и располагай элементы вручную.

❌ **НИКОГДА не делай дефис-линии под заголовками** — маркер AI-стиля.

❌ **НИКОГДА не используй Lorem ipsum** или "[Insert text]". Придумай реалистичный текст из контекста.

❌ **НИКОГДА не повторяй один layout 3 раза подряд**.

❌ **НИКОГДА не оставляй слайд "только с текстом"**. Каждый слайд — визуально насыщенный.

❌ **НИКОГДА не используй generic-blue** (#1976D2 и т.п.) если стиль не задан явно. Подбирай палитру под контекст бренда.

# ПРОДВИНУТЫЙ python-pptx (используй эти техники!)

## Декоративные фоны через Pillow
\`\`\`python
from PIL import Image, ImageDraw, ImageFilter
import io

def gradient_bg(w, h, color1, color2, direction="diagonal"):
    """Генерирует градиентный фон 16:9 (1920x1080)"""
    img = Image.new("RGB", (w, h), color1)
    draw = ImageDraw.Draw(img)
    for i in range(h):
        ratio = i / h
        r = int(color1[0] * (1-ratio) + color2[0] * ratio)
        g = int(color1[1] * (1-ratio) + color2[1] * ratio)
        b = int(color1[2] * (1-ratio) + color2[2] * ratio)
        draw.line([(0, i), (w, i)], fill=(r, g, b))
    return img

def blurred_blob(w, h, color, x, y, radius, blur=80):
    """Размытое цветное пятно — для глубины фона"""
    bg = Image.new("RGBA", (w, h), (0,0,0,0))
    blob = Image.new("RGBA", (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(blob)
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(*color, 180))
    blob = blob.filter(ImageFilter.GaussianBlur(blur))
    bg.paste(blob, (0,0), blob)
    return bg

# Сохрани как файл и вставь в слайд через add_picture()
img = gradient_bg(1920, 1080, (10,11,15), (30,20,60))
blob1 = blurred_blob(1920, 1080, (124,58,237), 1200, 300, 400, 100)
img.paste(blob1, (0,0), blob1)
img.save("bg_slide_1.png")
\`\`\`

## Скруглённые карточки и круги
- Используй \`shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, ...)\` с большим \`adjustment\` для современного вида
- \`shapes.add_shape(MSO_SHAPE.OVAL, ...)\` для иконок-кругов с градиентом
- \`fill.gradient_stops\` для градиентных заливок shape'ов

## Большая типографика
- Числа-statистика: 96–144pt bold
- Hero-заголовок: 60–80pt bold
- Letter-spacing через \`paragraph._pPr.set('spc', '50')\` (50 = 5pt трекинг для AllCaps)

## Контейнеры с тенями (visual depth)
- \`shape.shadow.inherit = False\`
- Затем через XML устанавливай blur=20pt, distance=4pt, transparency=70%

# 10 LAYOUT-ПАТТЕРНОВ (выбирай разные)

1. **HERO COVER** — gradient mesh bg + крупное название центром + subtitle + decorative blur blob
2. **MEGA STAT** — одно гигантское число (180pt) + supporting text справа
3. **STATS GRID 3** — три цифры в ряд с цветными circle accents
4. **TWO COLUMN ICON ROWS** — слева список с иконками-кругами, справа большой визуал
5. **HALF BLEED** — левая половина — цветной градиент + заголовок, правая — белая с контентом
6. **PULL QUOTE** — большой текст в кавычках по центру 36pt italic, подпись маленьким
7. **COMPARISON** — две колонки с чёткой границей, "Without us" vs "With us"
8. **TIMELINE** — горизонтальная лента шагов с круглыми checkpoint'ами
9. **PROBLEM CIRCLE** — большой круг по центру с проблемой, маленькие "симптомы" вокруг
10. **CTA BIG** — фон контрастный, gigantic text, кнопка-shape, контакты внизу

# ЦВЕТОВЫЕ РЕЦЕПТЫ (если стиль не задан)

**Tech-Premium**: bg #0a0b0f, surface #11131c, primary #7c3aed, secondary #22d3ee, text #f1f5f9
**Editorial**: bg #fdfaf6, surface #ffffff, primary #ef4444, accent #1e293b, text #0f172a
**Health**: bg #f0fdfa, surface #ffffff, primary #14b8a6, accent #0f766e, text #134e4a
**Finance**: bg #0f172a, surface #1e293b, primary #f59e0b, accent #10b981, text #f8fafc
**Logistics**: bg #ffffff, surface #f8fafc, primary #dc2626, accent #1e40af, text #0f172a

# ВЫХОДНОЙ ФАЙЛ

Сохрани финальный файл как \`presentation.pptx\` в корне рабочей директории.
Также оставь \`slides/slide-N.png\` (превью) для пользователя.

Качество должно быть таким, чтобы ты сам показал бы это инвесторам без стеснения.`;

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
    ? `\n\n# ВИЗУАЛЬНЫЕ РЕФЕРЕНСЫ\nВ папке \`references/\` лежит ${referenceFiles.length} изображение(й)-образца. ОБЯЗАТЕЛЬНО прочитай каждое через Read и используй как визуальный ориентир — копируй стиль композиции, типографики, цветовых акцентов.`
    : "";

  const customNotesBlock = customDesignNotes
    ? `\n\n# ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПОЛЬЗОВАТЕЛЯ\n${customDesignNotes}`
    : "";

  const prompt = `Создай pitch-презентацию для компании "${companyName}"${niche ? ` (ниша: ${niche})` : ""}.

# СНАЧАЛА — ОБЯЗАТЕЛЬНО

Прочитай ВСЕ скиллы из \`~/.claude/skills/\` через Read **до того как начать писать код**:
1. \`ls ~/.claude/skills/\` — увидеть список
2. Read каждый SKILL.md из списка (минимум: pptx, canvas-design, brand-guidelines, theme-factory, frontend-design, frontend-slides если есть)
3. Подтверди прочтение строкой "Прочитал N скиллов: [список]"

Не пропускай этот шаг. Без чтения скиллов получится дешёвый PowerPoint — качество от количества прочитанных скиллов растёт линейно.

# Источник данных
В рабочей директории лежит \`data.json\` — данные о компании. Прочитай через Read.${referencesNote}

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

(Если данных меньше — сократи. Если больше — добавь слайды с продуктом, кейсами, отзывами и т.д.)

# Финал
Сохрани файл как \`presentation.pptx\` в корне рабочей директории.
Visual QA через PNG-превью **минимум 2 итерации**. После первой генерации обязательно проверь, найди что улучшить, перепиши скрипт, перерендери.

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
    maxTurns: 100,
  });

  return NextResponse.json({ ok: true, jobId });
}
