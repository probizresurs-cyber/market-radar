/**
 * Сумма прописью на русском языке.
 * 1234.56 → "Одна тысяча двести тридцать четыре рубля 56 копеек"
 *
 * Используется в счетах и актах — печатается под итогом.
 */

const ONES_M  = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F  = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS   = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS    = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function plural(n: number, one: string, few: string, many: string): string {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 > 10 && m100 < 20) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function tripletToWords(n: number, feminine: boolean): string {
  const ones = feminine ? ONES_F : ONES_M;
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) parts.push(TEENS[o]);
  else {
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ones[o]);
  }
  return parts.join(" ");
}

/**
 * Сумма прописью.
 * @param amount сумма в рублях (целое или с копейками)
 * @returns "Одна тысяча двести рублей 50 копеек"
 */
export function amountToWords(amount: number): string {
  if (!isFinite(amount) || amount < 0) return "Ноль рублей 00 копеек";

  const rubles = Math.floor(amount);
  const kop = Math.round((amount - rubles) * 100);

  if (rubles === 0) {
    return `Ноль рублей ${String(kop).padStart(2, "0")} копеек`;
  }

  const billions = Math.floor(rubles / 1_000_000_000);
  const millions = Math.floor((rubles % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1_000);
  const units = rubles % 1_000;

  const parts: string[] = [];
  if (billions) {
    parts.push(tripletToWords(billions, false), plural(billions, "миллиард", "миллиарда", "миллиардов"));
  }
  if (millions) {
    parts.push(tripletToWords(millions, false), plural(millions, "миллион", "миллиона", "миллионов"));
  }
  if (thousands) {
    parts.push(tripletToWords(thousands, true), plural(thousands, "тысяча", "тысячи", "тысяч"));
  }
  if (units || (!billions && !millions && !thousands)) {
    parts.push(tripletToWords(units || 0, false));
  }

  let s = parts.join(" ").trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  const rubLabel = plural(rubles, "рубль", "рубля", "рублей");
  return `${s} ${rubLabel} ${String(kop).padStart(2, "0")} копеек`;
}
