/**
 * Subscription / Token limits for user plans.
 *
 * Phase 1: only the trial plan is supported.
 *   — New users get 100 000 tokens for 7 days.
 *   — Every AI call logged through `checkAiAccess` increments `tokens_used`.
 *   — When `tokens_used >= tokens_limit` OR `plan_expires_at < NOW()`, access is blocked.
 *
 * Paid plans will be added in Phase 2 via the `pricing_items.limits` JSON column.
 */

import { query } from "./db";

export const TRIAL_TOKEN_LIMIT = 100_000;
export const TRIAL_DAYS = 7;

export interface Subscription {
  userId: string;
  plan: string;               // 'trial' | 'free' | <pricing_item id> …
  planStartedAt: Date | null;
  planExpiresAt: Date | null;
  tokensUsed: number;
  tokensLimit: number;
  // Derived
  daysLeft: number;           // целые дни (floor); 0 если истёк или <24ч осталось
  hoursLeft: number;          // остаток часов в последнем неполном дне (0–23)
  totalHoursLeft: number;     // общее кол-во часов до истечения (для <1 дня)
  msLeft: number;             // миллисекунды до истечения (для точных расчётов на фронте)
  tokensLeft: number;         // tokens_limit - tokens_used, не ниже 0
  hasAccess: boolean;         // false если истёк или лимит выбран
  isExpired: boolean;
  isExhausted: boolean;
  // Referral bonus (from admin-generated referral_links applied at signup).
  // If the user signed up via ?ref=<code>, these carry the bonus details so the
  // UI can surface "30 дней бесплатно + 50% на 12 мес." instead of the generic trial copy.
  referralCode: string | null;
  discountPct: number;              // 0 if no discount
  discountExpiresAt: Date | null;   // when the post-trial discount window ends
  discountMonths: number;           // rounded integer months from trial end to discountExpiresAt
}

interface UserRow {
  id: string;
  plan: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  tokens_used: number;
  tokens_limit: number;
  referral_code: string | null;
  discount_pct: number | null;
  discount_expires_at: string | null;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const rows = await query<UserRow>(
    `SELECT id, plan, plan_started_at, plan_expires_at, tokens_used, tokens_limit,
            referral_code, discount_pct, discount_expires_at
       FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const u = rows[0];

  const now = Date.now();
  const expiresAt = u.plan_expires_at ? new Date(u.plan_expires_at) : null;
  const startedAt = u.plan_started_at ? new Date(u.plan_started_at) : null;

  const tokensUsed = Number(u.tokens_used) || 0;
  const tokensLimit = Number(u.tokens_limit) || 0;
  const tokensLeft = Math.max(0, tokensLimit - tokensUsed);

  const isExpired = !!expiresAt && expiresAt.getTime() < now;
  const isExhausted = tokensLimit > 0 && tokensUsed >= tokensLimit;

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  const msLeft = expiresAt ? Math.max(0, expiresAt.getTime() - now) : 0;
  const daysLeft = Math.floor(msLeft / DAY);
  const hoursLeft = Math.floor((msLeft % DAY) / HOUR);
  const totalHoursLeft = Math.floor(msLeft / HOUR);

  const discountPct = Number(u.discount_pct) || 0;
  const discountExpiresAt = u.discount_expires_at ? new Date(u.discount_expires_at) : null;
  // Rough months between trial-end and discount-end — for display only ("50% × 12 мес.")
  let discountMonths = 0;
  if (discountExpiresAt && expiresAt && discountExpiresAt.getTime() > expiresAt.getTime()) {
    const ms = discountExpiresAt.getTime() - expiresAt.getTime();
    discountMonths = Math.round(ms / (30 * DAY));
  }

  return {
    userId: u.id,
    plan: u.plan,
    planStartedAt: startedAt,
    planExpiresAt: expiresAt,
    tokensUsed,
    tokensLimit,
    daysLeft,
    hoursLeft,
    totalHoursLeft,
    msLeft,
    tokensLeft,
    hasAccess: !isExpired && !isExhausted,
    isExpired,
    isExhausted,
    referralCode: u.referral_code || null,
    discountPct,
    discountExpiresAt,
    discountMonths,
  };
}

/** Atomically increment `tokens_used` after a successful AI call. */
export async function recordTokenUsage(userId: string, tokens: number): Promise<void> {
  if (!userId || !tokens || tokens <= 0) return;
  try {
    await query(
      `UPDATE users SET tokens_used = tokens_used + $1 WHERE id = $2`,
      [Math.floor(tokens), userId]
    );
  } catch {
    // Никогда не ломаем основной поток
  }
}

/** Reset / initialise trial for a user (called from register route). */
export async function setTrialForUser(userId: string): Promise<void> {
  await query(
    `UPDATE users
        SET plan            = 'trial',
            plan_started_at = NOW(),
            plan_expires_at = NOW() + ($1 || ' days')::INTERVAL,
            tokens_used     = 0,
            tokens_limit    = $2
      WHERE id = $3`,
    [String(TRIAL_DAYS), TRIAL_TOKEN_LIMIT, userId]
  );
}
