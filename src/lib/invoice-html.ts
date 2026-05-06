/**
 * HTML-шаблон счёта на оплату для ИП/юрлица (форма Минфина РФ).
 * Используется как для PDF-рендера (через puppeteer), так и для просмотра
 * в браузере (с window.print).
 *
 * Все реквизиты (исполнитель, клиент, банк) передаются параметрами —
 * шаблон агностичен.
 */

import type { ClientRequisites, VendorRequisites } from "./requisites";
import { amountToWords } from "./amount-words";

export interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  service_description: string;
  amount: number;                      // в рублях
  vat_mode: "none" | "vat20" | "vat10" | "vat0";
  service_period_start?: Date | null;
  service_period_end?: Date | null;
}

const fmtDate = (d: Date | null | undefined): string => {
  if (!d) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
};

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const escape = (s: string | null | undefined): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const vatLabel = (mode: InvoiceData["vat_mode"], vendorVatNote: string): string => {
  if (mode === "none") return vendorVatNote || "Без НДС";
  if (mode === "vat0") return "НДС 0%";
  if (mode === "vat10") return "НДС 10%";
  if (mode === "vat20") return "НДС 20%";
  return "Без НДС";
};

const vatAmount = (amount: number, mode: InvoiceData["vat_mode"]): number => {
  if (mode === "vat10") return Math.round((amount / 1.10 * 0.10) * 100) / 100;
  if (mode === "vat20") return Math.round((amount / 1.20 * 0.20) * 100) / 100;
  return 0;
};

export function buildInvoiceHTML(
  invoice: InvoiceData,
  vendor: VendorRequisites,
  client: ClientRequisites,
): string {
  const totalQty = 1;
  const total = invoice.amount;
  const vatTotal = vatAmount(total, invoice.vat_mode);
  const totalWords = amountToWords(total);

  const isClientLLC = client.client_type === "llc";

  const period = invoice.service_period_start && invoice.service_period_end
    ? ` (за период с ${fmtDate(invoice.service_period_start)} по ${fmtDate(invoice.service_period_end)})`
    : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Счёт на оплату ${escape(invoice.invoice_number)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5pt;
    color: #000;
    margin: 0; padding: 0;
    line-height: 1.35;
  }
  .doc { max-width: 186mm; margin: 0 auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; padding: 4px 6px; }
  .bordered, .bordered td, .bordered th { border: 0.6pt solid #000; }
  .header-table td { padding: 6px 8px; font-size: 9.5pt; }
  .label { color: #444; font-size: 8.5pt; }
  .small { font-size: 8.5pt; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .title {
    font-size: 16pt; font-weight: bold; text-align: left; margin: 14px 0 12px;
  }
  .subtitle { font-size: 9pt; color: #666; margin-top: -6px; margin-bottom: 14px; }
  .parties-table { margin: 10px 0 14px; }
  .parties-table .label-cell { width: 35%; font-size: 8.5pt; color: #444; padding-right: 8px; }
  .items-table th {
    background: #efefef;
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
  }
  .items-table td { font-size: 9.5pt; }
  .totals { margin-top: 4px; }
  .totals td { font-size: 10pt; }
  .signatures { margin-top: 36px; }
  .sign-line { display: inline-block; min-width: 60mm; border-bottom: 0.6pt solid #000; height: 18mm; vertical-align: bottom; position: relative; }
  .sign-caption { font-size: 8.5pt; text-align: center; margin-top: 2px; }
  .stamp-area { display: inline-block; width: 35mm; height: 35mm; border: 1pt dashed #aaa; border-radius: 50%; text-align: center; line-height: 35mm; font-size: 8pt; color: #888; vertical-align: top; margin-left: 14px; }
  .footer-note {
    margin-top: 24px;
    padding: 8px 10px;
    border-top: 0.4pt solid #888;
    font-size: 8.5pt;
    color: #555;
    line-height: 1.4;
  }
  /* Шапка с реквизитами банка получателя — официальная форма счёта */
  .bank-header {
    margin-bottom: 14px;
  }
  .bank-header .row td {
    border: 0.6pt solid #000;
  }
  .bank-header .row td.lbl {
    font-size: 8pt;
    background: #fafafa;
    width: 38mm;
  }
  .bank-header .double-row td {
    border: 0.6pt solid #000;
    padding: 4px 6px;
    font-size: 9pt;
  }
  .bank-header .narrow {
    width: 16mm;
    text-align: center;
    background: #fafafa;
  }
  @media print {
    body { font-size: 10.5pt; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="doc">

<!-- Шапка с реквизитами банка получателя -->
<table class="bank-header">
  <tr class="row">
    <td class="lbl">ИНН ${escape(vendor.inn)}</td>
    <td class="lbl" style="width: 28mm;">${vendor.inn.length === 10 ? "КПП —" : ""}</td>
    <td rowspan="2" style="width: 30mm;" class="center small">Сч. №</td>
    <td rowspan="2" style="width: 70mm; font-weight: bold;">${escape(vendor.bank_account)}</td>
  </tr>
  <tr class="row">
    <td colspan="2" style="font-size: 9.5pt; font-weight: bold;">Получатель<br>${escape(vendor.legal_name)}</td>
  </tr>
  <tr class="double-row">
    <td colspan="2">Банк получателя<br><span class="bold">${escape(vendor.bank_name)}</span></td>
    <td class="narrow">БИК</td>
    <td class="bold">${escape(vendor.bank_bik)}</td>
  </tr>
  <tr class="double-row">
    <td colspan="2"></td>
    <td class="narrow">Сч. №</td>
    <td class="bold">${escape(vendor.bank_corr_account)}</td>
  </tr>
</table>

<!-- Заголовок -->
<div class="title">Счёт на оплату № ${escape(invoice.invoice_number)} от ${fmtDate(invoice.invoice_date)}</div>

<!-- Реквизиты сторон -->
<table class="parties-table">
  <tr>
    <td class="label-cell">Поставщик (Исполнитель):</td>
    <td>
      <span class="bold">${escape(vendor.legal_name)}</span>,
      ИНН ${escape(vendor.inn)}${vendor.ogrn ? `, ОГРН${vendor.inn.length === 12 ? "ИП" : ""} ${escape(vendor.ogrn)}` : ""},
      ${escape(vendor.legal_address)}
    </td>
  </tr>
  <tr>
    <td class="label-cell">Покупатель (Заказчик):</td>
    <td>
      <span class="bold">${escape(client.legal_name)}</span>,
      ИНН ${escape(client.inn)}${isClientLLC && client.kpp ? `, КПП ${escape(client.kpp)}` : ""}${client.ogrn ? `, ОГРН${client.client_type === "ip" ? "ИП" : ""} ${escape(client.ogrn)}` : ""},
      ${escape(client.legal_address)}
    </td>
  </tr>
  <tr>
    <td class="label-cell">Основание:</td>
    <td>Договор-оферта (публичный) на оказание услуг</td>
  </tr>
</table>

<!-- Таблица услуг -->
<table class="bordered items-table">
  <thead>
    <tr>
      <th style="width: 8mm;">№</th>
      <th>Товары (работы, услуги)</th>
      <th style="width: 18mm;">Кол-во</th>
      <th style="width: 16mm;">Ед.</th>
      <th style="width: 26mm;">Цена</th>
      <th style="width: 28mm;">Сумма</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td>${escape(invoice.service_description)}${period}</td>
      <td class="center">${totalQty}</td>
      <td class="center">шт.</td>
      <td class="right">${fmtMoney(total)}</td>
      <td class="right bold">${fmtMoney(total)}</td>
    </tr>
  </tbody>
</table>

<!-- Итого -->
<table class="totals" style="margin-top: 6px;">
  <tr>
    <td style="width: 60%;"></td>
    <td class="right" style="padding-right: 6px;">Итого:</td>
    <td class="right bold" style="width: 28mm;">${fmtMoney(total)} ₽</td>
  </tr>
  <tr>
    <td></td>
    <td class="right" style="padding-right: 6px;">${vatLabel(invoice.vat_mode, vendor.vat_note)}:</td>
    <td class="right" style="width: 28mm;">${invoice.vat_mode === "none" || invoice.vat_mode === "vat0" ? "—" : fmtMoney(vatTotal) + " ₽"}</td>
  </tr>
  <tr>
    <td></td>
    <td class="right" style="padding-right: 6px;"><span class="bold">Всего к оплате:</span></td>
    <td class="right bold" style="width: 28mm;">${fmtMoney(total)} ₽</td>
  </tr>
</table>

<div style="margin-top: 10px; font-size: 9.5pt;">
  Всего наименований 1, на сумму <span class="bold">${fmtMoney(total)}</span> руб.
</div>
<div style="margin-top: 4px; font-style: italic; font-size: 10pt;">
  ${escape(totalWords)}
</div>

<div style="margin-top: 14px; font-size: 9.5pt;">
  <span class="bold">Срок оплаты:</span> до ${fmtDate(invoice.due_date)}.
  В назначении платежа обязательно указать: «Оплата по счёту № ${escape(invoice.invoice_number)} от ${fmtDate(invoice.invoice_date)}.
  ${invoice.vat_mode === "none" ? "Без НДС" : ""}»
</div>

<!-- Подписи -->
<div class="signatures">
  <table style="width: 100%;">
    <tr>
      <td style="width: 60%;">
        <div>${escape(vendor.director_position)}</div>
        <div class="sign-line">
          ${vendor.signature_url ? `<img src="${escape(vendor.signature_url)}" alt="" style="position: absolute; right: 4px; top: 0; max-height: 16mm;">` : ""}
        </div>
        <div class="sign-caption">подпись / ${escape(vendor.director_name)}</div>
      </td>
      <td>
        ${vendor.stamp_url
          ? `<img src="${escape(vendor.stamp_url)}" alt="М.П." style="max-width: 35mm; max-height: 35mm;">`
          : `<div class="stamp-area">М.П.</div>`}
      </td>
    </tr>
  </table>
</div>

<div class="footer-note">
  Счёт действителен в течение 5 банковских дней с даты выставления. Сформирован в системе MarketRadar
  (${escape(invoice.invoice_date.toISOString().slice(0, 10))} ${invoice.invoice_date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}).
</div>

</div>
</body>
</html>`;
}
