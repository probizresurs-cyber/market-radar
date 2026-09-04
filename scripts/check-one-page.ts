#!/usr/bin/env -S npx tsx
/** Разовая проверка одной страницы через parsePage — для отладки geo-agent без полного обхода сайта. */
import { probe, BROWSER_UA, normalizeOrigin } from "@/lib/geo-agent/crawl";
import { parsePage } from "@/lib/geo-agent/html";

async function main() {
  const url = process.argv[2];
  const { domain } = normalizeOrigin(url);
  const { probe: browser, body } = await probe(url, BROWSER_UA);
  if (!browser.ok) { console.error("fetch failed", browser); process.exit(1); }
  const audit = parsePage({ url, source: "home", browser, html: body, domain });
  console.log(JSON.stringify({
    score: audit.score,
    issues: audit.issues,
    ledeIsAnswer: audit.ledeIsAnswer,
    questionHeadingShare: audit.questionHeadingShare,
    h2: audit.h2,
  }, null, 2));
}
main();
