/**
 * Профили под одним аккаунтом.
 *
 * Профиль — независимое рабочее пространство ДАННЫХ внутри одного юзера:
 * у каждого свой анализ компании, конкуренты, ЦА, СММ, брендбук, контент,
 * история. Пример: «ГК Орлинк» (основная компания) + «Личный бренд
 * руководителя». Токены — общий пул на аккаунт (профиль не влияет на биллинг).
 *
 * Реализация — namespace на ключах данных:
 *   - Профиль по умолчанию (default) → ключи БЕЗ суффикса (mr_company_<uid>).
 *     Это сохраняет данные существующих юзеров нетронутыми — они становятся
 *     профилем «Основной» автоматически.
 *   - Доп. профили → суффикс __p_<profileId> (mr_company_<uid>__p_abc123).
 *   - Сервер: ключ данных получает суффикс ::p_<profileId> — миграции БД нет,
 *     UNIQUE(user_id, key) продолжает работать.
 *
 * Профили НЕ зависят от workspace-команд: workspace = шеринг дашборда между
 * людьми, профиль = несколько компаний одного человека. Ортогональные оси.
 */

export const DEFAULT_PROFILE_ID = "default";

export interface Profile {
  id: string;          // "default" для основного, иначе случайный 8-hex
  name: string;        // «Основной», «Личный бренд», ...
  kind: "company" | "personal"; // компания или личный бренд (влияет на иконку/подсказки)
  createdAt: string;
}

/** Лимит профилей по плану. Trial — основной + 2 доп. = 3. Платные — 10. */
export function maxProfilesForPlan(plan: string | null | undefined): number {
  const p = (plan ?? "trial").toLowerCase();
  if (p === "trial" || p === "free") return 3;
  return 10;
}

function profilesKey(uid: string): string {
  return `mr_profiles_${uid}`;
}
function activeProfileKey(uid: string): string {
  return `mr_active_profile_${uid}`;
}

/** Дефолтный профиль — всегда первый, всегда «default». */
function defaultProfile(): Profile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Основной",
    kind: "company",
    // Фиксированная дата — чтобы default не зависел от Date.now() при первом
    // создании (стабильность сериализации/тестов).
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

/** Список профилей юзера. Всегда содержит как минимум default (первым). */
export function getProfiles(uid: string): Profile[] {
  if (typeof window === "undefined") return [defaultProfile()];
  try {
    const raw = localStorage.getItem(profilesKey(uid));
    if (!raw) return [defaultProfile()];
    const arr = JSON.parse(raw) as Profile[];
    if (!Array.isArray(arr) || arr.length === 0) return [defaultProfile()];
    // Гарантируем что default всегда есть и первый
    const hasDefault = arr.some(p => p.id === DEFAULT_PROFILE_ID);
    const list = hasDefault ? arr : [defaultProfile(), ...arr];
    return list.sort((a, b) => (a.id === DEFAULT_PROFILE_ID ? -1 : b.id === DEFAULT_PROFILE_ID ? 1 : 0));
  } catch {
    return [defaultProfile()];
  }
}

export function saveProfiles(uid: string, profiles: Profile[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(profilesKey(uid), JSON.stringify(profiles)); } catch { /* quota */ }
}

/** ID активного профиля. По умолчанию — default. */
export function getActiveProfileId(uid: string): string {
  if (typeof window === "undefined") return DEFAULT_PROFILE_ID;
  try {
    const id = localStorage.getItem(activeProfileKey(uid));
    if (!id) return DEFAULT_PROFILE_ID;
    // Проверяем что профиль ещё существует (не удалён)
    const exists = getProfiles(uid).some(p => p.id === id);
    return exists ? id : DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

export function setActiveProfileId(uid: string, profileId: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(activeProfileKey(uid), profileId); } catch { /* */ }
}

/** Создаёт новый профиль. Возвращает его или null если превышен лимит. */
export function createProfile(
  uid: string,
  name: string,
  kind: Profile["kind"],
  plan: string | null | undefined,
  genId: () => string,
): Profile | null {
  const profiles = getProfiles(uid);
  if (profiles.length >= maxProfilesForPlan(plan)) return null;
  const profile: Profile = {
    id: genId(),
    name: name.trim().slice(0, 60) || (kind === "personal" ? "Личный бренд" : "Новая компания"),
    kind,
    createdAt: new Date().toISOString(),
  };
  saveProfiles(uid, [...profiles, profile]);
  return profile;
}

/** Удаляет профиль (нельзя удалить default). Чистит его localStorage-ключи. */
export function deleteProfile(uid: string, profileId: string): boolean {
  if (profileId === DEFAULT_PROFILE_ID) return false;
  const profiles = getProfiles(uid).filter(p => p.id !== profileId);
  saveProfiles(uid, profiles);
  // Если удаляли активный — переключаемся на default
  if (getActiveProfileId(uid) === profileId) setActiveProfileId(uid, DEFAULT_PROFILE_ID);
  // Чистим все ключи данных этого профиля (по суффиксу __p_<id>)
  if (typeof window !== "undefined") {
    const suffix = `__p_${profileId}`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes(suffix)) toRemove.push(k);
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch { /* */ } });
  }
  return true;
}

/**
 * Суффикс ключа для профиля. Default → "" (обратная совместимость).
 * Применяется к localStorage-ключам: `mr_company_${uid}${profileSuffix(id)}`.
 */
export function profileLsSuffix(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? "" : `__p_${profileId}`;
}

/**
 * Суффикс серверного data-ключа. Default → "" (обратная совместимость).
 * Применяется к ключам /api/data: `company` → `company::p_<id>`.
 */
export function profileServerSuffix(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? "" : `::p_${profileId}`;
}
