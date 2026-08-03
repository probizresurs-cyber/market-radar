/**
 * GET /api/generate-avatar-clip/status?videoId=...
 *
 * Опрашивается СНАРУЖИ — оркестратор зовёт этот роут раз в несколько секунд
 * короткими запросами вместо одного долгого. См. шапку generate-avatar-clip
 * для причины: держать один HTTP-запрос открытым минутами ловит обрыв на
 * ~300-й секунде даже по loopback, потому что `next start` без кастомного
 * server.js не соблюдает наш maxDuration — это чисто вercelская настройка,
 * а реальный лимit держит сам Node.
 *
 * Returns:
 *   { ok, data: { done: false } }                             — ещё рендерится
 *   { ok, data: { done: true, url, durationSec, sizeBytes } }  — готово, скачано локально
 *   { ok: false, error }                                       — HeyGen сообщил о провале
 *
 * url — /api/static-asset/avatar-clips/{videoId}.mp4 (локальная копия:
 * ссылка HeyGen presigned и живёт недолго, а Remotion тянет файл покадрово).
 * Скачивание — тоже best-effort здесь: если сеть моргнёт на этом опросе,
 * следующий вызов status просто попробует скачать снова, HeyGen ссылку не
 * инвалидирует между опросами.
 */
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 30;

const HEYGEN_API = "https://api.heygen.com";

interface VideoStatus { status?: string; video_url?: string; duration?: number; failure_message?: string; failure_code?: string }

/**
 * POST дублирует GET с тем же videoId в теле — оркестраторный callLocal
 * умеет только POST (у него нет варианта для GET-запросов с телом-пустышкой),
 * а заводить для одного вызова отдельный HTTP-клиент не хотелось.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return handleStatus(req, String(body.videoId ?? "").trim());
}

export async function GET(req: Request) {
  return handleStatus(req, new URL(req.url).searchParams.get("videoId")?.trim() ?? "");
}

async function handleStatus(req: Request, videoId: string) {
  // countUsage:false — этот роут опрашивается раз в 5 сек несколько минут,
  // не должен в одиночку сжирать дневной лимит 100 AI-запросов (см. опцию
  // в with-ai-security.ts).
  const access = await checkAiAccess(req, { countUsage: false });
  if (!access.allowed) return access.response;

  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });

    if (!videoId) return NextResponse.json({ ok: false, error: "videoId обязателен" }, { status: 400 });

    const res = await fetch(`${HEYGEN_API}/v3/videos/${encodeURIComponent(videoId)}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      // Сетевой/HeyGen-сбой на КОНКРЕТНОМ опросе — не приговор всему рендеру,
      // оркестратор просто спросит снова на следующем тике.
      return NextResponse.json({ ok: true, data: { done: false } });
    }
    const data = ((await res.json()) as { data?: VideoStatus })?.data ?? null;
    if (!data || (data.status !== "completed" && data.status !== "failed")) {
      return NextResponse.json({ ok: true, data: { done: false } });
    }
    if (data.status === "failed") {
      return NextResponse.json(
        { ok: false, error: `HeyGen не собрал клип: ${data.failure_message ?? data.failure_code ?? "неизвестная причина"}` },
        { status: 200 },
      );
    }
    if (!data.video_url) {
      return NextResponse.json({ ok: false, error: "HeyGen отдал completed без ссылки на видео" });
    }

    const fileRes = await fetch(data.video_url);
    if (!fileRes.ok) {
      // Presigned-ссылка может отвечать не с первого раза — не финальная
      // ошибка, следующий опрос попробует скачать снова.
      return NextResponse.json({ ok: true, data: { done: false } });
    }
    const mp4 = Buffer.from(await fileRes.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "avatar-clips");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${videoId}.mp4`), mp4);

    await access.log({ endpoint: "generate-avatar-clip-status", model: "heygen", success: true });

    return NextResponse.json({
      ok: true,
      data: {
        done: true,
        url: `/api/static-asset/avatar-clips/${videoId}.mp4`,
        durationSec: typeof data.duration === "number" ? data.duration : null,
        sizeBytes: mp4.byteLength,
      },
    });
  } catch (e) {
    // Сбой самого опроса (не HeyGen-ответ) — тоже не финал, пробуем снова.
    return NextResponse.json({ ok: true, data: { done: false, transientError: e instanceof Error ? e.message : String(e) } });
  }
}
