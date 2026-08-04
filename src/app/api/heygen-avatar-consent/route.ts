/**
 * Согласие на использование внешности для Digital Twin аватара.
 *
 * HeyGen не собирает аватара, пока человек в кадре не дал согласие
 * (защита от дипфейков). Контракт v3
 * (developers.heygen.com/docs/avatar-consent):
 *
 *   POST /v3/avatars/{group_id}/consent
 *     Level 1 (доступен всем): пустое тело → HeyGen возвращает URL своей
 *       хостед-страницы, где человек записывает согласие с вебкамеры.
 *       Ссылка живёт 24 часа; протухла — просто кикнуть ещё раз.
 *     Level 2 (только whitelisted enterprise): consent_video с заранее
 *       записанным роликом. Мы пробуем его, если фронт передал asset —
 *       и автоматически откатываемся на Level 1, когда HeyGen отказывает
 *       (обычный тариф). Именно на этом ломался старый флоу: он ТРЕБОВАЛ
 *       заранее записанное consent-видео, которое обычному аккаунту HeyGen
 *       передать нельзя в принципе.
 *
 *   GET /v3/avatars/{group_id} — статус группы: consent_status + статус
 *       тренировки. Опрашивается кнопкой «Проверить статус» на фронте.
 *
 * POST body: { groupId, consentAssetId?, consentAssetUrl? }
 *   → { ok, data: { mode: "webcam", consentUrl, note? } }   — ссылка для записи
 *   → { ok, data: { mode: "video", consentStatus } }        — Level 2 принят
 *
 * GET ?groupId=...
 *   → { ok, data: { consentStatus, trainStatus } }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { heygenMessage } from "@/lib/heygen-avatar";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEYGEN_API = "https://api.heygen.com";

function headers(apiKey: string) {
  return { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

interface ConsentResponse {
  data?: {
    url?: string;
    avatar_group?: { id?: string; consent_status?: string | null; status?: string | null };
  };
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const groupId = String(body.groupId ?? "").trim();
    if (!groupId) return NextResponse.json({ ok: false, error: "groupId обязателен" }, { status: 400 });

    const consentAssetId = String(body.consentAssetId ?? "").trim();
    const consentAssetUrl = String(body.consentAssetUrl ?? "").trim();
    const endpoint = `${HEYGEN_API}/v3/avatars/${encodeURIComponent(groupId)}/consent`;

    // Level 2 — заранее записанный ролик. Пробуем, только если фронт его
    // передал; на обычном тарифе HeyGen откажет, и мы уйдём на Level 1.
    let level2Note: string | undefined;
    if (consentAssetId || consentAssetUrl) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          consent_video: consentAssetId
            ? { type: "asset_id", asset_id: consentAssetId }
            : { type: "url", url: consentAssetUrl },
        }),
      });
      const text = await res.text();
      if (res.ok) {
        let parsed: ConsentResponse = {};
        try { parsed = JSON.parse(text); } catch { /* ok — статус ниже */ }
        return NextResponse.json({
          ok: true,
          data: { mode: "video", consentStatus: parsed.data?.avatar_group?.consent_status ?? "processing" },
        });
      }
      // Не роняем весь флоу: юзеру всё равно доступен путь с вебкамерой.
      level2Note = `Готовый ролик HeyGen не принял (${heygenMessage(res.status, text).slice(0, 160)}) — этот способ доступен только enterprise-тарифам. Запишите согласие по ссылке.`;
    }

    // Level 1 — вебкам-флоу, доступен всем тарифам.
    const res = await fetch(endpoint, { method: "POST", headers: headers(apiKey), body: JSON.stringify({}) });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen consent ${res.status}: ${heygenMessage(res.status, text)}`, debug: text.slice(0, 400) },
        { status: 500 },
      );
    }
    let parsed: ConsentResponse = {};
    try { parsed = JSON.parse(text); } catch { /* проверка url ниже */ }
    const url = parsed.data?.url;
    if (!url) {
      return NextResponse.json({ ok: false, error: `HeyGen не вернул ссылку на запись согласия: ${text.slice(0, 300)}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { mode: "webcam", consentUrl: url, note: level2Note } });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });

    const groupId = new URL(req.url).searchParams.get("groupId")?.trim() ?? "";
    if (!groupId) return NextResponse.json({ ok: false, error: "groupId обязателен" }, { status: 400 });

    const res = await fetch(`${HEYGEN_API}/v3/avatars/${encodeURIComponent(groupId)}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${heygenMessage(res.status, text)}` },
        { status: 500 },
      );
    }

    let parsed: { data?: { consent_status?: string | null; status?: string | null; avatar_group?: { consent_status?: string | null; status?: string | null } } } = {};
    try { parsed = JSON.parse(text); } catch { /* отдадим null-поля */ }
    // Форма ответа встречается и плоская (data.consent_status), и вложенная
    // (data.avatar_group.consent_status) — берём что есть.
    const g = parsed.data?.avatar_group ?? parsed.data;

    return NextResponse.json({
      ok: true,
      data: {
        consentStatus: g?.consent_status ?? null,
        trainStatus: g?.status ?? null,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
