/**
 * POST /api/admin/leads/[id]/generate-kp
 *
 * Фаза C воронки: связка лидген-модуля с КП-генератором. Из карточки лида
 * в /admin/leads ставим генерацию КП в ту же очередь, что и консоль /kp-ru
 * (kp-queue), с привязкой lead_id и переносом контактов лида — менеджеру
 * не нужно копировать домен и email руками между двумя системами.
 *
 * Идемпотентность: если по лиду уже есть живое КП (queued/running/done) —
 * не плодим дубликат, возвращаем существующее с флагом alreadyExists.
 * Повторная генерация — body { force: true } (например, после правок сайта).
 *
 * Auth — admin-сессия (как у остальных /api/admin/leads/*), НЕ isKpManager:
 * enqueueKp зовём напрямую, минуя HTTP-гейт консоли менеджера.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { enqueueKp } from "@/lib/kp-queue";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { force?: boolean; locale?: string };
    const locale = body.locale === "de" ? "de" : "ru";

    const leads = await query<{
      id: string; domain: string; company_name: string | null;
      contact_email: string | null; contact_phone: string | null;
    }>(
      `SELECT id, domain, company_name, contact_email, contact_phone FROM leads WHERE id = $1`,
      [id],
    );
    const lead = leads[0];
    if (!lead) return NextResponse.json({ ok: false, error: "Лид не найден" }, { status: 404 });
    if (!lead.domain) return NextResponse.json({ ok: false, error: "У лида нет домена" }, { status: 400 });

    if (!body.force) {
      const existing = await query<{ id: string; status: string; share_token: string | null }>(
        `SELECT id, status, share_token FROM kp_generations
          WHERE lead_id = $1 AND status IN ('queued','running','done')
          ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      if (existing.length > 0) {
        return NextResponse.json({ ok: true, alreadyExists: true, kp: existing[0] });
      }
    }

    const kpId = await enqueueKp(`https://${lead.domain}`, locale, {
      leadId: lead.id,
      companyName: lead.company_name ?? undefined,
      clientEmail: lead.contact_email ?? undefined,
      clientPhone: lead.contact_phone ?? undefined,
    });

    return NextResponse.json({ ok: true, alreadyExists: false, kp: { id: kpId, status: "queued" } });
  } catch (e) {
    console.error("admin/leads/[id]/generate-kp error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
