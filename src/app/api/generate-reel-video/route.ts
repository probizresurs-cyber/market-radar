/**
 * POST /api/generate-reel-video
 *
 * Создаёт ВСЁ-в-одном видео через HeyGen Video Agent v3:
 * - аватар произносит сценарий
 * - b-roll автоматически вшивается между планами
 * - сабтитры автоматически добавляются
 *
 * Раньше это были 3 отдельных запроса (v2 video/generate + b-roll workflows
 * + ElevenLabs TTS upload). v3/video-agents делает всё одним вызовом.
 *
 * Docs: https://developers.heygen.com/reference/create-video-agent-session
 *
 * Body:
 *   script           — voiceover-сценарий (то что говорит аватар)
 *   prompt?          — расширенный промпт для агента; если не задан,
 *                      собирается из script + companyContext
 *   avatarId?        — конкретный аватар (опц, агент выберет авто)
 *   voiceId?         — конкретный голос (опц)
 *   aspect?          — "portrait" | "landscape"
 *   companyName?, companyNiche? — для контекста в auto-prompt
 *   title?, hook?    — заголовок/крючок рилса (улучшают авто-prompt)
 *
 * Returns:
 *   { ok, data: { sessionId, videoId? } }
 *   videoId появится позже — клиент поллит /api/video-status?sessionId=...
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const script: string = (body.script ?? "").toString().trim();
    const customPrompt: string = (body.prompt ?? "").toString().trim();
    const avatarId: string | undefined =
      typeof body.avatarId === "string" && body.avatarId.trim() ? body.avatarId.trim() : undefined;
    const voiceId: string | undefined =
      typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : undefined;
    const aspect: "portrait" | "landscape" =
      body.aspect === "landscape" ? "landscape" : "portrait";
    const companyName: string = (body.companyName ?? "").toString().trim();
    const companyNiche: string = (body.companyNiche ?? "").toString().trim();
    const title: string = (body.title ?? "").toString().trim();
    const hook: string = (body.hook ?? "").toString().trim();
    // Список конкретных b-roll сцен, которые пользователь явно прописал.
    // Если есть — внедряем их в prompt как явные инструкции для агента;
    // если нет — агент сам решит какие b-roll вставить.
    type BrollScene = { prompt?: string; motionHint?: string; position?: string };
    const brollScenes: BrollScene[] = Array.isArray(body.brollScenes)
      ? (body.brollScenes as BrollScene[])
          .filter(s => s && typeof s.prompt === "string" && s.prompt.trim().length > 5)
          .slice(0, 10)
      : [];

    if (!script && !customPrompt) {
      return NextResponse.json(
        { ok: false, error: "Нужен script или prompt" },
        { status: 400 },
      );
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    // Собираем промпт для агента. Видео-агент HeyGen ожидает естественное
    // описание видео — какой контекст, что говорит аватар, какой стиль b-roll.
    // Скрипт оборачиваем как «обязательный текст озвучки».
    let prompt: string;
    if (customPrompt) {
      prompt = customPrompt;
    } else {
      const parts: string[] = [];
      if (companyName) {
        parts.push(
          `Create a vertical short-form video for the company "${companyName}"${companyNiche ? ` (industry: ${companyNiche.slice(0, 240)})` : ""}.`
        );
      } else {
        parts.push("Create a vertical short-form video.");
      }
      if (title) parts.push(`Title: ${title}.`);
      if (hook) parts.push(`Opening hook: ${hook}.`);
      parts.push(
        `The avatar must speak EXACTLY this voiceover script (do not change wording):\n"""\n${script}\n"""`
      );
      if (brollScenes.length > 0) {
        // Юзер прописал конкретные сцены — даём агенту жёсткий список.
        const sceneList = brollScenes
          .map((s, i) => {
            const pos = s.position ? ` [${s.position}]` : "";
            const motion = s.motionHint ? ` (${s.motionHint})` : "";
            return `${i + 1}.${pos}${motion} ${s.prompt!.trim()}`;
          })
          .join("\n");
        parts.push(
          `Insert these SPECIFIC b-roll scenes between avatar shots, in this order:\n${sceneList}\n\n` +
          "Match each scene to the relevant part of the avatar's monologue. " +
          "Add burned-in subtitles for accessibility. " +
          "Style: modern, premium, cinematic lighting, shallow depth of field. " +
          "Do NOT add competitor brand names, logos, or recognizable third-party clinic/office signage."
        );
      } else {
        parts.push(
          "Insert cinematic b-roll between avatar shots to illustrate key points. " +
          "Add burned-in subtitles for accessibility. " +
          "Style: modern, premium, cinematic lighting, shallow depth of field. " +
          "Do NOT add competitor brand names, logos, or recognizable third-party clinic/office signage in b-roll."
        );
      }
      // HeyGen лимит — 10000 символов на промпт.
      prompt = parts.join("\n\n").slice(0, 9800);
    }

    const orientation = aspect === "portrait" ? "portrait" : "landscape";

    interface AgentPayload {
      prompt: string;
      mode: "generate";
      orientation: "portrait" | "landscape";
      avatar_id?: string;
      voice_id?: string;
    }
    const payload: AgentPayload = {
      prompt,
      mode: "generate",
      orientation,
    };
    if (avatarId) payload.avatar_id = avatarId;
    if (voiceId) payload.voice_id = voiceId;

    const res = await fetch("https://api.heygen.com/v3/video-agents", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      // HeyGen v3 error shape: { error: { code, message, param? } }
      let humanMsg = text.slice(0, 400);
      try {
        const errBody: { error?: { code?: string; message?: string; param?: string } } = JSON.parse(text);
        if (errBody.error?.message) {
          humanMsg = errBody.error.message;
          if (errBody.error.code) humanMsg = `${errBody.error.code}: ${humanMsg}`;
        }
      } catch { /* not JSON — keep raw text */ }

      const hint =
        res.status === 401 || res.status === 403
          ? " — Video Agents API недоступен на вашем тарифе HeyGen. Нужен платный план с включённым продуктом."
          : res.status === 404
          ? " — endpoint /v3/video-agents не найден. Проверьте версию API."
          : res.status === 429
          ? " — превышен rate-limit, повторите через минуту."
          : "";
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${humanMsg}${hint}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: { session_id?: string; status?: string; video_id?: string | null };
    } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const sessionId = parsed?.data?.session_id;
    const videoId = parsed?.data?.video_id ?? undefined;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул session_id: ${text.slice(0, 400)}` },
        { status: 500 },
      );
    }

    // Возвращаем sessionId под именем videoId (для бинарной совместимости с
    // существующим фронтом, который сохраняет heygenVideoId и поллит по нему).
    // /api/video-status дальше разрулит — это session_id v3.
    return NextResponse.json({
      ok: true,
      data: {
        videoId: sessionId,
        sessionId,
        // realVideoId доступен только когда session.status=completed
        realVideoId: videoId,
        voiceProvider: "video-agent",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
