import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { generateKp, type KpLocale } from "@/lib/kp-generate";

/**
 * Очередь генерации КП. Менеджер может закинуть несколько ссылок — каждая
 * становится строкой kp_generations(status='queued'), а фоновый воркер
 * обрабатывает их с ограниченной параллельностью. Состояние — в БД
 * (переживает перезапуск процесса), воркер — module-singleton внутри PM2.
 */

const CONCURRENCY = 2;
let running = 0;
let ticking = false;

// Простое человекочитаемое слово-пароль для шеринга (легко продиктовать).
const WORDS = ["radar", "astro", "orbit", "pulse", "delta", "north", "vega", "comet", "atlas", "flint"];
function makeSharePassword(): string {
  const w = WORDS[Math.floor((Date.now() / 1000) % WORDS.length)];
  return `${w}${Math.floor(10 + Math.random() * 89)}`; // напр. astro42
}

export async function enqueueKp(url: string, locale: KpLocale): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO kp_generations (id, locale, url, status, share_token, share_password)
     VALUES ($1, $2, $3, 'queued', $4, $5)`,
    [id, locale, url, randomUUID().replace(/-/g, "").slice(0, 12), makeSharePassword()],
  );
  void tick();
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка генерации";
    console.error(`[kp-queue] ✗ ошибка ${row.id.slice(0, 8)} ${row.url} за ${Math.round((Date.now() - started) / 1000)}с: ${msg}`);
    await query(
      "UPDATE kp_generations SET status='error', error=$2 WHERE id=$1",
      [row.id, msg.slice(0, 400)],
    );
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
       WHERE status='running' AND COALESCE(started_at, created_at) < NOW() - INTERVAL '20 minutes'`,
    ).catch(() => {});
    while (running < CONCURRENCY) {
      const rows = await query<{ id: string; url: string; locale: string }>(
        "SELECT id, url, locale FROM kp_generations WHERE status='queued' ORDER BY created_at ASC LIMIT 1",
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
