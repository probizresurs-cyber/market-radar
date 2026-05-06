/**
 * GET /api/user/requisites
 *   → реквизиты текущего пользователя (для предзаполнения формы Settings)
 * PUT /api/user/requisites
 *   → сохранить реквизиты текущего пользователя
 *
 * Реквизиты хранятся в users.* (см. db.ts). Здесь только проверка и UPSERT.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import type { ClientRequisites } from "@/lib/requisites";

export const runtime = "nodejs";

interface UserRow {
  client_type: string | null;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legal_address: string | null;
  bank_name: string | null;
  bank_bik: string | null;
  bank_account: string | null;
  bank_corr_account: string | null;
  director_name: string | null;
  director_position: string | null;
  contact_email: string | null;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<UserRow>(
    `SELECT client_type, legal_name, inn, kpp, ogrn, legal_address,
            bank_name, bank_bik, bank_account, bank_corr_account,
            director_name, director_position, contact_email
       FROM users WHERE id = $1`,
    [session.userId],
  );
  const u = rows[0];
  const data: ClientRequisites = {
    client_type: (u?.client_type as ClientRequisites["client_type"]) ?? "individual",
    legal_name: u?.legal_name ?? "",
    inn: u?.inn ?? "",
    kpp: u?.kpp ?? "",
    ogrn: u?.ogrn ?? "",
    legal_address: u?.legal_address ?? "",
    bank_name: u?.bank_name ?? "",
    bank_bik: u?.bank_bik ?? "",
    bank_account: u?.bank_account ?? "",
    bank_corr_account: u?.bank_corr_account ?? "",
    director_name: u?.director_name ?? "",
    director_position: u?.director_position ?? "",
    contact_email: u?.contact_email ?? "",
  };
  return NextResponse.json({ ok: true, data });
}

function clean(v: unknown, max = 250): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function PUT(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));

  const client_type = ["individual", "ip", "llc"].includes(body.client_type)
    ? body.client_type as ClientRequisites["client_type"]
    : "individual";

  const data: ClientRequisites = {
    client_type,
    legal_name: clean(body.legal_name, 300),
    inn: clean(body.inn, 12).replace(/\D/g, ""),
    kpp: clean(body.kpp, 9).replace(/\D/g, ""),
    ogrn: clean(body.ogrn, 15).replace(/\D/g, ""),
    legal_address: clean(body.legal_address, 500),
    bank_name: clean(body.bank_name, 300),
    bank_bik: clean(body.bank_bik, 9).replace(/\D/g, ""),
    bank_account: clean(body.bank_account, 20).replace(/\D/g, ""),
    bank_corr_account: clean(body.bank_corr_account, 20).replace(/\D/g, ""),
    director_name: clean(body.director_name, 200),
    director_position: clean(body.director_position, 200),
    contact_email: clean(body.contact_email, 200),
  };

  // Validation per client_type
  const errors: Record<string, string> = {};
  if (client_type !== "individual") {
    if (data.inn.length !== (client_type === "llc" ? 10 : 12)) {
      errors.inn = `ИНН должен быть из ${client_type === "llc" ? 10 : 12} цифр`;
    }
    if (client_type === "llc" && data.kpp && data.kpp.length !== 9) {
      errors.kpp = "КПП должен быть из 9 цифр";
    }
    if (data.bank_bik && data.bank_bik.length !== 9) {
      errors.bank_bik = "БИК должен быть из 9 цифр";
    }
    if (data.bank_account && data.bank_account.length !== 20) {
      errors.bank_account = "Расчётный счёт должен быть из 20 цифр";
    }
    if (data.bank_corr_account && data.bank_corr_account.length !== 20) {
      errors.bank_corr_account = "Корр.счёт должен быть из 20 цифр";
    }
    if (data.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) {
      errors.contact_email = "Неверный формат email";
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  await query(
    `UPDATE users SET
       client_type = $1, legal_name = $2, inn = $3, kpp = $4, ogrn = $5,
       legal_address = $6, bank_name = $7, bank_bik = $8, bank_account = $9,
       bank_corr_account = $10, director_name = $11, director_position = $12,
       contact_email = $13
     WHERE id = $14`,
    [
      data.client_type, data.legal_name, data.inn, data.kpp, data.ogrn,
      data.legal_address, data.bank_name, data.bank_bik, data.bank_account,
      data.bank_corr_account, data.director_name, data.director_position,
      data.contact_email, session.userId,
    ],
  );

  return NextResponse.json({ ok: true, data });
}
