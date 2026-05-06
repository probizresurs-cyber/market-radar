/**
 * GET /api/invoices/[id]/pdf — скачать счёт PDF.
 * GET /api/invoices/[id]/pdf?view=1 — открыть в браузере (HTML, печать через window.print).
 *
 * Доступ: только владелец счёта или админ.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildInvoiceHTML } from "@/lib/invoice-html";
import { htmlToPdfA4 } from "@/lib/html-to-pdf";
import type { ClientRequisites, VendorRequisites } from "@/lib/requisites";

export const runtime = "nodejs";
export const maxDuration = 60;

interface InvoiceRow {
  id: string;
  invoice_number: string;
  user_id: string;
  amount: number;
  vat_mode: string;
  status: string;
  service_description: string;
  service_period_start: string | null;
  service_period_end: string | null;
  due_date: string;
  client_snapshot: ClientRequisites;
  vendor_snapshot: VendorRequisites;
  created_at: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  const rows = await query<InvoiceRow>(
    `SELECT id, invoice_number, user_id, amount, vat_mode, status,
            service_description, service_period_start, service_period_end,
            due_date, client_snapshot, vendor_snapshot, created_at
       FROM invoices WHERE id = $1`,
    [id],
  );
  const inv = rows[0];
  if (!inv) return NextResponse.json({ ok: false, error: "Счёт не найден" }, { status: 404 });
  if (inv.user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const html = buildInvoiceHTML(
    {
      invoice_number: inv.invoice_number,
      invoice_date: new Date(inv.created_at),
      due_date: new Date(inv.due_date),
      service_description: inv.service_description,
      amount: inv.amount,
      vat_mode: inv.vat_mode as "none" | "vat20" | "vat10" | "vat0",
      service_period_start: inv.service_period_start ? new Date(inv.service_period_start) : null,
      service_period_end: inv.service_period_end ? new Date(inv.service_period_end) : null,
    },
    inv.vendor_snapshot,
    inv.client_snapshot,
  );

  // Режим просмотра в браузере
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "1") {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Скачивание PDF
  try {
    const pdf = await htmlToPdfA4(html);
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
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
