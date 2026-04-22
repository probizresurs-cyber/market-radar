import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";
import { randomUUID } from "crypto";
import { logActivity } from "@/lib/activity-log";
import { sanitizeHtml } from "@/lib/sanitize";
import { TRIAL_TOKEN_LIMIT, TRIAL_DAYS } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await initDb();
    const { name, email, password, consent } = await req.json();
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Некорректные данные" }, { status: 400 });
    }
    if (consent !== true) {
      return NextResponse.json(
        { ok: false, error: "Необходимо согласие на обработку персональных данных" },
        { status: 400 },
      );
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "Email уже зарегистрирован" }, { status: 400 });
    }

    // ─── Referral link bonus lookup (before INSERT, so trial_days can apply) ──
    const cookieStore = await cookies();
    const refCode = cookieStore.get("mr_ref")?.value;
    const refTs = cookieStore.get("mr_ref_ts")?.value;

    let bonusTrialDays = TRIAL_DAYS;
    let referralCodeApplied: string | null = null;
    let discountPct = 0;
    let discountMonths = 0;
    let referralLinkId: string | null = null;

    if (refCode) {
      const refRows = await query<{
        id: string; code: string; trial_days: number;
        discount_pct: number; discount_months: number;
        valid_to: string | null; max_uses: number | null;
        used_count: number; is_active: boolean;
      }>(
        `SELECT id, code, trial_days, discount_pct, discount_months,
                valid_to, max_uses, used_count, is_active
         FROM referral_links WHERE code = $1`,
        [refCode.toUpperCase()],
      );
      if (refRows.length > 0) {
        const link = refRows[0];
        const notExpired = !link.valid_to || new Date(link.valid_to).getTime() > Date.now();
        const underCap = link.max_uses == null || link.used_count < link.max_uses;
        if (link.is_active && notExpired && underCap) {
          bonusTrialDays = Math.max(bonusTrialDays, link.trial_days);
          discountPct = link.discount_pct;
          discountMonths = link.discount_months;
          referralCodeApplied = link.code;
          referralLinkId = link.id;
        }
      }
    }

    const safeName = name ? sanitizeHtml(name) : null;
    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    const consentIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Discount expires at: trial_end + discount_months. If no discount, pass 0
    // months and the CASE WHEN below sets the column to NULL.
    await query(
      `INSERT INTO users
         (id, email, password_hash, name, role,
          plan, plan_started_at, plan_expires_at, tokens_used, tokens_limit,
          referral_code, discount_pct, discount_expires_at,
          consent_accepted_at, consent_ip)
       VALUES (
         $1, $2, $3, $4, $5,
         'trial', NOW(), NOW() + ($6 || ' days')::INTERVAL, 0, $7,
         $8, $9,
         CASE WHEN $9 > 0 AND $10 > 0
              THEN NOW() + ($6 || ' days')::INTERVAL + ($10 || ' months')::INTERVAL
              ELSE NULL
         END,
         NOW(), $11
       )`,
      [
        id, email.toLowerCase(), passwordHash, safeName, "user",
        String(bonusTrialDays), TRIAL_TOKEN_LIMIT,
        referralCodeApplied, discountPct, String(discountMonths),
        consentIp,
      ],
    );

    // Count the referral link usage (fire-and-forget — don't block signup on this)
    if (referralLinkId) {
      await query(
        `UPDATE referral_links SET used_count = used_count + 1 WHERE id = $1`,
        [referralLinkId],
      );
    }

    // ─── Partner attribution (First-Touch) ──────────────────────────────────
    if (refCode) {
      // Find active partner by referral_code (independent of referral_links)
      const partnerRows = await query<{ id: string }>(
        "SELECT id FROM partners WHERE referral_code = $1 AND status = 'active'",
        [refCode]
      );
      if (partnerRows.length > 0) {
        const partnerId = partnerRows[0].id;
        await query(
          `INSERT INTO partner_clients (id, partner_id, client_user_id, attributed_at, cookie_set_at)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (client_user_id) DO NOTHING`,
          [
            randomUUID(),
            partnerId,
            id,
            refTs ? new Date(Number(refTs)).toISOString() : null,
          ]
        );
      }
    }

    const token = await signToken({ userId: id, email: email.toLowerCase(), role: "user" });
    const cookie = setTokenCookie(token);
    const res = NextResponse.json({ ok: true, user: { id, name, email: email.toLowerCase(), role: "user" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);

    // Clear referral cookies after attribution
    if (refCode) {
      res.cookies.set("mr_ref", "", { maxAge: 0, path: "/" });
      res.cookies.set("mr_ref_ts", "", { maxAge: 0, path: "/" });
    }

    // Audit log (reuse consentIp captured earlier)
    await logActivity({ userId: id, action: "register", entityType: "user", entityId: id, ipAddress: consentIp, userAgent: req.headers.get("user-agent") });

    return res;
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
