import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { fetchYouTubeTranscript, transcribeWithWhisper, MAX_UPLOAD_BYTES } from "@/lib/reel-transcribe";
import type { ReelBreakdown } from "@/lib/content-types";

/**
 * POST /api/content/reel-breakdown
 *
 * Разбор чужого успешного ролика на элементы (крюк / структура / приёмы
 * удержания / CTA / почему сработало) — «Тренды» → «Разбор ролика».
 *
 * Вход — ЛИБО:
 *  - JSON { youtubeUrl }              — субтитры YouTube без скачивания видео
 *  - multipart/form-data { file }     — свой видео/аудио файл → Whisper
 *
 * Instagram/VK/TikTok по ссылке не поддержаны (закрытые API — см. reel-transcribe.ts);
 * обходной путь — скачать ролик и загрузить как file.
 */
export const runtime = "nodejs";
export const maxDuration = 180;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — сценарный аналитик коротких видео (Reels/Shorts/TikTok) с опытом разбора вирального контента.

Тебе дают транскрипт ролика с грубыми таймкодами. Разбери его на элементы структуры и объясни, ПОЧЕМУ это работает — конкретно, по транскрипту, без общих фраз вроде "интересная подача".

Если транскрипт слишком короткий/бессвязный, чтобы разобрать структуру — честно скажи об этом в whyItWorks, не выдумывай драматургию, которой нет.

Возвращаешь СТРОГО валидный JSON без markdown:
{
  "hookText": "дословная или близкая к дословной фраза первых 3-5 секунд",
  "hookWhy": "почему именно так цепляет — конкретно",
  "structure": [
    { "timeRange": "0:00-0:03", "beat": "КРЮК", "description": "что происходит и зачем" }
  ],
  "retentionTricks": ["конкретный приём удержания внимания, а не общие слова"],
  "cta": "что предлагают сделать зрителю в конце (или '' если призыва нет)",
  "whyItWorks": "2-4 предложения — что конкретно в этом ролике работает на удержание/вовлечение"
}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    let transcript = "";
    let sourceType: ReelBreakdown["sourceType"];
    let sourceTitle = "";
    let sourceUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json({ ok: false, error: "Файл не передан" }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { ok: false, error: `Файл слишком большой (${Math.round(file.size / 1024 / 1024)} МБ > 24 МБ) — обрежьте ролик или сожмите` },
          { status: 413 },
        );
      }
      const filename = (form.get("filename") as string) || "upload.mp4";
      try {
        const { transcript: t } = await transcribeWithWhisper(file, filename);
        transcript = t;
      } catch (e) {
        return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка транскрипции" }, { status: 500 });
      }
      sourceType = "upload";
      sourceTitle = filename;
    } else {
      const body = await req.json().catch(() => ({})) as { youtubeUrl?: string };
      const youtubeUrl = (body.youtubeUrl || "").trim();
      if (!youtubeUrl) {
        return NextResponse.json({ ok: false, error: "Передайте youtubeUrl или файл (file)" }, { status: 400 });
      }
      if (!/youtube\.com|youtu\.be/i.test(youtubeUrl)) {
        return NextResponse.json(
          { ok: false, error: "Пока поддержан только YouTube по ссылке (Instagram/VK/TikTok — загрузите файл ролика напрямую)" },
          { status: 400 },
        );
      }
      const yt = await fetchYouTubeTranscript(youtubeUrl);
      if (!yt) {
        return NextResponse.json(
          { ok: false, error: "Не удалось получить субтитры этого видео (нет ни ручных, ни авто) — попробуйте загрузить файл ролика" },
          { status: 422 },
        );
      }
      transcript = yt.transcript;
      sourceType = "youtube";
      sourceTitle = yt.title || youtubeUrl;
      sourceUrl = youtubeUrl;
    }

    if (!transcript.trim()) {
      return NextResponse.json({ ok: false, error: "Транскрипт пуст — в ролике не распознана речь" }, { status: 422 });
    }
    // Грубый защитный кап — очень длинные транскрипты (>1 часа) режем, чтобы не разнести контекст промпта.
    const clipped = transcript.length > 40_000 ? transcript.slice(0, 40_000) : transcript;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Транскрипт ролика «${sourceTitle}»:\n\n${clipped}` },
        ],
        temperature: 0.4,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      hookText?: string; hookWhy?: string;
      structure?: ReelBreakdown["structure"];
      retentionTricks?: string[]; cta?: string; whyItWorks?: string;
    };

    const breakdown: ReelBreakdown = {
      sourceType, sourceTitle, sourceUrl,
      hookText: parsed.hookText ?? "",
      hookWhy: parsed.hookWhy ?? "",
      structure: parsed.structure ?? [],
      retentionTricks: parsed.retentionTricks ?? [],
      cta: parsed.cta ?? "",
      whyItWorks: parsed.whyItWorks ?? "",
      transcript: clipped,
    };

    await access.log({
      endpoint: "reel-breakdown",
      model: "gpt-4o-mini" + (sourceType === "upload" ? "+whisper-1" : ""),
      promptTokens: estimateTokens(SYSTEM_PROMPT + clipped),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({ ok: true, breakdown });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "reel-breakdown", model: "gpt-4o-mini", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
