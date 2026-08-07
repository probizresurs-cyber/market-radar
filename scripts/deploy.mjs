/**
 * Деплой market-radar на прод одной командой: npm run deploy
 *
 * Зачем обёртка: сам deploy.mjs — универсальный, но физически лежит в
 * репозитории лидгена, и запускать его приходилось длинной строкой с восемью
 * переменными DEPLOY_*, предварительно перейдя в чужой проект. Выглядело так,
 * будто market-radar как-то связан с лидгеном, — он не связан. Здесь те же
 * параметры заданы один раз и по месту.
 *
 * Что важно знать про сам деплой:
 *  - DEPLOY_GIT=1 значит «пакуем git archive HEAD», то есть уезжает ТОЛЬКО
 *    закоммиченное. Незакоммиченные правки молча не попадут на сервер.
 *  - Пуш в origin не нужен и не используется: тарбол собирается из локального
 *    HEAD и заливается по SSH.
 *  - DEPLOY_NO_INSTALL=1 — npm install на сервере пропускается. Если добавили
 *    зависимость, запустите с флагом --install.
 *
 * Использование:
 *   npm run deploy              обычный деплой
 *   npm run deploy -- --install деплой с npm install на сервере
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(here, "..");

// Путь к универсальному скрипту. Переопределяется через MR_DEPLOY_SCRIPT,
// если репозиторий лидгена лежит в другом месте.
const deployScript =
  process.env.MR_DEPLOY_SCRIPT ||
  path.join(projectRoot, "..", "marketradar-leadgen", "scripts", "deploy.mjs");

if (!existsSync(deployScript)) {
  console.error(
    `Не найден deploy.mjs: ${deployScript}\n` +
    "Укажите путь явно: MR_DEPLOY_SCRIPT=<путь к scripts/deploy.mjs> npm run deploy",
  );
  process.exit(1);
}

const withInstall = process.argv.includes("--install");

const env = {
  ...process.env,
  DEPLOY_ROOT: projectRoot,
  DEPLOY_REMOTE_DIR: "/var/www/market-radar",
  DEPLOY_PM2: "market-radar",
  DEPLOY_TAR_NAME: "mr-deploy.tar.gz",
  DEPLOY_REMOTE_TAR: "/tmp/mr-deploy.tar.gz",
  DEPLOY_GIT: "1",
  DEPLOY_NO_INSTALL: withInstall ? "0" : "1",
};

console.log(`Деплой market-radar → ${env.DEPLOY_REMOTE_DIR}${withInstall ? " (с npm install)" : ""}`);

const child = spawn(process.execPath, [deployScript], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
