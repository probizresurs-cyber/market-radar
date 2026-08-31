import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { generateKp, type KpLocale } from "@/lib/kp-generate";
import { notifyKpReady } from "@/lib/kp-notify";

/**
 * Очередь генерации КП. Менеджер может закинуть несколько ссылок — каждая
 * становится строкой kp_generations(status='queued'), а фоновый воркер
 * обрабатывает их с ограниченной параллельностью. Состояние — в БД
 * (переживает перезапуск процесса), воркер — module-singleton внутри PM2.
 */

const CONCURRENCY = 2;
// Потолок затрат на публичные генерации: столько КП source='public' может
// СТАРТОВАТЬ за скользящие 24 часа. Сверх — ждут в очереди, не отказ.
const PUBLIC_DAILY_BUDGET = 40;
let running = 0;
let ticking = false;

// Простое человекочитаемое слово-пароль для шеринга (легко продиктовать).
const WORDS = ["radar", "astro", "orbit", "pulse", "delta", "north", "vega", "comet", "atlas", "flint"];
function makeSharePassword(): string {
  const w = WORDS[Math.floor((Date.now() / 1000) % WORDS.length)];
  return `${w}${Math.floor(10 + Math.random() * 89)}`; // напр. astro42
}

export async function enqueueKp(
  url: string,
  locale: KpLocale,
  // Фаза C: постановка из карточки лида (/admin/leads) — сразу привязываем
  // лид и переносим его контакты, чтобы менеджеру в /kp-ru не пришлось
  // вбивать email руками, а воронка (kp-followups, magic-link) знала клиента.
  // source='user' — онбординг: человек зарегистрировался и КП генерируется
  // ему самому. Отличается от 'public' тем, что сразу привязано к аккаунту
  // (platformUserId), поэтому по готовности анализ уезжает в его дашборд без
  // участия менеджера. Публичный статус-роут такие генерации не отдаёт.
  opts?: { leadId?: string; companyName?: string; clientEmail?: string; clientPhone?: string; source?: "manager" | "public" | "user"; clientIp?: string; platformUserId?: string },
): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO kp_generations (id, locale, url, status, share_token, share_password, lead_id, company_name, client_email, client_phone, source, client_ip, platform_user_id)
     VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id, locale, url,
      randomUUID().replace(/-/g, "").slice(0, 12), makeSharePassword(),
      opts?.leadId ?? null, opts?.companyName ?? null, opts?.clientEmail ?? null, opts?.clientPhone ?? null,
      opts?.source ?? "manager", opts?.clientIp ?? null, opts?.platformUserId ?? null,
    ],
  );
  void tick();
  return id;
}

/**
 * Копия готовой генерации для другого лида — без повторного вызова Claude.
 *
 * Раньше второй человек, запросивший разбор того же сайта в течение суток,
 * просто получал id ЧУЖОЙ генерации. Его email не записывался (COALESCE не
 * перетирает первый), а значит письмо со ссылкой уходило первому, дожим
 * работал по первому, и второй лид тихо терялся — при том что он прошёл всю
 * воронку до конца.
 *
 * Содержимое разбора по одному и тому же сайту одинаково, поэтому bundle и
 * company копируются как есть: экономия Claude сохраняется полностью, а
 * ссылка, контакты, отписка и дожим у каждого лида свои.
 */
export async function cloneKpForLead(
  sourceId: string,
  opts: { clientEmail?: string; clientPhone?: string; clientIp?: string; source?: "public" | "user" },
): Promise<string | null> {
  const rows = await query<{ locale: string; url: string; company_name: string | null; bundle: unknown; company: unknown; status: string }>(
    "SELECT locale, url, company_name, bundle, company, status FROM kp_generations WHERE id = $1",
    [sourceId],
  );
  const src = rows[0];
  if (!src || src.status !== "done") return null;

  const id = randomUUID();
  await query(
    `INSERT INTO kp_generations
       (id, locale, url, status, share_token, share_password, company_name, bundle, company,
        client_email, client_phone, source, client_ip, completed_at)
     VALUES ($1, $2, $3, 'done', $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
    [
      id, src.locale, src.url,
      randomUUID().replace(/-/g, "").slice(0, 12), makeSharePassword(),
      src.company_name, JSON.stringify(src.bundle), JSON.stringify(src.company),
      opts.clientEmail ?? null, opts.clientPhone ?? null, opts.source ?? "public", opts.clientIp ?? null,
    ],
  );
  // Уведомление о готовности — обычным путём: ссылка уезжает на почту сразу,
  // как и у генерации, собранной с нуля.
  void notifyKpReady(id).catch(() => {});
  return id;
}

async function processOne(row: { id: string; url: string; locale: string }) {
  running++;
  const started = Date.now();
  console.info(`[kp-queue] → старт генерации ${row.id.slice(0, 8)} (${row.locale}) ${row.url}`);
  try {
    const { company, bundle, companyName } = await generateKp(row.url, row.locale as KpLocale);
    await query(
      `UPDATE kp_generations
         SET status='done', company_name=$2, bundle=$3, company=$4, completed_at=NOW(), error=NULL
       WHERE id=$1`,
      [row.id, companyName, JSON.stringify(bundle), JSON.stringify(company)],
    );
    console.info(`[kp-queue] ✓ готово ${row.id.slice(0, 8)} «${companyName}» за ${Math.round((Date.now() - started) / 1000)}с`);
    // Ссылка не должна жить только на открытой странице: человек, закрывший
    // вкладку за 2–3 минуты сборки, получает её на почту/в TG сразу.
    void notifyKpReady(row.id).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка генерации";
    console.error(`[kp-queue] ✗ ошибка ${row.id.slice(0, 8)} ${row.url} за ${Math.round((Date.now() - started) / 1000)}с: ${msg}`);
    await query(
      "UPDATE kp_generations SET status='error', error=$2, completed_at=NOW() WHERE id=$1",
      [row.id, msg.slice(0, 400)],
    );
    // Упавший публичный лид — сигнал менеджеру «собери руками», а не тишина.
    void notifyKpReady(row.id).catch(() => {});
  } finally {
    running--;
    void tick();
  }
}

/** Подбирает queued-строки и запускает их, соблюдая лимит параллельности. */
export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    // Реанимация «зависших»: считаем от СТАРТА (started_at), а не постановки —
    // иначе задача, отстоявшая очередь, перезапускалась бы прямо во время
    // честной работы. COALESCE — для строк, захваченных старым кодом без
    // started_at. Больше 3 попыток → error, чтобы не крутиться вечно.
    await query(
      `UPDATE kp_generations
         SET status = CASE WHEN attempts >= 3 THEN 'error' ELSE 'queued' END,
             error  = CASE WHEN attempts >= 3 THEN 'Генерация зависала 3 раза подряд — проверьте сайт и запустите заново' ELSE error END
       WHERE status='running' AND COALESCE(started_at, created_at) < NOW() - INTERVAL '10 minutes'`,
    ).catch(() => {});
    // Дневной бюджет публичных генераций проверяется ЗДЕСЬ, а не отказом в
    // POST: оплаченный клик из Директа не должен получать «попробуйте
    // завтра». Лид оставляет email всегда; при исчерпанном бюджете его КП
    // просто ждёт в очереди, пока 24-часовое окно освободится, и ссылка
    // уезжает письмом (kp-notify). Менеджерские и user-КП бюджет не занимают.
    const pubBudget = await query<{ n: string }>(
      `SELECT COUNT(*) n FROM kp_generations
        WHERE source='public' AND started_at > NOW() - INTERVAL '24 hours'`,
    ).then(r => Number(r[0]?.n ?? 0)).catch(() => 0);
    const publicAllowed = pubBudget < PUBLIC_DAILY_BUDGET;
    while (running < CONCURRENCY) {
      const rows = await query<{ id: string; url: string; locale: string }>(
        publicAllowed
          ? "SELECT id, url, locale FROM kp_generations WHERE status='queued' ORDER BY created_at ASC LIMIT 1"
          : "SELECT id, url, locale FROM kp_generations WHERE status='queued' AND source <> 'public' ORDER BY created_at ASC LIMIT 1",
      );
      if (!rows.length) break;
      // Атомарно захватываем строку, чтобы параллельные tick не взяли одну и ту же.
      const claim = await query(
        "UPDATE kp_generations SET status='running', started_at=NOW(), attempts=attempts+1 WHERE id=$1 AND status='queued' RETURNING id",
        [rows[0].id],
      );
      if (!claim.length) continue;
      void processOne(rows[0]);
    }
  } finally {
    ticking = false;
  }
}

// Отложенные из-за бюджета КП обязаны стартовать и без внешнего толчка:
// tick сам по себе срабатывает только на enqueue и завершение генерации, а
// освобождение 24-часового окна — событие времени. Раз в 10 минут достаточно.
declare global {
  // eslint-disable-next-line no-var
  var __mrKpQueueInterval: NodeJS.Timeout | undefined;
}
if (typeof setInterval !== "undefined" && !globalThis.__mrKpQueueInterval) {
  globalThis.__mrKpQueueInterval = setInterval(() => { void tick(); }, 10 * 60 * 1000);
}
