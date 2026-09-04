/**
 * POST /api/geo-agent/audit
 *
 * Полный GEO-аудит сайта: доступность для краулеров ассистентов,
 * извлекаемость контента, сущность/доверие, свежесть, опрос реальных
 * ассистентов (ChatGPT/Perplexity/Gemini/Claude/YandexGPT — по доступным
 * ключам) и кого они цитируют вместо нас. Возвращает GeoReport целиком:
 * скор по пяти опорам, приоритизированный план и готовые артефакты
 * (llms.txt, robots-блок, Organization JSON-LD, FAQ, answer-капсулы,
 * список площадок для размещений).
 *
 * Body: { websiteUrl, brandName?, niche?, region?, competitors?, prompts?,
 *         maxPages?, llms?, skipVisibility?, skipLlmArtifacts? }
 *
 * Тяжёлый эндпоинт (обход до 40 страниц + вызовы нескольких LLM) —
 * защищён checkAiAccess, как и остальные /api/ai-visibility/*.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { runGeoAudit } from "@/lib/geo-agent/run";
import type { GeoAuditInput, ProbeLLM } from "@/lib/geo-agent/types";
import { checkSafeUrl } from "@/lib/url-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_LLMS: ProbeLLM[] = ["chatgpt", "chatgpt-search", "perplexity", "gemini", "claude", "yandex"];

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON в теле запроса" }, { status: 400 });
  }

  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  if (!websiteUrl) return NextResponse.json({ ok: false, error: "websiteUrl обязателен" }, { status: 400 });

  const withProto = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  const guard = await checkSafeUrl(withProto);
  if (!guard.ok) return NextResponse.json({ ok: false, error: `Небезопасный URL: ${guard.reason}` }, { status: 400 });

  const llmsInput = Array.isArray(body.llms) ? body.llms.filter((l): l is ProbeLLM => VALID_LLMS.includes(l as ProbeLLM)) : undefined;
  const promptsInput = Array.isArray(body.prompts) ? body.prompts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 20) : undefined;
  const competitorsInput = Array.isArray(body.competitors) ? body.competitors.filter((c): c is string => typeof c === "string").slice(0, 10) : undefined;

  const input: GeoAuditInput = {
    websiteUrl: withProto,
    brandName: typeof body.brandName === "string" ? body.brandName.trim() || undefined : undefined,
    niche: typeof body.niche === "string" ? body.niche.trim() || undefined : undefined,
    region: typeof body.region === "string" ? body.region.trim() || undefined : undefined,
    competitors: competitorsInput,
    prompts: promptsInput,
    maxPages: typeof body.maxPages === "number" ? Math.max(3, Math.min(body.maxPages, 40)) : undefined,
    llms: llmsInput,
    skipVisibility: body.skipVisibility === true,
    skipLlmArtifacts: body.skipLlmArtifacts === true,
  };

  try {
    const report = await runGeoAudit(input);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось выполнить аудит" },
      { status: 500 },
    );
  }
}
