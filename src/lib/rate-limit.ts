/**
 * In-memory rate limiter with auto-cleanup every 5 minutes.
 *
 * checkAiRateLimit(userId)      — AI: 100 calls / day per user
 * checkPasswordAttempts(key)    — Auth: 5 attempts → 15 min block
 * checkApiRateLimit(key, opts)  — Generic: custom window + max
 */

interface RateEntry {
  count: number;
  resetAt: number;    // Unix ms
  blockedUntil?: number; // Unix ms (для блокировок)
}

// Общее in-memory хранилище
const store = new Map<string, RateEntry>();

// Автоочистка устаревших записей каждые 5 минут
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      const expired = entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now);
      if (expired) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ─── Generic rate check ───────────────────────────────────────────────────────

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;        // окно в мс
  blockDurationMs?: number; // блокировка после превышения (мс)
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Unix ms
  blockedUntil?: number; // Unix ms (если заблокирован)
  retryAfterMs?: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const fullKey = `${opts.keyPrefix || "rl"}:${key}`;
  const entry = store.get(fullKey);

  // Если заблокирован
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      blockedUntil: entry.blockedUntil,
      retryAfterMs: entry.blockedUntil - now,
    };
  }

  // Если окно истекло — сбрасываем
  if (!entry || entry.resetAt < now) {
    store.set(fullKey, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.maxRequests - 1, resetAt: now + opts.windowMs };
  }

  // Инкрементируем
  entry.count++;

  if (entry.count > opts.maxRequests) {
    if (opts.blockDurationMs) {
      entry.blockedUntil = now + opts.blockDurationMs;
    }
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      blockedUntil: entry.blockedUntil,
      retryAfterMs: entry.blockedUntil ? entry.blockedUntil - now : entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: opts.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── AI Rate Limit: 100 calls / day per user ─────────────────────────────────

export function checkAiRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(userId, {
    keyPrefix: "ai",
    maxRequests: 100,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  });
}

// ─── Password attempts: 5 tries → 15 min block ───────────────────────────────

export function checkPasswordAttempts(identifier: string): RateLimitResult {
  return checkRateLimit(identifier, {
    keyPrefix: "pwd",
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,       // 15-minute window
    blockDurationMs: 15 * 60 * 1000, // 15-minute block after 5 fails
  });
}

export function resetPasswordAttempts(identifier: string): void {
  store.delete(`pwd:${identifier}`);
}

// ─── General API rate limit: 60 req / min per IP or user ─────────────────────

export function checkApiRateLimit(key: string, maxPerMinute = 60): RateLimitResult {
  return checkRateLimit(key, {
    keyPrefix: "api",
    maxRequests: maxPerMinute,
    windowMs: 60 * 1000,
  });
}

// ─── Rate limit HTTP response helper ─────────────────────────────────────────

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed && result.retryAfterMs) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000));
  }
  return headers;
}
