import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
// Извлечение DOCX/HTML/PDF вынесено в общий lib — тот же код использует
// /api/presentation-extract-source (источники данных для презентаций).
import { htmlToText, extractDocxText, extractPdfText } from "@/lib/doc-extract";

export const runtime = "nodejs";
export const maxDuration = 60;

// Лимит base64 — 5MB декодированного = ~6.7MB закодированного. Выше —
// DoS-вектор: 50MB файл инфлейтится до 100MB в памяти.
const MAX_BASE64_LEN = 7_000_000;

export async function POST(req: Request) {
  // Раньше эндпоинт принимал любой base64 БЕЗ auth и БЕЗ size-check —
  // DoS-вектор через большие файлы + анонимный доступ.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({})) as {
      text?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
    };

    // Size guard: base64 строка не должна превышать ~7 MB (≈5 MB decoded).
    if (typeof body.fileBase64 === "string" && body.fileBase64.length > MAX_BASE64_LEN) {
      return NextResponse.json(
        { ok: false, error: `Файл слишком большой (${Math.round(body.fileBase64.length / 1024 / 1024)} MB > 5 MB)` },
        { status: 413 },
      );
    }
    if (typeof body.text === "string" && body.text.length > 5_000_000) {
      return NextResponse.json(
        { ok: false, error: "Текст слишком большой (> 5 MB)" },
        { status: 413 },
      );
    }

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
        const extracted = extractDocxText(buf);
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
        // Раньше PDF отклоняли — теперь есть наивный экстрактор в doc-extract.
        // Он не покрывает сканы без текстового слоя, поэтому при неудаче
        // по-прежнему советуем скопировать текст вручную.
        const extracted = extractPdfText(buf);
        if (!extracted) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Не удалось извлечь текст из PDF (возможно это скан). Скопируйте текст из PDF и вставьте его во вкладку «Вставить текст».",
            },
            { status: 400 },
          );
        }
        text = extracted;
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
