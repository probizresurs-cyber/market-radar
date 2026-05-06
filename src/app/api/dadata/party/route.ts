/**
 * GET /api/dadata/party?inn=XXXXXXXXXX
 *
 * Подтягивает реквизиты юрлица/ИП из ФНС через DaData по ИНН.
 * Используется в Settings → Реквизиты для автозаполнения формы.
 *
 * DaData возвращает массив "suggestions"; берём первую запись.
 *
 * Ответ:
 *   { ok, data: {
 *       legal_name, short_name, inn, kpp, ogrn,
 *       legal_address, director_name, director_position,
 *       client_type: "ip" | "llc",
 *     } }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

interface DaDataParty {
  value?: string;       // короткое название (как пишут в счёте)
  unrestricted_value?: string; // полное название
  data?: {
    inn?: string;
    kpp?: string;
    ogrn?: string;
    type?: "LEGAL" | "INDIVIDUAL"; // LEGAL = ООО / АО, INDIVIDUAL = ИП
    name?: {
      full_with_opf?: string;     // "Общество с ограниченной ответственностью «Ромашка»"
      short_with_opf?: string;    // 'ООО "Ромашка"'
      full?: string;              // "РОМАШКА"
      short?: string;
    };
    address?: {
      unrestricted_value?: string;       // полный адрес одной строкой
      value?: string;
      data?: { source?: string };
    };
    management?: {
      name?: string;        // "Иванов Иван Иванович"
      post?: string;        // "ГЕНЕРАЛЬНЫЙ ДИРЕКТОР"
    };
    fio?: {
      surname?: string;
      name?: string;
      patronymic?: string;
    };
  };
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const inn = (searchParams.get("inn") ?? "").trim();
  if (!/^\d{10}$|^\d{12}$/.test(inn)) {
    return NextResponse.json(
      { ok: false, error: "ИНН должен содержать 10 (юрлицо) или 12 (ИП) цифр" },
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
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ query: inn, count: 1 }),
      },
    );
    clearTimeout(t);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `DaData HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const json = (await res.json()) as { suggestions?: DaDataParty[] };
    const sugg = json.suggestions?.[0];
    if (!sugg) {
      return NextResponse.json(
        { ok: false, error: "По этому ИНН ничего не найдено в реестре ФНС" },
        { status: 404 },
      );
    }

    const d = sugg.data ?? {};
    const isIp = d.type === "INDIVIDUAL";

    // Для ИП имя из fio, для ООО — из management
    let directorName = d.management?.name ?? "";
    let directorPosition = d.management?.post ?? "";
    if (isIp && d.fio) {
      const { surname = "", name = "", patronymic = "" } = d.fio;
      directorName = [surname, name, patronymic].filter(Boolean).join(" ").trim();
      directorPosition = "Индивидуальный предприниматель";
    }

    return NextResponse.json({
      ok: true,
      data: {
        client_type: (isIp ? "ip" : "llc") as "ip" | "llc",
        legal_name: d.name?.short_with_opf ?? sugg.value ?? "",
        full_name: d.name?.full_with_opf ?? sugg.unrestricted_value ?? "",
        inn: d.inn ?? inn,
        kpp: d.kpp ?? "",
        ogrn: d.ogrn ?? "",
        legal_address: d.address?.unrestricted_value ?? d.address?.value ?? "",
        director_name: directorName,
        director_position: directorPosition,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка DaData" },
      { status: 500 },
    );
  }
}
