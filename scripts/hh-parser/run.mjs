// ─────────────────────────────────────────────────────────────────────────────
// Оркестратор парсинга hh.ru → Google Sheets.
//
// Запуск (Node 20.6+):
//   node --env-file=.env scripts/hh-parser/run.mjs
//   node --env-file=.env scripts/hh-parser/run.mjs --reset          # сбросить прогресс
//   node --env-file=.env scripts/hh-parser/run.mjs --role rop       # только одна роль
//   node --env-file=.env scripts/hh-parser/run.mjs --cities 5       # тест: первые 5 городов
//
// Пайплайн (для каждой роли, по городам в порядке REGION_ORDER):
//   список вакансий → дедуп по работодателю → деталка работодателя →
//   отсев агентств → парсинг телефона с сайта → нормализация/отсев 8-800 →
//   дедуп по таблице → запись в свою вкладку Google Sheet. Прогресс в state.json.
// ─────────────────────────────────────────────────────────────────────────────

import { ROLES, ROLE_ORDER, SETTINGS } from "./config.mjs";
import { buildCityList } from "./areas.mjs";
import {
  sleep,
  fetchVacanciesPage,
  fetchEmployer,
  fetchSiteHtml,
} from "./hh.mjs";
import { extractPhoneFromHtml, normalizeRuPhone, buildRow } from "./phone.mjs";
import { createSheetsWriter } from "./sheets.mjs";
import { loadState, saveState, processedSet, commitProcessed } from "./state.mjs";

// ─── разбор аргументов ───
const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const RESET = hasFlag("--reset");
const ONLY_ROLE = flagValue("--role"); // "rop" | "mop"
const CITY_LIMIT = flagValue("--cities") ? parseInt(flagValue("--cities"), 10) : null;
const MAX_MINUTES = process.env.HH_MAX_MINUTES ? parseInt(process.env.HH_MAX_MINUTES, 10) : null;

const startedAt = Date.now();
const timeUp = () => MAX_MINUTES != null && (Date.now() - startedAt) / 60000 >= MAX_MINUTES;

async function main() {
  console.log("🚀 hh.ru parser → Google Sheets\n");

  const state = await loadState();
  if (RESET) {
    state.roleIndex = 0;
    state.cityIndex = 0;
    state.processedEmployers = {};
    await saveState(state);
    console.log("↺ Прогресс сброшен\n");
  }

  let cities = await buildCityList();
  if (CITY_LIMIT) cities = cities.slice(0, CITY_LIMIT);

  const writer = await createSheetsWriter();

  const roleKeys = ONLY_ROLE ? [ONLY_ROLE] : ROLE_ORDER;

  // корректный старт по сохранённому курсору (только если идём полным списком ролей)
  let startRoleIdx = ONLY_ROLE ? 0 : state.roleIndex;

  let totalAdded = 0;

  // graceful shutdown — сохраняем прогресс
  let stopping = false;
  const onSig = async () => {
    stopping = true;
    console.log("\n⏸ Останавливаюсь, сохраняю прогресс…");
  };
  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);

  for (let ri = startRoleIdx; ri < roleKeys.length; ri++) {
    const role = ROLES[roleKeys[ri]];
    if (!role) {
      console.warn(`⚠ Неизвестная роль: ${roleKeys[ri]}`);
      continue;
    }

    console.log(`\n=== Роль: ${role.label} ("${role.query}") → вкладка "${role.sheet}" ===`);
    await writer.ensureSheet(role.sheet);
    const sheetKeys = await writer.loadExistingKeys(role.sheet); // дедуп по ссылке на hh
    const processed = processedSet(state, role.key);

    // если возобновляем ту же роль — продолжаем с сохранённого города
    const startCityIdx = !ONLY_ROLE && ri === startRoleIdx ? state.cityIndex : 0;

    for (let ci = startCityIdx; ci < cities.length; ci++) {
      if (stopping || timeUp()) break;
      const { areaId, city, region, fd } = cities[ci];

      const rows = await processCity({ role, areaId, processed, sheetKeys });
      if (rows.length) {
        await writer.appendRows(role.sheet, rows);
        rows.forEach((r) => r.hh_url && sheetKeys.add(r.hh_url));
        totalAdded += rows.length;
      }
      console.log(
        `  [${fd}] ${city} (${region}) → +${rows.length} | всего за запуск: ${totalAdded}`
      );

      // сохраняем прогресс после каждого города
      if (!ONLY_ROLE) {
        state.roleIndex = ri;
        state.cityIndex = ci + 1;
      }
      commitProcessed(state, role.key, processed);
      await saveState(state);
    }

    if (stopping || timeUp()) break;

    // роль завершена — курсор на начало следующей
    if (!ONLY_ROLE) {
      state.roleIndex = ri + 1;
      state.cityIndex = 0;
      await saveState(state);
    }
  }

  // полный проход завершён без остановки — сбрасываем курсор для следующего цикла
  if (!stopping && !timeUp() && !ONLY_ROLE && startRoleIdx < roleKeys.length) {
    state.roleIndex = 0;
    state.cityIndex = 0;
    await saveState(state);
  }

  console.log(`\n✅ Готово. Добавлено строк за запуск: ${totalAdded}`);
  if (timeUp()) console.log(`⏱ Остановлено по лимиту времени HH_MAX_MINUTES=${MAX_MINUTES}`);
}

/**
 * Обрабатывает один город для роли: листает вакансии, собирает уникальных
 * работодателей, тянет деталку + телефон, возвращает готовые строки для таблицы.
 */
async function processCity({ role, areaId, processed, sheetKeys }) {
  // 1) собрать уникальных работодателей по страницам выдачи
  const employers = new Map(); // employerId -> представительная вакансия
  let pages = 1;
  for (let page = 0; page < Math.min(SETTINGS.maxPages, pages); page++) {
    let res;
    try {
      res = await fetchVacanciesPage({
        text: role.query,
        areaId,
        page,
        perPage: SETTINGS.perPage,
      });
    } catch (e) {
      console.warn(`  ⚠ страница ${page} area=${areaId}: ${e.message}`);
      break;
    }
    pages = res.pages || 1;
    if (res.items.length === 0) break;

    for (const v of res.items) {
      const id = v.employer?.id;
      if (!id || employers.has(id) || processed.has(id)) continue;
      employers.set(id, v);
    }
    await sleep(SETTINGS.delayBetweenPages);
  }

  // 2) для каждого нового работодателя — деталка + телефон
  const rows = [];
  for (const [employerId, vacancy] of employers) {
    processed.add(employerId); // помечаем, чтобы не дёргать повторно

    let employer = null;
    try {
      employer = await fetchEmployer(employerId);
    } catch (e) {
      console.warn(`  ⚠ employer ${employerId}: ${e.message}`);
      continue;
    }
    await sleep(SETTINGS.delayBetweenEmployers);

    // отсев кадровых агентств
    if (SETTINGS.skipAgencies && employer.type === "agency") continue;

    // дедуп по ссылке на hh (на случай, если уже в таблице)
    const hhUrl = employer.alternate_url || vacancy.employer?.alternate_url || "";
    if (hhUrl && sheetKeys.has(hhUrl)) continue;

    // телефон: 1) контакты вакансии (редко публичны)  2) сайт компании
    let phoneRaw = null;
    const vc = vacancy.contacts?.phones?.[0];
    if (vc) phoneRaw = vc.formatted || [vc.country, vc.city, vc.number].filter(Boolean).join("");

    if (!phoneRaw && employer.site_url) {
      const html = await fetchSiteHtml(employer.site_url);
      phoneRaw = extractPhoneFromHtml(html);
      await sleep(SETTINGS.delayBetweenSiteFetches);
    }

    const phone = normalizeRuPhone(phoneRaw);
    rows.push(buildRow(vacancy, employer, phone));
  }

  return rows;
}

main().catch((e) => {
  console.error("\n💥 Фатальная ошибка:", e);
  process.exit(1);
});
