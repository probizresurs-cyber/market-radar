/**
 * /api/keyso/refresh — обновить только Keys.so-данные для домена
 *
 * Возвращает:
 *   - keysoDashboard: { yandex?, google? }   ← нужный shape для AnalysisResult
 *   - positions:      SeoPosition[]          ← Yandex позиции (для блока ключевые слова)
 *   - googlePositions: SeoPosition[]
 *
 * Используется кнопкой «Обновить» в KeysoDashboardBlock — без перезапуска
 * полного анализа компании.
 */
import { NextResponse } from "next/server";
import { getKeysoKeywords } from "@/lib/enricher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { domain } = await req.json() as { domain: string };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    const keyso = await getKeysoKeywords(domain);
    if (!keyso) {
      return NextResponse.json(
        { ok: false, error: "Keys.so не вернул данных. Проверьте токен или подписку." },
        { status: 502 }
      );
    }

    // Конвертируем в shape AnalysisResult.keysoDashboard
    const yandexDash = keyso.dashboard?.yandex
      ? { ...keyso.dashboard.yandex } as Record<string, unknown>
      : undefined;
    const googleDash = keyso.dashboard?.google
      ? { ...keyso.dashboard.google } as Record<string, unknown>
      : undefined;

    return NextResponse.json({
      ok: true,
      keysoDashboard: {
        yandex: yandexDash,
        google: googleDash,
      },
      positions: keyso.yandex,
      googlePositions: keyso.google,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
