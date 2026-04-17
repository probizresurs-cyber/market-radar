import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface DataRow { key: string; value: unknown }

// Ключи из user_data, которые попадают в публичный snapshot
const SHARE_KEYS = [
  "company",
  "competitors",
  "ta",
  "cjm",
  "benchmarks",
  "smm",
  "content",
  "brandbook",
  "brandsug",
  "stories",
];

// Создаёт новый public_share со снэпшотом текущих анализов пользователя.
// Каждый клик = новая ссылка с новым UUID.
// Возвращает id (UUID) — публичная ссылка /share/[id].
export async function POST() {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }

    const rows = await query<DataRow>(
      "SELECT key, value FROM user_data WHERE user_id = $1 AND key = ANY($2)",
      [session.userId, SHARE_KEYS]
    );
    const snapshot: Record<string, unknown> = {};
    for (const r of rows) snapshot[r.key] = r.value;

    if (!snapshot.company) {
      return NextResponse.json(
        { ok: false, error: "Сначала запустите анализ компании — без него нечего шерить" },
        { status: 400 }
      );
    }

    // meta для отображения кому принадлежит ссылка
    snapshot._meta = {
      sharedAt: new Date().toISOString(),
      ownerUserId: session.userId,
    };

    const id = randomUUID();
    await query(
      `INSERT INTO public_shares (id, user_id, snapshot, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [id, session.userId, JSON.stringify(snapshot)]
    );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("share/create error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
