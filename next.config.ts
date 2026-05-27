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
  // Next.js 16 по умолчанию режет body на 10 МБ через middleware-парсер
  // (см. nextjs.org/docs/.../middlewareClientMaxBodySize). Без этого
  // upload видео-аватара 22+ МБ падает «Request body exceeded 10MB».
  // 150 МБ соответствует лимиту nginx и UI заявлению «до 100 МБ».
  experimental: {
    middlewareClientMaxBodySize: 150 * 1024 * 1024, // 150 MB
  },
};

export default nextConfig;
