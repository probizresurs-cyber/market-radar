import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";

// Публичная шер-ссылка КП: /kp-share/<token>, гейт по простому паролю.
// GET  — есть ли КП и его название (для показа формы пароля, без утечки данных).
// POST { password } — при верном пароле отдаёт bundle + company для рендера.
export const runtime = "nodejs";

interface Row {
  status: string; company_name: string | null; share_password: string | null;
  bundle: PilotBundle | null; company: AnalysisResult | null; locale: string; url: string;
  rebuild_status: string | null; rebuild_id: string | null; client_email: string | null; client_tg_code: string | null;
}

const TG_BOT_USERNAME = "market_radar1_bot";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;
  const rows = await query<Row>(
    "SELECT status, company_name, locale FROM kp_generations WHERE share_token = $1",
    [token],
  );
  const r = rows[0];
  if (!r || r.status !== "done") {
    // locale отдаём даже в 404-ветке (если строка вообще нашлась) — иначе
    // клиент не знает, на каком языке показать «ссылка недоступна».
    return NextResponse.json({ ok: false, error: "Ссылка недоступна", locale: r?.locale ?? null }, { status: 404 });
  }
  return NextResponse.json({ ok: true, companyName: r.company_name, locale: r.locale });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;

  // Антиперебор пароля: по токену, 15 попыток / 15 мин.
  const rl = checkRateLimit(token, { keyPrefix: "kp-share", maxRequests: 15, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Слишком много попыток. Подождите." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password.trim() : "";

  const rows = await query<Row>("SELECT * FROM kp_generations WHERE share_token = $1", [token]);
  const r = rows[0];
  if (!r || r.status !== "done" || !r.bundle || !r.company) {
    return NextResponse.json({ ok: false, error: "Ссылка недоступна" }, { status: 404 });
  }
  if (!r.share_password || password.toLowerCase() !== r.share_password.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }

  // Счётчик просмотров (best-effort).
  query("UPDATE kp_generations SET views = views + 1 WHERE share_token = $1", [token]).catch(() => {});

  return NextResponse.json({
    ok: true,
    companyName: r.company_name,
    locale: r.locale,
    url: r.url,
    company: r.company,
    bundle: r.bundle,
    rebuildStatus: r.rebuild_status,
    clientEmail: r.client_email,
    tgConnectUrl: r.client_tg_code ? `https://t.me/${TG_BOT_USERNAME}?start=${r.client_tg_code}` : null,
    // Ссылка на готовый сайт прямо в КП — третий канал доставки после email и TG.
    siteReadyUrl: r.rebuild_status === "sent" && r.rebuild_id
      ? `/site-ready/${r.rebuild_id}?locale=${r.locale === "de" ? "de" : "ru"}`
      : null,
  });
}
