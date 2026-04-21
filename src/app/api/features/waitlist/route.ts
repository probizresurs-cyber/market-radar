import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Пользователь нажимает "Уведомить меня" на заглушке отключённого модуля —
// сохраняем запись в feature_waitlist. Подходит как для авторизованных
// (user_id), так и для гостей (только email).
export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json().catch(() => ({})) as {
      featureId?: string;
      email?: string;
      note?: string;
    };
    const featureId = (body.featureId ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const note = (body.note ?? "").trim().slice(0, 500);

    if (!featureId) {
      return NextResponse.json({ ok: false, error: "featureId обязателен" }, { status: 400 });
    }

    // Проверяем, что модуль существует
    const feat = await query<{ id: string }>(`SELECT id FROM features WHERE id = $1`, [featureId]);
    if (feat.length === 0) {
      return NextResponse.json({ ok: false, error: "Модуль не найден" }, { status: 404 });
    }

    const session = await getSessionUser().catch(() => null);
    const userId = session?.userId ?? null;

    // Если есть user_id — ON CONFLICT обновит только note/email.
    // Гости дают email, уникальность по email не гарантируем (дубликаты OK).
    if (userId) {
      await query(
        `INSERT INTO feature_waitlist (id, feature_id, user_id, email, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (feature_id, user_id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, feature_waitlist.email),
           note  = COALESCE(EXCLUDED.note,  feature_waitlist.note)`,
        [randomUUID(), featureId, userId, email || null, note || null]
      );
    } else {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "Укажите корректный email" }, { status: 400 });
      }
      await query(
        `INSERT INTO feature_waitlist (id, feature_id, user_id, email, note)
         VALUES ($1, $2, NULL, $3, $4)`,
        [randomUUID(), featureId, email, note || null]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist POST error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
