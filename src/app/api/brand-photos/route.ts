/**
 * Фотобанк бренда: реальные снимки компании для всех генераторов.
 *
 * POST   multipart { file } → { ok, data: { url } }
 * DELETE ?url=/api/static-asset/brand-photos/<uid>/<file> → { ok }
 *
 * Зачем файлы на сервере, а не data:-URL в брендбуке: десяток фото в base64
 * — это мегабайты в user_data и localStorage на каждый чих синка (у
 * mirror-sync есть потолок размера значения, брендбук перестал бы
 * синкаться вовсе). В брендбуке остаются только URL.
 *
 * Файлы лежат в public/brand-photos/<userId>/ и отдаются через
 * /api/static-asset (каталог добавлен в его whitelist). userId в пути —
 * это и изоляция пользователей, и защита от коллизий имён.
 *
 * Фото пережимаются до 1600px по длинной стороне (ffmpeg есть на сервере,
 * это уже проверено конвейером роликов): исходники с телефона по 8-12 МБ
 * не нужны ни лендингу, ни слайдам, а страницу они бы утопили.
 */
import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "Ожидается multipart/form-data" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Поле file обязательно" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Файл больше 15 МБ" }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ ok: false, error: `Только JPEG/PNG/WebP (пришло ${file.type || "неизвестно"})` }, { status: 415 });
  }

  const dir = path.join(process.cwd(), "public", "brand-photos", session.userId);
  await mkdir(dir, { recursive: true });

  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  const rawPath = path.join(dir, `raw-${name}`);
  const outPath = path.join(dir, name);
  await writeFile(rawPath, Buffer.from(await file.arrayBuffer()));

  try {
    // Даунскейл до 1600px по длинной стороне + JPEG q3 (~85%).
    // 'min(1600,iw)' — маленькие фото не растягиваем.
    await execFileAsync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", rawPath,
       "-vf", "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease",
       "-q:v", "3", outPath],
      { timeout: 30_000 },
    );
  } catch (e) {
    await unlink(rawPath).catch(() => {});
    return NextResponse.json(
      { ok: false, error: `Не удалось обработать изображение: ${e instanceof Error ? e.message : e}` },
      { status: 500 },
    );
  }
  await unlink(rawPath).catch(() => {});

  const size = (await stat(outPath)).size;
  return NextResponse.json({
    ok: true,
    data: { url: `/api/static-asset/brand-photos/${session.userId}/${name}`, sizeBytes: size },
  });
}

export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url") ?? "";
  // Удалять можно только СВОИ файлы: путь обязан лежать в каталоге userId
  // текущей сессии, имя — только наше сгенерированное (цифры-hex.jpg).
  const m = new RegExp(`^/api/static-asset/brand-photos/${session.userId}/(\\d+-[0-9a-f]{8}\\.jpg)$`).exec(url);
  if (!m) return NextResponse.json({ ok: false, error: "Некорректный url" }, { status: 400 });

  const filePath = path.join(process.cwd(), "public", "brand-photos", session.userId, m[1]);
  await unlink(filePath).catch(() => {});
  return NextResponse.json({ ok: true });
}
