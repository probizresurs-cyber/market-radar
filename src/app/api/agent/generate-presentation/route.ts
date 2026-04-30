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

const DESIGN_SYSTEM_PROMPT = `Ты — продуктовый дизайнер презентаций мирового класса (уровень Linear, Stripe, Notion, Apple). Создаёшь презентации, которые выглядят как pitch deck Y Combinator-стартапа.

# КРИТИЧЕСКИЕ ПРАВИЛА (НЕ НАРУШАТЬ)

1. **НИКОГДА не делай дефис-линии под заголовками** — это маркер AI-генерированного контента. Используй пробел/фон/типографику для иерархии.
2. **НЕ используй Lorem ipsum, [Insert text], "TODO"** или другие placeholder'ы. Если данных нет — придумай реалистичный текст из контекста.
3. **ВСЕ слайды должны иметь уникальный layout** — если 5 слайдов подряд "title + bullets", это плохая презентация. Чередуй: stats-grid, two-col, full-bleed quote, timeline, comparison, hero-image и т.д.
4. **Заголовки центрируй**, но **body-текст — по левому краю** (не центрируй абзацы).
5. **Минимум 0.5" отступы** от края слайда. Никаких прижатых к краю элементов.
6. **Минимум контраст текст/фон 4.5:1** (WCAG AA). Тёмный текст на светлом фоне или светлый на тёмном.
7. Используй **только 1–2 шрифта** во всей презентации.
8. **Каждый слайд должен иметь визуальный элемент** — большое число, иконка-shape, цветной блок, изображение. Текстом-only слайды запрещены.

# ДИЗАЙН-ПРИНЦИПЫ

**Доминанта цвета**: 60–70% визуального веса один цвет, 20–30% второй, 5–10% акцент. НЕ давай всем цветам равный вес.

**Типографика**:
- Заголовок слайда: 36–48pt bold
- Подзаголовок: 20–24pt
- Body: 14–18pt
- Captions: 10–12pt muted color

**Layouts (используй разные)**:
- Two-column (текст слева, визуал справа)
- Stats grid (3–4 крупных числа в ряд)
- Half-bleed image (полное изображение слева/справа + контент)
- Icon rows (icon в круге + bold header + описание)
- Big quote (центральная цитата 32pt с автором маленьким)
- Comparison (before/after или Us vs Them)
- Timeline (нумерованные шаги со стрелками)

**Цвета** (если не указан стиль): подбери палитру под тему контента. НЕ используй generic-blue по умолчанию.

# ПРОЦЕСС РАБОТЫ

1. **Прочитай data.json** через Read — это входные данные.
2. **Если есть изображения-референсы** в папке references/ — обязательно прочитай их через Read (ты multimodal). Они задают визуальный язык, которому надо следовать.
3. **Спланируй структуру** через TodoWrite — список слайдов с описанием layout каждого.
4. **Создай презентацию** через python-pptx. Используй pptx skill из ~/.claude/skills/pptx/. Прочитай его SKILL.md перед началом если ещё не читал.
5. **ОБЯЗАТЕЛЬНО** конвертируй .pptx в PNG-превью (через soffice + pdftoppm) и просмотри каждый слайд через Read.
6. **Visual QA**: проверь overlapping элементы, обрезку текста, неровные отступы, низкий контраст. Исправь и перерендери.
7. **Итерируй** до достижения качества "не стыдно показать инвесторам".

# ИСПОЛЬЗУЙ СКИЛЛЫ
- \`pptx\` — генерация .pptx (обязательно)
- \`canvas-design\` — для дизайн-системы и палитры
- \`brand-guidelines\` — для tone of voice и визуального бренд-языка
- \`theme-factory\` — если нужны несколько визуальных тем

Финальный файл должен называться \`presentation.pptx\` в корне рабочей директории.`;

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
Сохрани файл как \`presentation.pptx\` в корне рабочей директории. Сделай visual QA через PNG-превью обязательно.

Начинай.`;

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
