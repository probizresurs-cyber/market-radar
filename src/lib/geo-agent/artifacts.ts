/**
 * Готовые артефакты: то, что можно скопировать и вставить сразу.
 *
 * Всё здесь — детерминированное (без Claude), кроме двух мест, помеченных
 * явно в run.ts (FAQ и answer-капсулы качественнее с LLM, но и без него
 * отдаём рабочий черновик из собранных данных — agent должен работать
 * и без ANTHROPIC_API_KEY).
 */
import type { AnswerCapsule, FaqDraft, GeoArtifacts, PageAudit, SiteCrawl, VisibilityReport } from "./types";
import { AI_BOTS } from "./discovery";
import { placementKind } from "./llm-probe";

export function buildRobotsAiBlock(): string {
  const lines = ["# Краулеры ассистентов — открыты для попадания в ответы", ""];
  for (const b of AI_BOTS) {
    lines.push(`# ${b.label}`);
    lines.push(`User-agent: ${b.name}`);
    lines.push("Allow: /");
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function buildLlmsTxt(crawl: SiteCrawl): string {
  const home = crawl.pages.find(p => p.source === "home");
  const brand = crawl.brandName;
  const summary = home?.description || home?.lede?.slice(0, 200) || `${brand} — сайт ${crawl.domain}.`;
  const org = home?.jsonLd.organization;

  const keyPages = crawl.pages
    .filter(p => p.source !== "llms" && p.browser.ok && p.title)
    .slice(0, 8)
    .map(p => `- [${p.h1[0] || p.title}](${p.url}): ${p.description || p.lede.slice(0, 100)}`);

  const lines = [
    `# ${brand}`,
    "",
    `> ${summary}`,
    "",
    "## Ключевые страницы",
    ...(keyPages.length ? keyPages : [`- [Главная](${crawl.origin}/)`]),
    "",
  ];
  if (org?.contact || home?.email || home?.phone) {
    lines.push("## Контакты");
    if (home?.email) lines.push(`- Email: ${home.email}`);
    if (home?.phone) lines.push(`- Телефон: ${home.phone}`);
    lines.push(`- Сайт: ${crawl.origin}/`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function buildOrganizationJsonLd(crawl: SiteCrawl): string {
  const home = crawl.pages.find(p => p.source === "home");
  const existing = home?.jsonLd.organization;
  const sameAs = Array.from(new Set([...(existing?.sameAs ?? []), ...(home?.socialLinks ?? [])])).slice(0, 12);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: existing?.name || crawl.brandName,
    url: `${crawl.origin}/`,
    ...(home?.email ? { email: home.email } : {}),
    ...(home?.phone ? { telephone: home.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

export function buildFaqJsonLd(faq: FaqDraft[]): string | undefined {
  if (!faq.length) return undefined;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/** FAQ-черновик без LLM: берём незакрытые промпты + типовые вопросы из отсутствующих чек-пунктов. */
export function draftFaqFromVisibility(vis: VisibilityReport | undefined, brand: string): FaqDraft[] {
  if (!vis) return [];
  return vis.unansweredPrompts.slice(0, 6).map(p => ({
    question: p.text.replace(/\s*Назови конкретные названия\.?$/i, "").replace(/\s*Приведи примеры.*$/i, "").trim(),
    answer: `Заполните: прямой ответ 40–70 слов с упоминанием «${brand}», конкретными цифрами и одним фактом, который отличает вас от альтернатив. Этот вопрос ни один из опрошенных ассистентов не связал с брендом — сейчас на него отвечают другие.`,
    fromPrompt: p.text,
  }));
}

/** Answer-капсулы для страниц с низким score лида — черновик по шаблону, без LLM. */
export function draftCapsules(pages: PageAudit[], brand: string): AnswerCapsule[] {
  return pages
    .filter(p => p.browser.ok && !p.ledeIsAnswer && p.source !== "llms")
    .slice(0, 6)
    .map(p => {
      const subject = p.h1[0] || p.title || p.url;
      return {
        url: p.url,
        current: p.lede || "(первый абзац не найден)",
        proposed: `${subject} — ${brand ? `это услуга ${brand}, которая` : "это"} [впишите суть в одном предложении: для кого и что решает]. [Второе предложение: 1–2 цифры или условия — цена, срок, объём.] [Третье: чем отличается от альтернатив.]`,
        proposedH1: p.h1.length === 0 ? subject || undefined : undefined,
      };
    });
}

export function buildPlacementTargets(vis: VisibilityReport | undefined, domain: string): GeoArtifacts["placementTargets"] {
  if (!vis) return [];
  return vis.citedDomains
    .filter(d => !d.isUs)
    .slice(0, 15)
    .map(d => ({ domain: d.domain, count: d.count, kind: placementKind(d.domain) }));
}

export function buildArtifacts(crawl: SiteCrawl, vis: VisibilityReport | undefined): GeoArtifacts {
  const faq = draftFaqFromVisibility(vis, crawl.brandName);
  return {
    llmsTxt: buildLlmsTxt(crawl),
    robotsAiBlock: buildRobotsAiBlock(),
    organizationJsonLd: buildOrganizationJsonLd(crawl),
    faqJsonLd: buildFaqJsonLd(faq),
    faq,
    capsules: draftCapsules(crawl.pages, crawl.brandName),
    placementTargets: buildPlacementTargets(vis, crawl.domain),
  };
}
