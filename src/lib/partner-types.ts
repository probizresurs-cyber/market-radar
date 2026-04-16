// ─── Partner Program + Pricing types ─────────────────────────────────────────

export type PriceGroup = "A" | "B" | "C" | "D" | "E";
export type PriceType = "free" | "one_time" | "subscription";
export type PartnerType = "referral" | "integrator";
export type PartnerStatus = "pending" | "active" | "suspended" | "rejected";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type PaymentType = "one_time" | "subscription" | "refund";
export type BalanceType = "commission" | "payout" | "refund" | "reserve";

export interface PricingItem {
  id: string;
  name: string;
  description: string | null;
  price_group: PriceGroup;
  type: PriceType;
  price_amount: number;       // kopecks (divide by 100 for display)
  currency: string;
  limits: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Partner {
  id: string;
  user_id: string;
  type: PartnerType;
  status: PartnerStatus;
  referral_code: string;
  commission_rate: number;     // percent, e.g. 10.00
  company_name: string | null;
  website: string | null;
  description: string | null;
  created_at: string;
  // joined fields
  email?: string;
  name?: string;
  client_count?: number;
  total_earned?: number;
}

export interface PartnerClient {
  id: string;
  partner_id: string;
  client_user_id: string;
  attributed_at: string;
  cookie_set_at: string | null;
  first_payment_at: string | null;
  // joined fields
  client_email?: string;
  client_name?: string;
  total_paid?: number;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;              // kopecks
  currency: string;
  type: PaymentType;
  pricing_item_id: string | null;
  status: PaymentStatus;
  partner_id: string | null;
  promo_code_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // joined
  user_email?: string;
  item_name?: string;
}

export interface PartnerBalanceEntry {
  id: string;
  partner_id: string;
  amount: number;              // positive=credit, negative=debit (kopecks)
  type: BalanceType;
  payment_id: string | null;
  description: string | null;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null; // kopecks
  valid_from: string | null;
  valid_to: string | null;
  max_uses: number | null;
  used_count: number;
  partner_id: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Referral commission scales ──────────────────────────────────────────────

export const REFERRAL_SCALES = [
  { minClients: 1,  maxClients: 2,  rate: 10 },
  { minClients: 3,  maxClients: 9,  rate: 15 },
  { minClients: 10, maxClients: 29, rate: 18 },
  { minClients: 30, maxClients: Infinity, rate: 20 },
];

export const INTEGRATOR_SCALES = [
  { minClients: 1,  maxClients: 5,  rate: 25 },
  { minClients: 6,  maxClients: 10, rate: 30 },
  { minClients: 11, maxClients: 25, rate: 40 },
  { minClients: 26, maxClients: 29, rate: 40 },
  { minClients: 30, maxClients: Infinity, rate: 50 },
];

export function getCommissionRate(type: PartnerType, activeClients: number): number {
  const scales = type === "referral" ? REFERRAL_SCALES : INTEGRATOR_SCALES;
  for (const s of scales) {
    if (activeClients >= s.minClients && activeClients <= s.maxClients) return s.rate;
  }
  return scales[0].rate;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPrice(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(kopecks / 100);
}

export const PRICE_GROUP_LABELS: Record<PriceGroup, string> = {
  A: "Лид-магниты", B: "Микро-обновления", C: "Глубокие разовые",
  D: "Производство контента", E: "Подписки-мониторинг",
};

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  free: "Бесплатно", one_time: "Разово", subscription: "Подписка",
};
