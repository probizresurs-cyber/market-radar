// ─────────────────────────────────────────────────────────────────────────────
// Разовая OAuth-авторизация твоим личным Google-аккаунтом — БЕЗ gcloud и БЕЗ ключа.
//
// Подготовка (один раз, в Google Cloud Console):
//   1. APIs & Services → OAuth consent screen → User type External → заполнить,
//      добавить себя в Test users, scope можно не добавлять.
//   2. APIs & Services → Credentials → Create credentials → OAuth client ID →
//      Application type: Desktop app → создать → Download JSON.
//   3. Положить скачанный файл в scripts/hh-parser/oauth-client.json
//   4. Включить Google Sheets API.
//
// Запуск:  node scripts/hh-parser/authorize.mjs
//   → откроется ссылка, разрешаешь доступ, токен сохранится в token.json.
// Дальше парсер сам использует token.json (см. sheets.mjs).
// ─────────────────────────────────────────────────────────────────────────────

import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OAuth2Client } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_PATH = process.env.GOOGLE_OAUTH_CLIENT || join(__dirname, "oauth-client.json");
const TOKEN_PATH = join(__dirname, "token.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!existsSync(CLIENT_PATH)) {
  console.error(
    `❌ Нет файла OAuth-клиента: ${CLIENT_PATH}\n` +
      `   Создай OAuth client ID (Desktop app) в Google Cloud Console и скачай JSON сюда.`
  );
  process.exit(1);
}

const raw = JSON.parse(await readFile(CLIENT_PATH, "utf8"));
const cfg = raw.installed || raw.web;
if (!cfg?.client_id) throw new Error("oauth-client.json: не найдена секция installed/web с client_id");

const client = new OAuth2Client(cfg.client_id, cfg.client_secret, REDIRECT_URI);
const authUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // гарантирует выдачу refresh_token
  scope: SCOPES,
});

console.log("\n🔗 Открой эту ссылку в браузере и разреши доступ:\n");
console.log(authUrl + "\n");

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith("/oauth2callback")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const url = new URL(req.url, REDIRECT_URI);
    const err = url.searchParams.get("error");
    const c = url.searchParams.get("code");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<h3>Готово. Можно закрыть вкладку и вернуться в терминал.</h3>");
    server.close();
    if (err) reject(new Error(err));
    else resolve(c);
  });
  server.listen(PORT, () => console.log(`⏳ Жду редирект на ${REDIRECT_URI} …`));
});

const { tokens } = await client.getToken(code);
if (!tokens.refresh_token) {
  console.warn(
    "⚠ refresh_token не пришёл. Зайди в https://myaccount.google.com/permissions, удали доступ приложения и повтори."
  );
}
await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
console.log(`\n✅ Токен сохранён: ${TOKEN_PATH}\nТеперь запускай: pnpm hh:parse`);
