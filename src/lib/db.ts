import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool: Pool };

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// Run once on first import to ensure tables exist
export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ─── Subscription / Token limits (trial + paid plans) ───────────────────────
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial'`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_limit INTEGER NOT NULL DEFAULT 100000`);
  // Backfill existing users who never had a trial start date: give them 7 days from now
  await query(`
    UPDATE users
    SET plan_started_at = NOW(),
        plan_expires_at = NOW() + INTERVAL '7 days'
    WHERE plan = 'trial' AND plan_started_at IS NULL
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS user_data (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, key)
    )
  `);

  // ─── Partner Program + Pricing tables ───────────────────────────────────────

  await query(`
    CREATE TABLE IF NOT EXISTS pricing_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price_group TEXT NOT NULL CHECK (price_group IN ('A','B','C','D','E')),
      type TEXT NOT NULL CHECK (type IN ('free','one_time','subscription')),
      price_amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'RUB',
      limits JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('referral','integrator')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
      referral_code TEXT UNIQUE NOT NULL,
      commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
      company_name TEXT,
      website TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS partner_clients (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cookie_set_at TIMESTAMPTZ,
      first_payment_at TIMESTAMPTZ,
      UNIQUE(client_user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      type TEXT NOT NULL CHECK (type IN ('one_time','subscription','refund')),
      pricing_item_id TEXT REFERENCES pricing_items(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
      partner_id TEXT REFERENCES partners(id),
      promo_code_id TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS partner_balances (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('commission','payout','refund','reserve')),
      payment_id TEXT REFERENCES payments(id),
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT,
      discount_percent NUMERIC(5,2),
      discount_amount INTEGER,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      partner_id TEXT REFERENCES partners(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Migration: add name column if it doesn't exist yet
  await query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS name TEXT`);

  // ─── Referral Links (admin-generated registration links with bonuses) ─────
  await query(`
    CREATE TABLE IF NOT EXISTS referral_links (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      trial_days INTEGER NOT NULL DEFAULT 30,
      discount_pct INTEGER NOT NULL DEFAULT 0,
      discount_months INTEGER NOT NULL DEFAULT 0,
      valid_to TIMESTAMPTZ,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_referral_links_code ON referral_links(code)`);
  // Optional per-link token cap override — NULL = use default TRIAL_TOKEN_LIMIT (100k).
  // Added retroactively for existing installs.
  await query(`ALTER TABLE referral_links ADD COLUMN IF NOT EXISTS tokens_limit INTEGER`);

  // Track which referral a user came from + post-trial deferred discount
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS discount_pct INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ`);

  // ─── GDPR / ФЗ-152: consent to processing of personal data ──────────────────
  // https://company24.pro/politicahr2026 — captured at registration time.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip TEXT`);

  // Company name — captured at registration (required for referral signups,
  // optional otherwise) and shown in the profile / Settings view.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT`);

  // Website + contact (phone OR telegram) — captured at registration so we
  // can auto-run the first analysis and reach out to the client. Either
  // `phone` or `telegram` is filled, not both.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram TEXT`);

  // ─── AI Monitoring + Security tables ────────────────────────────────────────

  await query(`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      endpoint TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      duration_ms INTEGER,
      success BOOLEAN NOT NULL DEFAULT true,
      error_code TEXT,
      error_message TEXT,
      manipulation_detected BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON ai_logs(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC)`);

  // ─── Feature Flags (включение/отключение модулей платформы админом) ──────
  await query(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Waitlist (пользователи, которые хотят получить уведомление о запуске модуля)
  await query(`
    CREATE TABLE IF NOT EXISTS feature_waitlist (
      id TEXT PRIMARY KEY,
      feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(feature_id, user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_feature_waitlist_feature_id ON feature_waitlist(feature_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feature_waitlist_created_at ON feature_waitlist(created_at DESC)`);

  // Seed базовых модулей (idempotent). Позже админ может переключать.
  await query(`
    INSERT INTO features (id, label, description, sort_order, enabled) VALUES
      ('content-factory',    'Контент-завод',    'План контента, посты, рилсы, сторис, ToV-чекер',  1, true),
      ('brand-presentation', 'Презентации',      'Бренд-презентации: генерация, CSS-рендер, PDF/PPTX', 2, true),
      ('landing-generator',  'Лендинги',         'Генератор одностраничных лендингов под нишу',      3, true),
      ('seo-articles',       'SEO-статьи',       'AI-генерация SEO-статей + кластер ключей',         4, true),
      ('reviews-analysis',   'Рынок и отзывы',   'Сбор и AI-анализ отзывов с карт',                  5, true)
    ON CONFLICT (id) DO NOTHING
  `);

  // ─── Public shares (дашборд по публичной ссылке, без авторизации) ──────────
  // Каждая генерация ссылки создаёт новую строку со своим UUID.
  await query(`
    CREATE TABLE IF NOT EXISTS public_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_public_shares_user_id ON public_shares(user_id)`);
}
