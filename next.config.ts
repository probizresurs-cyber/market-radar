import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Force-load .env.local, overriding empty system env vars.
// Needed when a shell-level variable like ANTHROPIC_API_KEY="" shadows .env.local.
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key && value) process.env[key] = value;
  }
}

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: `eslint` config был убран — Next 16 больше не принимает его в next.config.ts.
  // ESLint в билде по умолчанию отключён в Turbopack-режиме; для отдельного линт-прохода
  // используйте `npx eslint .` если нужно.
  // Эти пакеты подгружаются runtime (только VPS); локально могут отсутствовать
  // и Turbopack-static-analysis их не должен жёстко резолвить.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "nodemailer"],

  /**
   * Основная посадочная — /neyroseti. Латиница выбрана не из вкуса:
   * кириллический путь при копировании превращается в /%D0%BD%D0%B5%D0%B9...
   * везде, где ссылку вставляют в переписку, КП, CRM или отчёт, а Next 16
   * вдобавок падает с InvalidCharacterError на кириллическом сегменте
   * маршрута. Диктуется адрес одинаково — «слэш нейросети» произносится
   * по-русски в любом случае.
   *
   * Оба прежних адреса ведут сюда постоянным редиректом: /new — потому что
   * на него уже настроены объявления, /нейросети — для тех, кто наберёт
   * по-русски. Строка запроса (?url=...) переносится Next-ом сама, поэтому
   * переход с уже введённым адресом сайта продолжает работать.
   */
  async redirects() {
    return [
      { source: "/new", destination: "/neyroseti", permanent: true },
      { source: "/нейросети", destination: "/neyroseti", permanent: true },
      { source: "/%D0%BD%D0%B5%D0%B9%D1%80%D0%BE%D1%81%D0%B5%D1%82%D0%B8", destination: "/neyroseti", permanent: true },
    ];
  },
};

export default nextConfig;
