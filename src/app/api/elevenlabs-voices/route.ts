/**
 * GET /api/elevenlabs-voices
 *
 * Возвращает список голосов из библиотеки ElevenLabs:
 * - /v1/voices         — голоса аккаунта (включая клонированные)
 * - /v1/voices/shared  — shared library (публичная, тысячи голосов)
 *
 * ?type=my        — только голоса аккаунта (default)
 * ?type=shared    — shared library (первые 50 по популярности)
 * ?type=all       — объединённый список (my + shared)
 * ?search=text    — фильтр по названию (только для shared, API поддерживает)
 *
 * Используется в admin/promo-reels для выбора голоса из дропдауна
 * вместо ручного ввода Voice ID.
 */
import { NextResponse } from "next/server";
import { ELEVENLABS_API_KEY, ELEVENLABS_BASE_URL } from "@/lib/elevenlabs";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;    // "premade" | "cloned" | "generated"
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>; // { accent, age, gender, use_case, ... }
  sharing?: { status?: string };
}

interface SharedVoice {
  voice_id: string;
  name: string;
  description?: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ ok: false, error: "ELEVENLABS_API_KEY не настроен" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "my";
  const search = searchParams.get("search") ?? "";

  const headers = {
    "xi-api-key": ELEVENLABS_API_KEY,
    Accept: "application/json",
  };

  try {
    // Голоса аккаунта (my + premade по умолчанию включены)
    let myVoices: ElevenVoice[] = [];
    if (type === "my" || type === "all") {
      const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices`, { headers });
      if (res.ok) {
        const data = await res.json() as { voices?: ElevenVoice[] };
        myVoices = (data.voices ?? []).map(v => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category ?? "premade",
          description: v.description,
          preview_url: v.preview_url,
          labels: v.labels,
        }));
      }
    }

    // Shared library — первые страницы популярных голосов
    let sharedVoices: ElevenVoice[] = [];
    if (type === "shared" || type === "all") {
      // ElevenLabs shared library endpoint: /v1/voices/shared?page_size=N&search=...&language=ru
      const params = new URLSearchParams({
        page_size: "100",
        sort: "trending",
      });
      if (search) params.set("search", search);
      const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices/shared?${params}`, { headers });
      if (res.ok) {
        const data = await res.json() as { voices?: SharedVoice[] };
        sharedVoices = (data.voices ?? []).map(v => ({
          voice_id: v.voice_id,
          name: v.name,
          category: "shared",
          description: v.description,
          preview_url: v.preview_url,
          labels: v.labels,
        }));
      }
    }

    // Объединяем, дедуплицируем по voice_id
    const seen = new Set<string>();
    const voices = [...myVoices, ...sharedVoices].filter(v => {
      if (seen.has(v.voice_id)) return false;
      seen.add(v.voice_id);
      return true;
    });

    // Клиентский фильтр по имени (для my-голосов без серверного поиска)
    const filtered = search && type !== "shared"
      ? voices.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
      : voices;

    return NextResponse.json({ ok: true, voices: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
