import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sanitizeUserPrompt } from "@/lib/prompt-sanitize";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  // Stitch (Gemini 3 Pro) платный — раньше открыт для всех.
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GOOGLE_STITCH_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { company, brandBook, taData, smmData, landingType, styleConfig, userPrompt } = body;

    // ── Resolve colors/font from styleConfig ─────────────────────
    interface StyleConfig {
      source?: string;
      colors?: string[];
      font?: string;
      customPrompt?: string;
    }
    // Stitch принимает шрифт только как enum из своего фиксированного списка,
    // а у нас в брендбуке лежит человекочитаемое имя ("Montserrat", "Inter").
    // Всё, чего в списке нет, отдаём как FONT_UNSPECIFIED — Stitch подберёт
    // сам, вместо того чтобы уронить весь вызов create_design_system.
    const STITCH_FONTS = new Set([
      "BE_VIETNAM_PRO", "EPILOGUE", "INTER", "LEXEND", "MANROPE", "NEWSREADER",
      "NOTO_SERIF", "PLUS_JAKARTA_SANS", "PUBLIC_SANS", "SPACE_GROTESK",
      "SPLINE_SANS", "WORK_SANS", "DOMINE", "LIBRE_CASLON_TEXT", "EB_GARAMOND",
      "LITERATA", "SOURCE_SERIF_FOUR", "MONTSERRAT", "METROPOLIS",
      "SOURCE_SANS_THREE", "NUNITO_SANS", "ARIMO", "HANKEN_GROTESK", "RUBIK",
      "GEIST", "DM_SANS", "IBM_PLEX_SANS", "SORA",
    ]);
    const toStitchFont = (name?: string): string => {
      if (!name) return "FONT_UNSPECIFIED";
      const key = name.trim().toUpperCase().replace(/[\s-]+/g, "_");
      return STITCH_FONTS.has(key) ? key : "FONT_UNSPECIFIED";
    };

    const sc: StyleConfig = styleConfig || { source: "brandbook" };
    const resolvedColors: string[] = sc.colors?.length
      ? sc.colors
      : (brandBook?.colors ?? []);
    const resolvedFont: string | undefined = sc.font || brandBook?.fontHeader;
    const colorMode = (() => {
      if (sc.source === "preset" && (styleConfig as StyleConfig & { id?: string })?.id === "dark") return "DARK";
      const primaryColor = resolvedColors[0] || "#ffffff";
      const hex = primaryColor.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? "DARK" : "LIGHT";
      }
      return "LIGHT";
    })();

    // ── Build detailed prompt from analysis data ──────────────────
    const promptParts: string[] = [];

    // Company basics
    const companyName = company?.name || "Компания";
    promptParts.push(`Create a professional landing page for "${companyName}".`);
    if (company?.description) promptParts.push(`About: ${company.description}`);
    if (company?.url) promptParts.push(`Website: ${company.url}`);

    // Landing type
    const typeMap: Record<string, string> = {
      main:    "Main company landing page with hero, services, benefits, testimonials, CTA sections.",
      product: "Product/service showcase page with features grid, pricing, social proof, FAQ.",
      promo:   "Promotional landing page with bold CTA, urgency elements, special offer block, trust badges.",
      lead:    "Lead generation page with prominent form, pain points, solution benefits, client logos.",
    };
    promptParts.push(typeMap[landingType] || typeMap.main);

    // Style from preset/custom
    if (sc.customPrompt) promptParts.push(`Style requirements: ${sanitizeUserPrompt(sc.customPrompt, { maxLength: 600 })}`);
    if (resolvedColors.length) promptParts.push(`Use these exact colors: ${resolvedColors.join(", ")} — primary, secondary, accent.`);
    if (resolvedFont) promptParts.push(`Typography: Use "${resolvedFont}" as the main font family.`);

    // Brand identity
    if (brandBook) {
      const brandParts: string[] = [];
      if (brandBook.tagline) brandParts.push(`Tagline: "${brandBook.tagline}"`);
      if (brandBook.mission) brandParts.push(`Mission: ${brandBook.mission}`);
      if (brandBook.toneOfVoice?.length) brandParts.push(`Tone: ${brandBook.toneOfVoice.join(", ")}`);
      if (brandParts.length) promptParts.push(`Brand: ${brandParts.join(". ")}`);
    }

    // Target audience
    if (taData?.segments?.length) {
      const segs = taData.segments.slice(0, 3).map((s: { segmentName: string; demographics?: { age?: string } }) =>
        `${s.segmentName}${s.demographics?.age ? ` (${s.demographics.age})` : ""}`
      );
      promptParts.push(`Target audience: ${segs.join("; ")}`);
    }
    if (taData?.mainPains?.length) {
      promptParts.push(`Key customer pains to address: ${taData.mainPains.slice(0, 4).join("; ")}`);
    }

    // SMM
    if (smmData?.brandArchetype) promptParts.push(`Brand archetype: ${smmData.brandArchetype}`);

    // User's custom prompt — highest priority. Sanitize against
    // prompt-injection (юзер передаёт строку, не control-text для Stitch).
    if (userPrompt?.trim()) {
      const safe = sanitizeUserPrompt(userPrompt, { maxLength: 800 });
      if (safe) promptParts.push(`User's specific style/content requirements:\n${safe}`);
    }

    // Base requirements
    promptParts.push(`Base requirements:
- Mobile-responsive layout
- All text content in Russian language
- Professional, conversion-optimized design
- Hero section with headline, subheadline, CTA button
- Clean typography with proper spacing and visual hierarchy
- Subtle hover effects and smooth transitions`);

    const prompt = promptParts.join("\n\n");

    // ── Initialize Stitch SDK ────────────────────────────────────
    const { StitchToolClient, Stitch } = await import("@google/stitch-sdk");
    const client = new StitchToolClient({ apiKey });
    const stitchInstance = new Stitch(client);

    // Create project.
    // Имя проекта чистим до ASCII: Stitch отвечает «Tool Call Failed
    // [create_project]: Request contains an invalid argument» на кириллицу
    // и длинное тире — то есть у русских компаний генерация падала всегда,
    // ещё до промпта. Имя проекта техническое, пользователь его не видит,
    // поэтому безопасный фолбэк по домену/дате ничего не ломает.
    const asciiName = companyName
      .replace(/[^\x20-\x7E]+/g, " ")   // не-ASCII → пробел
      .replace(/[^A-Za-z0-9 ._-]/g, "") // спецсимволы, которые Stitch тоже не любит
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    const domainFallback = String(company?.url ?? "")
      .replace(/^https?:\/\//i, "")
      .replace(/[^A-Za-z0-9.-]/g, "")
      .slice(0, 40);
    const projectName = `${asciiName || domainFallback || "MarketRadar"} Landing`;
    const project = await stitchInstance.createProject(projectName);
    const projectId = project.id;

    // Set design system.
    //
    // Раньше сюда уходил объект {customColor, font, colorMode, roundness:"MEDIUM"},
    // которого в API вообще нет: create_design_system требует
    // { displayName, theme: {colorMode, headlineFont, bodyFont, roundness, customColor} },
    // где шрифты и roundness — строгие enum'ы ("MONTSERRAT", "ROUND_EIGHT"),
    // а не свободные строки. Из-за этого вызов падал на КАЖДОЙ генерации
    // («Tool Call Failed [create_design_system]: Request contains an invalid
    // argument»), а мы глушили ошибку как non-critical — брендовые цвета и
    // шрифт до Stitch не доезжали никогда, лендинг рисовался дефолтным.
    if (resolvedColors.length || resolvedFont) {
      try {
        await project.createDesignSystem({
          displayName: `${asciiName || "MarketRadar"} brand`,
          theme: {
            colorMode,
            headlineFont: toStitchFont(resolvedFont),
            bodyFont: toStitchFont(brandBook?.fontBody ?? resolvedFont),
            roundness: "ROUND_EIGHT",
            // Stitch ждёт hex-строку основного цвета бренда.
            customColor: resolvedColors[0] || "#6366F1",
          },
        });
      } catch (e) {
        console.warn("Design system creation failed (non-critical):", e);
      }
    }

    // Generate the screen
    const screen = await project.generate(prompt, "DESKTOP", "GEMINI_3_PRO");
    const screenId = screen.id;

    // Get HTML and screenshot URLs
    const [htmlUrl, imageUrl] = await Promise.all([
      screen.getHtml(),
      screen.getImage(),
    ]);

    await client.close();

    // Stitch иногда отдаёт превью-картинку (getImage), но пустой HTML
    // (getHtml) — без ошибки. Признак, что на аккаунте Stitch закончился
    // план/квота на экспорт HTML. Не сохраняем «битый» лендинг из одной
    // картинки, а возвращаем понятную причину.
    if (!htmlUrl || !htmlUrl.trim()) {
      await access.log({ endpoint: "generate-landing", model: "stitch-gemini-3-pro", success: false });
      return NextResponse.json({
        ok: false,
        error: "Stitch вернул только превью без HTML-страницы — вероятно, на аккаунте Stitch закончился план или квота на экспорт HTML. Проверьте аккаунт и ключ GOOGLE_STITCH_API_KEY.",
      }, { status: 502 });
    }

    // Записываем projectId↔userId, чтобы edit-landing мог проверить владение.
    // Без этого был IDOR (см. P0 от аудит-агента 25.05). workspace_id = id
    // владельца workspace (для multi-user команд).
    const session = await getSessionUser().catch(() => null);
    if (session?.userId) {
      try {
        await query(
          `INSERT INTO landing_projects (project_id, user_id, workspace_id, landing_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id) DO NOTHING`,
          [projectId, session.userId, session.userId, landingType ?? "main"],
        );
      } catch (e) {
        console.warn("[generate-landing] failed to persist project ownership:", e);
      }
    }

    await access.log({ endpoint: "generate-landing", model: "stitch-gemini-3-pro", success: true });
    return NextResponse.json({
      ok: true,
      projectId,
      screenId,
      htmlUrl,
      imageUrl,
      prompt: prompt.slice(0, 500),
    });
  } catch (err: unknown) {
    console.error("generate-landing error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Stitch API error" },
      { status: 500 }
    );
  }
}
