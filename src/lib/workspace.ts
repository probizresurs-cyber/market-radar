/**
 * Workspace primitives — мульти-юзер доступ к одному дашборду.
 *
 * Концепция:
 *   workspace_id === user.id владельца. Каждый аккаунт по умолчанию имеет
 *   свою workspace (= собственный дашборд). Через workspace_members
 *   подключаются другие пользователи в ролях editor/viewer.
 *
 * Активный workspace юзера хранится в JWT (поле activeWorkspaceId) либо,
 * если поля нет, считается = userId (собственная workspace).
 */

import { query, initDb } from "./db";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceMember {
  workspaceId: string;
  memberUserId: string;
  role: "editor" | "viewer"; // owner НЕ хранится в таблице
  invitedBy: string | null;
  joinedAt: string;
  // Заполняется только когда join'им с users
  memberEmail?: string;
  memberName?: string | null;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: "editor" | "viewer";
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  revokedAt: string | null;
}

export interface WorkspaceSummary {
  workspaceId: string;
  ownerEmail: string;
  ownerName: string | null;
  ownerCompanyName: string | null;
  role: WorkspaceRole;
  joinedAt: string | null; // null для собственной workspace
}

// ─── Resolution: какие workspace'ы доступны юзеру ──────────────────────────

/**
 * Возвращает список workspace'ов, к которым юзер имеет доступ.
 * Всегда включает собственную (owner), плюс все где он member.
 */
export async function listAccessibleWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  await initDb();
  const result: WorkspaceSummary[] = [];

  // 1) Собственная workspace
  const meRows = await query<{ email: string; name: string | null; company_name: string | null }>(
    `SELECT email, name, company_name FROM users WHERE id = $1`,
    [userId],
  );
  const me = meRows[0];
  if (me) {
    result.push({
      workspaceId: userId,
      ownerEmail: me.email,
      ownerName: me.name,
      ownerCompanyName: me.company_name,
      role: "owner",
      joinedAt: null,
    });
  }

  // 2) Workspace'ы где он member
  const memberships = await query<{
    workspace_id: string; role: "editor" | "viewer"; joined_at: string;
    owner_email: string; owner_name: string | null; owner_company_name: string | null;
  }>(
    `SELECT wm.workspace_id, wm.role, wm.joined_at,
            u.email AS owner_email, u.name AS owner_name, u.company_name AS owner_company_name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.workspace_id
     WHERE wm.member_user_id = $1
     ORDER BY wm.joined_at DESC`,
    [userId],
  );

  for (const m of memberships) {
    result.push({
      workspaceId: m.workspace_id,
      ownerEmail: m.owner_email,
      ownerName: m.owner_name,
      ownerCompanyName: m.owner_company_name,
      role: m.role,
      joinedAt: m.joined_at,
    });
  }

  return result;
}

/**
 * Возвращает роль юзера в указанной workspace, либо null если доступа нет.
 * Используется на всех write-эндпоинтах для проверки прав.
 */
export async function getRoleInWorkspace(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  if (userId === workspaceId) return "owner";

  await initDb();
  const r = await query<{ role: "editor" | "viewer" }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND member_user_id = $2`,
    [workspaceId, userId],
  );
  return r[0]?.role ?? null;
}

/**
 * Проверка прав на запись. owner и editor могут писать, viewer — нет.
 */
export async function canWriteInWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const role = await getRoleInWorkspace(userId, workspaceId);
  return role === "owner" || role === "editor";
}

// ─── Members management ────────────────────────────────────────────────────

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  await initDb();
  const rows = await query<{
    workspace_id: string; member_user_id: string;
    role: "editor" | "viewer"; invited_by: string | null;
    joined_at: string; email: string; name: string | null;
  }>(
    `SELECT wm.*, u.email, u.name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.member_user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at DESC`,
    [workspaceId],
  );
  return rows.map(row => ({
    workspaceId: row.workspace_id,
    memberUserId: row.member_user_id,
    role: row.role,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at,
    memberEmail: row.email,
    memberName: row.name,
  }));
}

export async function removeMember(workspaceId: string, memberUserId: string): Promise<void> {
  await initDb();
  await query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND member_user_id = $2`,
    [workspaceId, memberUserId],
  );
}

export async function updateMemberRole(
  workspaceId: string,
  memberUserId: string,
  role: "editor" | "viewer",
): Promise<void> {
  await initDb();
  await query(
    `UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND member_user_id = $3`,
    [role, workspaceId, memberUserId],
  );
}

// ─── Invitations ───────────────────────────────────────────────────────────

const INVITE_TTL_DAYS = 7;

function genInviteCode(): string {
  // 24 hex chars = ~10^28 combos — устойчиво к перебору
  const a = Math.random().toString(36).slice(2, 12);
  const b = Math.random().toString(36).slice(2, 12);
  return `wi_${a}${b}`;
}

export async function createInvite(params: {
  workspaceId: string;
  email: string;
  role: "editor" | "viewer";
  invitedBy: string;
}): Promise<WorkspaceInvite> {
  await initDb();

  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    throw new Error("Некорректный email");
  }

  // Если этот email уже был приглашён в эту workspace и приглашение активно —
  // возвращаем существующий код, не плодим строки.
  const existing = await query<WorkspaceInviteRow>(
    `SELECT * FROM workspace_invites
     WHERE workspace_id = $1 AND LOWER(email) = $2
       AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [params.workspaceId, normalizedEmail],
  );
  if (existing[0]) return mapInvite(existing[0]);

  // Если у workspace уже есть member с таким email — не приглашаем повторно.
  const dup = await query<{ id: string }>(
    `SELECT wm.member_user_id AS id
     FROM workspace_members wm JOIN users u ON u.id = wm.member_user_id
     WHERE wm.workspace_id = $1 AND LOWER(u.email) = $2`,
    [params.workspaceId, normalizedEmail],
  );
  if (dup[0]) throw new Error("Этот пользователь уже в команде");

  const id = genInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();

  await query(
    `INSERT INTO workspace_invites (id, workspace_id, email, role, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, params.workspaceId, normalizedEmail, params.role, params.invitedBy, expiresAt],
  );

  const inserted = await query<WorkspaceInviteRow>(
    `SELECT * FROM workspace_invites WHERE id = $1`,
    [id],
  );
  return mapInvite(inserted[0]);
}

export async function getInviteByCode(code: string): Promise<WorkspaceInvite | null> {
  await initDb();
  const r = await query<WorkspaceInviteRow>(
    `SELECT * FROM workspace_invites WHERE id = $1 LIMIT 1`,
    [code],
  );
  return r[0] ? mapInvite(r[0]) : null;
}

export async function acceptInvite(code: string, userId: string, userEmail: string): Promise<{
  workspaceId: string;
  role: "editor" | "viewer";
}> {
  await initDb();
  const invite = await getInviteByCode(code);
  if (!invite) throw new Error("Приглашение не найдено");
  if (invite.acceptedAt) throw new Error("Приглашение уже использовано");
  if (invite.revokedAt) throw new Error("Приглашение отозвано");
  if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error("Срок действия приглашения истёк");
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error(`Приглашение отправлено на адрес ${invite.email}. Войдите под нужным аккаунтом.`);
  }
  if (invite.workspaceId === userId) throw new Error("Это ваша собственная workspace");

  // Создаём membership + помечаем приглашение принятым (атомарно)
  await query(
    `INSERT INTO workspace_members (workspace_id, member_user_id, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, member_user_id) DO UPDATE SET role = EXCLUDED.role`,
    [invite.workspaceId, userId, invite.role, invite.invitedBy],
  );
  await query(
    `UPDATE workspace_invites SET accepted_at = NOW(), accepted_user_id = $1 WHERE id = $2`,
    [userId, code],
  );

  return { workspaceId: invite.workspaceId, role: invite.role };
}

export async function listPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  await initDb();
  const r = await query<WorkspaceInviteRow>(
    `SELECT * FROM workspace_invites
     WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return r.map(mapInvite);
}

export async function revokeInvite(workspaceId: string, code: string): Promise<void> {
  await initDb();
  await query(
    `UPDATE workspace_invites SET revoked_at = NOW() WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, code],
  );
}

// ─── Snapshot: read all data of a workspace ───────────────────────────────

/**
 * Возвращает все user_data ключи для владельца workspace.
 * Используется при загрузке дашборда: если активный workspace ≠ user.id,
 * фронт запросит этот endpoint и применит данные владельца.
 */
export async function getWorkspaceSnapshot(workspaceId: string): Promise<Record<string, unknown>> {
  await initDb();
  const r = await query<{ key: string; value: unknown }>(
    `SELECT key, value FROM user_data WHERE user_id = $1`,
    [workspaceId],
  );
  const out: Record<string, unknown> = {};
  for (const row of r) {
    out[row.key] = row.value;
  }
  return out;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

interface WorkspaceInviteRow {
  id: string; workspace_id: string; email: string;
  role: "editor" | "viewer"; invited_by: string;
  created_at: string; expires_at: string;
  accepted_at: string | null; accepted_user_id: string | null;
  revoked_at: string | null;
}

function mapInvite(row: WorkspaceInviteRow): WorkspaceInvite {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    acceptedUserId: row.accepted_user_id,
    revokedAt: row.revoked_at,
  };
}
