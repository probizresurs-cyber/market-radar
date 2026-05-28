/**
 * POST /api/generate-promo-voiceover
 *
 * Тонкая обёртка над /api/elevenlabs-tts для пайплайна промо-рилсов:
 *  1. Собирает текст голоса из hookText + problemText + ctaText
 *  2. Зовёт ElevenLabs через существующий endpoint
 *  3. Декодирует base64 → MP3-файл на диск /public/voiceovers/{jobId}.mp3
 *  4. Возвращает URL через /api/static-asset/voiceovers/{jobId}.mp3
 *
 * Почему отдельный endpoint, а не вызов elevenlabs-tts напрямую из
 * orchestrator'а:
 *  - elevenlabs-tts возвращает base64 data URL (огромный JSON ~500KB)
 *    — таскать его через props.json и тратить память orchestrator'а
 *    не хочется. Этот wrapper сразу пишет на диск.
 *  - Логику «собрать скрипт» из 3 кусков текста инкапсулируем тут.
 *
 * Body:
 *   hookText, problemText, ctaText  — куски речи
 *   voiceId?                        — ElevenLabs voice ID (default — multilingual женский)
 *   stability?, similarity?         — настройки голоса
 *
 * Returns:
 *   { ok, data: { jobId, url, bytes, totalMs } }
 *
 * ВАЖНО: рассчитано на ~30-сек ролик. Если тексты слишком длинные —
 * voiceover может вылезти за хронометраж. ElevenLabs не ускоряет речь;
 * это надо учитывать на этапе генерации скрипта. Хорошее правило:
 * hook ~12 слов, problem ~35 слов, CTA ~10 слов = ~57 слов = ~25 сек
 * нормальной речи.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ELEVENLABS_API_KEY, ELEVENLABS_BASE_URL, ELEVENLABS_DEFAULT_MODEL } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 120;

// Дефолтный голос — нейтральный женский multilingual (Russian works fine
// через eleven_multilingual_v2). Юзер может переопределить в body.voiceId.
// «Charlotte» — популярный, ставился admin'ом для UI'ев бренда.
const DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa"; // Charlotte

function buildScript(hookText: string, problemText: string, ctaText: string): string {
  // Простая склейка с паузами через точки. ElevenLabs учитывает знаки
  // препинания для интонации — двойная точка после hook'а даёт нужную
  // драматическую паузу. После problem'ы — тоже пауза перед CTA.
  return `${hookText}.. ${problemText}.. ${ctaText}.`.trim();
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "ELEVENLABS_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const hookText = String(body.hookText ?? "").trim();
    const problemText = String(body.problemText ?? "").trim();
    const ctaText = String(body.ctaText ?? "").trim();
    if (!hookText || !problemText || !ctaText) {
      return NextResponse.json(
        { ok: false, error: "hookText/problemText/ctaText обязательны" },
        { status: 400 },
      );
    }

    const voiceId = String(body.voiceId ?? DEFAULT_VOICE_ID).trim();
    // Настройки голоса подобраны под промо-формат:
    //  - stability 0.35 (вместо 0.5) — даёт живые модуляции вместо
    //    монотонной читки. Слишком низко (<0.3) — голос «гуляет».
    //  - style 0.55 (вместо 0) — добавляет эмоциональной окраски
    //    (улыбка, акценты), без этого голос звучит «новостным»
    //  - similarity 0.85 (вместо 0.75) — крепче держится за оригинальный
    //    voice, иначе на низкой stability может «уплыть» в чужой тембр
    // Юзер может переопределить через body.stability/.similarity/.style.
    const stability = typeof body.stability === "number" ? body.stability : 0.35;
    const similarity = typeof body.similarity === "number" ? body.similarity : 0.85;
    const style = typeof body.style === "number" ? body.style : 0.55;

    // Скрипт: либо явный override (юзер сам написал полный текст ~75 слов),
    // либо автосборка из 3 кусков (короткий, ~7-10 сек озвучки)
    const explicitScript = String(body.voiceoverScript ?? "").trim();
    const script = explicitScript || buildScript(hookText, problemText, ctaText);
    if (script.length > 1500) {
      return NextResponse.json(
        { ok: false, error: `Скрипт слишком длинный (${script.length} символов), не уложится в 30 сек` },
        { status: 400 },
      );
    }

    // Дёргаем ElevenLabs напрямую (не через /api/elevenlabs-tts —
    // там лишняя сериализация в base64-JSON и обратно).
    const res = await fetch(
      `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: ELEVENLABS_DEFAULT_MODEL,
          voice_settings: {
            stability,
            similarity_boost: similarity,
            style,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        {
          ok: false,
          error: `ElevenLabs ${res.status}: ${errorText.slice(0, 300)}`,
        },
        { status: 502 },
      );
    }

    const audioBuf = Buffer.from(await res.arrayBuffer());

    // Сохраняем MP3 на диск, отдаём через /api/static-asset/voiceovers/
    const jobId = `voice-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const publicDir = path.join(process.cwd(), "public", "voiceovers");
    await mkdir(publicDir, { recursive: true });
    await writeFile(path.join(publicDir, `${jobId}.mp3`), audioBuf);

    await access.log({
      endpoint: "generate-promo-voiceover",
      model: ELEVENLABS_DEFAULT_MODEL,
      success: true,
      promptTokens: script.length,
      durationMs: Date.now() - t0,
    });

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        url: `/api/static-asset/voiceovers/${jobId}.mp3`,
        bytes: audioBuf.byteLength,
        scriptChars: script.length,
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, elapsedMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
