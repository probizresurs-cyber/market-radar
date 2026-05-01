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

const DESIGN_SYSTEM_PROMPT = `Ты — frontend-дизайнер презентаций уровня Linear / Stripe / Apple keynote. Создаёшь HTML-презентации с distinctive design, никакого "AI slop".

# КАК ТЫ РАБОТАЕШЬ

ТОЛЬКО HTML. Один self-contained файл с N блоками \`.slide\`. Helper-скрипт автоматически собирает PDF и PPTX. Никакого python-pptx для верстки.

# ВОРКФЛОУ — РОВНО 5 ШАГОВ

## ШАГ 1: Прочитай 3 ключевых файла (не больше!)

\`\`\`
Read ~/.claude/skills/frontend-slides/SKILL.md
Read ~/.claude/skills/frontend-slides/html-template.md
Read ~/.claude/skills/frontend-slides/viewport-base.css
\`\`\`

frontend-slides — твой ГЛАВНЫЙ инструмент. Не отвлекайся на другие скиллы — они только размывают фокус.

После чтения скажи: \`Прочитал frontend-slides skill\`.

## ШАГ 2: Прочитай данные

\`\`\`
Read data.json
Read references/LOGO.png  (если есть — это официальный логотип компании)
Read references/ref-*.png  (если есть — визуальные референсы)
\`\`\`

Если есть LOGO.png — он должен использоваться на cover-слайде и CTA-слайде. Других логотипов не выдумывай.

## ШАГ 3: TodoWrite со структурой

Запиши план:
- Палитра (5 hex-кодов: primary, secondary, accent, bg, text)
- Один heading-шрифт + один body-шрифт (НЕ Inter/Roboto/Arial — бери из Fontshare: Cabinet Grotesk, Boldonse, Fraunces, Migra, Geist; или Google Fonts: Space Grotesk, Playfair Display)
- Список из РОВНО {SLIDES} слайдов с типом каждого (Hero/Stat/Quote/Grid/Comparison/Timeline/CTA)

## ШАГ 4: Создай HTML

Файл: \`presentation/index.html\`. Single self-contained — всё inline (CSS + JS).

ОБЯЗАТЕЛЬНЫЕ требования frontend-slides:
- Полностью вставь \`viewport-base.css\` в \`<style>\`
- Каждый слайд: \`<section class="slide">\` с \`height: 100vh; height: 100dvh; overflow: hidden;\`
- Все размеры через \`clamp()\` — никаких фиксированных px
- Шрифты подключи через \`<link rel="stylesheet" href="https://api.fontshare.com/v2/...">\` или Google Fonts
- Density limits: title slide = 1 заголовок + 1 подзаголовок, content slide = max 4–6 bullets

## ШАГ 5: Запусти helper и проверь

\`\`\`bash
bash ${HELPER_DIR}/render-deck.sh presentation/index.html .
\`\`\`

Создаст: \`slides/slide-001.png ... slide-NNN.png\`, \`presentation.pdf\`, \`presentation.pptx\`.

Прочитай ВСЕ \`slides/slide-*.png\` через Read. Проверь:
1. Текст не обрезан и виден полностью (анимации не должны прятать контент — helper их отключает, но если что-то пропало — это ошибка вёрстки)
2. Шрифты загрузились (если видишь дефолтный sans-serif — Fontshare/Google Fonts не подгрузились, исправь URL)
3. Контраст AA+
4. Слайдов РОВНО {SLIDES} штук — не больше, не меньше

Если есть проблемы — исправь HTML, перезапусти render-deck.sh, проверь снова.

# DEALBREAKER'Ы

❌ python-pptx для верстки слайдов
❌ Inter, Roboto, Arial, system-ui — БАН шрифты
❌ Generic фиолетовый градиент на белом — БАН цвет
❌ Lorem ipsum, [Insert text], placeholder-текст
❌ Больше или меньше слайдов чем заказано
❌ Декоративные дефис-линии под заголовками
❌ Одинаковые layouts подряд

# ВЫХОДНЫЕ ФАЙЛЫ

В корне рабочей директории:
- \`presentation/index.html\`
- \`presentation.pdf\`
- \`presentation.pptx\`
- \`slides/slide-001.png\` … \`slides/slide-NNN.png\``;

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

    // Logo gets a special filename so the agent knows what it is
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const buf = Buffer.from(await logo.arrayBuffer());
      referenceFiles.push({
        name: `references/LOGO.png`,
        content: buf,
      });
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

  const hasLogo = referenceFiles.some(f => f.name === "references/LOGO.png");
  const otherRefs = referenceFiles.filter(f => f.name !== "references/LOGO.png").length;

  const referencesNote = referenceFiles.length > 0
    ? `\n\n# РЕФЕРЕНСЫ\n${hasLogo ? "В \`references/LOGO.png\` лежит ОФИЦИАЛЬНЫЙ ЛОГОТИП компании — используй его на cover и CTA слайдах, других логотипов не выдумывай.\n" : ""}${otherRefs > 0 ? `В \`references/ref-*.png\` — ${otherRefs} визуальных референса. Прочитай каждый через Read, копируй стиль композиции/типографики/цвета.` : ""}`
    : "";

  const customNotesBlock = customDesignNotes
    ? `\n\n# ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПОЛЬЗОВАТЕЛЯ\n${customDesignNotes}`
    : "";

  const systemPromptResolved = DESIGN_SYSTEM_PROMPT
    .split("{SLIDES}").join(String(slides));

  const prompt = `Создай pitch-презентацию для компании "${companyName}"${niche ? ` (ниша: ${niche})` : ""}.

# КОЛИЧЕСТВО СЛАЙДОВ
СТРОГО ${slides} слайдов. Не больше, не меньше. Если контента мало — растяни. Если много — сократи. Финальный HTML должен содержать ровно ${slides} блоков \`<section class="slide">\`.

# Источник данных
В рабочей директории лежит \`data.json\`. Прочитай через Read.${referencesNote}

# Стиль
${styleDesc}${customNotesBlock}

# Структура (адаптируй под ${slides} слайдов)
Cover → Проблема → Решение → ЦА → Конкуренты → Метрики → Команда → Roadmap → CTA

# Воркфлоу — следуй системному промпту
1. Прочитай 3 файла frontend-slides skill (SKILL.md, html-template.md, viewport-base.css)
2. Прочитай data.json и references/
3. TodoWrite план
4. Создай \`presentation/index.html\` с ровно ${slides} \`.slide\` блоками
5. Запусти \`bash ${HELPER_DIR}/render-deck.sh presentation/index.html .\`
6. Прочитай все \`slides/slide-*.png\` для visual QA
7. Если проблемы — исправь HTML и перезапусти render-deck.sh

Начинай с Read frontend-slides/SKILL.md.`;

  const contextFiles: ContextFile[] = [
    { name: "data.json", content: JSON.stringify(dataObj, null, 2) },
    ...referenceFiles,
  ];

  const jobId = startAgentJob({
    prompt,
    systemPrompt: systemPromptResolved,
    contextFiles,
    model,
    maxTurns: 120,
  });

  return NextResponse.json({ ok: true, jobId });
}
