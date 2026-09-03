/**
 * Точка входа GEO-агента: crawl → checks → (опционально) visibility →
 * → score → plan → artifacts → GeoReport.
 *
 * Осознанно НЕ вызывает Claude по умолчанию для FAQ/капсул — детерминированные
 * черновики из artifacts.ts работают без ключа. Если ANTHROPIC_API_KEY есть
 * и skipLlmArtifacts не выставлен, run.ts просит Claude переписать черновики
 * человеческим текстом (см. rewriteArtifacts ниже) — но при сбое просто
 * оставляет детерминированную версию, не роняя весь отчёт.
 */
import type { GeoArtifacts, GeoAuditInput, GeoReport, ProgressFn } from "./types";
import { crawlSite } from "./crawl";
import { buildChecks, scoreChecks } from "./checks";
import { availableLLMs, probeVisibility, templatePrompts } from "./llm-probe";
import { buildArtifacts } from "./artifacts";
import { buildPlan } from "./plan";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";

export async function runGeoAudit(input: GeoAuditInput, onProgress?: ProgressFn): Promise<GeoReport> {
  const log: ProgressFn = (stage, detail) => onProgress?.(stage, detail);
  const limitations: string[] = [];

  log("crawl", input.websiteUrl);
  const crawl = await crawlSite(input.websiteUrl, {
    maxPages: input.maxPages,
    brandName: input.brandName,
    onProgress: log,
  });

  if (!crawl.bing?.ok) limitations.push("Проверка индексации в Bing не удалась (изменилась вёрстка выдачи или таймаут) — проверьте вручную: bing.com/search?q=site:" + crawl.domain);
  if (crawl.pages.every(p => !p.browser.ok)) limitations.push("Ни одна страница не открылась — сайт может быть недоступен или блокирует все User-Agent.");

  let visibility;
  if (!input.skipVisibility) {
    const avail = availableLLMs();
    if (avail.length === 0) {
      limitations.push("Опрос ассистентов пропущен: не настроен ни один ключ (OPENAI_API_KEY, PERPLEXITY_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, YANDEX_GPT_*).");
    } else {
      log("visibility", `${avail.length} ассистентов`);
      const prompts = (input.prompts?.length ? input.prompts.map(text => ({ text, intent: "recommend" as const })) : templatePrompts(crawl.brandName, input.niche ?? "", input.region ?? "России"));
      visibility = await probeVisibility(prompts, {
        brand: crawl.brandName,
        domain: crawl.domain,
        llms: input.llms,
        onProgress: log,
      });
      const unavailableRequested = input.llms?.filter(l => !avail.includes(l));
      if (unavailableRequested?.length) limitations.push(`Ассистенты без ключа, пропущены: ${unavailableRequested.join(", ")}.`);
    }
  } else {
    limitations.push("Опрос ассистентов пропущен по запросу (skipVisibility).");
  }

  log("checks", "скоринг");
  const checks = buildChecks(crawl, visibility);
  const score = scoreChecks(checks);
  const plan = buildPlan(checks);

  log("artifacts", "черновики");
  let artifacts = buildArtifacts(crawl, visibility);
  if (!input.skipLlmArtifacts && process.env.ANTHROPIC_API_KEY) {
    try {
      artifacts = await rewriteArtifacts(artifacts, crawl, visibility);
    } catch {
      limitations.push("Не удалось улучшить FAQ/капсулы через Claude — оставлены детерминированные черновики.");
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    limitations.push("ANTHROPIC_API_KEY не настроен — FAQ и answer-капсулы это черновики-шаблоны, перепишите вручную перед публикацией.");
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    input,
    crawl,
    checks,
    visibility,
    score,
    plan,
    artifacts,
    limitations,
  };
}

/**
 * Просим Claude заполнить шаблонные FAQ-ответы и answer-капсулы реальным
 * текстом на основе того, что реально нашли на сайте (лиды, факты, реквизиты).
 * Anti-hallucination: явно запрещаем придумывать цифры/кейсы, которых нет
 * во входных данных — модель должна писать «уточните» вместо выдумки.
 */
async function rewriteArtifacts(
  base: GeoArtifacts,
  crawl: Awaited<ReturnType<typeof crawlSite>>,
  vis: Awaited<ReturnType<typeof probeVisibility>> | undefined,
): Promise<GeoArtifacts> {
  if (base.faq.length === 0 && base.capsules.length === 0) return base;

  const home = crawl.pages.find(p => p.source === "home");
  const facts = [
    `Бренд: ${crawl.brandName}`,
    `Сайт: ${crawl.origin}`,
    home?.description ? `Meta description: ${home.description}` : "",
    home?.lede ? `Текущий лид главной: ${home.lede}` : "",
  ].filter(Boolean).join("\n");

  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: `КРИТИЧНО: не выдумывай цифры, кейсы, цены и факты, которых нет во входных данных ниже. Если факта не хватает — оставь плейсхолдер вида [уточните: что именно], не изобретай число.

Данные о компании:
${facts}

Задача: улучшить черновики для GEO (Generative Engine Optimization) — сделать их конкретнее и человечнее, сохранив структуру.

FAQ-черновики (JSON):
${JSON.stringify(base.faq)}

Answer-капсулы страниц (JSON, поле proposed — черновик первого абзаца 40-70 слов, формат "X — это..."):
${JSON.stringify(base.capsules.map(c => ({ url: c.url, current: c.current, proposed: c.proposed })))}

Верни ТОЛЬКО JSON: {"faq": [{"question": "...", "answer": "..."}], "capsules": [{"url": "...", "proposed": "..."}]}`,
    }],
  });
  if (!text) return base;
  const parsed = extractJson<{ faq?: Array<{ question: string; answer: string }>; capsules?: Array<{ url: string; proposed: string }> }>(text);
  if (!parsed) return base;

  const faq = parsed.faq?.length
    ? parsed.faq.map((f, i) => ({ question: f.question, answer: f.answer, fromPrompt: base.faq[i]?.fromPrompt }))
    : base.faq;
  const capsuleMap = new Map((parsed.capsules ?? []).map(c => [c.url, c.proposed]));
  const capsules = base.capsules.map(c => (capsuleMap.has(c.url) ? { ...c, proposed: capsuleMap.get(c.url)! } : c));

  return {
    ...base,
    faq,
    faqJsonLd: faq.length ? buildFaqJsonLdSafe(faq) : base.faqJsonLd,
    capsules,
  };
}

function buildFaqJsonLdSafe(faq: GeoArtifacts["faq"]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(f => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}
