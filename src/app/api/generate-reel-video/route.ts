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
import { friendlyAiError } from "@/lib/ai-error";

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
    // Длина видео в секундах (5/10/15/30/60). Передаётся в prompt.
    const targetDurationSec: number = (() => {
      const n = Number(body.targetDurationSec);
      if (!Number.isFinite(n) || n < 5 || n > 120) return 30;
      return Math.round(n);
    })();
    // Сабтитры — burned-in caption on screen. По умолчанию включены.
    const subtitles: boolean = body.subtitles !== false;
    // Режим видео: mixed (default) / avatar-only / broll-only.
    const videoMode: "avatar-only" | "broll-only" | "mixed" =
      body.videoMode === "avatar-only" || body.videoMode === "broll-only"
        ? body.videoMode
        : "mixed";
    // Список конкретных b-roll сцен, которые пользователь явно прописал.
    // Если есть — внедряем их в prompt как явные инструкции для агента;
    // если нет — агент сам решит какие b-roll вставить.
    type BrollScene = { prompt?: string; motionHint?: string; position?: string; referenceImageUrl?: string };
    const brollScenes: BrollScene[] = Array.isArray(body.brollScenes)
      ? (body.brollScenes as BrollScene[])
          .filter(s => s && typeof s.prompt === "string" && s.prompt.trim().length > 5)
          .slice(0, 10)
      : [];
    // Собираем все референс-фото из сцен в files[] для HeyGen.
    // Поддерживаемые форматы (по docs):
    //   - { type: "url", url: "https://..." }
    //   - { type: "base64", media_type: "image/png", data: "iVBOR..." }
    type HeygenFile =
      | { type: "url"; url: string }
      | { type: "base64"; media_type: string; data: string };
    const filesForAgent: HeygenFile[] = [];
    for (const s of brollScenes) {
      const ref = (s.referenceImageUrl ?? "").trim();
      if (!ref) continue;
      if (ref.startsWith("http")) {
        filesForAgent.push({ type: "url", url: ref });
      } else if (ref.startsWith("data:")) {
        const m = ref.match(/^data:([^;]+);base64,(.*)$/);
        if (m) filesForAgent.push({ type: "base64", media_type: m[1], data: m[2] });
      }
      if (filesForAgent.length >= 20) break; // HeyGen лимит
    }

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
      // СТРОГО фиксируем длину — иначе видео-агент тянет на 20-30 секунд
      // даже для 10-секундных запросов. Повторяем требование 3 раза в разных
      // местах промпта, чтобы LLM-агент не проигнорировал.
      parts.push(
        `STRICT REQUIREMENT — VIDEO DURATION: exactly ${targetDurationSec} seconds. ` +
        `Final video MUST be no longer than ${targetDurationSec} seconds total. ` +
        `Cut script if needed to fit. This is a HARD constraint.`
      );
      parts.push(
        `The avatar must speak EXACTLY this voiceover script (do not change wording, but trim from the end if it doesn't fit ${targetDurationSec} seconds):\n"""\n${script}\n"""`
      );
      // Сабтитры — повторяем строгое указание два раза.
      const subtitleLine = subtitles
        ? `STRICT REQUIREMENT — BURNED-IN SUBTITLES ARE MANDATORY: render Russian subtitles directly into the video, frame by frame, synced with the avatar's speech. ` +
          `Clean modern sans-serif, white text with subtle drop shadow, positioned at the bottom-center, 40-60px from the bottom edge. ` +
          `Without subtitles the video is unusable — do NOT skip them.`
        : "STRICT REQUIREMENT: do NOT add any text overlays, subtitles, captions or any on-screen text. Pure visual + audio only.";

      // Режим финального видео — даёт агенту чёткое указание что показывать.
      if (videoMode === "avatar-only") {
        parts.push(
          "VIDEO MODE: avatar-only. The video should show ONLY the talking avatar full-frame the entire time — no b-roll, no scene cuts, no inserts. Just one continuous avatar shot. " +
          subtitleLine + " " +
          "Style: clean, professional, neutral studio background."
        );
      } else if (videoMode === "broll-only") {
        // Только b-roll с озвучкой — закадровый голос поверх кинематографичных кадров.
        if (brollScenes.length > 0) {
          const sceneList = brollScenes
            .map((s, i) => {
              const pos = s.position ? ` [${s.position}]` : "";
              const motion = s.motionHint ? ` (${s.motionHint})` : "";
              const ref = (s.referenceImageUrl ?? "").trim()
                ? ` — animate from the provided reference image (image #${i + 1} attached as file)`
                : "";
              return `${i + 1}.${pos}${motion} ${s.prompt!.trim()}${ref}`;
            })
            .join("\n");
          parts.push(
            `VIDEO MODE: b-roll-only with voiceover. NO avatar in frame. ` +
            `Use these SPECIFIC b-roll scenes in this order:\n${sceneList}\n\n` +
            "Each scene must have CLEAR ACTION (movement, motion, change happening) — not static photo with camera pan. " +
            "Voiceover plays over the b-roll. " + subtitleLine + " " +
            "Style: modern, premium, cinematic lighting, shallow depth of field. " +
            "Do NOT add competitor brand names, logos, or recognizable third-party signage."
          );
        } else {
          parts.push(
            "VIDEO MODE: b-roll-only with voiceover. NO avatar in frame. " +
            "Generate cinematic b-roll scenes that match the voiceover, with CLEAR ACTION in every scene " +
            "(movement, real activity, gesture, transformation — not static photos with camera pans). " +
            subtitleLine + " " +
            "Style: modern, premium, cinematic lighting, shallow depth of field. " +
            "Do NOT add competitor brand names or logos."
          );
        }
      } else if (brollScenes.length > 0) {
        // Mixed mode — аватар + конкретные b-roll сцены.
        const sceneList = brollScenes
          .map((s, i) => {
            const pos = s.position ? ` [${s.position}]` : "";
            const motion = s.motionHint ? ` (${s.motionHint})` : "";
            const ref = (s.referenceImageUrl ?? "").trim()
              ? ` — animate from the provided reference image (image #${i + 1} attached as file)`
              : "";
            return `${i + 1}.${pos}${motion} ${s.prompt!.trim()}${ref}`;
          })
          .join("\n");
        parts.push(
          `VIDEO MODE: mixed (avatar + b-roll). ` +
          `Insert these SPECIFIC b-roll scenes between avatar shots, in this order:\n${sceneList}\n\n` +
          "Each b-roll must have CLEAR ACTION (movement, gesture, transformation, real activity happening) — not static photos with camera pan/zoom. " +
          "Match each scene to the relevant part of the avatar's monologue. " +
          subtitleLine + " " +
          "Style: modern, premium, cinematic lighting, shallow depth of field. " +
          "Do NOT add competitor brand names, logos, or recognizable third-party signage."
        );
      } else {
        parts.push(
          `VIDEO MODE: mixed (avatar + b-roll). ` +
          "Insert cinematic b-roll between avatar shots. Each b-roll must show CLEAR ACTION (movement, gesture, activity, transformation) — NOT static photos with camera pan/zoom. " +
          subtitleLine + " " +
          "Style: modern, premium, cinematic lighting, shallow depth of field. " +
          "Do NOT add competitor brand names, logos, or recognizable third-party signage in b-roll."
        );
      }

      // Финальное напоминание — самые критичные требования в конце промпта
      // (LLM лучше выполняет последние инструкции).
      const modeDesc =
        videoMode === "avatar-only" ? "ONLY talking avatar, NO b-roll, NO scene cuts"
        : videoMode === "broll-only" ? "ONLY b-roll scenes with voiceover, NO avatar in frame"
        : "Avatar + b-roll mixed (b-roll scenes must have CLEAR ACTION, not static photos)";
      parts.push(
        `FINAL CHECKLIST (must satisfy ALL):\n` +
        `1) Final video length: exactly ${targetDurationSec} seconds.\n` +
        `2) Subtitles: ${subtitles ? "BURNED-IN, Russian, bottom-center, mandatory" : "NONE"}.\n` +
        `3) Voiceover: matches the provided script word-for-word.\n` +
        `4) Orientation: vertical 9:16.\n` +
        `5) Video mode: ${modeDesc}.`
      );

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
      files?: HeygenFile[];
    }
    const payload: AgentPayload = {
      prompt,
      mode: "generate",
      orientation,
    };
    if (avatarId) payload.avatar_id = avatarId;
    if (voiceId) payload.voice_id = voiceId;
    if (filesForAgent.length > 0) payload.files = filesForAgent;

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
    console.error("[generate-reel-video] caught", err);
    const { message, status } = friendlyAiError(err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
