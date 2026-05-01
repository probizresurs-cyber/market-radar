/**
 * Yandex.Метрика helper — typed wrappers around `ym()` global.
 *
 * Counter ID is hardcoded since the snippet in layout.tsx initializes it.
 * All functions are no-op if called server-side or before metrika loads.
 *
 * Goals to create in metrika.yandex.ru → Цели:
 *   - signup            — JavaScript-событие
 *   - login             — JavaScript-событие
 *   - express_report    — JavaScript-событие
 *   - partner_apply     — JavaScript-событие
 *   - telegram_click    — JavaScript-событие
 *   - payment_success   — JavaScript-событие (с параметрами через ecommerce)
 *   - premium_deck      — JavaScript-событие (формат: pptx / pdf / html)
 *   - analyze_start     — JavaScript-событие
 *   - analyze_complete  — JavaScript-событие
 */

const COUNTER_ID = 108999924;

// Public goal names — keep in sync with goals configured in Metrika UI
export type Goal =
  | "signup"
  | "login"
  | "express_report"
  | "partner_apply"
  | "telegram_click"
  | "payment_success"
  | "premium_deck"
  | "analyze_start"
  | "analyze_complete"
  | "share_created"
  | "presentation_export";

// Augment window with Yandex.Метрика API
declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Fire a Метрика goal. Pass optional params object that will appear under
 * "Параметры визитов" in Метрика reports.
 */
export function trackGoal(goal: Goal, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.ym) return;
  try {
    if (params && Object.keys(params).length > 0) {
      window.ym(COUNTER_ID, "reachGoal", goal, params);
    } else {
      window.ym(COUNTER_ID, "reachGoal", goal);
    }
  } catch {
    /* swallow — analytics must never break user flow */
  }
}

/**
 * E-commerce purchase event (also fires the `payment_success` goal).
 * Pushes to dataLayer in the Метрика format so that revenue is attributed
 * properly in reports → Электронная коммерция.
 *
 * @param transactionId — your internal payment id
 * @param plan          — internal plan id (e.g. "starter", "growth")
 * @param amount        — amount in RUB (number, no kopecks)
 */
export function trackPurchase(opts: {
  transactionId: string;
  plan: string;
  amount: number;
  currency?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const dl = (window.dataLayer = window.dataLayer || []);
    dl.push({
      ecommerce: {
        purchase: {
          actionField: {
            id: opts.transactionId,
            revenue: opts.amount,
            currency: opts.currency || "RUB",
          },
          products: [
            {
              id: opts.plan,
              name: opts.plan,
              price: opts.amount,
              quantity: 1,
            },
          ],
        },
      },
    });
    trackGoal("payment_success", {
      plan: opts.plan,
      amount: opts.amount,
      transaction_id: opts.transactionId,
    });
  } catch {
    /* swallow */
  }
}

/**
 * Set a user-id for cross-device stitching (call after login/registration).
 */
export function setUserId(id: string) {
  if (typeof window === "undefined" || !window.ym) return;
  try {
    window.ym(COUNTER_ID, "setUserID", id);
  } catch {
    /* swallow */
  }
}
