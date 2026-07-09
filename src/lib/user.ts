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

// ─── Profile sync ───────────────────────────────────────────────────────────
// Серверный суффикс активного профиля. Default → "" (ключ "company" как был),
// доп. профиль → "::p_<id>" (ключ "company::p_abc"). Так данные разных профилей
// лежат в одной таблице user_data без миграции схемы.
let _activeProfileSuffixForSync = "";

export function setActiveProfileSuffixForSync(suffix: string): void {
  _activeProfileSuffixForSync = suffix ?? "";
}

export async function syncToServer(key: string, value: unknown): Promise<void> {
  try {
    // Прибавляем суффикс профиля к ключу (default → без изменений).
    const scopedKey = key + _activeProfileSuffixForSync;
    const body: Record<string, unknown> = { key: scopedKey, value };
    if (_activeWorkspaceIdForSync) body.workspaceId = _activeWorkspaceIdForSync;

    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      console.warn(`[sync] POST /api/data "${scopedKey}" failed:`, res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn(`[sync] POST /api/data "${key}" error:`, e);
  }
}

/**
 * Загружает данные с сервера. Если задан profileSuffix — возвращает ТОЛЬКО
 * ключи этого профиля, со снятым суффиксом (чтобы page.tsx работал как раньше).
 * Для default-профиля (suffix="") отдаём ключи БЕЗ "::p_" — т.е. только
 * основной профиль, не подмешивая чужие.
 */
export async function loadAllFromServer(
  workspaceId?: string | null,
  profileSuffix = "",
): Promise<Record<string, unknown> | null> {
  try {
    const url = workspaceId
      ? `/api/data?workspaceId=${encodeURIComponent(workspaceId)}`
      : `/api/data`;
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json();
    if (json.ok) {
      const all = (json.data ?? {}) as Record<string, unknown>;
      // Фильтруем по профилю
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(all)) {
        if (profileSuffix) {
          // Доп. профиль: берём только "key::p_<id>", снимаем суффикс
          if (k.endsWith(profileSuffix)) {
            result[k.slice(0, -profileSuffix.length)] = v;
          }
        } else {
          // Default: берём ключи БЕЗ "::p_" суффикса
          if (!/::p_[a-z0-9]+$/i.test(k)) result[k] = v;
        }
      }
      console.log(`[sync] loaded from server (profile suffix "${profileSuffix}"):`, Object.keys(result));
      return result;
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
