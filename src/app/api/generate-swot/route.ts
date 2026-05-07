/**
 * POST /api/generate-swot
 *
 * Генерирует полный SWOT-отчёт по компании с использованием:
 * 1) Извлечения SWOT-пунктов через Claude Haiku
 * 2) Параллельного написания 4 секций (Сильные / Слабые / Возможности / Угрозы)
 *    через Claude Sonnet
 * 3) Generation вводного и заключительного разделов
 *
 * Body:
 *   - либо { context: CompanyContext } — пользователь передал контекст вручную
 *   - либо { useStored: true } — берём из последних анализов в localStorage
 *     (для этого фронт сам пробрасывает company/competitors/ta/smm)
 *   - либо { company, competitors, ta, smm } — старые анализы
 *
 * Returns: { ok, data: SwotReport }
 *
 * Время выполнения: 30-60 секунд (4 параллельных Claude-вызова + 2 последовательных).
 */

import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import {
  buildContextFromAnalyses,
  generateSwotReport,
  type CompanyContext,
} from "@/lib/swot";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";

export const runtime = "nodejs";
export const maxDuration = 120; // SWOT с 4 параллельными Claude может занять ~60-90 сек

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();

    // Вариант A: контекст передан напрямую
    let ctx: CompanyContext | null = body.context ?? null;

    // Вариант B: фронт прислал результаты анализов
    if (!ctx && body.company) {
      const company = body.company as AnalysisResult;
      const competitors: AnalysisResult[] = Array.isArray(body.competitors) ? body.competitors : [];
      const ta: TAResult | null = body.ta ?? null;
      const smm: SMMResult | null = body.smm ?? null;
      ctx = buildContextFromAnalyses(company, competitors, ta, smm);
    }

    if (!ctx || !ctx.companyName) {
      return NextResponse.json(
        { ok: false, error: "Не передан контекст компании. Сначала запустите анализ." },
        { status: 400 },
      );
    }

    // Можно перекрыть отдельные поля из body.overrides — например цели и feedback
    if (body.overrides && typeof body.overrides === "object") {
      ctx = { ...ctx, ...body.overrides };
    }

    const report = await generateSwotReport(ctx);

    // Сохраняем в БД (если пользователь авторизован)
    const session = await getSessionUser();
    if (session) {
      try {
        await initDb();
        await query(
          `INSERT INTO swot_reports (id, user_id, company_name, report)
             VALUES ($1, $2, $3, $4::jsonb)`,
          [report.id, session.userId, report.companyName, JSON.stringify(report)],
        );
      } catch {
        // Не фейлим — пользователь всё равно получит отчёт через ответ.
      }
    }

    await access.log({ endpoint: "generate-swot", model: "claude-sonnet-4-5" });
    return NextResponse.json({ ok: true, data: report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// GET — список SWOT-отчётов текущего пользователя
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<{
    id: string;
    company_name: string;
    created_at: string;
  }>(
    `SELECT id, company_name, created_at
       FROM swot_reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
    [session.userId],
  );
  return NextResponse.json({ ok: true, reports: rows });
}
