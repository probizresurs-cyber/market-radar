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
import { ELEVENLABS_API_KEY, ELEVENLABS_BASE_URL, ELEVENLABS_DEFAULT_MODEL, ELEVENLABS_FALLBACK_MODEL as FALLBACK_MODEL } from "@/lib/elevenlabs";

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
    //
    // Клампы, а не сырые значения: настройки теперь приходят от ИИ-арт-
    // директора, а крайние значения звучат СИНТЕТИЧНЕЕ, а не живее.
    // stability < 0.3 — тембр «гуляет» и появляются призвуки; style > 0.7 —
    // наигранная театральность вместо естественной интонации.
    const clamp = (v: unknown, min: number, max: number, def: number) =>
      typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
    const stability = clamp(body.stability, 0.3, 0.75, 0.45);
    const similarity = clamp(body.similarity, 0.7, 0.95, 0.85);
    const style = clamp(body.style, 0, 0.7, 0.5);
    const speed = clamp(body.speed, 0.85, 1.1, 1);
    const speakerBoost = body.speakerBoost !== false; // default true
    const modelId = String(body.elevenModel ?? ELEVENLABS_DEFAULT_MODEL).trim();

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
    // /with-timestamps вместо обычного эндпоинта: тот же синтез, но вместе с
    // аудио возвращает посимвольную разметку. Из неё собираются пословные
    // тайминги для субтитров и ТОЧНАЯ длительность дорожки — раньше и то, и
    // другое давал Whisper, а он недоступен (OpenAI блокирует наш регион, и
    // обойти это воркером нельзя — api.openai.com сам за Cloudflare).
    // Побочно это чинило два бага: субтитры шли быстрее речи, а ролик
    // обрывался раньше конца озвучки, потому что длительность была оценкой.
    async function synth(model: string) {
      return fetch(
        `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            text: script,
            model_id: model,
            voice_settings: {
              stability,
              similarity_boost: similarity,
              style,
              use_speaker_boost: speakerBoost,
              // Темп речи. Реализм страдает от «дикторского» ровного темпа:
              // лёгкое замедление на доверительных текстах и ускорение на
              // продающих звучит живее. Диапазон ElevenLabs — 0.7..1.2.
              speed,
            },
          }),
        },
      );
    }

    let res = await synth(modelId);

    // Модель задаётся через ELEVENLABS_MODEL и может оказаться недоступной
    // тарифу аккаунта (новые модели раскатываются не на все планы). Тогда
    // ElevenLabs отвечает 4xx на КОНКРЕТНУЮ модель, а не на запрос вообще —
    // молча откатываемся на проверенную multilingual_v2, чтобы смена модели
    // в env не могла оставить ролики без голоса. 401/402 (ключ и квота) не
    // ретраим: там смена модели не поможет.
    if (!res.ok && res.status >= 400 && res.status < 500
        && res.status !== 401 && res.status !== 402 && modelId !== FALLBACK_MODEL) {
      console.warn(`[voiceover] модель ${modelId} отклонена (${res.status}), откат на ${FALLBACK_MODEL}`);
      res = await synth(FALLBACK_MODEL);
    }

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

    const payload = (await res.json()) as {
      audio_base64?: string;
      alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] };
      normalized_alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] };
    };
    if (!payload.audio_base64) {
      return NextResponse.json({ ok: false, error: "ElevenLabs не вернул аудио" }, { status: 502 });
    }
    const audioBuf = Buffer.from(payload.audio_base64, "base64");

    // Посимвольную разметку сворачиваем в пословную: слово начинается на
    // первом непробельном символе и заканчивается на последнем перед пробелом.
    // Пунктуацию оставляем внутри слова — субтитры показывают её как есть.
    const al = payload.alignment ?? payload.normalized_alignment;
    const words: Array<{ word: string; start: number; end: number }> = [];
    if (al?.characters?.length && al.character_start_times_seconds?.length) {
      let buf = "";
      let start = 0;
      for (let i = 0; i < al.characters.length; i++) {
        const ch = al.characters[i];
        if (/\s/.test(ch)) {
          if (buf) {
            words.push({ word: buf, start, end: al.character_end_times_seconds?.[i - 1] ?? start });
            buf = "";
          }
          continue;
        }
        if (!buf) start = al.character_start_times_seconds[i] ?? 0;
        buf += ch;
      }
      if (buf) {
        const last = al.characters.length - 1;
        words.push({ word: buf, start, end: al.character_end_times_seconds?.[last] ?? start });
      }
    }
    // Длительность — конец последнего символа, а не оценка по темпу речи.
    const durationSec = al?.character_end_times_seconds?.length
      ? al.character_end_times_seconds[al.character_end_times_seconds.length - 1]
      : null;

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
        /** Пословные тайминги от самого синтезатора — точнее Whisper и без OpenAI. */
        words,
        /** Точная длительность дорожки: по ней ставится длительность ролика. */
        durationSec,
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
