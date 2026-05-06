/**
 * GET /api/dadata/bank?bik=XXXXXXXXX
 *
 * Подтягивает реквизиты банка по БИК через DaData.
 * Используется в Settings → Реквизиты для автозаполнения корр.счёта,
 * названия банка и адреса по введённому БИК.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

interface DaDataBank {
  value?: string;
  data?: {
    bic?: string;
    name?: { payment?: string; full?: string; short?: string };
    correspondent_account?: string;
    address?: { unrestricted_value?: string; value?: string };
    state?: { status?: string };
  };
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const bik = (searchParams.get("bik") ?? "").trim();
  if (!/^\d{9}$/.test(bik)) {
    return NextResponse.json(
      { ok: false, error: "БИК должен содержать ровно 9 цифр" },
      { status: 400 },
    );
  }

  const token = process.env.DADATA_API_KEY;
  if (!token) {
    return NextResponse.json({ ok: false, error: "DADATA_API_KEY не настроен" }, { status: 500 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ query: bik, count: 1 }),
      },
    );
    clearTimeout(t);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `DaData HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const json = (await res.json()) as { suggestions?: DaDataBank[] };
    const sugg = json.suggestions?.[0];
    if (!sugg) {
      return NextResponse.json(
        { ok: false, error: "По этому БИК банк не найден" },
        { status: 404 },
      );
    }

    const d = sugg.data ?? {};
    if (d.state?.status === "LIQUIDATING" || d.state?.status === "LIQUIDATED") {
      return NextResponse.json(
        { ok: false, error: "Банк ликвидирован — проверьте БИК" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        bik: d.bic ?? bik,
        bank_name: d.name?.payment ?? d.name?.short ?? sugg.value ?? "",
        bank_full_name: d.name?.full ?? "",
        bank_corr_account: d.correspondent_account ?? "",
        bank_address: d.address?.unrestricted_value ?? d.address?.value ?? "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка DaData" },
      { status: 500 },
    );
  }
}
