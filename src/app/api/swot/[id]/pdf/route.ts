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

  let html: string;
  try {
    html = buildSwotReportHTML(row.report);
  } catch (err) {
    console.error("[swot/pdf] buildSwotReportHTML failed for", id, err);
    // Старый отчёт со сломанной структурой — отдаём минимальный HTML
    // с raw items, чтобы юзер увидел контент, а не 500.
    const r = row.report;
    const items = r?.rawItems ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    const list = (title: string, color: string, arr: string[] | undefined) =>
      `<h2 style="color: ${color}; margin-top: 28px;">${title}</h2>
       <ul>${(arr ?? []).map(i => `<li>${String(i).replace(/</g, "&lt;")}</li>`).join("")}</ul>`;
    html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>SWOT — ${r?.companyName ?? ""}</title></head>
      <body style="font-family: -apple-system,sans-serif; max-width: 720px; margin: 40px auto; padding: 20px; color: #1a1a2e;">
        <h1>SWOT — ${r?.companyName ?? "Компания"}</h1>
        <p style="background: #FEF3C7; padding: 12px; border-left: 4px solid #F59E0B; color: #92400E; font-size: 13px;">
          Этот отчёт был сохранён в старом формате. Перегенерируйте его, чтобы получить полную версию.
        </p>
        <p>${(r?.introduction || "").slice(0, 1000)}</p>
        ${list("Сильные стороны", "#16a34a", items.strengths)}
        ${list("Слабые стороны", "#dc2626", items.weaknesses)}
        ${list("Возможности", "#6366f1", items.opportunities)}
        ${list("Угрозы", "#f59e0b", items.threats)}
        <p>${(r?.conclusion || "").slice(0, 1000)}</p>
      </body></html>`;
  }

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
