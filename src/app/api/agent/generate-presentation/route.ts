/**
 * POST /api/agent/generate-presentation
 * Body: {
 *   companyName: string,
 *   niche?: string,
 *   data: any,        // analysis result, brand book, etc.
 *   style?: "premium-dark" | "minimal" | "corporate" | "bold-startup",
 *   slides?: number,  // 8-14
 * }
 *
 * Returns: { ok, jobId }
 *
 * Then poll GET /api/agent/job/[id] for progress + final file.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startAgentJob } from "@/lib/agent-runner";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 min

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "premium-dark": "Премиум-тёмная тема в стиле Linear/Vercel/Stripe. Палитра: фоны #0a0b0f / #11131c, акцент электрический фиолетовый #7c3aed, второй акцент #22d3ee, текст #f1f5f9. Большие цифры, gradient-подсветки, sans-serif (Inter/SF Pro), летящая типографика, минимум границ, много воздуха.",
  "minimal": "Минимализм в стиле Notion/Airbnb. Светлый фон #ffffff, основной текст #0f172a, акцент #ef4444 (один). Очень спокойная вёрстка, много белого пространства, элегантные числовые блоки.",
  "corporate": "Корпоративный стиль для B2B-клиентов. Тёмно-синяя палитра #1e3a8a / #1e40af, акцент золотой #d97706. Чёткая иерархия, графики, серьёзный тон.",
  "bold-startup": "Bold-стиль стартапа. Чёрный фон #000, неоновые акценты #facc15 (жёлтый) или #22d55e (зелёный), очень крупные заголовки 80pt+, минимум текста, дерзкая подача.",
};

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json() as {
    companyName: string;
    niche?: string;
    data: Record<string, unknown>;
    style?: string;
    slides?: number;
  };

  if (!body.companyName) {
    return NextResponse.json({ ok: false, error: "companyName обязателен" }, { status: 400 });
  }

  const styleKey = body.style || "premium-dark";
  const styleDesc = STYLE_DESCRIPTIONS[styleKey] || STYLE_DESCRIPTIONS["premium-dark"];
  const slides = Math.min(14, Math.max(8, body.slides || 12));

  const prompt = `Ты — продуктовый дизайнер презентаций. Сейчас создаёшь pitch-презентацию для компании "${body.companyName}"${body.niche ? ` (ниша: ${body.niche})` : ""}.

# Источник данных
В рабочей директории лежит файл \`data.json\` — результат глубокого анализа компании (включая SEO, соцсети, конкурентов, ЦА, бренд). Прочитай его через Read.

# Что нужно
Сгенерируй красивую презентацию из ${slides} слайдов в формате .pptx.

## Стиль
${styleDesc}

## Структура (адаптируй под данные, но в целом)
1. Cover — название компании, оффер, дата
2. Проблема рынка/ниши
3. Решение / уникальное предложение
4. Целевая аудитория (используй данные ЦА)
5. Конкурентный ландшафт (используй данные конкурентов)
6. SEO / трафик / охваты (если есть данные)
7. Команда / экспертиза
8. Метрики / KPI
9. Roadmap / следующие шаги
10. CTA

## Требования к качеству
- ВСЕ слайды на русском
- НЕ используй placeholder-текст вроде "Lorem ipsum" или "[Insert text]"
- Каждый слайд должен иметь визуальный элемент (число, иконка-подобный shape, цветной блок)
- Используй pptx skill для создания .pptx
- После создания обязательно сделай visual QA: конвертируй в JPG через soffice + pdftoppm, посмотри слайды, исправь визуальные проблемы (overlaps, обрезка текста, etc.)
- Финальный файл сохрани в текущей директории как \`presentation.pptx\`

## ВАЖНО
- Не используй дефис-линии под заголовками (это "ИИ-стиль")
- Дай каждому слайду уникальную раскладку (не дублируй layout)
- Заголовки центрируй, body-текст — по левому краю
- Минимум 0.5" отступы от края

Начинай — сначала прочитай data.json, потом план, потом генерация.`;

  const jobId = startAgentJob({
    prompt,
    contextFiles: [
      { name: "data.json", content: JSON.stringify(body.data, null, 2) },
    ],
    model: "claude-sonnet-4-5",
    maxTurns: 80,
  });

  return NextResponse.json({ ok: true, jobId });
}
