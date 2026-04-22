import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// Public endpoint: given a referral code (from ?ref=<code> on /register),
// return bonus details for display. Does NOT increment used_count — that
// happens only after a real registration in /api/auth/register.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });

  await initDb();
  const rows = await query<{
    code: string;
    name: string;
    trial_days: number;
    discount_pct: number;
    discount_months: number;
    valid_to: string | null;
    max_uses: number | null;
    used_count: number;
    is_active: boolean;
  }>(
    `SELECT code, name, trial_days, discount_pct, discount_months,
            valid_to, max_uses, used_count, is_active
     FROM referral_links WHERE code = $1`,
    [code],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Код не найден" }, { status: 404 });
  }
  const link = rows[0];
  if (!link.is_active) {
    return NextResponse.json({ ok: false, error: "Ссылка отключена" }, { status: 410 });
  }
  if (link.valid_to && new Date(link.valid_to).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Срок действия ссылки истёк" }, { status: 410 });
  }
  if (link.max_uses != null && link.used_count >= link.max_uses) {
    return NextResponse.json({ ok: false, error: "Лимит использований исчерпан" }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    link: {
      code: link.code,
      name: link.name,
      trialDays: link.trial_days,
      discountPct: link.discount_pct,
      discountMonths: link.discount_months,
    },
  });
}
