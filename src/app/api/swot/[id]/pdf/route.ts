/**
 * GET /api/swot/[id]/pdf — скачать SWOT-отчёт PDF.
 * GET /api/swot/[id]/pdf?view=1 — открыть HTML в браузере (для печати window.print).
 *
 * Доступ: только владелец отчёта или админ.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { buildSwotReportHTML } from "@/lib/swot-html";
import { htmlToPdfA4 } from "@/lib/html-to-pdf";
import type { SwotReport } from "@/lib/swot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const { id } = await params;
  const rows = await query<{ user_id: string; report: SwotReport }>(
    `SELECT user_id, report FROM swot_reports WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "Отчёт не найден" }, { status: 404 });
  if (row.user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const html = buildSwotReportHTML(row.report);

  // View-режим: отдаём HTML inline
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "1") {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // PDF-режим
  try {
    const pdf = await htmlToPdfA4(html);
    const safeName = row.report.companyName.replace(/[^a-zA-Z0-9_-]/g, "_") || "company";
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="SWOT_${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF render failed" },
      { status: 500 },
    );
  }
}
