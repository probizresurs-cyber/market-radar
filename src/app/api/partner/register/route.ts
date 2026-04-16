import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";
import { getCommissionRate } from "@/lib/partner-types";
import type { PartnerType } from "@/lib/partner-types";

export const runtime = "nodejs";

function genReferralCode(): string {
  // 6-char alphanumeric code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST — register as partner
// Body: { type: "referral" | "integrator", company_name?, website?, description? }
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  // Check if already a partner
  const existing = await query("SELECT id FROM partners WHERE user_id = $1", [session.userId]);
  if (existing.length > 0) {
    return NextResponse.json({ ok: false, error: "Вы уже зарегистрированы как партнёр" }, { status: 400 });
  }

  const body = await req.json();
  const partnerType: PartnerType = body.type === "integrator" ? "integrator" : "referral";
  const rate = getCommissionRate(partnerType, 0);

  // Generate unique referral code
  let referralCode = genReferralCode();
  for (let attempts = 0; attempts < 10; attempts++) {
    const dup = await query("SELECT id FROM partners WHERE referral_code = $1", [referralCode]);
    if (dup.length === 0) break;
    referralCode = genReferralCode();
  }

  const id = randomUUID();
  await query(
    `INSERT INTO partners (id, user_id, type, status, referral_code, commission_rate, company_name, website, description)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)`,
    [
      id,
      session.userId,
      partnerType,
      referralCode,
      rate,
      body.company_name || null,
      body.website || null,
      body.description || null,
    ]
  );

  return NextResponse.json({
    ok: true,
    partner: { id, type: partnerType, status: "pending", referral_code: referralCode, commission_rate: rate },
  });
}
