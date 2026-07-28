/**
 * GET /api/admin/render-diag  (admin only)
 *
 * Диагностика Remotion-рендера на сервере. Появился потому, что рендер
 * падает ТОЛЬКО на VPS (локально та же композиция собирается), а текст
 * ошибки терялся: stderr обрезался, SSH-доступа у разработки нет.
 *
 * Что показывает:
 *   - свободное место на диске и в памяти (главные подозреваемые при
 *     падении бандлинга — он потяжелел после @remotion/transitions);
 *   - установленные пакеты @remotion/* и их версии (частая причина —
 *     неполный npm install: transitions есть в package.json, но не в
 *     node_modules, либо версия разошлась с ядром remotion);
 *   - ПОЛНЫЙ вывод пробного рендера одного кадра.
 *
 * Безопасность: параметров от пользователя нет — команда фиксированная,
 * инъекция невозможна. Только для роли admin.
 */
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFile, readdir, statfs } from "fs/promises";
import path from "path";
import os from "os";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const REMOTION_DIR = process.env.REMOTION_PROJECT_DIR ?? path.join(process.cwd(), "remotion");

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); if (stdout.length > 20000) stdout = stdout.slice(-20000); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: null, stdout, stderr: stderr + `\nspawn error: ${e.message}`, timedOut }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // ── Диск ──────────────────────────────────────────────────────────────
  let disk: unknown = null;
  try {
    const s = await statfs(REMOTION_DIR);
    disk = {
      freeMb: Math.round((s.bsize * s.bfree) / 1048576),
      availableMb: Math.round((s.bsize * s.bavail) / 1048576),
      totalMb: Math.round((s.bsize * s.blocks) / 1048576),
    };
  } catch (e) { disk = `statfs failed: ${e instanceof Error ? e.message : String(e)}`; }

  const memory = {
    freeMb: Math.round(os.freemem() / 1048576),
    totalMb: Math.round(os.totalmem() / 1048576),
  };

  // ── Установленные @remotion/* ─────────────────────────────────────────
  let remotionPackages: unknown = null;
  try {
    const dir = path.join(REMOTION_DIR, "node_modules", "@remotion");
    const names = await readdir(dir);
    const versions: Record<string, string> = {};
    for (const name of names) {
      try {
        const pkg = JSON.parse(await readFile(path.join(dir, name, "package.json"), "utf8"));
        versions[name] = pkg.version ?? "?";
      } catch { versions[name] = "(no package.json)"; }
    }
    // Версия ядра remotion — она обязана совпадать со всеми @remotion/*
    try {
      const core = JSON.parse(await readFile(path.join(REMOTION_DIR, "node_modules", "remotion", "package.json"), "utf8"));
      versions["__core_remotion"] = core.version ?? "?";
    } catch { versions["__core_remotion"] = "(not installed)"; }
    remotionPackages = versions;
  } catch (e) { remotionPackages = `readdir failed: ${e instanceof Error ? e.message : String(e)}`; }

  // ── Пробный рендер одного кадра — полный вывод ────────────────────────
  const still = await run(
    "npx",
    ["remotion", "still", "ContentReel", "out/diag.png", "--frame=30", "--scale=0.2"],
    REMOTION_DIR,
    240_000,
  );

  return NextResponse.json({
    ok: true,
    remotionDir: REMOTION_DIR,
    disk,
    memory,
    remotionPackages,
    still: {
      exitCode: still.code,
      timedOut: still.timedOut,
      stdout: still.stdout,
      stderr: still.stderr,
    },
  });
}
