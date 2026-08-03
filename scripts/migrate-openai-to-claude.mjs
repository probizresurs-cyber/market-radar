/**
 * Кодмод: перевод роутов с прямого вызова OpenAI chat/completions на Claude
 * через общий хелпер chatJson (src/lib/ai-chat.ts).
 *
 * Зачем скриптом, а не руками: роутов 18, вызов у них однотипный, а ручная
 * правка такого объёма — это гарантированные опечатки в местах, которые
 * компилятор не поймает (например перепутанный порядок system/user).
 *
 * Скрипт НАМЕРЕННО консервативен: трогает только файлы, где вызов совпал с
 * ожидаемой формой целиком. Всё остальное перечисляет в отчёте для ручной
 * правки — молча пропустить кусок логики хуже, чем не тронуть файл.
 *
 * Запуск:  node scripts/migrate-openai-to-claude.mjs [--apply]
 * Без --apply только показывает, что будет сделано.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";

const APPLY = process.argv.includes("--apply");

const FILES = [
  "analyze-offers", "analyze-performance", "analyze-reviews", "analyze-smm", "analyze-ta",
  "content/reel-breakdown", "content/reel-breakdown/adapt", "content/rewrite", "content/trends",
  "edit-presentation", "expand-prompt", "generate-carousel", "generate-content-plan",
  "generate-reel-scenario", "presentation-speaker-notes", "suggest-brandbook",
].map((p) => `src/app/api/${p}/route.ts`);

/** Вызов fetch к chat/completions целиком, вместе с телом запроса. */
const CALL_RE = new RegExp(
  String.raw`const (\w+) = await (?:fetchWithTimeout|fetch)\(\s*` +
  String.raw`\x60\$\{process\.env\.OPENAI_BASE_URL[^\x60]*\}/v1/chat/completions\x60,\s*\{` +
  String.raw`[\s\S]*?model:\s*"([\w.-]+)",` +
  String.raw`[\s\S]*?\{\s*role:\s*"system",\s*content:\s*([\w.]+)\s*\},` +
  String.raw`\s*\{\s*role:\s*"user",\s*content:\s*([\w.]+)\s*\},` +
  String.raw`[\s\S]*?(?:temperature:\s*([\d.]+),)?` +
  String.raw`[\s\S]*?max_tokens:\s*(\d+),` +
  String.raw`[\s\S]*?\}\),?\s*\}\s*\);`,
  "m",
);

/** Блок обработки ошибки + разбор ответа OpenAI. */
const PARSE_RE = new RegExp(
  String.raw`\s*if \(!\w+\.ok\) \{[\s\S]*?\}\s*` +
  String.raw`const \w+ = await \w+\.json\(\)[^;]*;\s*` +
  String.raw`const (\w+) = \w+\.choices\[0\]\??\.message\??\.content \?\? "\{\}";`,
  "m",
);

const report = { done: [], skipped: [] };

for (const rel of FILES) {
  const file = path.join(process.cwd(), rel);
  let src;
  try { src = await readFile(file, "utf8"); }
  catch { report.skipped.push([rel, "файл не найден"]); continue; }

  const call = src.match(CALL_RE);
  if (!call) { report.skipped.push([rel, "вызов не совпал с ожидаемой формой"]); continue; }
  const parse = src.slice(call.index + call[0].length).match(PARSE_RE);
  if (!parse || parse.index !== 0) { report.skipped.push([rel, "разбор ответа не совпал"]); continue; }

  const [, , model, systemVar, userVar, temperature, maxTokens] = call;
  const rawVar = parse[1];

  // Модель: где был gpt-4o (тяжёлые аналитические промпты) — берём Sonnet,
  // где gpt-4o-mini — Haiku. Соответствие по классу, а не по имени.
  const modelArg = model.includes("mini") ? "" : "\n      model: CHAT_MODEL_SMART,";

  const replacement =
    `const { data: __parsed, raw: ${rawVar}, modelUsed: __modelUsed, error: __aiError } = await chatJson<Record<string, unknown>>({${modelArg}\n` +
    `      system: ${systemVar},\n` +
    `      user: ${userVar},\n` +
    `      maxTokens: ${maxTokens},\n` +
    (temperature ? `      temperature: ${temperature},\n` : "") +
    `    });\n\n` +
    `    if (!__parsed) {\n` +
    `      return NextResponse.json({ ok: false, error: __aiError ?? "AI не вернул валидный JSON" }, { status: 502 });\n` +
    `    }`;

  let out = src.slice(0, call.index) + replacement + src.slice(call.index + call[0].length + parse[0].length);

  // Импорт хелпера вместо ручного fetch.
  const importLine = modelArg
    ? `import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";`
    : `import { chatJson } from "@/lib/ai-chat";`;
  if (!out.includes('from "@/lib/ai-chat"')) {
    out = out.replace(/^(import .+?;\n)/m, `$1${importLine}\n`);
  }

  report.done.push([rel, `${model} -> ${modelArg ? "sonnet" : "haiku"}, max_tokens ${maxTokens}`]);
  if (APPLY) await writeFile(file, out, "utf8");
}

console.log(`\nПереведено: ${report.done.length}`);
for (const [f, note] of report.done) console.log(`  ${f}  (${note})`);
console.log(`\nНе тронуто (нужна ручная правка): ${report.skipped.length}`);
for (const [f, why] of report.skipped) console.log(`  ${f}  — ${why}`);
if (!APPLY) console.log(`\nЭто был сухой прогон. Применить: node scripts/migrate-openai-to-claude.mjs --apply`);
