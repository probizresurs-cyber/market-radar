/**
 * POST /api/heygen-create-digital-twin
 *
 * Прокси-режим: backend НЕ парсит multipart-тело, а стримит его как есть
 * в HeyGen `/v3/avatars`. Это обходит баг req.formData() в Next.js 16
 * который падает «Failed to parse body as FormData» на больших файлах
 * (видео 20+ МБ через FormData в Node.js undici).
 *
 * Фронт сам формирует правильный multipart с полями:
 *   file              — training video (обязательно)
 *   consent_file      — consent video (обязательно)
 *   name              — имя аватара
 *   type              — "digital_twin"
 *   (+ другие альтернативные имена которые HeyGen может ожидать)
 *
 * Body: multipart/form-data (любого размера)
 * Response: { ok, data: { heygenAvatarId, status } }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 240;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const ct = req.headers.get("content-type") ?? "";

    // Совместимость со старым кэшем браузера: если фронт всё ещё шлёт JSON
    // вместо multipart — даём понятную инструкцию.
    if (ct.includes("application/json")) {
      return NextResponse.json({
        ok: false,
        error: "Старая версия страницы в браузере (Content-Type: application/json вместо multipart/form-data). Сделайте Ctrl+Shift+R и попробуйте ещё раз.",
      }, { status: 400 });
    }

    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({
        ok: false,
        error: `Ожидался multipart/form-data, получено: ${ct || "(пусто)"}`,
      }, { status: 400 });
    }

    // ВАЖНО: НЕ вызываем req.formData()/req.text()/req.json() — они
    // ломаются на больших файлах в Next.js 16 undici. Вместо этого
    // передаём body как stream напрямую в HeyGen.
    const body = req.body;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Пустое тело запроса" }, { status: 400 });
    }

    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        // Передаём оригинальный Content-Type с boundary без изменений
        "Content-Type": ct,
      },
      body,
      // @ts-expect-error — `duplex: "half"` нужен node.js fetch для streamed body
      duplex: "half",
    });

    const avatarText = await avatarRes.text();

    if (!avatarRes.ok) {
      let humanMsg = avatarText.slice(0, 400);
      let errCode = "";
      let errParam = "";
      try {
        const errBody: { error?: { code?: string; message?: string; param?: string } } = JSON.parse(avatarText);
        if (errBody.error?.message) {
          humanMsg = errBody.error.message;
          errCode = errBody.error.code ?? "";
          errParam = errBody.error.param ?? "";
          if (errCode) humanMsg = `${errCode}: ${humanMsg}`;
          if (errParam) humanMsg += ` (поле: ${errParam})`;
        }
      } catch { /* keep raw */ }

      let hint = "";
      if (avatarRes.status === 401 || avatarRes.status === 403) {
        hint = " — создание Digital Twin доступно на платных тарифах HeyGen Pro+.";
      } else if (/consent/i.test(humanMsg)) {
        hint = " — HeyGen отклонил consent-видео. Спикер должен чётко произнести: «I, [name], consent to HeyGen using my likeness and voice to create an AI avatar».";
      } else if (/duration|too short|2 minutes|720/i.test(humanMsg)) {
        hint = " — тренировочное видео ≥ 2 минут, разрешение 720p+.";
      } else if (errParam) {
        hint = ` — HeyGen ожидает поле «${errParam}». Возможно изменилась их схема — пришлите этот лог разработчику.`;
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen ${avatarRes.status}: ${humanMsg}${hint}`, debug: avatarText.slice(0, 500) },
        { status: 500 },
      );
    }

    let avatarParsed: { data?: { avatar_id?: string; id?: string; status?: string } } = {};
    try { avatarParsed = JSON.parse(avatarText); } catch { /* ignore */ }
    const heygenAvatarId = avatarParsed?.data?.avatar_id ?? avatarParsed?.data?.id;
    if (!heygenAvatarId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул avatar_id: ${avatarText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId,
        name: "Мой видео-аватар",
        status: avatarParsed?.data?.status ?? "processing",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
