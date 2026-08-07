/**
 * Mirror-sync: серверное зеркало для localStorage-ключей, которые пишутся
 * лениво внутри вьюх и НЕ проходят через syncToServer в AppShell.
 *
 * Фаза C.9 ремонта воронки. Аудит показал ~20 per-user ключей (SWOT, TOWS,
 * battle-cards, отзывы, AI-видимость, лендинги, презентации, SEO-модуль,
 * реестр профилей, white-label и др.), которые жили только в localStorage —
 * пользователь, открывший платформу с другого устройства/браузера, терял
 * эти данные. Трогать каждую вьюху — большой рефакторинг; вместо этого
 * прозрачный слой-зеркало:
 *
 *   1. hydrateMirror(uid) — на входе в приложение: тянет m_* ключи из
 *      user_data и раскладывает в localStorage (вьюхи ничего не знают).
 *   2. startMirrorPush(uid) — интервал (45 сек) + visibilitychange:
 *      изменившиеся локальные значения уходят на сервер.
 *
 * Конфликты — last-write-wins по таймстемпу с одной поправкой: если у
 * локальной копии есть незапушенные изменения (hash != последнего
 * синка), локальная побеждает даже при более свежем серверном t —
 * активная работа пользователя важнее фоновой синхронизации.
 *
 * На сервере значение хранится обёрнутым: { t: epoch_ms, v: <сырая строка
 * localStorage> }. Сырая строка, не парсенный JSON — часть ключей хранит
 * не-JSON (id профиля, режим UI), и зеркало не должно ничего знать о формате.
 *
 * Ключи зеркала имеют префикс m_ — не пересекаются ни с 14 основными
 * server-ключами (company/competitors/...), ни с профильными суффиксами ::p_.
 */

interface MirrorEntry { ls: string; server: string }

export function mirrorEntries(uid: string): MirrorEntry[] {
  return [
    { ls: `mr_swot_${uid}`, server: "m_swot" },
    { ls: `mr_tows_${uid}`, server: "m_tows" },
    { ls: `mr_battle_cards_${uid}`, server: "m_battleCards" },
    { ls: `mr_competitor_insights_${uid}`, server: "m_competitorInsights" },
    { ls: `mr_reviews_${uid}`, server: "m_reviews" },
    { ls: `mr_ai_visibility_audits_${uid}`, server: "m_aiVisibilityAudits" },
    { ls: `mr_landings_${uid}`, server: "m_landings" },
    { ls: `mr_premium_decks_${uid}`, server: "m_premiumDecks" },
    { ls: `mr_presentations_${uid}`, server: "m_presentations" },
    { ls: `mr_trends_${uid}`, server: "m_trends" },
    { ls: `mr_seo_keywords_${uid}`, server: "m_seoKeywords" },
    { ls: `mr_seo_expand_${uid}`, server: "m_seoExpand" },
    { ls: `mr_seo_paa_${uid}`, server: "m_seoPaa" },
    { ls: `mr_seo_${uid}`, server: "m_seoArticle" },
    { ls: `mr_seo_mode_${uid}`, server: "m_seoMode" },
    { ls: `mr_chat_history_${uid}`, server: "m_chatHistory" },
    { ls: `mr_whitelabel_${uid}`, server: "m_whitelabel" },
    // Реестр бизнес-профилей — критичный: без него серверные данные
    // вторичных профилей (company::p_xxx) на новом устройстве недостижимы.
    { ls: `mr_profiles_${uid}`, server: "m_profiles" },
    { ls: `mr_active_profile_${uid}`, server: "m_activeProfile" },
    // ЦА: двухслотовая (B2C+B2B). Легаси-ключ `ta` хранит только один
    // результат — второй слот терялся между устройствами.
    { ls: `mr_ta_${uid}_b2c`, server: "m_taB2c" },
    { ls: `mr_ta_${uid}_b2b`, server: "m_taB2b" },
    // AI-саммари дашбордов (AISummary.tsx) — кэш без userId-суффикса
    // (компонент его не передаёт), но /api/data и так скопирован по сессии.
    { ls: "mr_aisum_company", server: "m_aisumCompany" },
    { ls: "mr_aisum_ta", server: "m_aisumTa" },
    { ls: "mr_aisum_smm", server: "m_aisumSmm" },
    { ls: "mr_aisum_reviews", server: "m_aisumReviews" },
    // Тестовая админка промо-роликов (/admin/promo-reels) — та же сессия
    // (getSessionUser), ключи без userId-суффикса.
    { ls: "mr_admin_promo_reel_form", server: "m_adminPromoReelForm" },
    { ls: "mr_admin_promo_reels", server: "m_adminPromoReels" },
  ];
}

// Офферы конкурентов (CompetitorProfileView/DashboardView) — ключ
// mr_offers_<company.url||name> для произвольного числа компаний
// (своя + N конкурентов), заранее неизвестных. Фиксированный список
// mirrorEntries() тут не подходит — сканируем localStorage по префиксу.
const SCAN_PREFIXES = ["mr_offers_"];
const SCAN_SERVER_PREFIX = "m_scan_";

function scannedLocalEntries(): MirrorEntry[] {
  if (typeof window === "undefined") return [];
  const out: MirrorEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const ls = localStorage.key(i);
      if (ls && SCAN_PREFIXES.some((p) => ls.startsWith(p))) {
        out.push({ ls, server: SCAN_SERVER_PREFIX + ls });
      }
    }
  } catch { /* ignore */ }
  return out;
}

/**
 * Профильные варианты зеркальных ключей.
 *
 * Вьюхи получают `userId` из AppShell как `workspaceLsId`, а он равен
 * `<owner|user>.id + profileSuffix` (см. AppShell: `baseLsId + profileSuffix`).
 * То есть при активном не-default профиле ключ выглядит как
 * `mr_presentations_<uid>__p_<profileId>`, тогда как mirrorEntries() знает
 * только `mr_presentations_<uid>`. Из-за этого история презентаций, премиум-дек
 * и лендингов в любом профиле кроме «Основного» НИКОГДА не уезжала на сервер:
 * локально всё было, а на другом устройстве/после чистки кэша — пусто.
 *
 * Чиним симметрично уже принятой в проекте схеме серверных суффиксов
 * (profileServerSuffix из lib/profiles): `m_presentations::p_<profileId>`.
 *
 * Направления разные, поэтому источников тоже два:
 *  - push: профили находим сканированием localStorage (что есть в браузере);
 *  - hydrate: сканированием ключей, пришедших с сервера (что есть в аккаунте).
 */
function profileVariants(uid: string, serverKeys: string[]): MirrorEntry[] {
  const out: MirrorEntry[] = [];
  const seen = new Set<string>();
  const add = (ls: string, server: string) => {
    if (seen.has(ls)) return;
    seen.add(ls);
    out.push({ ls, server });
  };

  for (const base of mirrorEntries(uid)) {
    // Профильный суффикс дописывается к uid, поэтому фиксированные ключи
    // без uid (mr_aisum_*, mr_admin_*) профилей не имеют — пропускаем.
    if (!base.ls.includes(uid)) continue;

    // 1) Что лежит в localStorage прямо сейчас (для push).
    if (typeof window !== "undefined") {
      const lsPrefix = `${base.ls}__p_`;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(lsPrefix)) {
            add(k, `${base.server}::p_${k.slice(lsPrefix.length)}`);
          }
        }
      } catch { /* ignore */ }
    }

    // 2) Что уже есть на сервере (для hydrate на новом устройстве, где
    //    в localStorage ещё пусто и сканировать нечего).
    const srvPrefix = `${base.server}::p_`;
    for (const sk of serverKeys) {
      if (sk.startsWith(srvPrefix)) {
        add(`${base.ls}__p_${sk.slice(srvPrefix.length)}`, sk);
      }
    }
  }
  return out;
}

interface Wrapped { t: number; v: string }
interface MetaMap { [serverKey: string]: { h: string; t: number } }

// Значения крупнее лимита не зеркалим (413/раздувание БД) — лучше честно
// потерять кэш одного экрана, чем сломать синк всем остальным.
const MAX_VALUE_BYTES = 2_000_000;

function metaKey(uid: string): string { return `mr_mirror_meta_${uid}`; }

function readMeta(uid: string): MetaMap {
  try { return JSON.parse(localStorage.getItem(metaKey(uid)) ?? "{}") as MetaMap; }
  catch { return {}; }
}

function writeMeta(uid: string, meta: MetaMap): void {
  try { localStorage.setItem(metaKey(uid), JSON.stringify(meta)); } catch { /* quota — не критично */ }
}

// djb2 — быстрый нестойкий хэш; нужен только для «изменилось ли», не для безопасности.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${h}:${s.length}`;
}

function isWrapped(x: unknown): x is Wrapped {
  return typeof x === "object" && x !== null && typeof (x as Wrapped).t === "number" && typeof (x as Wrapped).v === "string";
}

/**
 * Гидратация при входе: сервер → localStorage. Вызывать ДО первого рендера
 * вьюх (в initApp, до setAppScreen) — вьюхи читают localStorage на маунте.
 */
export async function hydrateMirror(uid: string): Promise<void> {
  if (typeof window === "undefined") return;
  let serverData: Record<string, unknown>;
  try {
    const res = await fetch("/api/data", { credentials: "include" });
    const json = await res.json();
    if (!json.ok) return;
    serverData = (json.data ?? {}) as Record<string, unknown>;
  } catch { return; } // офлайн/ошибка — работаем с локальными данными как раньше

  const meta = readMeta(uid);
  let metaDirty = false;

  const applyEntry = (entry: MirrorEntry) => {
    const remote = serverData[entry.server];
    if (!isWrapped(remote)) return;
    const local = localStorage.getItem(entry.ls);
    const m = meta[entry.server];

    if (local === null) {
      // Нового устройства/браузера случай — просто раскладываем.
      try { localStorage.setItem(entry.ls, remote.v); } catch { return; }
      meta[entry.server] = { h: hash(remote.v), t: remote.t };
      metaDirty = true;
      return;
    }

    const localHash = hash(local);
    if (localHash === hash(remote.v)) {
      if (!m || m.t !== remote.t) { meta[entry.server] = { h: localHash, t: remote.t }; metaDirty = true; }
      return;
    }
    // Расхождение. Локальные незапушенные правки (hash != последнего синка)
    // побеждают всегда — их подхватит ближайший push-тик.
    const hasUnpushedLocal = !m || m.h !== localHash;
    if (!hasUnpushedLocal && remote.t > (m?.t ?? 0)) {
      try { localStorage.setItem(entry.ls, remote.v); } catch { return; }
      meta[entry.server] = { h: hash(remote.v), t: remote.t };
      metaDirty = true;
    }
  };

  for (const entry of mirrorEntries(uid)) applyEntry(entry);

  // Профильные варианты (mr_presentations_<uid>__p_<id> и т.п.) — источником
  // служат ключи с сервера, потому что на новом устройстве локально их ещё нет.
  for (const entry of profileVariants(uid, Object.keys(serverData))) applyEntry(entry);

  // Скан-ключи (mr_offers_*): объединяем то, что уже есть локально, с тем,
  // что сервер знает, но локально ещё не появилось (новое устройство).
  const scanEntries = new Map(scannedLocalEntries().map((e) => [e.server, e]));
  for (const serverKey of Object.keys(serverData)) {
    if (serverKey.startsWith(SCAN_SERVER_PREFIX) && !scanEntries.has(serverKey)) {
      scanEntries.set(serverKey, { ls: serverKey.slice(SCAN_SERVER_PREFIX.length), server: serverKey });
    }
  }
  for (const entry of scanEntries.values()) applyEntry(entry);

  if (metaDirty) writeMeta(uid, meta);
}

async function pushChanged(uid: string): Promise<void> {
  const meta = readMeta(uid);
  let metaDirty = false;
  // profileVariants здесь берёт профили из localStorage (serverKeys не нужны —
  // пушим ровно то, что лежит в браузере).
  for (const entry of [...mirrorEntries(uid), ...profileVariants(uid, []), ...scannedLocalEntries()]) {
    let local: string | null = null;
    try { local = localStorage.getItem(entry.ls); } catch { continue; }
    if (local === null) continue;
    if (local.length > MAX_VALUE_BYTES) {
      // Молчаливый пропуск был отдельным источником «данные исчезли»:
      // история презентаций с инлайн-картинками легко перевешивает лимит.
      console.warn(`[mirror-sync] ${entry.ls} — ${(local.length / 1024 / 1024).toFixed(1)}МБ, больше лимита ${MAX_VALUE_BYTES / 1024 / 1024}МБ. Не синкается на сервер.`);
      continue;
    }
    const h = hash(local);
    if (meta[entry.server]?.h === h) continue;

    const t = Date.now();
    try {
      // Прямой POST без syncToServer: тот добавляет суффикс активного
      // профиля, а зеркальные ключи — uid-scoped, без профилей.
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: entry.server, value: { t, v: local } satisfies Wrapped }),
        credentials: "include",
      });
      if (res.ok) { meta[entry.server] = { h, t }; metaDirty = true; }
    } catch { /* сеть моргнула — доедет следующим тиком */ }
  }
  if (metaDirty) writeMeta(uid, meta);
}

let pushTimer: ReturnType<typeof setInterval> | null = null;
let visHandler: (() => void) | null = null;

/** Запуск фонового push-цикла. Повторный вызов (смена аккаунта) перезапускает. */
export function startMirrorPush(uid: string): void {
  if (typeof window === "undefined") return;
  stopMirrorPush();
  pushTimer = setInterval(() => { void pushChanged(uid); }, 45_000);
  visHandler = () => { if (document.visibilityState === "hidden") void pushChanged(uid); };
  document.addEventListener("visibilitychange", visHandler);
  // Первый push вскоре после старта — подтянуть то, что накопилось офлайн.
  setTimeout(() => { void pushChanged(uid); }, 5_000);
}

export function stopMirrorPush(): void {
  if (pushTimer) { clearInterval(pushTimer); pushTimer = null; }
  if (visHandler) { document.removeEventListener("visibilitychange", visHandler); visHandler = null; }
}
