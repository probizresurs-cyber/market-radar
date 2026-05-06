/**
 * HTML-шаблон акта об оказании услуг (типовая форма для ИП на УСН/НПД).
 */

import type { ClientRequisites, VendorRequisites } from "./requisites";
import { amountToWords } from "./amount-words";

export interface ActData {
  act_number: string;
  act_date: Date;
  invoice_number?: string | null;       // если есть связь со счётом
  invoice_date?: Date | null;
  service_description: string;
  amount: number;
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

const vatLabel = (mode: ActData["vat_mode"], vendorVatNote: string): string => {
  if (mode === "none") return vendorVatNote || "Без НДС";
  if (mode === "vat0") return "НДС 0%";
  if (mode === "vat10") return "НДС 10%";
  if (mode === "vat20") return "НДС 20%";
  return "Без НДС";
};

export function buildActHTML(
  act: ActData,
  vendor: VendorRequisites,
  client: ClientRequisites,
): string {
  const total = act.amount;
  const totalWords = amountToWords(total);
  const isClientLLC = client.client_type === "llc";

  const period = act.service_period_start && act.service_period_end
    ? ` за период с ${fmtDate(act.service_period_start)} по ${fmtDate(act.service_period_end)}`
    : "";

  const basis = act.invoice_number
    ? `Счёт № ${escape(act.invoice_number)} от ${fmtDate(act.invoice_date)}`
    : `Договор-оферта на оказание услуг`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Акт ${escape(act.act_number)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    color: #000;
    margin: 0; padding: 0;
    line-height: 1.4;
  }
  .doc { max-width: 182mm; margin: 0 auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 6px 8px; vertical-align: top; }
  .bordered, .bordered td, .bordered th { border: 0.6pt solid #000; }
  .title {
    font-size: 16pt; font-weight: bold; text-align: center; margin: 8px 0 4px;
  }
  .subtitle { font-size: 12pt; text-align: center; margin: 0 0 16px; }
  .city-date {
    display: flex; justify-content: space-between;
    margin: 8px 0 18px; font-size: 11pt;
  }
  .parties { font-size: 11pt; line-height: 1.55; margin-bottom: 18px; text-align: justify; }
  .items-table th {
    background: #efefef;
    font-size: 10pt;
    font-weight: bold;
    text-align: center;
  }
  .items-table td { font-size: 10.5pt; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .totals td { font-size: 11pt; padding: 4px 6px; }
  .closing {
    margin-top: 18px;
    font-size: 11pt;
    text-align: justify;
    line-height: 1.55;
  }
  .signatures { margin-top: 36px; }
  .sign-block {
    width: 48%;
    display: inline-block;
    vertical-align: top;
  }
  .sign-line {
    display: inline-block;
    min-width: 60mm;
    border-bottom: 0.6pt solid #000;
    height: 16mm;
    vertical-align: bottom;
    position: relative;
  }
  .sign-caption { font-size: 8.5pt; margin-top: 2px; }
  .stamp-area {
    display: inline-block;
    width: 32mm; height: 32mm;
    border: 1pt dashed #aaa;
    border-radius: 50%;
    text-align: center;
    line-height: 32mm;
    font-size: 8pt; color: #888;
    vertical-align: top;
    margin-left: 12px;
  }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="doc">

<div class="title">Акт № ${escape(act.act_number)}</div>
<div class="subtitle">об оказании услуг</div>

<div class="city-date">
  <div>г. Москва</div>
  <div>${fmtDate(act.act_date)}</div>
</div>

<div class="parties">
  <span class="bold">${escape(vendor.legal_name)}</span>, ИНН ${escape(vendor.inn)}${vendor.ogrn ? `, ОГРН${vendor.inn.length === 12 ? "ИП" : ""} ${escape(vendor.ogrn)}` : ""},
  именуемый(-ая) в дальнейшем «<span class="bold">Исполнитель</span>», в лице
  ${escape(vendor.director_position || "Индивидуального предпринимателя")} ${escape(vendor.director_name)},
  действующего на основании ${vendor.inn.length === 12 ? "свидетельства о регистрации в качестве ИП" : "Устава"}, с одной стороны,
  и <span class="bold">${escape(client.legal_name)}</span>, ИНН ${escape(client.inn)}${isClientLLC && client.kpp ? `, КПП ${escape(client.kpp)}` : ""}${client.ogrn ? `, ОГРН${client.client_type === "ip" ? "ИП" : ""} ${escape(client.ogrn)}` : ""},
  именуемый(-ая) в дальнейшем «<span class="bold">Заказчик</span>», в лице
  ${escape(client.director_position || (client.client_type === "ip" ? "Индивидуального предпринимателя" : "Генерального директора"))} ${escape(client.director_name)},
  с другой стороны, составили настоящий акт о том, что Исполнитель оказал Заказчику услуги${period},
  а Заказчик принял оказанные услуги. Основание: ${basis}.
</div>

<table class="bordered items-table">
  <thead>
    <tr>
      <th style="width: 8mm;">№</th>
      <th>Наименование услуги</th>
      <th style="width: 18mm;">Кол-во</th>
      <th style="width: 16mm;">Ед.</th>
      <th style="width: 28mm;">Цена, ₽</th>
      <th style="width: 28mm;">Сумма, ₽</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td>${escape(act.service_description)}${period}</td>
      <td class="center">1</td>
      <td class="center">шт.</td>
      <td class="right">${fmtMoney(total)}</td>
      <td class="right bold">${fmtMoney(total)}</td>
    </tr>
  </tbody>
</table>

<table class="totals" style="margin-top: 4px;">
  <tr>
    <td style="width: 64%;"></td>
    <td class="right">Итого:</td>
    <td class="right bold" style="width: 28mm;">${fmtMoney(total)} ₽</td>
  </tr>
  <tr>
    <td></td>
    <td class="right">${vatLabel(act.vat_mode, vendor.vat_note)}:</td>
    <td class="right" style="width: 28mm;">${act.vat_mode === "none" || act.vat_mode === "vat0" ? "—" : "—"}</td>
  </tr>
  <tr>
    <td></td>
    <td class="right bold">Всего:</td>
    <td class="right bold" style="width: 28mm;">${fmtMoney(total)} ₽</td>
  </tr>
</table>

<div style="margin-top: 8px; font-size: 10.5pt; font-style: italic;">
  Всего оказано услуг на сумму ${escape(totalWords)}.
</div>

<div class="closing">
  Услуги оказаны Исполнителем в полном объёме, в установленные сроки и с надлежащим
  качеством. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
  Стороны взаимных претензий не имеют.
</div>

<div class="signatures">
  <table style="width: 100%;">
    <tr>
      <td style="width: 50%; padding-right: 8mm;">
        <div class="bold" style="margin-bottom: 6px;">ИСПОЛНИТЕЛЬ</div>
        <div style="font-size: 10.5pt;">${escape(vendor.legal_name)}</div>
        <div style="margin-top: 18px;">
          <span style="font-size: 9.5pt;">${escape(vendor.director_position)}</span>
        </div>
        <div class="sign-line">
          ${vendor.signature_url ? `<img src="${escape(vendor.signature_url)}" style="position: absolute; right: 4px; top: 0; max-height: 14mm;">` : ""}
        </div>
        <div class="sign-caption">${escape(vendor.director_name)}</div>
        <div style="margin-top: 4px;">
          ${vendor.stamp_url
            ? `<img src="${escape(vendor.stamp_url)}" style="max-width: 30mm; max-height: 30mm;">`
            : `<div class="stamp-area">М.П.</div>`}
        </div>
      </td>
      <td style="width: 50%; padding-left: 8mm;">
        <div class="bold" style="margin-bottom: 6px;">ЗАКАЗЧИК</div>
        <div style="font-size: 10.5pt;">${escape(client.legal_name)}</div>
        <div style="margin-top: 18px;">
          <span style="font-size: 9.5pt;">${escape(client.director_position || (client.client_type === "ip" ? "ИП" : "Генеральный директор"))}</span>
        </div>
        <div class="sign-line"></div>
        <div class="sign-caption">${escape(client.director_name)}</div>
        <div style="margin-top: 4px;"><div class="stamp-area">М.П.</div></div>
      </td>
    </tr>
  </table>
</div>

</div>
</body>
</html>`;
}
