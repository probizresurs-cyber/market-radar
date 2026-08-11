// ─────────────────────────────────────────────────────────────────────────────
// Локальный воркер парсера hh.ru (запускается на ТВОЁМ компе → жилой IP, hh пускает).
//
// Что делает:
//   • подключается к Postgres на VPS через SSH-туннель (localhost:5433 → VPS:5432);
//   • берёт из очереди (parse_runs.status='queued') запуски, поставленные дашбордом;
//   • парсит hh, пишет лиды в Postgres (leads) И в Google Sheets;
//   • обновляет счётчики прогона; умеет останавливаться по сигналу из дашборда;
//   • простой cron-планировщик из таблицы schedule (когда комп включён).
//
// Запуск:  node --env-file=.env.worker local-worker.mjs
// Нужен открытый SSH-туннель (см. start-worker.bat).
// ─────────────────────────────────────────────────────────────────────────────

import pg from "pg";
import { ROLES, SETTINGS } from "./config.mjs";
import { buildCityList } from "./areas.mjs";
import { sleep, fetchVacanciesPage, fetchEmployer, fetchSiteHtml } from "./hh.mjs";
import { extractPhoneFromHtml, normalizeRuPhone, buildRow } from "./phone.mjs";
import { createSheetsWriter } from "./sheets.mjs";

const { Pool } = pg;

const POLL_MS = 5000;
const SCHED_MS = 30000;

// ─── Очередь ───
async function claimNext(pool) {
  const { rows } = await pool.query(
    `UPDATE parse_runs SET status='running', started_at=now()
       WHERE id = (SELECT id FROM parse_runs WHERE status='queued' ORDER BY id LIMIT 1)
       RETURNING *`
  );
  return rows[0] || null;
}

async function isStopRequested(pool, id) {
  const { rows } = await pool.query(`SELECT status FROM parse_runs WHERE id=$1`, [id]);
  return rows[0]?.status === "stopping";
}

async function updateCounters(pool, id, c) {
  await pool.query(
    `UPDATE parse_runs SET regions_done=$2, vacancies_seen=$3, employers_seen=$4,
            leads_new=$5, phones_found=$6 WHERE id=$1`,
    [id, c.regionsDone, c.vacanciesSeen, c.employersSeen, c.leadsNew, c.phonesFound]
  );
}

// ─── Обработка одного региона (зеркало engine.ts) ───
async function processCity(query, c, known) {
  const employers = new Map();
  let vacanciesSeen = 0;
  let pages = 1;

  for (let page = 0; page < Math.min(SETTINGS.maxPages, pages); page++) {
    let res;
    try {
      res = await fetchVacanciesPage({ text: query, areaId: c.areaId, page, perPage: SETTINGS.perPage });
    } catch (e) {
      console.warn(`[engine] страница ${page} area=${c.areaId}: ${e.message}`);
      break;
    }
    pages = res.pages || 1;
    if (res.items.length === 0) break;
    vacanciesSeen += res.items.length;
    for (const v of res.items) {
      const id = v.employer?.id;
      if (!id || employers.has(id) || known.has(id)) continue;
      employers.set(id, v);
    }
    await sleep(SETTINGS.delayBetweenPages);
  }

  const candidates = [];
  for (const [employerId, vacancy] of employers) {
    known.add(employerId);
    let employer = null;
    try {
      employer = await fetchEmployer(employerId);
    } catch (e) {
      console.warn(`[engine] employer ${employerId}: ${e.message}`);
      continue;
    }
    await sleep(SETTINGS.delayBetweenEmployers);

    if (SETTINGS.skipAgencies && employer.type === "agency") continue;

    let phoneRaw = null;
    const vc = vacancy.contacts?.phones?.[0];
    if (vc) phoneRaw = vc.formatted || [vc.country, vc.city, vc.number].filter(Boolean).join("");
    if (!phoneRaw && employer.site_url) {
      const html = await fetchSiteHtml(employer.site_url);
      phoneRaw = extractPhoneFromHtml(html);
      await sleep(SETTINGS.delayBetweenSiteFetches);
    }

    const phone = normalizeRuPhone(phoneRaw);
    candidates.push({ employerId, row: buildRow(vacancy, employer, phone) });
  }

  return { vacanciesSeen, candidates };
}

// ─── Один прогон роли ───
async function runParse(pool, run, sheets) {
  const role = ROLES[run.role];
  if (!role) {
    await pool.query(`UPDATE parse_runs SET status='error', error=$2, finished_at=now() WHERE id=$1`,
      [run.id, `Неизвестная роль: ${run.role}`]);
    return;
  }
  console.log(`\n▶ run #${run.id}: ${role.label} (${run.trigger})`);

  const c = { regionsDone: 0, vacanciesSeen: 0, employersSeen: 0, leadsNew: 0, phonesFound: 0 };
  try {
    await sheets.ensureSheet(role.sheet);
    const sheetKeys = await sheets.loadExistingKeys(role.sheet);

    const existing = await pool.query(`SELECT employer_id FROM leads WHERE role=$1`, [role.key]);
    const known = new Set(existing.rows.map((r) => r.employer_id));

    let cities = await buildCityList();
    const params = run.params || {};
    if (params.cityLimit) cities = cities.slice(0, params.cityLimit);

    const t0 = Date.now();
    const timeUp = () => params.maxMinutes != null && (Date.now() - t0) / 60000 >= params.maxMinutes;

    let stopped = false;
    for (const city of cities) {
      if (timeUp() || (await isStopRequested(pool, run.id))) { stopped = true; break; }

      const { vacanciesSeen, candidates } = await processCity(role.query, city, known);
      c.vacanciesSeen += vacanciesSeen;
      c.employersSeen += candidates.length;

      const newRows = [];
      for (const cand of candidates) {
        if (cand.row.hhUrl && sheetKeys.has(cand.row.hhUrl)) continue;
        const ins = await pool.query(
          `INSERT INTO leads (run_id, platform, role, employer_id, company, phone, phone_source,
                              hh_url, vacancy_name, vacancy_url, city, region, fd)
             VALUES ($1,'hh',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT DO NOTHING RETURNING id`,
          [run.id, role.key, cand.employerId, cand.row.company, cand.row.phone || null,
           cand.row.phoneSource, cand.row.hhUrl || null, cand.row.vacancyName || null,
           cand.row.vacancyUrl || null, city.city, city.region, city.fd]
        );
        if (ins.rows.length) {
          newRows.push(cand.row);
          c.leadsNew++;
          if (cand.row.phone) c.phonesFound++;
          if (cand.row.hhUrl) sheetKeys.add(cand.row.hhUrl);
        }
      }
      if (newRows.length) await sheets.appendRows(role.sheet, newRows);

      c.regionsDone++;
      await updateCounters(pool, run.id, c);
      console.log(`  ${city.fd} / ${city.region}: +${newRows.length} (всего ${c.leadsNew}, тел ${c.phonesFound})`);
    }

    await pool.query(
      `UPDATE parse_runs SET regions_done=$2, vacancies_seen=$3, employers_seen=$4,
              leads_new=$5, phones_found=$6, status=$7, finished_at=now() WHERE id=$1`,
      [run.id, c.regionsDone, c.vacanciesSeen, c.employersSeen, c.leadsNew, c.phonesFound,
       stopped ? "stopped" : "done"]
    );
    console.log(`✓ run #${run.id} ${stopped ? "остановлен" : "готов"}: ${c.leadsNew} новых лидов`);
  } catch (e) {
    await pool.query(`UPDATE parse_runs SET status='error', error=$2, finished_at=now() WHERE id=$1`,
      [run.id, e.message]);
    console.error(`✗ run #${run.id} ошибка:`, e.message);
  }
}

// ─── Простой cron-планировщик ───
function fieldMatch(field, value, lo, hi) {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, stepS] = part.split("/");
      const step = Number(stepS);
      let a = lo, b = hi;
      if (range !== "*") {
        if (range.includes("-")) { const [x, y] = range.split("-").map(Number); a = x; b = y; }
        else { a = Number(range); b = hi; }
      }
      for (let v = a; v <= b; v += step) if (v === value) return true;
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (value >= a && value <= b) return true;
    } else if (Number(part) === value) return true;
  }
  return false;
}

function cronMatch(expr, d) {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return false;
  return (
    fieldMatch(f[0], d.getMinutes(), 0, 59) &&
    fieldMatch(f[1], d.getHours(), 0, 23) &&
    fieldMatch(f[2], d.getDate(), 1, 31) &&
    fieldMatch(f[3], d.getMonth() + 1, 1, 12) &&
    fieldMatch(f[4], d.getDay(), 0, 6)
  );
}

async function schedulerTick(pool, lastFired) {
  const { rows } = await pool.query(`SELECT enabled, cron, roles FROM schedule WHERE id=1`);
  const s = rows[0];
  if (!s || !s.enabled) return lastFired;
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (lastFired === minuteKey) return lastFired;
  if (!cronMatch(s.cron, now)) return lastFired;

  const roles = Array.isArray(s.roles) ? s.roles : ["rop", "mop"];
  console.log(`⏰ cron сработал (${s.cron}) → ставлю в очередь: ${roles.join(", ")}`);
  for (const role of roles) {
    await pool.query(
      `INSERT INTO parse_runs (platform, role, trigger, status, params)
         VALUES ('hh', $1, 'cron', 'queued', '{}'::jsonb)`,
      [role]
    );
  }
  return minuteKey;
}

// ─── Главный цикл ───
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL не задан (см. .env.worker)"); process.exit(1); }
  if (!process.env.HH_SPREADSHEET_ID) { console.error("HH_SPREADSHEET_ID не задан"); process.exit(1); }

  const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 8000 });
  pool.on("error", (e) => console.error("[pg] pool error:", e.message));

  try {
    await pool.query("SELECT 1");
    console.log("[pg] подключение к VPS-базе через туннель — OK");
  } catch (e) {
    console.error("[pg] не могу подключиться к базе. Открыт ли SSH-туннель?\n  ", e.message);
    process.exit(1);
  }

  const sheets = await createSheetsWriter();
  console.log("[sheets] Google Sheets — OK");
  console.log("\n🟢 Воркер запущен. Жду задания из дашборда (Ctrl+C — выход).\n");

  let lastFired = "";
  let lastSched = 0;
  process.on("SIGINT", async () => { console.log("\nОстановка…"); await pool.end().catch(() => {}); process.exit(0); });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (Date.now() - lastSched >= SCHED_MS) {
        lastFired = await schedulerTick(pool, lastFired);
        lastSched = Date.now();
      }
      const run = await claimNext(pool);
      if (run) await runParse(pool, run, sheets);
    } catch (e) {
      console.error("[loop]", e.message);
    }
    await sleep(POLL_MS);
  }
}

main();
