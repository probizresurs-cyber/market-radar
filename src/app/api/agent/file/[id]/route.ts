/**
 * GET /api/agent/file/[id]?path=presentation.pptx
 * Serves a file produced by an agent job. Path is relative to the job's cwd.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJob } from "@/lib/agent-runner";
import { readFileSync, existsSync } from "fs";
import { join, normalize } from "path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  html: "text/html",
  md: "text/markdown",
  txt: "text/plain",
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Job не найден" }, { status: 404 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("path") || "presentation.pptx";

  // Block directory traversal — final resolved path must stay inside cwd
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const full = join(job.cwd, safe);
  if (!full.startsWith(job.cwd)) {
    return NextResponse.json({ ok: false, error: "bad path" }, { status: 400 });
  }
  if (!existsSync(full)) {
    return NextResponse.json({ ok: false, error: "Файл не найден" }, { status: 404 });
  }

  const ext = (safe.split(".").pop() || "").toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const buf = readFileSync(full);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${safe.split("/").pop()}"`,
      "Content-Length": String(buf.length),
    },
  });
}
