/**
 * GET /api/acts/[id]/pdf       — скачать акт PDF
 * GET /api/acts/[id]/pdf?view=1 — открыть HTML в браузере
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildActHTML } from "@/lib/act-html";
import { htmlToPdfA4 } from "@/lib/html-to-pdf";
import type { ClientRequisites, VendorRequisites } from "@/lib/requisites";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ActRow {
  id: string;
  act_number: string;
  user_id: string;
  invoice_id: string | null;
  amount: number;
  vat_mode: string;
  service_description: string;
  service_period_start: string | null;
  service_period_end: string | null;
  signed_at: string;
  client_snapshot: ClientRequisites;
  vendor_snapshot: VendorRequisites;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  const rows = await query<ActRow>(
    `SELECT id, act_number, user_id, invoice_id, amount, vat_mode,
            service_description, service_period_start, service_period_end,
            signed_at, client_snapshot, vendor_snapshot
       FROM acts WHERE id = $1`,
    [id],
  );
  const act = rows[0];
  if (!act) return NextResponse.json({ ok: false, error: "Акт не найден" }, { status: 404 });
  if (act.user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Подтянем номер счёта (для шапки акта)
  let invoiceNumber: string | null = null;
  let invoiceDate: Date | null = null;
  if (act.invoice_id) {
    const inv = await query<{ invoice_number: string; created_at: string }>(
      `SELECT invoice_number, created_at FROM invoices WHERE id = $1`,
      [act.invoice_id],
    );
    if (inv[0]) {
      invoiceNumber = inv[0].invoice_number;
      invoiceDate = new Date(inv[0].created_at);
    }
  }

  const html = buildActHTML(
    {
      act_number: act.act_number,
      act_date: new Date(act.signed_at),
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      service_description: act.service_description,
      amount: act.amount,
      vat_mode: act.vat_mode as "none" | "vat20" | "vat10" | "vat0",
      service_period_start: act.service_period_start ? new Date(act.service_period_start) : null,
      service_period_end: act.service_period_end ? new Date(act.service_period_end) : null,
    },
    act.vendor_snapshot,
    act.client_snapshot,
  );

  const url = new URL(req.url);
  if (url.searchParams.get("view") === "1") {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const pdf = await htmlToPdfA4(html);
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${act.act_number}.pdf"`,
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
