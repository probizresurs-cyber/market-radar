import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function keysoRaw(
  path: string,
  params: Record<string, string | number>,
  token: string,
  method: "GET" | "POST" = "GET",
) {
  let url: string;
  let init: RequestInit;
  if (method === "POST") {
    url = `https://api.keys.so${path}`;
    init = {
      method: "POST",
      headers: { "X-Keyso-TOKEN": token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(params),
    };
  } else {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    url = `https://api.keys.so${path}?${qs}`;
    init = { headers: { "X-Keyso-TOKEN": token, Accept: "application/json" } };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* */ }
  let sample: unknown = null;
  let total: number | string = 0;
  if (parsed && typeof parsed === "object" && "data" in (parsed as object)) {
    const d = (parsed as Record<string, unknown>).data;
    if (Array.isArray(d)) { total = d.length; sample = d[0] ?? null; }
    else { total = "not-array"; sample = d; }
  } else { total = "no-data-key"; }
  return { method, status: res.status, total, sample, rawStart: text.slice(0, 600) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") ?? "me-dent.ru";
  const base = searchParams.get("base") ?? "msk";
  const token = process.env.KEYSO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No KEYSO_API_TOKEN" });

  const p = { domain, base, page: 1, per_page: 3 };
  const pLinks = { domain, page: 1, per_page: 3 };

  const [pages, lost, anchors, refDomains, popPages, topics] = await Promise.all([
    keysoRaw("/report/simple/organic/sitepages/withkeys", p, token, "GET"),
    keysoRaw("/report/simple/organic/lost_keywords", p, token, "GET"),
    keysoRaw("/report/simple/anchors", pLinks, token, "POST"),
    keysoRaw("/report/simple/referring_domains", pLinks, token, "POST"),
    keysoRaw("/report/simple/popular_pages", pLinks, token, "POST"),
    keysoRaw("/report/simple/main_topics", { domain, base }, token, "POST"),
  ]);

  return NextResponse.json({
    domain,
    "sitepages/withkeys": pages,
    "lost_keywords": lost,
    "anchors": anchors,
    "referring_domains": refDomains,
    "popular_pages": popPages,
    "main_topics": topics,
  });
}
