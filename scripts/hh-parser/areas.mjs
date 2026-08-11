// ─────────────────────────────────────────────────────────────────────────────
// Построение упорядоченного списка ОБЛАСТЕЙ/РЕГИОНОВ из дерева hh /areas
// согласно REGION_ORDER и EXCLUDED_REGION_KEYS из config.
//
// Крошим по субъектам РФ (area-id региона), а не по отдельным посёлкам:
// поиск по area=<регион> уже охватывает все его города. Это и есть «только города»
// в смысле ТЗ — мы исключаем целиком республики Кавказа, а не перебираем хутора.
// (Лимит hh: до 2000 результатов на запрос; для крупных регионов берём 2000 самых
//  свежих — при ежедневном прогоне с дедупом этого достаточно.)
// ─────────────────────────────────────────────────────────────────────────────

import { REGION_ORDER, EXCLUDED_REGION_KEYS } from "./config.mjs";
import { fetchRussiaAreas } from "./hh.mjs";

const matchesAnyKey = (name, keys) =>
  keys.some((k) => name.toLowerCase().includes(k.toLowerCase()));

/**
 * Возвращает плоский упорядоченный массив регионов:
 *   [{ areaId, city, region, fd }]   (city == название субъекта)
 * Республики Кавказа исключены. Порядок — как в REGION_ORDER.
 */
export async function buildCityList() {
  const russia = await fetchRussiaAreas();
  const subjects = russia.areas || []; // субъекты РФ

  const cities = [];
  const seenAreaIds = new Set();
  const unmatched = [];

  for (const block of REGION_ORDER) {
    for (const regionName of block.regions) {
      const target = regionName.trim().toLowerCase();
      const subject = subjects.find((s) => s.name.trim().toLowerCase() === target);
      if (!subject) {
        unmatched.push(regionName);
        continue;
      }
      if (matchesAnyKey(subject.name, EXCLUDED_REGION_KEYS)) continue;
      if (seenAreaIds.has(subject.id)) continue;

      seenAreaIds.add(subject.id);
      cities.push({
        areaId: subject.id,
        city: subject.name,
        region: subject.name,
        fd: block.fd,
      });
    }
  }

  if (unmatched.length) {
    console.warn(`⚠ Не сопоставлены ключи регионов (проверь config): ${unmatched.join(", ")}`);
  }
  console.log(`📍 Регионов в очереди: ${cities.length}`);
  return cities;
}
