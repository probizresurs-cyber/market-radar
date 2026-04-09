import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gemini 2.5 Flash Image — supports multimodal input (reference images)
const MODEL = "gemini-2.5-flash-image";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
  error?: { code: number; message: string; status: string };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body.prompt ?? "";
    const referenceImages: Array<{ data: string; mimeType: string }> = body.referenceImages ?? [];

    if (!prompt.trim()) {
      return NextResponse.json({ ok: false, error: "Промпт не передан" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY не настроен" }, { status: 500 });
    }

    // Build parts array: text prompt + optional reference images
    const parts: GeminiPart[] = [];

    if (referenceImages.length > 0) {
      parts.push({
        text: `Generate an image matching this description: ${prompt}

Use the provided reference images for visual style — color palette, composition, mood, and aesthetic. The result should feel consistent with the references.`,
      });
      for (const ref of referenceImages) {
        // Strip data URL prefix if present
        const rawData = ref.data.includes(",") ? ref.data.split(",")[1] : ref.data;
        parts.push({ inlineData: { mimeType: ref.mimeType, data: rawData } });
      }
    } else {
      parts.push({ text: prompt });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      },
    );

    const geminiData = await res.json() as GeminiResponse;

    if (geminiData.error) {
      return NextResponse.json(
        { ok: false, error: `Gemini error ${geminiData.error.code}: ${geminiData.error.message}` },
        { status: 500 },
      );
    }

    const responseParts = geminiData.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find(p => p.inlineData?.data);

    if (!imagePart?.inlineData) {
      return NextResponse.json(
        { ok: false, error: "Gemini не вернул изображение. Попробуйте другой промпт." },
        { status: 500 },
      );
    }

    const mimeType = imagePart.inlineData.mimeType ?? "image/png";
    const imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({ ok: true, data: { imageUrl } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
