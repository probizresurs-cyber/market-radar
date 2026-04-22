import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSubscription } from "@/lib/subscription";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const sub = await getSubscription(session.userId);
    if (!sub) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      plan: sub.plan,
      planStartedAt: sub.planStartedAt,
      planExpiresAt: sub.planExpiresAt,
      tokensUsed: sub.tokensUsed,
      tokensLimit: sub.tokensLimit,
      tokensLeft: sub.tokensLeft,
      daysLeft: sub.daysLeft,
      hoursLeft: sub.hoursLeft,
      totalHoursLeft: sub.totalHoursLeft,
      msLeft: sub.msLeft,
      hasAccess: sub.hasAccess,
      isExpired: sub.isExpired,
      isExhausted: sub.isExhausted,
      // Referral bonus details (only populated when user signed up via ?ref=<code>)
      referralCode: sub.referralCode,
      discountPct: sub.discountPct,
      discountExpiresAt: sub.discountExpiresAt,
      discountMonths: sub.discountMonths,
      // Admin-ы фактически не ограничены (checkAiAccess их пропускает)
      isAdmin: session.role === "admin",
    });
  } catch (e) {
    console.error("subscription route error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
