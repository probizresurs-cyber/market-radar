/**
 * POST /api/generate-promo-images
 *
 * Генерирует 2-3 фоновые картинки для промо-рилса через существующий
 * Gemini-пайплайн (generate-image). Главная задача — превратить
 * base64-data-URL'ы (которые отдаёт Gemini) в обычные публичные URL'ы
 * в /public/promo-images/, чтобы:
 *   1) не таскать многомегабайтные base64 в props.json при рендере
 *   2) Remotion-Chrome мог их прочитать через resolveMediaUrl как file://
 *
 * Промпты строятся по короткому описанию темы рилса (brandName, niche,
 * mainProblem). Можно либо дать всё руками, либо запустить с дефолтным
 * MarketRadar-промптом.
 *
 * Body:
 *   brandName     — название бренда (попадает в промпт hook'а)
 *   niche?        — ниша/индустрия (для контекста картинок)
 *   accentColor?  — hex, влияет на palette в промпте
 *   includeBroll? — true → ещё +3 b-roll картинки (по дольше, по дороже)
 *
 * Returns:
 *   {
 *     ok: true,
 *     data: {
 *       hookBgImageUrl: "/promo-images/{jobId}-hook.png",
 *       ctaBgImageUrl:  "/promo-images/{jobId}-cta.png",
 *       brollImageUrls: [...] | undefined,
 *       jobId,
 *       generatedInMs
 *     }
 *   }
 *
 * Тяжёлый роут — каждая картинка 5-15 сек, 2-5 штук = 30-60 сек тотал.
 * maxDuration выставлен в 120.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateGeminiImage } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMO_IMAGES_DIR = "promo-images"; // относительно /public

interface ImageSpec {
  /** Ключ под которым картинка вернётся в ответе */
  key: "hook" | "cta" | `broll${number}`;
  prompt: string;
}

function buildPrompts(opts: {
  brandName: string;
  niche: string | null;
  accentColor: string;
  includeBroll: boolean;
}): ImageSpec[] {
  const { brandName, niche, accentColor, includeBroll } = opts;
  const nicheLine = niche ? `Industry context: ${niche}.` : "";
  const palette = `Color palette built around ${accentColor} as accent against deep navy / charcoal black. Cinematic, premium feel.`;
  const baseStyle =
    "Vertical 9:16 composition. Dark moody background. No text or logos in the image. Editorial style. Sharp focus.";

  const specs: ImageSpec[] = [
    {
      key: "hook",
      prompt: `${baseStyle} ${palette} ${nicheLine} Abstract concept of "overwhelmed marketer drowning in tabs and notifications": dim office lights, multiple glowing screens with chaotic data, hands on keyboard partially visible from below, sense of time pressure and exhaustion. Photorealistic with subtle bokeh. No people's faces visible.`,
    },
    {
      key: "cta",
      prompt: `${baseStyle} ${palette} ${nicheLine} Concept of "AI-powered marketing platform that saves time": serene dashboard glowing on a single sleek modern device (smartphone or tablet, screen content abstract), surrounded by softly floating data viz fragments — pie charts, bars, growth arrows — like a constellation. Triumphant, calm, premium fintech aesthetic. Brand atmosphere for ${brandName}.`,
    },
  ];

  if (includeBroll) {
    specs.push(
      {
        key: "broll1",
        prompt: `${baseStyle} ${palette} Single dramatic close-up shot of a glowing growth-arrow / bar chart spike, abstract data visualization, electric blue and cyan tones, fast motion blur sense.`,
      },
      {
        key: "broll2",
        prompt: `${baseStyle} ${palette} Single shot: floating UI cards with charts and KPI numbers, holographic style, levitating against dark background, premium SaaS aesthetic.`,
      },
      {
        key: "broll3",
        prompt: `${baseStyle} ${palette} Single shot: stylized abstract icon of a target / bullseye made from light trails, futuristic, glowing with ${accentColor} core.`,
      },
    );
  }

  return specs;
}

/**
 * Decode data:image/png;base64,... → Buffer, кидает Error при невалидном
 * формате.
 */
function decodeDataUrl(dataUrl: string): { mimeType: string; buf: Buffer; ext: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("invalid data URL");
  const mimeType = match[1];
  const buf = Buffer.from(match[2], "base64");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return { mimeType, buf, ext };
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

    const specs = buildPrompts({ brandName, niche, accentColor, includeBroll });

    const jobId = `promo-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const publicDir = path.join(process.cwd(), "public", PROMO_IMAGES_DIR);
    await mkdir(publicDir, { recursive: true });

    const results: Record<string, string> = {};
    const failures: Array<{ key: string; error: string }> = [];

    // Генерим последовательно, а не параллельно — Gemini-прокси через
    // Cloudflare периодически ругается на параллельные хвосты,
    // последовательно гарантированно проходит.
    for (const spec of specs) {
      const r = await generateGeminiImage({ prompt: spec.prompt, referenceImages: [] });
      if (!r.ok) {
        failures.push({ key: spec.key, error: r.error ?? "unknown" });
        continue;
      }
      const { buf, ext } = decodeDataUrl(r.imageUrl);
      const fileName = `${jobId}-${spec.key}.${ext}`;
      await writeFile(path.join(publicDir, fileName), buf);
      results[spec.key] = `/${PROMO_IMAGES_DIR}/${fileName}`;
    }

    // Логируем расход — по количеству успешных картинок
    const successCount = Object.keys(results).length;
    if (successCount > 0) {
      await access.log({
        endpoint: "generate-promo-images",
        model: "gemini-2.5-flash-image",
        success: true,
        durationMs: Date.now() - t0,
      });
    }

    const data = {
      jobId,
      hookBgImageUrl: results.hook ?? null,
      ctaBgImageUrl: results.cta ?? null,
      brollImageUrls: [results.broll1, results.broll2, results.broll3].filter(Boolean) as string[],
      generatedInMs: Date.now() - t0,
      failures: failures.length ? failures : undefined,
    };

    // Если ничего не сгенерилось — это ошибка
    if (successCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Gemini не сгенерил ни одной картинки", failures, data },
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
