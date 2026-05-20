"use client";

/**
 * Клиентская часть workspace-системы: текущий активный workspace,
 * переключение, загрузка снапшота для foreign workspace.
 *
 * Хранение: активный workspaceId — в localStorage по ключу
 * `mr_active_workspace`. По умолчанию = userId юзера (= собственная).
 */

import type { WorkspaceSummary, WorkspaceRole } from "./workspace";

export type ClientWorkspaceRole = WorkspaceRole;

const STORAGE_KEY_ACTIVE_WS = "mr_active_workspace";

export interface ActiveWorkspaceState {
  /** workspaceId === userId владельца. */
  workspaceId: string;
  /** Роль текущего юзера в этом workspace. */
  role: WorkspaceRole;
  /** Это собственная workspace юзера (он = владелец) */
  isOwnWorkspace: boolean;
  /** Имя workspace для отображения. */
  displayName: string;
  /** Email владельца. */
  ownerEmail: string;
}

export function loadActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(STORAGE_KEY_ACTIVE_WS); } catch { return null; }
}

export function saveActiveWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY_ACTIVE_WS, workspaceId); } catch { /* */ }
}

export function clearActiveWorkspaceId(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY_ACTIVE_WS); } catch { /* */ }
}

/**
 * Резолвит активный workspace юзера.
 *
 * Логика:
 *   1. Тянет список доступных workspace'ов с /api/workspace/list
 *   2. Берёт saved из localStorage, проверяет что юзер всё ещё имеет доступ
 *   3. Если saved отсутствует / нет доступа — возвращает собственную (owner)
 */
export async function resolveActiveWorkspace(currentUserId: string): Promise<{
  active: ActiveWorkspaceState;
  available: WorkspaceSummary[];
}> {
  let available: WorkspaceSummary[] = [];

  try {
    const res = await fetch("/api/workspace/list", { credentials: "include" });
    const json = await res.json() as { ok: boolean; workspaces?: WorkspaceSummary[] };
    if (json.ok && json.workspaces) available = json.workspaces;
  } catch {
    // Если бэкенд не отвечает — fallback на собственную workspace без сетевых данных
  }

  // Если список пустой (например, /list упал) — синтетически создаём свою.
  if (available.length === 0) {
    available = [{
      workspaceId: currentUserId,
      ownerEmail: "",
      ownerName: null,
      ownerCompanyName: null,
      role: "owner",
      joinedAt: null,
    }];
  }

  const savedId = loadActiveWorkspaceId();
  const found = savedId ? available.find(w => w.workspaceId === savedId) : null;
  const chosen = found ?? available.find(w => w.role === "owner") ?? available[0];

  // Если savedId был мусором — затираем
  if (savedId && !found) clearActiveWorkspaceId();

  const active: ActiveWorkspaceState = {
    workspaceId: chosen.workspaceId,
    role: chosen.role,
    isOwnWorkspace: chosen.workspaceId === currentUserId,
    displayName: chosen.ownerCompanyName || chosen.ownerName || chosen.ownerEmail || "Моя команда",
    ownerEmail: chosen.ownerEmail || "",
  };

  return { active, available };
}

/**
 * Снапшот всех user_data ключей workspace (для foreign workspace).
 */
export async function fetchWorkspaceSnapshot(workspaceId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/workspace/snapshot?id=${encodeURIComponent(workspaceId)}`, {
      credentials: "include",
    });
    const json = await res.json() as { ok: boolean; snapshot?: Record<string, unknown> };
    if (!json.ok || !json.snapshot) return null;
    return json.snapshot;
  } catch {
    return null;
  }
}
