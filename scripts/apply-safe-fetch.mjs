#!/usr/bin/env node
/**
 * Массовая замена `await res.json()` → `await jsonOrThrow(res)` во всех
 * компонентах. Помогает с криптической ошибкой «Unexpected token '<'».
 *
 * Использует balanced-brace matching для корректного захвата сложных
 * generic типов с вложенными { } и < >.
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SRC_DIR = 'src/components';
const IMPORT_LINE = 'import { jsonOrThrow } from "@/lib/safe-fetch-json";';
const RESPONSE_VARS = ['res', 'response', 'aiRes', 'avatarRes', 'submitRes', 'avatarStatus', 'r', 'pollRes'];

async function walkFiles(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) files.push(...await walkFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(full);
  }
  return files;
}

/**
 * Находит позицию конца TypeScript type expression — учитывает balanced
 * фигурные/угловые/круглые скобки и игнорирует разделители внутри них.
 * Возвращает индекс первого "стоп-символа" вне любых скобок, где стопы —
 * это `;`, `,`, `)`, `\n` или конец строки.
 */
function findTypeEnd(content, start) {
  let depth = 0;
  let i = start;
  while (i < content.length) {
    const c = content[i];
    if (c === '{' || c === '<' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === '>' || c === ')' || c === ']') {
      if (depth === 0) return i; // closing bracket of enclosing scope
      depth--;
    } else if (depth === 0 && (c === ';' || c === ',' || c === '\n')) {
      return i;
    }
    i++;
  }
  return i;
}

async function processFile(filePath) {
  let content = await readFile(filePath, 'utf-8');
  const original = content;

  for (const v of RESPONSE_VARS) {
    // Паттерн 1: `await <v>.json() as <TYPE>`
    const typedRegex = new RegExp(`await\\s+${v}\\.json\\(\\)\\s+as\\s+`, 'g');
    let match;
    const replacements = [];
    while ((match = typedRegex.exec(content)) !== null) {
      const typeStart = match.index + match[0].length;
      const typeEnd = findTypeEnd(content, typeStart);
      const type = content.slice(typeStart, typeEnd).trim();
      // Сохраняем замену для применения в обратном порядке
      replacements.push({
        start: match.index,
        end: typeEnd,
        replacement: `await jsonOrThrow<${type}>(${v})`,
      });
    }
    // Применяем замены в обратном порядке чтобы индексы не сбились
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }

    // Паттерн 2: `await <v>.json()` без `as`
    content = content.replace(
      new RegExp(`await\\s+${v}\\.json\\(\\)(?!\\s+as\\b)`, 'g'),
      `await jsonOrThrow(${v})`,
    );
  }

  if (content === original) return false;

  // Добавить import если ещё нет
  if (!content.includes('from "@/lib/safe-fetch-json"')) {
    const importRegex = /^import\s.+;$/gm;
    const matches = [...content.matchAll(importRegex)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const insertPos = last.index + last[0].length;
      content = content.slice(0, insertPos) + '\n' + IMPORT_LINE + content.slice(insertPos);
    }
  }

  await writeFile(filePath, content, 'utf-8');
  return true;
}

async function main() {
  const files = await walkFiles(SRC_DIR);
  let changed = 0;
  for (const file of files) {
    try {
      if (await processFile(file)) {
        changed++;
        console.log(`  ✓ ${file}`);
      }
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }
  console.log(`\nИзменено: ${changed} / ${files.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
