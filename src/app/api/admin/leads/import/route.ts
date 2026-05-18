/**
 * POST /api/admin/leads/import
 *
 * Body: { csv: string, source?: string }
 *
 * Импорт CSV-таблицы лидов. Поддерживает заголовки (любой регистр):
 *   domain | url | site | website  (обязательный — иначе строка пропускается)
 *   company | company_name | name
 *   email | contact_email
 *   phone | contact_phone
 *   telegram | tg | contact_telegram
 *   city
 *   niche | industry
 *   tags  (через запятую или ;)
 *
 * Любой лишний столбец игнорируется. Идемпотентно по `domain` —
 * повторный импорт того же сайта НЕ создаёт дубликат (ON CONFLICT DO NOTHING).
 *
 * Возвращает {imported, skipped, errors}.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { normalizeDomain, domainToSlug } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/** Простейший CSV-парсер: запятые ИЛИ точки с запятой, кавычки опционально.
 *  Не покрывает экзотику (multi-line cells), для типичных Excel-экспортов хватает. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // авто-детект разделителя: если первая строка содержит ; — используем его,
  // иначе запятую. Это покрывает Excel-RU (;) и стандартный CSV (,).
  const delim = lines[0]?.includes(";") && !lines[0]?.includes(",") ? ";" : ",";
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        if (inQuotes && raw[i + 1] === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === delim && !inQuotes) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map(c => c.trim()));
  }
  return rows;
}

/** Нормализует заголовок: «E-Mail» → «email», «Сайт» → «site». */
function normalizeHeader(h: string): string {
  const cleaned = h.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_|_$/g, "");
  // Русские синонимы → канонические английские
  const map: Record<string, string> = {
    сайт: "domain",
    url: "domain",
    website: "domain",
    site: "domain",
    компания: "company_name",
    company: "company_name",
    name: "company_name",
    name_company: "company_name",
    наименование: "company_name",
    e_mail: "email",
    e_mai: "email",
    почта: "email",
    телефон: "phone",
    phone_number: "phone",
    телеграм: "telegram",
    tg: "telegram",
    город: "city",
    ниша: "niche",
    отрасль: "niche",
    industry: "niche",
    теги: "tags",
  };
  return map[cleaned] ?? cleaned;
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { csv?: string; source?: string };
    if (!body.csv || typeof body.csv !== "string") {
      return NextResponse.json({ ok: false, error: "csv обязателен" }, { status: 400 });
    }

    const rows = parseCsv(body.csv);
    if (rows.length < 2) {
      return NextResponse.json({ ok: false, error: "CSV пустой или только заголовок" }, { status: 400 });
    }

    const headers = rows[0].map(normalizeHeader);
    const idxOf = (key: string) => headers.indexOf(key);
    const domainIdx = idxOf("domain");
    if (domainIdx < 0) {
      return NextResponse.json({
        ok: false,
        error: `Не найдена колонка с доменом. Используйте заголовок: domain / url / site / website / сайт. Получены: ${headers.join(", ")}`,
      }, { status: 400 });
    }

    const source = (body.source || `csv-${new Date().toISOString().slice(0, 10)}`).slice(0, 100);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Идём построчно. ON CONFLICT (domain) DO NOTHING — дубликаты не падают.
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[domainIdx]) { skipped++; continue; }
      const domain = normalizeDomain(row[domainIdx]);
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
        skipped++;
        if (errors.length < 20) errors.push(`Строка ${i + 1}: «${row[domainIdx]}» не похожа на домен`);
        continue;
      }

      const get = (key: string) => {
        const j = idxOf(key);
        return j >= 0 ? (row[j] ?? "").trim() || null : null;
      };
      const tagsRaw = get("tags");
      const tags = tagsRaw ? tagsRaw.split(/[,;]+/).map(t => t.trim()).filter(Boolean) : null;

      try {
        const id = randomUUID();
        const slug = domainToSlug(domain);
        const res = await query(
          `INSERT INTO leads (id, domain, company_name, contact_email, contact_phone, contact_telegram, city, niche, slug, source, tags, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new')
           ON CONFLICT (domain) DO NOTHING
           RETURNING id`,
          [id, domain, get("company_name"), get("email"), get("phone"), get("telegram"), get("city"), get("niche"), slug, source, tags],
        );
        if (Array.isArray(res) && res.length > 0) imported++;
        else skipped++;
      } catch (e) {
        skipped++;
        if (errors.length < 20) errors.push(`Строка ${i + 1} (${domain}): ${e instanceof Error ? e.message : "error"}`);
      }
    }

    return NextResponse.json({ ok: true, imported, skipped, errors, total: rows.length - 1 });
  } catch (e) {
    console.error("admin/leads/import error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
