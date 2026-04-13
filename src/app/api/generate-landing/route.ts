import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GOOGLE_STITCH_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { company, brandBook, taData, smmData, landingType, styleConfig, userPrompt } = body;

    // ── Resolve colors/font from styleConfig ─────────────────────
    interface StyleConfig {
      source?: string;
      colors?: string[];
      font?: string;
      customPrompt?: string;
    }
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
    if (sc.customPrompt) promptParts.push(`Style requirements: ${sc.customPrompt}`);
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

    // User's custom prompt — highest priority
    if (userPrompt?.trim()) {
      promptParts.push(`IMPORTANT — User's specific requirements (apply these first):\n${userPrompt.trim()}`);
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

    // Create project
    const project = await stitchInstance.createProject(`${companyName} — Landing`);
    const projectId = project.id;

    // Set design system
    if (resolvedColors.length || resolvedFont) {
      try {
        await project.createDesignSystem({
          customColor: resolvedColors[0] || undefined,
          font: resolvedFont || undefined,
          colorMode,
          roundness: "MEDIUM",
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

    // Fetch actual HTML content so frontend can use srcDoc (bypasses X-Frame-Options)
    let htmlContent = "";
    try {
      const htmlRes = await fetch(htmlUrl, { headers: { "Accept": "text/html" } });
      if (htmlRes.ok) htmlContent = await htmlRes.text();
    } catch { /* non-critical */ }

    await client.close();

    return NextResponse.json({
      ok: true,
      projectId,
      screenId,
      htmlUrl,
      imageUrl,
      htmlContent,
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
