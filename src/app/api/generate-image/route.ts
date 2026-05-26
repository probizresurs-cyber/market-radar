import { NextResponse } from "next/server";
import { generateGeminiImage } from "@/lib/gemini";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generate a single image via Gemini 2.5 Flash Image.
// Принимает JSON { prompt, referenceImages?: [{ data, mimeType }] }.
// Ключ и базовый URL (включая Cloudflare-прокси для российского VPS) —
// в src/lib/gemini.ts.

export async function POST(req: Request) {
  // КРИТИЧНО: раньше любой анонимный мог жечь Gemini-бюджет ($X/картинка).
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = body.prompt ?? "";
    const referenceImages: Array<{ data: string; mimeType: string }> =
      body.referenceImages ?? [];

    if (!prompt.trim()) {
      return NextResponse.json({ ok: false, error: "Промпт не передан" }, { status: 400 });
    }

    const result = await generateGeminiImage({ prompt, referenceImages });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status ?? 500 },
      );
    }
    // Логируем расход для admin-аналитики и списания с квоты пользователя.
    await access.log({ endpoint: "generate-image", model: "gemini-2.5-flash-image", success: true });
    return NextResponse.json({ ok: true, data: { imageUrl: result.imageUrl } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
