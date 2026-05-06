/**
 * Атомарная нумерация счетов и актов в формате `MR-СЧТ-2026-00042`.
 * Счётчик per-год хранится в таблице `doc_counters` (см. db.ts).
 * Atomic: используем `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
 */

import { query, initDb } from "./db";

export type DocKind = "invoice" | "act";

const PREFIX: Record<DocKind, string> = {
  invoice: "СЧТ",
  act:     "АКТ",
};

/**
 * Atomically allocate the next document number for the current year.
 * Returns formatted string like "MR-СЧТ-2026-00042".
 */
export async function allocateDocNumber(kind: DocKind, atDate: Date = new Date()): Promise<string> {
  await initDb();
  const year = atDate.getFullYear();
  const rows = await query<{ counter: number }>(
    `INSERT INTO doc_counters (kind, year, counter)
       VALUES ($1, $2, 1)
       ON CONFLICT (kind, year) DO UPDATE
         SET counter = doc_counters.counter + 1
       RETURNING counter`,
    [kind, year],
  );
  const n = rows[0]?.counter ?? 1;
  return `MR-${PREFIX[kind]}-${year}-${String(n).padStart(5, "0")}`;
}
