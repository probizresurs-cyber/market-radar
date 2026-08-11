/**
 * POST /api/voice-tune — «опиши подачу словами, получи настройки голоса».
 *
 * Зачем: живость озвучки задают три числа ElevenLabs, и два из них
 * контринтуитивны. stability НИЖЕ значит БОЛЬШЕ модуляций (то есть живее),
 * а style выше 0.7 даёт призвуки вместо эмоции. Просить это выставлять
 * вручную — гарантированный «робот» у половины пользователей.
 *
 * Здесь пользователь пишет «бодрее, как ведущий новостей стройки», а модель
 * возвращает конкретные значения. Ползунки в кабинете остаются: агент их
 * заполняет, а не подменяет.
 *
 * Body: { prompt: string, current?: { stability?, style?, speed? } }
 * Returns: { ok, data: { stability, style, speed, rationale } }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { chatJson, CHAT_MODEL_FAST } from "@/lib/ai-chat";
import { sanitizeUserPrompt } from "@/lib/prompt-sanitize";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Границы — те же, что клампит generate-promo-voiceover. Держим их и здесь,
 * чтобы модель не предлагала значения, которые сервер всё равно обрежет:
 * пользователь увидел бы одно, а услышал другое.
 */
const LIMITS = {
  stability: { min: 0.3, max: 0.75, def: 0.45 },
  style: { min: 0, max: 0.7, def: 0.5 },
  speed: { min: 0.85, max: 1.1, def: 1 },
};

const clamp = (v: unknown, k: keyof typeof LIMITS): number => {
  const n = Number(v);
  const { min, max, def } = LIMITS[k];
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const SYSTEM = `Ты — звукорежиссёр озвучки. Переводишь пожелание к подаче голоса в три параметра ElevenLabs.

ПАРАМЕТРЫ (и что они делают на самом деле):
- stability ${LIMITS.stability.min}–${LIMITS.stability.max}: НИЖЕ = живее, больше интонационных перепадов. ВЫШЕ = ровнее, монотоннее, «дикторски». Это НЕ «качество».
- style ${LIMITS.style.min}–${LIMITS.style.max}: выше = эмоциональнее и выразительнее. Больше 0.7 не бывает — начинаются призвуки.
- speed ${LIMITS.speed.min}–${LIMITS.speed.max}: темп речи. 1.0 — обычный.

ОРИЕНТИРЫ:
- «живее, эмоциональнее, бодрее» → stability 0.30-0.35, style 0.65-0.7, speed 1.05-1.1
- «спокойнее, солиднее, увереннее» → stability 0.55-0.65, style 0.35-0.45, speed 0.95-1.0
- «строго, официально, сдержанно» → stability 0.65-0.75, style 0.2-0.3, speed 0.9-0.95
- «медленнее / быстрее» → двигай ТОЛЬКО speed, остальное оставь как есть

Если пожелание касается одного аспекта — меняй только его, остальные значения бери из текущих.
rationale — одна короткая фраза по-русски, что именно изменилось и как это прозвучит.

Ответ строго JSON: {"stability":0.35,"style":0.68,"speed":1.05,"rationale":"..."}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { prompt?: string; current?: { stability?: number; style?: number; speed?: number } };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const prompt = sanitizeUserPrompt(String(body.prompt ?? ""), { maxLength: 400 });
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Опишите, как должен звучать голос" }, { status: 400 });
  }

  const cur = {
    stability: clamp(body.current?.stability, "stability"),
    style: clamp(body.current?.style, "style"),
    speed: clamp(body.current?.speed, "speed"),
  };

  try {
    const r = await chatJson<{ stability: number; style: number; speed: number; rationale?: string }>({
      model: CHAT_MODEL_FAST,
      system: SYSTEM,
      user: `Текущие настройки: stability ${cur.stability}, style ${cur.style}, speed ${cur.speed}.\n\nПожелание: ${prompt}`,
      maxTokens: 300,
    });
    // data === null значит модель не ответила или ответила не-JSON. Молча
    // подставлять дефолты нельзя: пользователь решит, что подача учтена.
    if (!r.data) {
      await access.log({ endpoint: "voice-tune", model: CHAT_MODEL_FAST, success: false });
      return NextResponse.json(
        { ok: false, error: `Не удалось подобрать настройки: ${r.error ?? "пустой ответ"}` },
        { status: 502 },
      );
    }
    const data = r.data;

    const out = {
      stability: clamp(data?.stability, "stability"),
      style: clamp(data?.style, "style"),
      speed: clamp(data?.speed, "speed"),
      rationale: String(data?.rationale ?? "").slice(0, 200),
    };
    await access.log({ endpoint: "voice-tune", model: CHAT_MODEL_FAST, success: true });
    return NextResponse.json({ ok: true, data: out });
  } catch (e) {
    await access.log({ endpoint: "voice-tune", model: CHAT_MODEL_FAST, success: false });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Не удалось подобрать настройки" },
      { status: 500 },
    );
  }
}
