/**
 * POST /api/heygen-create-digital-twin
 *
 * Создаёт видео-аватара (Digital Twin) по официальному контракту HeyGen v3
 * (developers.heygen.com/reference/create-avatar):
 *
 *   POST /v3/avatars
 *   { "type": "digital_twin", "name": "...",
 *     "file": { "type": "asset_id", "asset_id": "..." } }
 *
 * ВАЖНО: consent-видео при создании НЕ передаётся — это отдельный шаг
 * POST /v3/avatars/{group_id}/consent (см. /api/heygen-avatar-consent).
 * Предыдущая версия этого роута слала consent-поля прямо в /v3/avatars
 * «наугад» в десятке вариантов имён — HeyGen такой контракт никогда не
 * поддерживал, поэтому создание своих аватаров не работало вовсе.
 *
 * Body (JSON; файл уже загружен через /api/heygen-upload-video → asset_id):
 *   name             — имя аватара
 *   trainingAssetId  — asset_id тренировочного видео (приоритет)
 *   trainingAssetUrl — публичный URL тренировочного видео (фолбэк)
 *
 * Response: { ok, data: { heygenAvatarId, groupId, name, status, consentStatus } }
 *   status: processing | pending_consent | failed | completed
 *   Дальше фронт ведёт юзера на шаг согласия (heygen-avatar-consent).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { heygenMessage } from "@/lib/heygen-avatar";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AvatarItem {
  id?: string;
  name?: string;
  status?: string;
  preview_image_url?: string | null;
  error?: { code?: string; message?: string } | null;
}
interface AvatarGroup {
  id?: string;
  consent_status?: string | null;
  status?: string | null;
}

export async function POST(req: Request) {
  // Auth обязателен: создание Digital Twin — платная операция HeyGen.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim() || "Мой видео-аватар";
    const trainingAssetId = String(body.trainingAssetId ?? "").trim();
    const trainingAssetUrl = String(body.trainingAssetUrl ?? "").trim();

    if (!trainingAssetId && !trainingAssetUrl) {
      return NextResponse.json({ ok: false, error: "Тренировочное видео не загружено (нет asset_id)" }, { status: 400 });
    }

    const res = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: "digital_twin",
        name,
        file: trainingAssetId
          ? { type: "asset_id", asset_id: trainingAssetId }
          : { type: "url", url: trainingAssetUrl },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      const human = heygenMessage(res.status, text);
      let hint = "";
      if (res.status === 401 || res.status === 403) {
        hint = " — Digital Twin доступен только на платных тарифах HeyGen.";
      } else if (/duration|too short|2 min|720/i.test(human)) {
        hint = " — тренировочное видео должно быть ≥ 2 минут, разрешение 720p+.";
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${human}${hint}`, debug: text.slice(0, 500) },
        { status: 500 },
      );
    }

    let parsed: { data?: { avatar_item?: AvatarItem; avatar_group?: AvatarGroup } } = {};
    try { parsed = JSON.parse(text); } catch { /* ниже отработает проверка на id */ }
    const item = parsed.data?.avatar_item;
    const group = parsed.data?.avatar_group;

    if (!item?.id) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул avatar id: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }
    if (item.status === "failed") {
      return NextResponse.json(
        { ok: false, error: `HeyGen отклонил видео: ${item.error?.message ?? item.error?.code ?? "причина не указана"}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId: item.id,
        /** group id — нужен фронту для шага согласия и проверки статуса. */
        groupId: group?.id ?? null,
        name: item.name ?? name,
        status: item.status ?? "processing",
        consentStatus: group?.consent_status ?? null,
        previewUrl: item.preview_image_url ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
