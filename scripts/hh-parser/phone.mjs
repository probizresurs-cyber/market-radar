// ─────────────────────────────────────────────────────────────────────────────
// Извлечение и нормализация телефонов. Логика повторяет твой n8n, но в одном месте.
// ─────────────────────────────────────────────────────────────────────────────

import { SETTINGS } from "./config.mjs";

/**
 * Достаёт телефон из HTML сайта компании.
 * 1) href="tel:..."  2) телефон в тексте по regex РФ-формата.
 * Возвращает строку цифр (например "79991234567") или null.
 */
export function extractPhoneFromHtml(html) {
  if (!html || typeof html !== "string" || html.length < 100) return null;

  // 1) tel: ссылка — самый надёжный сигнал
  const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) {
    const digits = telMatch[1].replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }

  // 2) номер в тексте
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const m = text.match(
    /(?:\+?7|8)\s*\(?\d{3}\)?\s*[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}/
  );
  if (m) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return null;
}

/**
 * Нормализует телефон РФ к виду +7XXXXXXXXXX.
 * Возвращает null, если это не валидный РФ-номер (или 8-800 при drop8800).
 */
export function normalizeRuPhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits.length === 10) digits = "7" + digits;

  if (!/^7\d{10}$/.test(digits)) return null;
  if (SETTINGS.drop8800 && digits.startsWith("7800")) return null;

  return "+" + digits;
}

/**
 * Собирает строку для Google Sheet из вакансии (item списка hh) и
 * деталки работодателя. Структура колонок — как в твоей таблице.
 */
export function buildRow(vacancy, employer, phone) {
  const v = vacancy || {};
  const e = employer || {};

  const snippet = v.snippet || {};
  const vacancyDescription = [snippet.requirement, snippet.responsibility]
    .filter(Boolean)
    .join(" ")
    .replace(/<\/?highlighttext>/g, "");

  const salary = v.salary || {};
  const city = v.address?.city || v.area?.name || "";

  // метро / место работы
  let metro = "";
  if (Array.isArray(v.address?.metro_stations) && v.address.metro_stations.length) {
    metro = [...new Set(v.address.metro_stations.map((m) => m.line_name).filter(Boolean))].join(", ");
  } else if (v.address?.metro?.line_name) {
    metro = v.address.metro.line_name;
  }

  return {
    company: e.name || v.employer?.name || "",
    phone: phone || "",
    description: stripHtml(e.description) || "",
    hh_url: e.alternate_url || v.employer?.alternate_url || "",
    vacancy_name: v.name || "",
    vacancy_description: vacancyDescription,
    salary_from: salary.from != null ? `${salary.from} ${salary.currency || ""}`.trim() : "",
    salary_to: salary.to != null ? `${salary.to} ${salary.currency || ""}`.trim() : "",
    key_skills: (snippet.responsibility || "").replace(/<\/?highlighttext>/g, ""),
    workplace: metro,
    city,
    vacancy_url: v.alternate_url || "",
  };
}

function stripHtml(s) {
  if (!s) return "";
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
