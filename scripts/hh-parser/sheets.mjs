// ─────────────────────────────────────────────────────────────────────────────
// Запись в Google Sheets через service account (googleapis).
// Каждая роль пишется в свою вкладку. Дедуп по ссылке на hh-работодателя.
//
// ENV (выбери ОДИН способ авторизации):
//   HH_SPREADSHEET_ID                    — id таблицы (из URL .../d/<ID>/edit)
//   GOOGLE_IMPERSONATE_SERVICE_ACCOUNT   — email СА: работаем ОТ его имени БЕЗ ключа
//                                          (через твой gcloud-логин + impersonation)
//   GOOGLE_SERVICE_ACCOUNT_KEY           — путь к JSON-ключу СА (если ключи разрешены)
//   GOOGLE_SERVICE_ACCOUNT_JSON          — сам JSON-ключ строкой
//   (ничего из СА не задано)             — пишем от твоего личного аккаунта (ADC)
// ─────────────────────────────────────────────────────────────────────────────

import { google } from "googleapis";
import { GoogleAuth, Impersonated, OAuth2Client } from "google-auth-library";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Порядок и заголовки колонок (соответствует твоей таблице)
export const COLUMNS = [
  { header: "Название компании", key: "company" },
  { header: "Телефон", key: "phone" },
  { header: "Описание", key: "description" },
  { header: "Ссылка на hh", key: "hh_url" },
  { header: "Название вакансии", key: "vacancy_name" },
  { header: "Описание вакансии", key: "vacancy_description" },
  { header: "Зп от", key: "salary_from" },
  { header: "До", key: "salary_to" },
  { header: "Ключевые навыки", key: "key_skills" },
  { header: "Место работы", key: "workplace" },
  { header: "Город", key: "city" },
  { header: "Ссылка на вакансию", key: "vacancy_url" },
];

const HEADER_ROW = COLUMNS.map((c) => c.header);
const HH_URL_COL = COLUMNS.findIndex((c) => c.key === "hh_url"); // индекс колонки дедупа

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function buildAuth() {
  // 1) Сервисный аккаунт JSON строкой (для VPS/CI)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log("🔑 Авторизация: service account (JSON из env)");
    return new GoogleAuth({ credentials: creds, scopes: [SHEETS_SCOPE] });
  }

  // 2) Сервисный аккаунт по файлу-ключу
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log("🔑 Авторизация: service account (keyFile)");
    return new GoogleAuth({ keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, scopes: [SHEETS_SCOPE] });
  }

  // 3) Impersonation — СЕРВИСНЫЙ АККАУНТ БЕЗ КЛЮЧА.
  //    Твой gcloud-логин (ADC) «выдаёт себя» за сервисный аккаунт.
  //    Требуется: у твоего аккаунта роль roles/iam.serviceAccountTokenCreator на этом СА,
  //    включён IAM Service Account Credentials API, таблица расшарена на email СА.
  if (process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT) {
    const target = process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT;
    console.log(`🔑 Авторизация: impersonation СА без ключа → ${target}`);
    const sourceAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const sourceClient = await sourceAuth.getClient();
    return new Impersonated({
      sourceClient,
      targetPrincipal: target,
      targetScopes: [SHEETS_SCOPE],
      lifetime: 3600,
    });
  }

  // 4) OAuth твоим личным аккаунтом — БЕЗ gcloud и БЕЗ ключа.
  //    Используется, если есть token.json (создаётся `node authorize.mjs`).
  const tokenPath = join(__dirname, "token.json");
  const clientPath = process.env.GOOGLE_OAUTH_CLIENT || join(__dirname, "oauth-client.json");
  if (existsSync(tokenPath) && existsSync(clientPath)) {
    const cfg = JSON.parse(await readFile(clientPath, "utf8"));
    const c = cfg.installed || cfg.web;
    const tokens = JSON.parse(await readFile(tokenPath, "utf8"));
    const oauth = new OAuth2Client(c.client_id, c.client_secret);
    oauth.setCredentials(tokens); // refresh_token → токен обновляется автоматически
    console.log("🔑 Авторизация: OAuth (личный аккаунт, token.json, без gcloud)");
    return oauth;
  }

  // 5) Application Default Credentials — БЕЗ ключа, от твоего личного аккаунта (нужен gcloud).
  //    Подхватывает токен от `gcloud auth application-default login`
  //    (логин со scope spreadsheets) либо GOOGLE_APPLICATION_CREDENTIALS.
  console.log("🔑 Авторизация: ADC (gcloud, личный аккаунт, без ключа)");
  return new GoogleAuth({ scopes: [SHEETS_SCOPE] });
}

export async function createSheetsWriter() {
  const spreadsheetId = process.env.HH_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Не задан HH_SPREADSHEET_ID");

  const auth = await buildAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // кэш существующих заголовков вкладок -> Set ключей дедупа
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = new Set(meta.data.sheets.map((s) => s.properties.title));

  /** Создаёт вкладку с шапкой, если её нет. */
  async function ensureSheet(title) {
    if (!existingTabs.has(title)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      existingTabs.add(title);
    }
    // гарантируем строку заголовков
    const first = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${title}!A1:${colLetter(COLUMNS.length)}1`,
    });
    if (!first.data.values || first.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
    }
  }

  /** Множество уже записанных ключей дедупа (ссылок на hh) во вкладке. */
  async function loadExistingKeys(title) {
    const col = colLetter(HH_URL_COL + 1);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${title}!${col}2:${col}`,
    });
    const rows = res.data.values || [];
    return new Set(rows.map((r) => (r[0] || "").trim()).filter(Boolean));
  }

  /** Дописывает строки (массив объектов с ключами COLUMNS[*].key). */
  async function appendRows(title, rows) {
    if (!rows.length) return;
    const values = rows.map((r) => COLUMNS.map((c) => r[c.key] ?? ""));
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }

  return { ensureSheet, loadExistingKeys, appendRows };
}

// Номер колонки (1-based) -> буква (A, B, ... Z, AA)
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
