import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Лёгкий эндпоинт для клиентского pixel-tracking визитов.
// Пишет в уже существующую таблицу activity_logs с action='visit'.
// Поддерживает source='landing' и source='platform'.
export async function POST(req: Request) {
  try {
    await initDb();
    const body = await req.json().catch(() => ({})) as {
      source?: "landing" | "platform";
      path?: string;
      referrer?: string;
      utm?: Record<string, string>;
    };
    const source = body.source === "platform" ? "platform" : "landing";
    const path = (body.path ?? "/").slice(0, 300);
    const referrer = (body.referrer ?? "").slice(0, 300);
    const utm = body.utm ?? {};

    const session = await getSessionUser().catch(() => null);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("x-real-ip")
      || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    await query(
      `INSERT INTO activity_logs
         (id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, 'visit', $3, NULL, $4, $5, $6)`,
      [
        randomUUID(),
        session?.userId ?? null,
        source,
        JSON.stringify({ path, referrer, utm }),
        ip,
        userAgent,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Никогда не падаем — tracking не критичен
    console.error("track-visit error", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
