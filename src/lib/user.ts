// ─── User account type ─────────────────────────────────────────────────────────

import type { BusinessType } from "./business-types";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  telegram?: string;
  website?: string;
  niche?: string;
  companyName?: string;
  companyUrl?: string;
  vk?: string;
  tg?: string;
  hhUrl?: string;
  onboardingDone: boolean;
  role?: string;
  tgChatId?: string;
  tgNotifyAnalysis?: boolean;
  tgNotifyCompetitors?: boolean;
  tgNotifyVacancies?: boolean;
  tgNotifyDigest?: boolean;
  businessType?: BusinessType;
}

// ─── Niche competitor suggestions (used in onboarding) ─────────────────────────

export const NICHE_COMPETITORS: Record<string, Array<{ name: string; url: string }>> = {
  digital: [
    { name: "Kokoc Group", url: "kokoc.com" },
    { name: "iConText Group", url: "icontext.ru" },
    { name: "i-Media", url: "i-media.ru" },
    { name: "Nimax", url: "nimax.ru" },
    { name: "WebCanape", url: "webcanape.ru" },
  ],
  clinic: [
    { name: "СМ-Клиника", url: "sm-clinic.ru" },
    { name: "Медицина.ру", url: "medicina.ru" },
    { name: "К+31", url: "klinika31.ru" },
    { name: "МедСи", url: "medsi.ru" },
    { name: "Hadassah", url: "hmc.ru" },
  ],
  b2b: [
    { name: "Контур", url: "kontur.ru" },
    { name: "МойСклад", url: "moysklad.ru" },
    { name: "amoCRM", url: "amocrm.ru" },
    { name: "Битрикс24", url: "bitrix24.ru" },
    { name: "1С-Битрикс", url: "1c-bitrix.ru" },
  ],
  other: [
    { name: "Авито", url: "avito.ru" },
    { name: "Яндекс Маркет", url: "market.yandex.ru" },
    { name: "Озон", url: "ozon.ru" },
    { name: "ВКонтакте", url: "vk.com" },
    { name: "Тинькофф", url: "tinkoff.ru" },
  ],
  products: [
    { name: "Tiu.ru", url: "tiu.ru" },
    { name: "Пульс цен", url: "pulscen.ru" },
    { name: "Метпром", url: "metprom.ru" },
    { name: "ОптЛист", url: "optlist.ru" },
    { name: "Поставщики.ру", url: "postavshhiki.ru" },
  ],
};

// ─── Server sync helpers ────────────────────────────────────────────────────────

/**
 * Активный workspace для записи. Если null — пишем в свою (по сессии).
 * Если задан — в чужую (нужны editor/owner права; читать может viewer).
 *
 * Глобальная переменная вместо контекста — потому что syncToServer вызывается
 * из десятков мест по всему приложению, через хелпер. React-контекст пришлось
 * бы прокидывать всюду.
 */
let _activeWorkspaceIdForSync: string | null = null;

export function setActiveWorkspaceForSync(workspaceId: string | null): void {
  _activeWorkspaceIdForSync = workspaceId;
}

export function getActiveWorkspaceForSync(): string | null {
  return _activeWorkspaceIdForSync;
}

export async function syncToServer(key: string, value: unknown): Promise<void> {
  try {
    const body: Record<string, unknown> = { key, value };
    if (_activeWorkspaceIdForSync) body.workspaceId = _activeWorkspaceIdForSync;

    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      console.warn(`[sync] POST /api/data "${key}" failed:`, res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn(`[sync] POST /api/data "${key}" error:`, e);
  }
}

export async function loadAllFromServer(workspaceId?: string | null): Promise<Record<string, unknown> | null> {
  try {
    const url = workspaceId
      ? `/api/data?workspaceId=${encodeURIComponent(workspaceId)}`
      : `/api/data`;
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json();
    if (json.ok) {
      console.log("[sync] loaded from server:", Object.keys(json.data ?? {}));
      return json.data;
    }
    console.warn("[sync] GET /api/data returned not-ok:", json);
  } catch (e) {
    console.warn("[sync] GET /api/data error:", e);
  }
  return null;
}

// ─── Legacy localStorage auth (kept for migration compat) ──────────────────────

export function authGetCurrentUser(): UserAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("mr_current_user_v2");
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch { return null; }
}

export function authSetCurrentUser(user: UserAccount | null): void {
  if (user) localStorage.setItem("mr_current_user_v2", JSON.stringify(user));
  else localStorage.removeItem("mr_current_user_v2");
}

// ─── Telegram notification helper ──────────────────────────────────────────────

// chatId-параметр оставлен для обратной совместимости со старыми вызовами,
// но больше НЕ отправляется — сервер сам подтянет chatId сессионного юзера
// из БД. Открытый relay был дырой безопасности (см. фикс telegram/notify).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendTgNotification(_chatId: string, text: string) {
  try {
    await fetch("/api/telegram/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch { /* silent fail */ }
}
