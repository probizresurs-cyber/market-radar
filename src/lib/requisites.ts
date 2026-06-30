/**
 * Юр.реквизиты клиента и исполнителя — общие типы и хелперы.
 *
 * Реквизиты клиента хранятся в users.* (см. db.ts → ALTER TABLE users).
 * Реквизиты исполнителя (твоего ИП) задаются в .env (VENDOR_*) или в админке;
 * см. getVendorRequisites().
 */

export type ClientType = "individual" | "ip" | "llc";

export interface ClientRequisites {
  client_type: ClientType;
  legal_name: string;          // "ООО Ромашка" / "ИП Иванов И.И." / "Иванов Иван Иванович"
  inn: string;
  kpp: string;                 // только для ООО
  ogrn: string;                // ОГРН/ОГРНИП
  legal_address: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;        // расчётный счёт
  bank_corr_account: string;
  director_name: string;       // ФИО директора (ООО) или ИП
  director_position: string;   // "Генеральный директор" / "Индивидуальный предприниматель"
  contact_email: string;       // отдельный e-mail для бухгалтерии
}

export interface VendorRequisites {
  legal_name: string;          // "ИП Иванов Иван Иванович"
  short_name: string;          // "ИП Иванов И.И." (для счёта)
  director_name: string;       // ФИО полностью
  director_position: string;   // "Индивидуальный предприниматель"
  inn: string;
  ogrn: string;
  legal_address: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  bank_corr_account: string;
  taxation: string;            // "УСН Доходы 6%" / "НПД" / etc.
  vat_mode: "none" | "vat20" | "vat10" | "vat0";
  vat_note: string;            // "Без НДС (УСН)" — печатается в счёте
  signature_url?: string;      // факсимиле подписи (опционально)
  stamp_url?: string;          // печать (опционально)
  contact_phone?: string;
  contact_email?: string;
}

/**
 * Реквизиты исполнителя (нашего ИП). Берутся из переменных окружения,
 * пока в админке нет UI-формы. Используются для печати в счетах и актах.
 *
 * Если переменные не заполнены — в PDF появятся плейсхолдеры вида
 * «{{VENDOR_LEGAL_NAME}}», что ясно сигнализирует, что нужно настроить .env.
 */
export function getVendorRequisites(): VendorRequisites {
  const env = process.env;
  return {
    legal_name: env.VENDOR_LEGAL_NAME ?? "ИП Штумпф Юрий Геннадьевич",
    short_name: env.VENDOR_SHORT_NAME ?? env.VENDOR_LEGAL_NAME ?? "ИП Штумпф Ю. Г.",
    director_name: env.VENDOR_DIRECTOR_NAME ?? "Штумпф Юрий Геннадьевич",
    director_position: env.VENDOR_DIRECTOR_POSITION ?? "Индивидуальный предприниматель",
    inn: env.VENDOR_INN ?? "550615955642",
    ogrn: env.VENDOR_OGRN ?? "317774600595262",
    legal_address: env.VENDOR_LEGAL_ADDRESS ?? "123290, г. Москва, Шелепихинская набережная, д. 34, к. 2, оф. 704",
    bank_name: env.VENDOR_BANK_NAME ?? "{{VENDOR_BANK_NAME}}",
    bank_bik: env.VENDOR_BANK_BIK ?? "{{VENDOR_BANK_BIK}}",
    bank_account: env.VENDOR_BANK_ACCOUNT ?? "{{VENDOR_BANK_ACCOUNT}}",
    bank_corr_account: env.VENDOR_BANK_CORR ?? "{{VENDOR_BANK_CORR}}",
    taxation: env.VENDOR_TAXATION ?? "УСН Доходы",
    vat_mode: (env.VENDOR_VAT_MODE as VendorRequisites["vat_mode"]) ?? "none",
    vat_note: env.VENDOR_VAT_NOTE ?? "Без НДС",
    signature_url: env.VENDOR_SIGNATURE_URL,
    stamp_url: env.VENDOR_STAMP_URL,
    contact_phone: env.VENDOR_CONTACT_PHONE,
    contact_email: env.VENDOR_CONTACT_EMAIL,
  };
}

/** Все ли поля исполнителя заполнены (vendor готов выставлять счета). */
export function isVendorReady(): boolean {
  const v = getVendorRequisites();
  return !v.legal_name.startsWith("{{") &&
         !v.inn.startsWith("{{") &&
         !v.bank_account.startsWith("{{") &&
         !v.bank_bik.startsWith("{{");
}

/**
 * Какие из обязательных полей клиента отсутствуют — для UI «Заполнить
 * реквизиты, прежде чем сформировать счёт».
 *
 * Для физлица счёт не выставляется вовсе — возвращаем спец-сигнал.
 */
export function getMissingClientFields(req: Partial<ClientRequisites>): string[] {
  if (!req.client_type || req.client_type === "individual") {
    return ["client_type"]; // единственный способ — переключиться на ИП/ООО
  }
  const required: Array<keyof ClientRequisites> = [
    "legal_name", "inn", "legal_address",
    "bank_name", "bank_bik", "bank_account", "bank_corr_account",
    "director_name",
  ];
  if (req.client_type === "llc") required.push("kpp", "ogrn");
  if (req.client_type === "ip")  required.push("ogrn");
  const missing: string[] = [];
  for (const k of required) {
    const v = req[k];
    if (!v || (typeof v === "string" && v.trim() === "")) missing.push(k);
  }
  return missing;
}

/** Маска расчётного счёта по разделам (для печати): «4070 2810 1234 5678 9012». */
export function formatAccount(acc: string | null | undefined): string {
  if (!acc) return "—";
  const clean = acc.replace(/\D/g, "");
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

/** Краткое название юрлица для шапки документов. */
export function shortName(req: Pick<ClientRequisites, "client_type" | "legal_name" | "director_name">): string {
  if (req.client_type === "individual") return req.director_name || req.legal_name || "Физическое лицо";
  return req.legal_name || "—";
}

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  individual: "Физическое лицо",
  ip: "Индивидуальный предприниматель",
  llc: "Юридическое лицо (ООО / АО / др.)",
};
