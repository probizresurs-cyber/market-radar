/**
 * GET /l/[slug] — публичный рендер расшаренного лендинга.
 *
 * Тянет HTML из shared_landings и отдаёт как ПОЛНУЮ страницу
 * с Content-Type: text/html. Это Route Handler (не page.tsx),
 * потому что Next.js App Router не разрешает возвращать <html>
 * из вложенных страниц — только из root layout. А нам нужно
 * отдать лендинг как чистый HTML без обёртки платформы.
 *
 * Юзер делится `https://staging.marketradar24.ru/l/<slug>` —
 * клиент открывает и видит лендинг без боковой панели MarketRadar.
 */
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ShareRow {
  slug: string;
  title: string | null;
  html_content: string;
  expires_at: Date | null;
}

function notFoundPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Лендинг не найден</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0f;color:#e5e7eb;text-align:center;padding:20px}h1{font-size:48px;margin:0 0 8px}p{color:#9ca3af;margin:0 0 24px}a{color:#a78bfa;text-decoration:none}</style>
</head><body><div><h1>404</h1><p>Лендинг не найден или срок действия ссылки истёк.</p><a href="/">← MarketRadar</a></div></body></html>`;
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function gonePage(): Response {
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Срок ссылки истёк</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0f;color:#e5e7eb;text-align:center;padding:20px}h1{font-size:48px;margin:0 0 8px}p{color:#9ca3af;margin:0 0 24px}a{color:#a78bfa;text-decoration:none}</style>
</head><body><div><h1>410</h1><p>Срок действия этой ссылки истёк.</p><a href="/">← MarketRadar</a></div></body></html>`;
  return new Response(html, { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slug || !/^[a-f0-9]{6,64}$/i.test(slug)) {
    return notFoundPage();
  }

  let rows: ShareRow[];
  try {
    rows = await query<ShareRow>(
      "SELECT slug, title, html_content, expires_at FROM shared_landings WHERE slug = $1",
      [slug],
    );
  } catch (err) {
    console.error("[/l/[slug]] DB error:", err);
    return new Response("Server error", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (rows.length === 0) return notFoundPage();
  const r = rows[0];
  if (r.expires_at && new Date(r.expires_at) < new Date()) return gonePage();

  // Инкрементируем счётчик async (не блокируем рендер)
  void query("UPDATE shared_landings SET view_count = view_count + 1 WHERE slug = $1", [slug])
    .catch(e => console.warn("[/l/[slug]] view count update failed:", e));

  // Отдаём HTML напрямую. Лендинг — self-contained документ от
  // generate-landing, со встроенными стилями и (опционально) формами.
  return new Response(r.html_content, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Не индексируем юзерские лендинги в Google
      "X-Robots-Tag": "noindex, nofollow",
      // Кеш на 5 минут на CDN, потом ревалидация — даём редактировать
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
