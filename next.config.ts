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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The Claude Agent SDK is loaded at runtime (VPS only); skip it during local builds
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
