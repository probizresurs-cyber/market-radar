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
  try {
    await query("UPDATE kp_generations SET status='running' WHERE id=$1", [row.id]);
    const { company, bundle, companyName } = await generateKp(row.url, row.locale as KpLocale);
    await query(
      `UPDATE kp_generations
         SET status='done', company_name=$2, bundle=$3, company=$4, completed_at=NOW(), error=NULL
       WHERE id=$1`,
      [row.id, companyName, JSON.stringify(bundle), JSON.stringify(company)],
    );
  } catch (e) {
    await query(
      "UPDATE kp_generations SET status='error', error=$2 WHERE id=$1",
      [row.id, (e instanceof Error ? e.message : "Ошибка генерации").slice(0, 400)],
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
    // Реанимация «зависших»: running дольше 15 мин → снова queued (процесс мог упасть).
    await query(
      "UPDATE kp_generations SET status='queued' WHERE status='running' AND created_at < NOW() - INTERVAL '15 minutes'",
    ).catch(() => {});
    while (running < CONCURRENCY) {
      const rows = await query<{ id: string; url: string; locale: string }>(
        "SELECT id, url, locale FROM kp_generations WHERE status='queued' ORDER BY created_at ASC LIMIT 1",
      );
      if (!rows.length) break;
      // Атомарно захватываем строку, чтобы параллельные tick не взяли одну и ту же.
      const claim = await query(
        "UPDATE kp_generations SET status='running' WHERE id=$1 AND status='queued' RETURNING id",
        [rows[0].id],
      );
      if (!claim.length) continue;
      void processOne(rows[0]);
    }
  } finally {
    ticking = false;
  }
}
