import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { enqueueKp, tick } from "@/lib/kp-queue";
import type { KpLocale } from "@/lib/kp-generate";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST { urls: string[], locale } — ставит генерации КП в очередь.
// Только менеджер (гейт /kp-ru, /kp-de).
export async function POST(req: Request) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const body = await req.json().catch(() => ({}));
  const locale: KpLocale = body.locale === "de" ? "de" : "ru";
  const raw: unknown = body.urls ?? body.url;
  const list = (Array.isArray(raw) ? raw : [raw])
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((u) => {
      const t = u.trim();
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    })
    .slice(0, 20);

  if (list.length === 0) {
    return NextResponse.json({ ok: false, error: "Укажите хотя бы одну ссылку" }, { status: 400 });
  }

  const ids: string[] = [];
  for (const url of list) ids.push(await enqueueKp(url, locale));
  void tick();
  return NextResponse.json({ ok: true, ids, queued: ids.length });
}
