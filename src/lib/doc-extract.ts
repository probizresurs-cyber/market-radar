/**
 * Извлечение текста из документов (DOCX / PDF / HTML) БЕЗ внешних зависимостей.
 *
 * Почему без mammoth/pdf-parse: в package.json их нет, а тащить новые
 * зависимости ради двух форматов не хочется — DOCX это ZIP с XML внутри
 * (хватает node:zlib), а для PDF достаточно наивного парсера контент-стримов
 * (FlateDecode + Tj/TJ + ToUnicode CMap), который покрывает подавляющее
 * большинство «офисных» PDF (экспорт из Word/браузера/Google Docs).
 *
 * Используется в:
 *  - /api/content/extract-doc (импорт документов в контент-завод)
 *  - /api/presentation-extract-source (источники данных для презентаций)
 */
import { inflateRawSync, inflateSync } from "node:zlib";

/** Strip HTML/XML tags, decode basic entities, collapse whitespace. */
export function htmlToText(html: string): string {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = noScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(h[1-6]|li|div|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Minimal ZIP reader — находит и распаковывает word/document.xml из DOCX.
 * DOCX — это ZIP-архив; параграфы лежат в `word/document.xml`.
 * Возвращает null если файл не похож на DOCX / не распаковался.
 */
export function extractDocxText(buf: Buffer): string | null {
  try {
    // Locate the end-of-central-directory record (EOCD)
    const eocdSig = 0x06054b50;
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === eocdSig) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) return null;

    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const entries = buf.readUInt16LE(eocdOffset + 10);

    // Walk central directory, find word/document.xml
    let ptr = cdOffset;
    const cdEnd = cdOffset + cdSize;
    const targetName = "word/document.xml";
    for (let i = 0; i < entries && ptr < cdEnd; i++) {
      const sig = buf.readUInt32LE(ptr);
      if (sig !== 0x02014b50) break;
      const compMethod = buf.readUInt16LE(ptr + 10);
      const compSize = buf.readUInt32LE(ptr + 20);
      const nameLen = buf.readUInt16LE(ptr + 28);
      const extraLen = buf.readUInt16LE(ptr + 30);
      const commentLen = buf.readUInt16LE(ptr + 32);
      const localOffset = buf.readUInt32LE(ptr + 42);
      const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString("utf8");
      ptr += 46 + nameLen + extraLen + commentLen;
      if (name !== targetName) continue;

      // Read local file header to find data start
      const lh = localOffset;
      if (buf.readUInt32LE(lh) !== 0x04034b50) return null;
      const lhNameLen = buf.readUInt16LE(lh + 26);
      const lhExtraLen = buf.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + lhNameLen + lhExtraLen;
      const raw = buf.slice(dataStart, dataStart + compSize);
      let xml: string;
      if (compMethod === 0) {
        xml = raw.toString("utf8");
      } else if (compMethod === 8) {
        xml = inflateRawSync(raw).toString("utf8");
      } else {
        return null;
      }

      // Extract text — each <w:t> is a run of text, <w:p> a paragraph
      const paragraphs: string[] = [];
      const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
      const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
      let pm: RegExpExecArray | null;
      while ((pm = pRegex.exec(xml)) !== null) {
        const chunk = pm[0];
        const runs: string[] = [];
        let tm: RegExpExecArray | null;
        tRegex.lastIndex = 0;
        while ((tm = tRegex.exec(chunk)) !== null) {
          runs.push(
            tm[1]
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'"),
          );
        }
        const text = runs.join("").trim();
        if (text) paragraphs.push(text);
      }
      return paragraphs.join("\n\n");
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────

/** Декодирование PDF literal string `(...)` с escape-последовательностями. */
function decodePdfLiteral(src: string): string {
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch !== "\\") { out += ch; continue; }
    const next = src[++i];
    if (next === undefined) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b" || next === "f") out += "";
    else if (next === "\n" || next === "\r") out += ""; // line continuation
    else if (/[0-7]/.test(next)) {
      // Octal escape \ddd (1-3 цифры)
      let oct = next;
      while (oct.length < 3 && /[0-7]/.test(src[i + 1] ?? "")) oct += src[++i];
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
    } else out += next; // \( \) \\ и прочее
  }
  return out;
}

/** Декодирование PDF hex string `<...>` через ToUnicode CMap (2-байтные CID). */
function decodePdfHex(hex: string, cmap: Map<number, string>): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  if (cmap.size > 0) {
    // CID-шрифты: коды по 4 hex-символа, маппим через ToUnicode
    for (let i = 0; i + 4 <= clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      const uni = cmap.get(code);
      if (uni !== undefined) out += uni;
    }
  } else {
    // Простые шрифты: 1 байт = 1 символ (latin1-приближение)
    for (let i = 0; i + 2 <= clean.length; i += 2) {
      out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    }
  }
  return out;
}

/**
 * Наивное извлечение текста из PDF.
 *
 * Что покрывает: FlateDecode-стримы, операторы Tj/TJ/', hex-строки через
 * объединённый ToUnicode CMap (bfchar + bfrange) — это стандартный вывод
 * Word / Google Docs / Chrome «Сохранить как PDF», включая кириллицу.
 *
 * Что НЕ покрывает: сканы без текстового слоя (нужен OCR), экзотические
 * фильтры (LZW, DCT-текст), пофонтовые CMap-коллизии (мы сливаем все CMap
 * в одну — на практике коды почти никогда не конфликтуют по смыслу).
 *
 * Возвращает null если текст извлечь не удалось или он выглядит как мусор
 * (< 40 букв) — вызывающий код должен показать понятную ошибку.
 */
export function extractPdfText(buf: Buffer): string | null {
  try {
    if (buf.slice(0, 5).toString("latin1") !== "%PDF-") return null;
    const latin = buf.toString("latin1");

    // 1) Собираем все stream-объекты (словарь до `stream` + распакованные данные)
    const streams: Buffer[] = [];
    const streamRe = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = streamRe.exec(latin)) !== null) {
      // «endstream» содержит подстроку «stream\n» — такое ложное совпадение
      // нельзя обрабатывать, иначе оно «съедает» следующий реальный stream
      // (end уезжает на endstream следующего объекта и lastIndex перескакивает
      // через его начало).
      if (latin.slice(Math.max(0, m.index - 3), m.index) === "end") continue;
      const start = m.index + m[0].length;
      const end = latin.indexOf("endstream", start);
      if (end < 0) break;
      // Словарь объекта — прямо перед `stream`; окно в 1000 символов
      // покрывает типичные /Filter-декларации и не тащит весь файл.
      const dict = latin.slice(Math.max(0, m.index - 1000), m.index);
      let data = buf.slice(start, end);
      // Срезаем хвостовой EOL перед endstream
      while (data.length > 0 && (data[data.length - 1] === 0x0a || data[data.length - 1] === 0x0d)) {
        data = data.slice(0, -1);
      }
      if (/\/FlateDecode/.test(dict)) {
        try { data = inflateSync(data); }
        catch {
          try { data = inflateRawSync(data); }
          catch { streamRe.lastIndex = end; continue; }
        }
      }
      // Кап на распакованный размер — защита от zip-bomb
      if (data.length > 8_000_000) { streamRe.lastIndex = end; continue; }
      streams.push(data);
      streamRe.lastIndex = end;
    }
    if (streams.length === 0) return null;

    // 2) Объединённый ToUnicode CMap: CID (2 байта) → unicode-строка
    const cmap = new Map<number, string>();
    const hexToUni = (hex: string): string => {
      let s = "";
      for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
      return s;
    };
    for (const s of streams) {
      const t = s.toString("latin1");
      if (!t.includes("beginbfchar") && !t.includes("beginbfrange")) continue;
      let bm: RegExpExecArray | null;
      const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
      while ((bm = bfcharRe.exec(t)) !== null) {
        const pairRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
        let pm: RegExpExecArray | null;
        while ((pm = pairRe.exec(bm[1])) !== null && cmap.size < 65536) {
          cmap.set(parseInt(pm[1], 16), hexToUni(pm[2]));
        }
      }
      const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
      while ((bm = bfrangeRe.exec(t)) !== null) {
        const tripleRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
        let tm: RegExpExecArray | null;
        while ((tm = tripleRe.exec(bm[1])) !== null && cmap.size < 65536) {
          const lo = parseInt(tm[1], 16), hi = parseInt(tm[2], 16), base = parseInt(tm[3], 16);
          for (let c = lo; c <= hi && c - lo < 512; c++) {
            cmap.set(c, String.fromCharCode(base + (c - lo)));
          }
        }
      }
    }

    // 3) Контент-стримы: вытаскиваем строки из Tj / ' / TJ, переносы — по Td/TD/T*
    const chunks: string[] = [];
    // Литеральная строка ИЛИ hex-строка + оператор, TJ-массив, либо оператор перевода строки
    const tokRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(Tj|')|<([0-9a-fA-F\s]+)>\s*(Tj|')|\[((?:\((?:\\[\s\S]|[^\\()])*\)|<[0-9a-fA-F\s]*>|[^\][()<>])*)\]\s*TJ|(T\*|TD|Td)/g;
    const innerRe = /\(((?:\\[\s\S]|[^\\()])*)\)|<([0-9a-fA-F\s]*)>/g;
    for (const s of streams) {
      const t = s.toString("latin1");
      if (!/\bBT\b/.test(t) || !/T[Jj']/.test(t)) continue;
      let tm: RegExpExecArray | null;
      tokRe.lastIndex = 0;
      while ((tm = tokRe.exec(t)) !== null) {
        if (tm[1] !== undefined) chunks.push(decodePdfLiteral(tm[1]));
        else if (tm[3] !== undefined) chunks.push(decodePdfHex(tm[3], cmap));
        else if (tm[5] !== undefined) {
          let im: RegExpExecArray | null;
          innerRe.lastIndex = 0;
          let piece = "";
          while ((im = innerRe.exec(tm[5])) !== null) {
            piece += im[1] !== undefined ? decodePdfLiteral(im[1]) : decodePdfHex(im[2] ?? "", cmap);
          }
          chunks.push(piece);
        } else if (tm[6] !== undefined) chunks.push("\n");
      }
      chunks.push("\n\n");
    }

    const text = chunks
      .join("")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Quality gate: если букв мало — извлечение не удалось (скан / незнакомая
    // кодировка), лучше честная ошибка, чем мусор в промпте.
    const letters = (text.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
    if (letters < 40) return null;
    return text;
  } catch {
    return null;
  }
}
