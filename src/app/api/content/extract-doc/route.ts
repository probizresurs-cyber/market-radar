import { NextResponse } from "next/server";
import { inflateRawSync } from "node:zlib";

export const runtime = "nodejs";
export const maxDuration = 60;

// Strip HTML/XML tags, decode basic entities, collapse whitespace
function htmlToText(html: string): string {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
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

// Minimal ZIP reader — finds and decompresses a single file from a DOCX.
// DOCX is a ZIP archive; paragraphs live in `word/document.xml`.
function extractFromDocx(buf: Buffer): string | null {
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

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      text?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
    };

    // 1) Direct paste — no processing needed
    if (typeof body.text === "string" && body.text.trim()) {
      const clean = body.text.trim();
      return NextResponse.json({
        ok: true,
        text: clean,
        wordCount: clean.split(/\s+/).filter(Boolean).length,
      });
    }

    // 2) File upload — decode + extract
    if (body.fileBase64) {
      const raw = body.fileBase64.includes(",")
        ? body.fileBase64.split(",")[1]
        : body.fileBase64;
      const buf = Buffer.from(raw, "base64");
      const name = (body.fileName ?? "").toLowerCase();
      const mime = (body.mimeType ?? "").toLowerCase();

      let text = "";

      if (name.endsWith(".docx") || mime.includes("wordprocessingml")) {
        const extracted = extractFromDocx(buf);
        if (!extracted) {
          return NextResponse.json(
            { ok: false, error: "Не удалось извлечь текст из .docx — попробуйте скопировать содержимое вручную" },
            { status: 400 },
          );
        }
        text = extracted;
      } else if (name.endsWith(".html") || name.endsWith(".htm") || mime.includes("html")) {
        text = htmlToText(buf.toString("utf8"));
      } else if (
        name.endsWith(".txt") ||
        name.endsWith(".md") ||
        name.endsWith(".markdown") ||
        name.endsWith(".csv") ||
        mime.startsWith("text/")
      ) {
        text = buf.toString("utf8").trim();
      } else if (name.endsWith(".pdf") || mime.includes("pdf")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "PDF пока не поддерживается. Скопируйте текст из PDF и вставьте его во вкладку «Вставить текст».",
          },
          { status: 400 },
        );
      } else {
        return NextResponse.json(
          { ok: false, error: `Неподдерживаемый формат: ${name || mime || "неизвестно"}` },
          { status: 400 },
        );
      }

      const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      return NextResponse.json({
        ok: true,
        text: cleaned,
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      });
    }

    return NextResponse.json({ ok: false, error: "Передайте text или fileBase64" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
