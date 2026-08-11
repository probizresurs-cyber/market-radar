// ─────────────────────────────────────────────────────────────────────────────
// Сохранение прогресса между запусками (аналог $getWorkflowStaticData в n8n).
// Позволяет прервать парсинг и продолжить с того же места.
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "state.json");

const DEFAULT_STATE = {
  // позиция курсора по ролям/городам
  roleIndex: 0,
  cityIndex: 0,
  // обработанные employer_id (чтобы не дёргать деталку повторно), по ролям
  processedEmployers: {}, // { rop: ["123","456"], mop: [...] }
};

export async function loadState() {
  if (!existsSync(STATE_PATH)) return structuredClone(DEFAULT_STATE);
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

/** Множество обработанных работодателей для роли (как Set). */
export function processedSet(state, roleKey) {
  return new Set(state.processedEmployers[roleKey] || []);
}

export function commitProcessed(state, roleKey, set) {
  state.processedEmployers[roleKey] = [...set];
}
