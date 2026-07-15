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

  // ─── Раздельные подписки по продуктам (Этап 2) ───────────────────────
  // Экосистема разнесена на продукты (core / seo-geo / content-factory /
  // land-pres). У каждого — своя подписка, свой пул токенов, свои тарифы и
  // реф-ссылки. Доступ к продукту = активная строка в product_subscriptions.
  // product NULL на pricing_items/referral_links = «общий» (любой продукт).
  await query(`ALTER TABLE pricing_items ADD COLUMN IF NOT EXISTS product TEXT`);
  await query(`ALTER TABLE referral_links ADD COLUMN IF NOT EXISTS product TEXT`);
  await query(`
    CREATE TABLE IF NOT EXISTS product_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product TEXT NOT NULL,                    -- core | seo-geo | content-factory | land-pres
      plan TEXT NOT NULL DEFAULT 'trial',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','trialing','expired','canceled')),
      tokens_used INTEGER NOT NULL DEFAULT 0,
      tokens_limit INTEGER,                     -- NULL = дефолт тарифа
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, product)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_product_subs_user ON product_subscriptions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_product_subs_product ON product_subscriptions(product, status)`);

  // ─── GDPR / ФЗ-152: consent to processing of personal data ──────────────────
  // https://company24.pro/politicahr2026 — captured at registration time.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip TEXT`);

  // Company name — captured at registration (required for referral signups,
  // optional otherwise) and shown in the profile / Settings view.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT`);

  // Telegram chatId для серверных уведомлений (price alerts, etc.).
  // Заполняется при «Подключить Telegram» в настройках. Без этого cron не
  // знает куда слать алерты.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT`);

  // Production-канал Telegram, куда уходят посты из «Контент-завода».
  // Может быть @channel_name, числовой -100xxxxxx, или числовой chat_id.
  // Если не задан — публикация падает с понятной ошибкой.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT`);

  // VK-сообщество для прямого постинга. Формат: "-12345" (с минусом) для группы.
  // Per-user, чтобы агентство могло обслуживать несколько клиентов.
  // Token остаётся общий из env (VK_ACCESS_TOKEN).
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_group_id TEXT`);

  // Снапшот компании из ПОСЛЕДНЕГО анализа — нужен серверным агентам, у
  // которых нет доступа к localStorage. AnalysisResult живёт в браузере;
  // мы зеркалим минимум (name, url, niche) в DB при каждом /api/analyze.
  // Так Yandex Reviews Watcher и Site Change Detector понимают «над какой
  // компанией сейчас работает юзер».
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_analyzed_company JSONB`);

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

  // Иерархия фичфлагов: «Контент-завод» имеет 9 под-модулей. Админ
  // может выключить весь блок (parent) или точечно одну вкладку (child).
  // ON DELETE SET NULL — на случай ручного удаления parent-модуля.
  await query(`ALTER TABLE features ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES features(id) ON DELETE SET NULL`);
  await query(`CREATE INDEX IF NOT EXISTS idx_features_parent_id ON features(parent_id)`);

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

  // Sub-features под «Контент-заводом». ID совпадают с nav-id из src/lib/nav.ts —
  // это позволяет в page.tsx делать `featureOn(activeNav)` для under-the-hood проверки.
  // sort_order = 100+ чтобы они шли после корневых модулей в админке.
  await query(`
    INSERT INTO features (id, label, description, parent_id, sort_order, enabled) VALUES
      ('content-trends',    'Тренды по нише',      'Подборка трендов и идей под нишу',            'content-factory', 101, true),
      ('content-plan',      'План контента',        'AI-генерация контент-плана',                  'content-factory', 102, true),
      ('content-calendar',  'Календарь публикаций', 'Расписание постов и рилсов по неделям',       'content-factory', 103, true),
      ('content-posts',     'Создать пост',         'Генерация поста + картинки',                  'content-factory', 104, true),
      ('content-reels',     'Создать видео',        'Сценарии рилсов и HeyGen-видео',              'content-factory', 105, true),
      ('content-stories',   'Сторис-сценарии',     'Серии сторис с фонами и текстом',             'content-factory', 106, true),
      ('content-carousels', 'Карусель-посты',      'Карусели из 5-10 слайдов',                    'content-factory', 107, true),
      ('content-analytics', 'Аналитика контента',   'Метрики постов и рилсов, охват/вовлечение',   'content-factory', 108, true),
      ('content-roi',       'ROI калькулятор',      'Расчёт окупаемости контент-производства',     'content-factory', 109, true)
    ON CONFLICT (id) DO UPDATE SET parent_id = EXCLUDED.parent_id
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

  // ─── Partner applications (публичные заявки без учётной записи) ──────────────
  await query(`
    CREATE TABLE IF NOT EXISTS partner_applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company_name TEXT,
      website TEXT,
      type TEXT NOT NULL DEFAULT 'referral' CHECK (type IN ('referral','integrator')),
      description TEXT,
      client_price_amount INTEGER,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','rejected')),
      admin_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON partner_applications(email)`);

  // ─── Заявки на полноценный анализ со страницы /kp, /kp-sozdavaya и других
  // публичных «интерактивных анализов» (кнопка «Хотите полноценный анализ
  // за 2 990 ₽?») — публичная форма без учётной записи, попадает в /admin/analysis-requests.
  await query(`
    CREATE TABLE IF NOT EXISTS analysis_requests (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      website TEXT NOT NULL,
      contact TEXT NOT NULL,
      source_path TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','rejected')),
      admin_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_analysis_requests_status ON analysis_requests(status)`);

  // ─── Добавляем client_price_amount к partners (если ещё нет) ─────────────────
  await query(`
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS client_price_amount INTEGER
  `);

  // ─── Юр.реквизиты клиента (для счетов на оплату и актов) ────────────────────
  // Тип клиента: individual (физлицо) / ip (ИП) / llc (ООО и пр. юрлица).
  // Нужен для генерации счетов и актов: для физика — не выставляются.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_type TEXT
    CHECK (client_type IN ('individual','ip','llc')) DEFAULT 'individual'`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_name TEXT`);          // "ООО Ромашка" / "ИП Иванов И.И."
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS inn TEXT`);                  // 10 для ООО, 12 для ИП
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS kpp TEXT`);                  // только ООО
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ogrn TEXT`);                 // ОГРН (13) / ОГРНИП (15)
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_address TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_bik TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account TEXT`);          // расчётный счёт
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_corr_account TEXT`);     // корр.счёт
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS director_name TEXT`);         // директор (только ООО)
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS director_position TEXT`);     // "Генеральный директор"
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_email TEXT`);         // отдельный e-mail для бухгалтерии (если != email)

  // ─── Счета на оплату (по р/счёту) ───────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pricing_item_id TEXT REFERENCES pricing_items(id),
      amount INTEGER NOT NULL,                      -- сумма в рублях
      currency TEXT NOT NULL DEFAULT 'RUB',
      vat_mode TEXT NOT NULL DEFAULT 'none' CHECK (vat_mode IN ('none','vat20','vat10','vat0')),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','sent','paid','cancelled','expired')),
      client_snapshot JSONB NOT NULL,               -- snapshot реквизитов клиента
      vendor_snapshot JSONB NOT NULL,               -- snapshot реквизитов исполнителя
      service_description TEXT NOT NULL,            -- "Услуги доступа к платформе MarketRadar (тариф Pro)"
      service_period_start DATE,
      service_period_end DATE,
      payment_id TEXT REFERENCES payments(id),
      due_date DATE NOT NULL,                        -- срок оплаты
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC)`);

  // ─── Акты выполненных работ ─────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS acts (
      id TEXT PRIMARY KEY,
      act_number TEXT UNIQUE NOT NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      vat_mode TEXT NOT NULL DEFAULT 'none',
      service_description TEXT NOT NULL,
      service_period_start DATE,
      service_period_end DATE,
      client_snapshot JSONB NOT NULL,
      vendor_snapshot JSONB NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_acts_user_id ON acts(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_acts_invoice_id ON acts(invoice_id)`);

  // Счётчики для номеров счетов / актов (по году)
  await query(`
    CREATE TABLE IF NOT EXISTS doc_counters (
      kind TEXT NOT NULL,            -- 'invoice' | 'act'
      year INTEGER NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, year)
    )
  `);

  // ─── Persistent user image store ────────────────────────────────────────────
  // Контент-завод генерит картинки через OpenAI/Gemini/Pollinations, и они
  // приходят как `data:image/png;base64,...` (~1.5 MB на 1024×1024).
  // Если такой data-URI положить в `GeneratedPost.imageUrl` и сохранить в
  // localStorage / user_data, то после 2-4 постов:
  //   • localStorage переполняется (5 MB лимит браузера) → QuotaExceeded,
  //   • POST /api/data выходит за 1 MB body limit → 413,
  // и оба сейва падают в silent catch → посты теряются после F5 reload.
  // Решение: складываем байты сюда, а в посте остаётся только короткий URL
  // вида `/api/image/{id}` (см. /api/image/[id]/route.ts).
  await query(`
    CREATE TABLE IF NOT EXISTS user_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      data BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Релаксим NOT NULL на user_id — иногда image-gen вызывается до того
  // как сессия зарезолвилась (anon-flow), и FK ломал INSERT → клиент
  // получал raw base64 → localStorage переполнялся → картинки терялись.
  await query(`ALTER TABLE user_images ALTER COLUMN user_id DROP NOT NULL`).catch(() => { /* старый PG */ });
  await query(`CREATE INDEX IF NOT EXISTS idx_user_images_user_id ON user_images(user_id)`);

  // ─── SWOT-отчёты ──────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS swot_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      report JSONB NOT NULL,             -- полный SwotReport object
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_swot_reports_user_id ON swot_reports(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_swot_reports_created_at ON swot_reports(created_at DESC)`);

  // ─── Мониторинг цен конкурентов ───────────────────────────────────────────
  // tracked_products — что отслеживаем, price_history — журнал измерений.
  await query(`
    CREATE TABLE IF NOT EXISTS tracked_products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_url TEXT NOT NULL,
      product_name TEXT,                -- название (опционально, заполняется при первом скане)
      competitor_name TEXT,              -- конкурент (для группировки)
      currency TEXT DEFAULT 'RUB',
      last_price NUMERIC,                -- последняя известная цена
      last_checked_at TIMESTAMPTZ,
      check_status TEXT DEFAULT 'pending'
        CHECK (check_status IN ('pending','ok','failed','disabled')),
      check_error TEXT,
      notify_telegram BOOLEAN NOT NULL DEFAULT true,
      threshold_pct NUMERIC,             -- алерт только при изменении > N% (NULL = на любое)
      css_selector TEXT,                 -- если автоопределение фейлит, можно задать вручную
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id ON tracked_products(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_tracked_products_status ON tracked_products(check_status)`);

  await query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
      price NUMERIC NOT NULL,
      currency TEXT DEFAULT 'RUB',
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id, checked_at DESC)`);

  // ─── Agents framework ───────────────────────────────────────────────
  // Per-user конфиг каждого агента. Ключ (user_id, agent_name) — у каждого
  // юзера один конфиг на агента. Cron-runner читает таблицу, выбирает
  // due-агентов (по schedule + last_run_at) и запускает их параллельно.
  await query(`
    CREATE TABLE IF NOT EXISTS agent_configs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,           -- auto-publisher / competitor-watcher / trend-hunter / ...
      enabled BOOLEAN NOT NULL DEFAULT false,
      schedule TEXT NOT NULL DEFAULT 'daily',  -- hourly | daily | weekly | manual
      params JSONB DEFAULT '{}'::jsonb,   -- произвольные параметры (например, time-of-day, list of competitor IDs)
      last_run_at TIMESTAMPTZ,
      last_run_status TEXT,                -- ok | error | skipped
      last_run_summary TEXT,               -- 1-2 предложения для UI
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, agent_name)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_configs_user_enabled ON agent_configs(user_id, enabled)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_configs_due ON agent_configs(enabled, last_run_at) WHERE enabled = true`);

  // История запусков агентов. Хранит результат + детали для inbox-карточек,
  // которые требуют approval (например, draft ответа на отзыв).
  await query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL,                -- running | ok | error
      summary TEXT,                         -- короткое описание результата
      result JSONB DEFAULT '{}'::jsonb,     -- произвольный output (artifacts, drafts...)
      error_message TEXT,
      duration_ms INTEGER,
      needs_approval BOOLEAN NOT NULL DEFAULT false,
      approved_at TIMESTAMPTZ,
      approved_by TEXT                      -- user id (на будущее для команд)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_runs_user_started ON agent_runs(user_id, started_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_runs_pending_approval ON agent_runs(user_id, needs_approval, approved_at) WHERE needs_approval = true AND approved_at IS NULL`);

  // Серверное зеркало запланированных постов. Раньше посты жили только в
  // localStorage браузера → auto-publisher по крону их не видел (мог постить
  // только когда у юзера открыт таб). Теперь фронт синхронизирует посты с
  // scheduledFor сюда, а cron-агент auto-publisher читает due-посты (status
  // pending, scheduled_for ≤ now) и публикует автономно.
  await query(`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,                  -- = post.id с фронта (стабильный, для upsert)
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile_suffix TEXT NOT NULL DEFAULT '', -- мульти-профиль: '' для основного, иначе __p_<id>
      scheduled_for TIMESTAMPTZ NOT NULL,
      platforms TEXT[] NOT NULL DEFAULT '{}', -- ['telegram','vk']
      payload JSONB NOT NULL,                 -- весь GeneratedPost (hook/body/hashtags/imageUrl/variants)
      status TEXT NOT NULL DEFAULT 'pending'  -- pending | queued (ждёт approval) | published | failed | canceled
        CHECK (status IN ('pending','queued','published','failed','canceled')),
      last_error TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, scheduled_for) WHERE status = 'pending'`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON scheduled_posts(user_id, profile_suffix)`);

  // ─── Лиды (база сайтов для холодного аутрича) ──────────────────────────────
  // Из админки админ грузит CSV с 100-10000 доменами, на каждый домен
  // создаётся запись lead + (опционально) генерируется экспресс-отчёт.
  // Отчёт публикуется на /r/{slug} — публичная страница с blur-CTA,
  // куда мы кидаем ссылку владельцу сайта в email/Telegram.
  await query(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,                   -- основной ключ — нормализованный URL (без http/www)
      company_name TEXT,                      -- из CSV или AI-резюме
      contact_email TEXT,
      contact_phone TEXT,
      contact_telegram TEXT,
      city TEXT,
      niche TEXT,                             -- из CSV или после анализа
      slug TEXT UNIQUE NOT NULL,              -- для /r/{slug} — обычно домен с заменой точек на дефисы
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new','in_progress','contacted','replied','meeting','customer','rejected','followup')),
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      source TEXT,                            -- csv-import-2026-05-15 / manual / ...
      tags TEXT[],                             -- произвольные ярлыки для фильтрации
      last_contact_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(domain)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)`);

  // Имя контактного лица (отдельно от company_name). Заполняется CRM-менеджером
  // при первом контакте — «с кем разговаривал», «кому назначить встречу».
  await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_person_name TEXT`);

  // Экспресс-отчёт по сайту: ~1 страница AI-резюме + структурированные блоки.
  // Один лид может иметь несколько версий отчёта (перегенерация), берётся последняя по created_at.
  await query(`
    CREATE TABLE IF NOT EXISTS lead_reports (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      data JSONB NOT NULL,                     -- полный отчёт: score, проблемы, рекомендации, конкуренты
      model TEXT,                              -- claude-haiku-4-5 / sonnet / opus
      cost_cents NUMERIC,                      -- сколько $ × 100 потрачено на этот отчёт
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','done','failed')),
      error_message TEXT,
      generated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_reports_lead_id ON lead_reports(lead_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_reports_status ON lead_reports(status) WHERE status IN ('pending','running')`);

  // Заметки CRM-менеджера на лида (произвольный текст с автором + датой).
  await query(`
    CREATE TABLE IF NOT EXISTS lead_notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT,                        -- snapshot имени, если автор удалится
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id, created_at DESC)`);

  // История смены статусов — нужна для аналитики «сколько лидов конвертится».
  await query(`
    CREATE TABLE IF NOT EXISTS lead_status_history (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      changed_by_name TEXT,
      note TEXT,                                -- опциональная причина смены
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id, created_at DESC)`);

  // ─── Журнал отправленных писем + tracking opens/clicks ─────────────────────
  // Каждая отправка добавляет строку. В письмо инжектится 1×1 pixel-tracker
  // (/api/track/open/{id}.gif) и report-ссылка проксируется через
  // /api/track/click/{id} → 302 на /r/{slug}.
  // Это даёт нам метрики: «доходит ли письмо до inbox», «открывают ли»,
  // «кликают ли по CTA» — без сторонних сервисов вроде Mailgun.
  await query(`
    CREATE TABLE IF NOT EXISTS lead_emails (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      to_email TEXT NOT NULL,
      message_id TEXT,
      sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      sent_by_name TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      first_opened_at TIMESTAMPTZ,
      last_opened_at TIMESTAMPTZ,
      open_count INTEGER NOT NULL DEFAULT 0,
      first_clicked_at TIMESTAMPTZ,
      last_clicked_at TIMESTAMPTZ,
      click_count INTEGER NOT NULL DEFAULT 0
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_emails_lead_id ON lead_emails(lead_id, sent_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_emails_sent_at ON lead_emails(sent_at DESC)`);

  // ─── Workspaces — мульти-юзер доступ к одному дашборду ─────────────────────
  // Модель: каждый user.id ОДНОВРЕМЕННО является workspace_id своей собственной
  // рабочей области. То есть "владелец workspace W" = "пользователь с id=W".
  // Чтобы пригласить других пользователей видеть/редактировать данные владельца,
  // создаются строки в workspace_members.
  //
  // Роли:
  //   - "owner"  — implicit, не хранится в workspace_members (он = user.id)
  //   - "editor" — может редактировать всё (запускать анализы, генерировать контент)
  //   - "viewer" — только смотрит, не может ничего менять
  //
  // Все изменения, которые делает editor, пишутся в user_data СО СВОИМ
  // workspace_id = owner.id, не member.id. Это значит при чтении данных
  // мы смотрим на активный workspace, не на сессионного юзера.
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, member_user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_member ON workspace_members(member_user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id)`);

  // Приглашения отправляются по email с уникальным кодом-токеном.
  // Если приглашённого юзера ещё нет в системе → он регистрируется,
  // потом по тому же коду присоединяется к workspace. Если уже есть —
  // сразу принимает.
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      accepted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(LOWER(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id, created_at DESC)`);

  // Landing projects (Stitch SDK). Нужны чтобы прикрепить projectId+screenId
  // к пользователю — иначе любой залогиненный мог редактировать чужой
  // лендинг, зная projectId (IDOR от аудит-агента).
  await query(`
    CREATE TABLE IF NOT EXISTS landing_projects (
      project_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      landing_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_landing_projects_user ON landing_projects(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_landing_projects_workspace ON landing_projects(workspace_id, created_at DESC)`);

  // Расшаренные лендинги — публичная ссылка marketradar24.ru/l/<slug>.
  // HTML с Stitch-CDN копируется в БД сразу, потому что Stitch URLs живут
  // 1-7 дней, и шара должна работать вечно. Slug рандомный, 8 байт = 16
  // hex chars. Юзер делится ссылкой с клиентом, потом может удалить.
  await query(`
    CREATE TABLE IF NOT EXISTS shared_landings (
      slug TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES landing_projects(project_id) ON DELETE SET NULL,
      title TEXT,
      html_content TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_shared_landings_user ON shared_landings(user_id, created_at DESC)`);

  // Lead submissions from landings — кто-то заполнил форму на лендинге.
  // Юзер настраивает TG-уведомления или email через notify_config (JSON).
  await query(`
    CREATE TABLE IF NOT EXISTS landing_submissions (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT REFERENCES landing_projects(project_id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      referrer TEXT,
      utm JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_landing_submissions_user ON landing_submissions(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_landing_submissions_project ON landing_submissions(project_id, created_at DESC)`);

  // Конфиг уведомлений (TG chat / email / webhook URL) на уровне юзера.
  // Один юзер может ловить заявки со всех своих лендингов в один и тот же канал.
  await query(`
    CREATE TABLE IF NOT EXISTS landing_notify_config (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      telegram_chat_id TEXT,
      email TEXT,
      webhook_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Расшаренные презентации — view tracking + публичная ссылка /share/[slug].
  // Юзер кликает «Поделиться» → создаётся запись с публичным slug. Просмотры
  // в presentation_views (slide-impression events). Sales-команды видят кто
  // из лидов смотрел дольше.
  await query(`
    CREATE TABLE IF NOT EXISTS shared_presentations (
      slug TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slides_json JSONB NOT NULL,
      style_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      password_hash TEXT,
      view_count INTEGER NOT NULL DEFAULT 0
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_shared_presentations_user ON shared_presentations(user_id, created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS presentation_views (
      id BIGSERIAL PRIMARY KEY,
      share_slug TEXT REFERENCES shared_presentations(slug) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      slide_index INTEGER NOT NULL,
      time_on_slide_ms INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_presentation_views_slug ON presentation_views(share_slug, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_presentation_views_session ON presentation_views(session_id)`);

  // Persistent agent jobs — состояние премиум-генерации презентаций.
  // Раньше жило в RAM Map → PM2 restart всё стирал, история premium-decks
  // в localStorage у юзера превращалась в битые ссылки. Теперь в БД,
  // а файлы — в /var/lib/marketradar/agent-files (см. agent-runner).
  await query(`
    CREATE TABLE IF NOT EXISTS agent_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      prompt TEXT,
      cwd TEXT NOT NULL,
      log JSONB DEFAULT '[]'::jsonb,
      output_files JSONB DEFAULT '[]'::jsonb,
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_jobs_user ON agent_jobs(user_id, started_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status) WHERE status IN ('queued', 'running')`);
}
