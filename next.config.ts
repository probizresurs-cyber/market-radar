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
   * Основная посадочная переехала с /new на /нейросети: короткий латинский
   * адрес ничего не значил и не диктовался по телефону. Редирект постоянный
   * и обязателен — на /new уже настроены объявления, и ломать их нельзя.
   * Строка запроса (?url=...) переносится Next-ом сама, поэтому переход
   * с /geo и /competitors с уже введённым адресом продолжает работать.
   */
  async redirects() {
    return [
      { source: "/new", destination: "/нейросети", permanent: true },
    ];
  },

  /**
   * Кириллический адрес обслуживается латинским маршрутом.
   *
   * Next 16 падает с InvalidCharacterError при пререндере сегмента, набранного
   * кириллицей, поэтому страница лежит в src/app/neuroseti, а человек видит
   * /нейросети. Браузеры шлют адрес в процентном кодировании, поэтому
   * перезаписей две: на случай, если запрос дойдёт декодированным, и на
   * закодированный вид.
   */
  async rewrites() {
    return [
      { source: "/нейросети", destination: "/neuroseti" },
      { source: "/%D0%BD%D0%B5%D0%B9%D1%80%D0%BE%D1%81%D0%B5%D1%82%D0%B8", destination: "/neuroseti" },
    ];
  },
};

export default nextConfig;
