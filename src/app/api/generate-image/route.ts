import { NextResponse } from "next/server";
import { generateGeminiImage } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generate a single image via Gemini 2.5 Flash Image.
// Принимает JSON { prompt, referenceImages?: [{ data, mimeType }] }.
// Ключ и базовый URL (включая Cloudflare-прокси для российского VPS) —
// в src/lib/gemini.ts.

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
    return NextResponse.json({ ok: true, data: { imageUrl: result.imageUrl } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
