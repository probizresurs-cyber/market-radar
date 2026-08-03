/**
 * POST /api/generate-avatar-clip
 *
 * Говорящая голова HeyGen как ИНГРЕДИЕНТ нашего ролика, а не готовый ролик.
 *
 * Чем отличается от /api/generate-reel-video: тот зовёт Video Agent v3, и
 * HeyGen собирает всё сам — свой b-roll, свои субтитры, свой монтаж. От
 * брендбука, спека арт-директора и наших караоке-субтитров при этом не
 * остаётся ничего. Здесь наоборот: просим ТОЛЬКО аватара на сплошном фоне
 * (POST /v3/videos, type=avatar), а кадр собирает Remotion — см. AvatarSegment
 * и AvatarBubble в remotion/src/ContentReel.tsx.
 *
 * Звук. Главное решение роута: аватар синтезируется по НАШЕМУ mp3
 * (audio_asset_id), а не по тексту. Проверено живым запросом на нашем ключе —
 * тариф это позволяет. Значит клонированный русский голос бренда (ElevenLabs)
 * сохраняется, губы попадают в него, а таймлайн клипа совпадает с таймлайном
 * озвучки — композиции достаточно взять из клипа кадр с тем же номером.
 * Путь через TTS HeyGen (script + voice_id) оставлен как автоматический
 * запасной: он даёт клип с ЧУЖИМ голосом, поэтому включается только по явному
 * allowTtsFallback и помечается в ответе audioSource="heygen" — вызывающий
 * обязан решить, что делать со второй звуковой дорожкой.
 *
 * Body:
 *   audioUrl?        — наша озвучка ("/api/static-asset/voiceovers/x.mp3" или https://)
 *   script?          — текст для TTS HeyGen (нужен только для запасного пути)
 *   voiceId?         — голос HeyGen для запасного пути
 *   allowTtsFallback? — разрешить запасной путь, если аудио не приняли (default false)
 *   avatarId?        — иначе HEYGEN_AVATAR_ID
 *   bgColor?         — сплошной фон клипа; ставим цвет ролика, чтобы врезка
 *                      и полнокадровый сегмент не выпадали из палитры
 *   resolution?      — "720p" | "1080p" (default 1080p)
 *
 * Returns: { ok, data: { url, videoId, durationSec, audioSource, engine } }
 *   url — /api/static-asset/avatar-clips/{videoId}.mp4 (локальная копия:
 *   ссылка HeyGen presigned и живёт недолго, а Remotion тянет файл покадрово).
 */
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
// HeyGen рендерит говорящую голову ~1-3 минуты (на живом тесте 2 сек речи —
// 50 сек). Поллим внутри роута, как и остальные наши долгие шаги, чтобы
// оркестратору не заводить второй механизм ожидания.
export const maxDuration = 600;

const HEYGEN_API = "https://api.heygen.com";
/** Запас на скачивание готового mp4 — поллинг обязан закончиться раньше. */
const POLL_BUDGET_MS = 480_000;
/** Лимит HeyGen на загружаемый ассет. */
const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

interface HeygenError { error?: { code?: string; message?: string } }

function heygenMessage(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as HeygenError;
    const code = parsed.error?.code;
    const msg = parsed.error?.message;
    if (msg) return code ? `${code}: ${msg}` : msg;
  } catch { /* не JSON — отдаём как есть */ }
  return `${status}: ${text.slice(0, 300)}`;
}

/** Загружает наш mp3 в ассеты HeyGen и возвращает asset_id.
 *
 *  Почему не отдать audio_url прямо на наш /api/static-asset: HeyGen тогда
 *  сам ходит за файлом на наш публичный домен, а тот на проде живёт за
 *  Cloudflare и требует, чтобы внешний робот прошёл проверку. Загрузка
 *  байтами убирает эту зависимость целиком. */
async function uploadAudio(apiKey: string, bytes: ArrayBuffer, mime: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${HEYGEN_API}/v3/assets`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HeyGen upload ${heygenMessage(res.status, text)}`);
  const assetId = (JSON.parse(text) as { data?: { asset_id?: string } })?.data?.asset_id;
  if (!assetId) throw new Error(`HeyGen не вернул asset_id: ${text.slice(0, 200)}`);
  return assetId;
}

interface CreatePayload {
  type: "avatar";
  avatar_id: string;
  aspect_ratio: string;
  resolution: string;
  background: { type: "color"; value: string };
  title?: string;
  audio_asset_id?: string;
  script?: string;
  voice_id?: string;
  engine?: { type: string };
}

async function createVideo(apiKey: string, payload: CreatePayload): Promise<{ videoId: string; engine: string }> {
  const post = async (p: CreatePayload) => {
    const res = await fetch(`${HEYGEN_API}/v3/videos`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(p),
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  };

  // Движок не задаём: HeyGen сам берёт свой дефолт (сейчас Avatar IV). Но
  // студийные аватары старого поколения его не поддерживают и отвечают ровно
  // одной ошибкой — по ней и переключаемся на Avatar III. Захардкодить III
  // сразу нельзя: тогда новые аватары не получат актуальный движок.
  let r = await post(payload);
  let engine = "default";
  if (!r.ok && /avatar iv/i.test(r.text)) {
    r = await post({ ...payload, engine: { type: "avatar_iii" } });
    engine = "avatar_iii";
  }
  if (!r.ok) throw new Error(`HeyGen create ${heygenMessage(r.status, r.text)}`);

  const videoId = (JSON.parse(r.text) as { data?: { video_id?: string } })?.data?.video_id;
  if (!videoId) throw new Error(`HeyGen не вернул video_id: ${r.text.slice(0, 200)}`);
  return { videoId, engine };
}

interface VideoStatus { status?: string; video_url?: string; duration?: number; failure_message?: string; failure_code?: string }

async function pollVideo(apiKey: string, videoId: string): Promise<VideoStatus> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    let data: VideoStatus | null = null;
    try {
      const res = await fetch(`${HEYGEN_API}/v3/videos/${encodeURIComponent(videoId)}`, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      });
      if (res.ok) data = (JSON.parse(await res.text()) as { data?: VideoStatus })?.data ?? null;
    } catch { /* сетевой сбой поллинга — не повод бросать рендер, пробуем снова */ }
    if (!data) continue;
    if (data.status === "completed") return data;
    if (data.status === "failed") {
      throw new Error(`HeyGen не собрал клип: ${data.failure_message ?? data.failure_code ?? "неизвестная причина"}`);
    }
  }
  throw new Error("HeyGen не отдал клип за 8 минут");
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const avatarId = String(body.avatarId ?? process.env.HEYGEN_AVATAR_ID ?? "").trim();
    if (!avatarId) {
      return NextResponse.json({ ok: false, error: "Не задан avatarId (или HEYGEN_AVATAR_ID)" }, { status: 400 });
    }

    const audioUrlRaw = String(body.audioUrl ?? "").trim();
    const script = String(body.script ?? "").trim();
    const voiceId = String(body.voiceId ?? process.env.HEYGEN_VOICE_ID ?? "").trim();
    const allowTtsFallback = body.allowTtsFallback === true;
    if (!audioUrlRaw && !script) {
      return NextResponse.json({ ok: false, error: "Нужен audioUrl или script" }, { status: 400 });
    }

    const bgColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bgColor ?? "")) ? String(body.bgColor) : "#0f1117";
    const resolution = body.resolution === "720p" ? "720p" : "1080p";

    const base: CreatePayload = {
      type: "avatar",
      avatar_id: avatarId,
      // Всегда вертикаль: клип ложится в наш 1080×1920 кадр целиком (сегмент)
      // либо кропается в круг (врезка) — в обоих случаях горизонталь означала
      // бы потерю половины головы.
      aspect_ratio: "9:16",
      resolution,
      // Сплошной фон под цвет ролика: в полнокадровом сегменте он становится
      // фоном сцены, во врезке — виден вокруг лица внутри кружка.
      background: { type: "color", value: bgColor },
      title: `mr-avatar-${Date.now()}`,
    };

    let audioSource: "ours" | "heygen" = "ours";
    let created: { videoId: string; engine: string };

    if (audioUrlRaw) {
      // Наш файл лежит на нашем же origin — оркестратор передаёт относительный
      // путь ровно так же, как на шаге транскрипции.
      const abs = audioUrlRaw.startsWith("http")
        ? audioUrlRaw
        : `${new URL(req.url).origin}${audioUrlRaw.startsWith("/") ? "" : "/"}${audioUrlRaw}`;
      const audioRes = await fetch(abs);
      if (!audioRes.ok) throw new Error(`Не удалось скачать озвучку (${audioRes.status}) для аватара`);
      const bytes = await audioRes.arrayBuffer();
      if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Озвучка больше 32 МБ — HeyGen такой ассет не примет");
      const mime = audioRes.headers.get("content-type") ?? "audio/mpeg";
      const ext = mime.includes("wav") ? "wav" : "mp3";

      try {
        const assetId = await uploadAudio(apiKey, bytes, mime, `voiceover.${ext}`);
        created = await createVideo(apiKey, { ...base, audio_asset_id: assetId });
      } catch (e) {
        // Автоопределение возможностей тарифа: если аудио-вход не принят,
        // единственная работающая альтернатива — TTS самого HeyGen, но это
        // уже ДРУГОЙ голос, поэтому по умолчанию мы лучше останемся без
        // аватара, чем подменим голос бренда молча.
        if (!allowTtsFallback || !script) throw e;
        console.warn(`[avatar-clip] аудио-вход отклонён (${e instanceof Error ? e.message : e}), откат на TTS HeyGen`);
        created = await createVideo(apiKey, { ...base, script, ...(voiceId ? { voice_id: voiceId } : {}) });
        audioSource = "heygen";
      }
    } else {
      created = await createVideo(apiKey, { ...base, script, ...(voiceId ? { voice_id: voiceId } : {}) });
      audioSource = "heygen";
    }

    const done = await pollVideo(apiKey, created.videoId);
    if (!done.video_url) throw new Error("HeyGen отдал completed без ссылки на видео");

    // Копируем к себе: ссылка HeyGen presigned и протухает, а Remotion тянет
    // файл десятками range-запросов на протяжении всего рендера.
    const fileRes = await fetch(done.video_url);
    if (!fileRes.ok) throw new Error(`Не удалось скачать клип аватара: ${fileRes.status}`);
    const mp4 = Buffer.from(await fileRes.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "avatar-clips");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${created.videoId}.mp4`), mp4);

    await access.log({ endpoint: "generate-avatar-clip", model: `heygen-${created.engine}`, success: true, durationMs: Date.now() - t0 });

    return NextResponse.json({
      ok: true,
      data: {
        url: `/api/static-asset/avatar-clips/${created.videoId}.mp4`,
        videoId: created.videoId,
        durationSec: typeof done.duration === "number" ? done.duration : null,
        sizeBytes: mp4.byteLength,
        /** "ours" — губы синхронны нашей озвучке; "heygen" — голос чужой. */
        audioSource,
        engine: created.engine,
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await access.log({ endpoint: "generate-avatar-clip", model: "heygen", success: false, errorMessage: msg.slice(0, 500), durationMs: Date.now() - t0 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
