/**
 * GET /api/heygen-avatar-groups
 *
 * Список групп digital-twin аватаров аккаунта (GET /v3/avatars, ownership=private) —
 * нужен, чтобы найти group_id по имени, когда локально в customAvatars его нет
 * (аватары, созданные ДО того как heygenGroupId начал сохраняться).
 *
 * Response: { ok, data: Array<{ id, name, consentStatus, status, looksCount }> }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface AvatarGroup {
  id?: string;
  name?: string;
  consent_status?: string | null;
  status?: string | null;
  looks_count?: number;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });

    const res = await fetch("https://api.heygen.com/v3/avatars?ownership=private&limit=50", {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HeyGen ${res.status}: ${text.slice(0, 300)}` }, { status: 500 });
    }
    let parsed: { data?: AvatarGroup[] } = {};
    try { parsed = JSON.parse(text); } catch { /* пустой список ниже */ }

    return NextResponse.json({
      ok: true,
      data: (parsed.data ?? []).map((g) => ({
        id: g.id ?? "",
        name: g.name ?? "",
        consentStatus: g.consent_status ?? null,
        status: g.status ?? null,
        looksCount: g.looks_count ?? 0,
      })).filter((g) => g.id),
    });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
