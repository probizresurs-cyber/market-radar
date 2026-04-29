import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function keysoRaw(path: string, params: Record<string, string | number>, token: string) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `https://api.keys.so${path}?${qs}`;
  const res = await fetch(url, { headers: { "X-Keyso-TOKEN": token, Accept: "application/json" } });
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
  return { status: res.status, total, sample, rawStart: text.slice(0, 500) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") ?? "me-dent.ru";
  const base = searchParams.get("base") ?? "msk";
  const token = process.env.KEYSO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No KEYSO_API_TOKEN" });

  const p = { domain, base, page: 1, per_page: 3 };

  // Test 4 broken endpoints with both me-dent.ru AND a large domain (sber.ru) to distinguish path errors from missing data
  const bigDomain = "sber.ru";
  const pBig = { domain: bigDomain, base, page: 1, per_page: 3 };

  const [pages, lost, anchors, refDomains, popPages, topics,
    anchBig, refBig, popBig, topBig,
    // Also try alternative path variants
    anchAlt, refAlt, popAlt, topAlt,
  ] = await Promise.all([
    keysoRaw("/report/simple/organic/sitepages/withkeys", p, token),
    keysoRaw("/report/simple/organic/lost_keywords", p, token),
    // me-dent.ru with doc paths
    keysoRaw("/report/simple/links/anchors", p, token),
    keysoRaw("/report/simple/links/refdomains", p, token),
    keysoRaw("/report/simple/links/popular", p, token),
    keysoRaw("/report/simple/site_topics", { domain, base }, token),
    // sber.ru with same paths (to test if path is wrong or data missing)
    keysoRaw("/report/simple/links/anchors", pBig, token),
    keysoRaw("/report/simple/links/refdomains", pBig, token),
    keysoRaw("/report/simple/links/popular", pBig, token),
    keysoRaw("/report/simple/site_topics", { domain: bigDomain, base }, token),
    // Alt path variants
    keysoRaw("/report/simple/links/anchors_list", p, token),
    keysoRaw("/report/simple/links/referring_domains", p, token),
    keysoRaw("/report/simple/links/popular_pages", p, token),
    keysoRaw("/report/simple/domain_dashboard/topics", { domain, base }, token),
  ]);

  return NextResponse.json({
    domain,
    "sitepages/withkeys": pages,
    "lost_keywords": lost,
    "[me-dent] links/anchors": anchors,
    "[me-dent] links/refdomains": refDomains,
    "[me-dent] links/popular": popPages,
    "[me-dent] site_topics": topics,
    "[sber.ru] links/anchors": anchBig,
    "[sber.ru] links/refdomains": refBig,
    "[sber.ru] links/popular": popBig,
    "[sber.ru] site_topics": topBig,
    "[alt] links/anchors_list": anchAlt,
    "[alt] links/referring_domains": refAlt,
    "[alt] links/popular_pages": popAlt,
    "[alt] domain_dashboard/topics": topAlt,
  });
}
