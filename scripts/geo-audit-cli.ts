#!/usr/bin/env -S npx tsx
/**
 * CLI-запуск GEO-агента без сервера — для локальной отладки и одноразовых
 * прогонов ("проверь мой сайт"). Запускать через tsx (уважает @/-алиасы
 * из tsconfig.json из коробки).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/geo-audit-cli.ts https://example.com
 *   npx tsx --env-file=.env.local scripts/geo-audit-cli.ts https://example.com --no-visibility --max-pages=10 --out=report.json
 */
import { runGeoAudit } from "@/lib/geo-agent/run";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith("--"));
if (!url) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/geo-audit-cli.ts <url> [--no-visibility] [--max-pages=N] [--brand=Name] [--niche=text] [--out=file.json]");
  process.exit(1);
}
const skipVisibility = args.includes("--no-visibility");
const maxPages = parseInt(args.find(a => a.startsWith("--max-pages="))?.split("=")[1] ?? "14", 10);
const brandName = args.find(a => a.startsWith("--brand="))?.split("=").slice(1).join("=");
const niche = args.find(a => a.startsWith("--niche="))?.split("=").slice(1).join("=");
const outPath = args.find(a => a.startsWith("--out="))?.split("=")[1];

async function main() {
  const report = await runGeoAudit(
    { websiteUrl: url!, skipVisibility, maxPages, brandName, niche },
    (stage, detail) => console.error(`[${stage}] ${detail ?? ""}`),
  );

  const json = JSON.stringify(report, null, 2);
  if (outPath) {
    writeFileSync(outPath, json, "utf8");
    console.error(`\nПолный отчёт: ${outPath}`);
  } else {
    console.log(json);
  }

  console.error(`\n=== Score: ${report.score.total}/100 ===`);
  for (const [pillar, v] of Object.entries(report.score.pillars)) {
    console.error(`  ${pillar}: ${v < 0 ? "н/д" : v + "/100"}`);
  }
  console.error(`\nПлан действий: ${report.plan.length} пунктов, приоритет 1: ${report.plan.filter(p => p.priority === 1).length}`);
  if (report.limitations.length) {
    console.error(`\nОграничения:\n${report.limitations.map(l => "  - " + l).join("\n")}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
