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
    const { company, brandBook, taData, smmData, landingType } = body;

    // ── Build detailed prompt from analysis data ──────────────────
    const promptParts: string[] = [];

    // Company basics
    const companyName = company?.name || "Компания";
    promptParts.push(`Create a professional landing page for "${companyName}".`);
    if (company?.description) promptParts.push(`About: ${company.description}`);
    if (company?.url) promptParts.push(`Website: ${company.url}`);

    // Landing type
    const typeMap: Record<string, string> = {
      main: "Main company landing page with hero, services, benefits, testimonials, CTA sections.",
      product: "Product/service showcase page with features grid, pricing, social proof, FAQ.",
      promo: "Promotional landing page with bold CTA, urgency elements, special offer block, trust badges.",
      lead: "Lead generation page with prominent form, pain points, solution benefits, client logos.",
    };
    promptParts.push(typeMap[landingType] || typeMap.main);

    // Brand identity
    if (brandBook) {
      const brandParts: string[] = [];
      if (brandBook.tagline) brandParts.push(`Tagline: "${brandBook.tagline}"`);
      if (brandBook.mission) brandParts.push(`Mission: ${brandBook.mission}`);
      if (brandBook.toneOfVoice?.length) brandParts.push(`Tone: ${brandBook.toneOfVoice.join(", ")}`);
      if (brandBook.colors?.length) brandParts.push(`Brand colors: ${brandBook.colors.join(", ")}`);
      if (brandBook.fontHeader) brandParts.push(`Font: ${brandBook.fontHeader}`);
      if (brandParts.length) promptParts.push(`Brand identity: ${brandParts.join(". ")}`);
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

    // SMM / social proof
    if (smmData?.brandArchetype) promptParts.push(`Brand archetype: ${smmData.brandArchetype}`);

    // Design requirements
    promptParts.push(`Requirements:
- Modern, professional SaaS-style design
- Mobile-responsive layout
- Clear visual hierarchy
- Hero section with strong headline and CTA button
- Sections: benefits/features grid, social proof, about/team, contact form
- Use brand colors throughout
- All text in Russian language
- Clean typography with proper spacing
- Subtle animations and hover effects`);

    const prompt = promptParts.join("\n\n");

    // ── Initialize Stitch SDK ────────────────────────────────────
    const { StitchToolClient, Stitch } = await import("@google/stitch-sdk");
    const client = new StitchToolClient({ apiKey });
    const stitchInstance = new Stitch(client);

    // Create project
    const project = await stitchInstance.createProject(`${companyName} — Landing`);
    const projectId = project.id;

    // Set design system from brandbook
    if (brandBook?.colors?.length) {
      try {
        await project.createDesignSystem({
          customColor: brandBook.colors[0] || undefined,
          font: brandBook.fontHeader || undefined,
          colorMode: "LIGHT",
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

    await client.close();

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
