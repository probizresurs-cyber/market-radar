import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";
import { profileServerSuffix, DEFAULT_PROFILE_ID } from "@/lib/profiles";

export const runtime = "nodejs";

interface DataRow { key: string; value: unknown }

// Ключи из user_data, которые попадают в публичный snapshot дашборда руководителя
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
//
// kind="dashboard" (по умолчанию) — снэпшот дашборда руководителя (все ключи).
// kind="kp" — снэпшот только company/competitors для /kp, с учётом активного
// профиля (profileId) — чтобы шеринг КП для отдельного профиля (например,
// проспект под /kp-sozdavaya) не тянул данные «Основного» профиля.
export async function POST(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }

    let body: { kind?: string; profileId?: string; pilot?: boolean | string } = {};
    try { body = await req.json(); } catch { /* тело не обязательно (дашборд шлёт пустой POST) */ }
    const kind = body.kind === "kp" ? "kp" : "dashboard";
    // pilot — слаг пилот-клиента ("sozdavaya" | "biglife"): публичная страница
    // рендерит его пилотную версию КП. true — легаси от старых ссылок sozdavaya.
    const pilot =
      body.pilot === true ? "sozdavaya"
      : body.pilot === "sozdavaya" || body.pilot === "biglife" ? body.pilot
      : null;

    const snapshot: Record<string, unknown> = {};

    if (kind === "kp") {
      const suffix = profileServerSuffix(body.profileId || DEFAULT_PROFILE_ID);
      const companyKey = `company${suffix}`;
      const competitorsKey = `competitors${suffix}`;
      const rows = await query<DataRow>(
        "SELECT key, value FROM user_data WHERE user_id = $1 AND key = ANY($2)",
        [session.userId, [companyKey, competitorsKey]]
      );
      for (const r of rows) {
        if (r.key === companyKey) snapshot.company = r.value;
        if (r.key === competitorsKey) snapshot.competitors = r.value;
      }
    } else {
      const rows = await query<DataRow>(
        "SELECT key, value FROM user_data WHERE user_id = $1 AND key = ANY($2)",
        [session.userId, SHARE_KEYS]
      );
      for (const r of rows) snapshot[r.key] = r.value;
    }

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
      kind,
      ...(pilot ? { pilot } : {}),
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
