/**
 * Activity Log — аудит действий пользователей и системных событий.
 * 12 типов действий × 10 типов сущностей.
 *
 * Использование:
 *   await logActivity({ userId, action: "analyze", entityType: "company", entityId: companyId })
 */

import { query } from "./db";
import { randomUUID } from "crypto";

// ─── Action types (12) ────────────────────────────────────────────────────────

export type ActivityAction =
  | "create"      // создание объекта
  | "update"      // обновление
  | "delete"      // удаление
  | "view"        // просмотр
  | "analyze"     // запуск AI-анализа
  | "generate"    // генерация контента (AI)
  | "export"      // экспорт (PDF, PPTX, DOCX)
  | "login"       // вход в систему
  | "logout"      // выход
  | "register"    // регистрация
  | "payment"     // платёжное событие
  | "error";      // ошибка / нарушение безопасности

// ─── Entity types (10) ────────────────────────────────────────────────────────

export type ActivityEntity =
  | "company"     // компания пользователя
  | "competitor"  // конкурент
  | "analysis"    // результат анализа
  | "content"     // контент-план
  | "post"        // пост / рилс / сторис
  | "report"      // отчёт
  | "user"        // аккаунт пользователя
  | "partner"     // партнёр
  | "payment"     // платёж
  | "seo";        // SEO-статья

// ─── Log entry ────────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: ActivityAction;
  entity_type: ActivityEntity | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Log function ─────────────────────────────────────────────────────────────

export interface LogActivityParams {
  userId?: string | null;
  action: ActivityAction;
  entityType?: ActivityEntity | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_logs
         (id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        params.userId ?? null,
        params.action,
        params.entityType ?? null,
        params.entityId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ]
    );
  } catch (e) {
    // Never crash the main flow due to logging failure
    console.error("[ActivityLog] insert failed:", e);
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface QueryActivityLogsOptions {
  userId?: string;
  action?: ActivityAction;
  entityType?: ActivityEntity;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function queryActivityLogs(opts: QueryActivityLogsOptions = {}): Promise<ActivityLogEntry[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.userId) { conditions.push(`user_id = $${idx++}`); params.push(opts.userId); }
  if (opts.action) { conditions.push(`action = $${idx++}`); params.push(opts.action); }
  if (opts.entityType) { conditions.push(`entity_type = $${idx++}`); params.push(opts.entityType); }
  if (opts.entityId) { conditions.push(`entity_id = $${idx++}`); params.push(opts.entityId); }
  if (opts.from) { conditions.push(`created_at >= $${idx++}`); params.push(opts.from.toISOString()); }
  if (opts.to) { conditions.push(`created_at <= $${idx++}`); params.push(opts.to.toISOString()); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 100, 1000);
  const offset = opts.offset ?? 0;

  params.push(limit, offset);

  return query<ActivityLogEntry>(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );
}

// ─── DB init (call from initDb) ───────────────────────────────────────────────

export async function initActivityLogTable(): Promise<void> {
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
  await query(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC)
  `);
}
