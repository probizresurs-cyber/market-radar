/**
 * POST /api/generate-promo-images
 *
 * Генерирует 2-5 фоновых картинок для промо-рилса через OpenAI `gpt-image-2`
 * (ChatGPT Images 2.0). Главная задача — превратить base64-data-URL'ы,
 * которые отдаёт OpenAI, в обычные публичные URL'ы в /public/promo-images/,
 * чтобы:
 *   1) не таскать многомегабайтные base64 в props.json при рендере
 *   2) Remotion-Chrome мог прочитать их через resolveMediaUrl как file://
 *
 * Почему OpenAI, а не Gemini:
 *   - gpt-image-2 даёт значительно лучшее качество композиции для премиум-
 *     стилистики (cinematic, fintech, editorial)
 *   - не выгорает free-tier как Gemini
 *   - тот же OPENAI_API_KEY + OPENAI_BASE_URL (Cloudflare-прокси для VPS)
 *     уже работают в проекте — никакой новой инфры
 *
 * Тайминги (quality=medium, format=portrait 1024×1536):
 *   - 1 картинка: 40-60 сек
 *   - 2 параллельно (hook+cta): ~60 сек
 *   - 5 параллельно (+3 b-roll): ~70-90 сек (зависит от загрузки OpenAI)
 *
 * Все генерации параллельные — Promise.all. Если одна упала, остальные
 * успешные всё равно возвращаются (composition умеет работать с частичным
 * набором ассетов).
 *
 * Body:
 *   brandName     — название бренда (попадает в промпт hook'а)
 *   niche?        — ниша/индустрия (для контекста картинок)
 *   accentColor?  — hex, влияет на palette в промпте
 *   includeBroll? — true → ещё +3 b-roll картинки (по дольше)
 *   quality?      — "low" | "medium" | "high"; default "medium"
 *
 * Returns:
 *   {
 *     ok, data: {
 *       jobId,
 *       hookBgImageUrl, ctaBgImageUrl,
 *       brollImageUrls: [],
 *       generatedInMs,
 *       failures?: [{key, error}]
 *     }
 *   }
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateOpenAIImage } from "@/lib/openai-image";

export const runtime = "nodejs";
// 180 сек — Promise.all 5 картинок quality=medium укладывается в 90с,
// но на пике загрузки OpenAI может растянуться. С запасом.
export const maxDuration = 180;

const PROMO_IMAGES_DIR = "promo-images"; // относительно /public

type ImageKey = "hook" | "cta" | "broll1" | "broll2" | "broll3";

interface ImageSpec {
  key: ImageKey;
  prompt: string;
  /** Качество per-картинка. У b-roll'а можно занизить — они мелкие декорации. */
  quality: "low" | "medium" | "high";
}

function buildPrompts(opts: {
  brandName: string;
  niche: string | null;
  accentColor: string;
  includeBroll: boolean;
  baseQuality: "low" | "medium" | "high";
}): ImageSpec[] {
  const { brandName, niche, accentColor, includeBroll, baseQuality } = opts;
  const nicheLine = niche ? `Industry context: ${niche}.` : "";
  const palette = `Color palette built around ${accentColor} as accent against deep navy / charcoal black. Cinematic, premium feel.`;
  const baseStyle =
    "Vertical 9:16 composition. Dark moody background. No text or logos in the image. Editorial style. Sharp focus.";

  const specs: ImageSpec[] = [
    {
      key: "hook",
      quality: baseQuality,
      prompt: `${baseStyle} ${palette} ${nicheLine} Abstract concept of "overwhelmed marketer drowning in tabs and notifications": dim office lights, multiple glowing screens with chaotic data, hands on keyboard partially visible from below, sense of time pressure and exhaustion. Photorealistic with subtle bokeh. No people's faces visible.`,
    },
    {
      key: "cta",
      quality: baseQuality,
      prompt: `${baseStyle} ${palette} ${nicheLine} Concept of "AI-powered marketing platform that saves time": serene dashboard glowing on a single sleek modern device (smartphone or tablet, screen content abstract), surrounded by softly floating data viz fragments — pie charts, bars, growth arrows — like a constellation. Triumphant, calm, premium fintech aesthetic. Brand atmosphere for ${brandName}.`,
    },
  ];

  if (includeBroll) {
    // У b-roll'а понижаем quality до "low" — это маленькие декорации
    // в углу, никто пиксели не считает. Скорость генерации ~2× выше.
    const brollQuality: "low" = "low";
    specs.push(
      {
        key: "broll1",
        quality: brollQuality,
        prompt: `${baseStyle} ${palette} Single dramatic close-up shot of a glowing growth-arrow / bar chart spike, abstract data visualization, electric blue and cyan tones, fast motion blur sense.`,
      },
      {
        key: "broll2",
        quality: brollQuality,
        prompt: `${baseStyle} ${palette} Single shot: floating UI cards with charts and KPI numbers, holographic style, levitating against dark background, premium SaaS aesthetic.`,
      },
      {
        key: "broll3",
        quality: brollQuality,
        prompt: `${baseStyle} ${palette} Single shot: stylized abstract icon of a target / bullseye made from light trails, futuristic, glowing with ${accentColor} core.`,
      },
    );
  }

  return specs;
}

/**
 * Decode data:image/png;base64,... → Buffer, кидает Error при невалидном
 * формате. OpenAI и Gemini оба возвращают data-URL'ы в этом формате.
 */
function decodeDataUrl(dataUrl: string): { mimeType: string; buf: Buffer; ext: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("invalid data URL");
  const mimeType = match[1];
  const buf = Buffer.from(match[2], "base64");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return { mimeType, buf, ext };
}

interface SpecResult {
  key: ImageKey;
  url: string | null;
  error: string | null;
}

/** Генерит одну картинку и пишет на диск. Не кидает наружу — возвращает
 *  result-объект, чтобы Promise.all не убил остальные параллельные задачи. */
async function generateOne(
  spec: ImageSpec,
  publicDir: string,
  jobId: string,
): Promise<SpecResult> {
  try {
    const r = await generateOpenAIImage({
      prompt: spec.prompt,
      format: "portrait", // 1024×1536, фигачит идеально под 9:16
      quality: spec.quality,
    });
    if (!r.ok) {
      return { key: spec.key, url: null, error: r.error };
    }
    const { buf, ext } = decodeDataUrl(r.imageUrl);
    const fileName = `${jobId}-${spec.key}.${ext}`;
    await writeFile(path.join(publicDir, fileName), buf);
    // Через /api/static-asset/, а не прямую /promo-images/ статику —
    // Next 16 кеширует 404 для /public-путей которые мы дёргаем
    // ДО создания файла (Remotion+Cloudflare видят 404, кешируют, дальше 404).
    return { key: spec.key, url: `/api/static-asset/${PROMO_IMAGES_DIR}/${fileName}`, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { key: spec.key, url: null, error: msg };
  }
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const brandName = String(body.brandName ?? "MarketRadar").trim();
    const niche = body.niche ? String(body.niche).trim() : null;
    const accentColor = String(body.accentColor ?? "#22d3ee").trim();
    const includeBroll = Boolean(body.includeBroll ?? false);
    const rawQuality = String(body.quality ?? "medium").trim();
    const baseQuality: "low" | "medium" | "high" =
      rawQuality === "low" || rawQuality === "high" ? rawQuality : "medium";

    const specs = buildPrompts({ brandName, niche, accentColor, includeBroll, baseQuality });

    const jobId = `promo-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const publicDir = path.join(process.cwd(), "public", PROMO_IMAGES_DIR);
    await mkdir(publicDir, { recursive: true });

    // Параллельная генерация. Если одна упала — остальные продолжатся.
    const results = await Promise.all(specs.map((s) => generateOne(s, publicDir, jobId)));

    const byKey: Partial<Record<ImageKey, string>> = {};
    const failures: Array<{ key: string; error: string }> = [];
    for (const r of results) {
      if (r.url) byKey[r.key] = r.url;
      else if (r.error) failures.push({ key: r.key, error: r.error });
    }

    const successCount = Object.keys(byKey).length;

    if (successCount > 0) {
      await access.log({
        endpoint: "generate-promo-images",
        model: "gpt-image-2",
        success: true,
        durationMs: Date.now() - t0,
      });
    }

    const data = {
      jobId,
      hookBgImageUrl: byKey.hook ?? null,
      ctaBgImageUrl: byKey.cta ?? null,
      brollImageUrls: [byKey.broll1, byKey.broll2, byKey.broll3].filter(Boolean) as string[],
      generatedInMs: Date.now() - t0,
      failures: failures.length ? failures : undefined,
    };

    // Если ничего не сгенерилось — это полная ошибка пайплайна.
    // ВАЖНО: включаем детальный текст первой ошибки в верхнее поле error —
    // оркестратор показывает именно его в UI, без этого юзер видит только
    // «OpenAI не сгенерил ни одной картинки» без причины.
    if (successCount === 0) {
      const firstError = failures[0]?.error ?? "unknown";
      return NextResponse.json(
        {
          ok: false,
          error: `OpenAI gpt-image-2 не сгенерил ни одной картинки. Первая ошибка: ${firstError.slice(0, 500)}`,
          failures,
          data,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, elapsedMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
