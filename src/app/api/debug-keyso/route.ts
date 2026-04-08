import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") ?? "btg-spedition.ru";

  const token = process.env.KEYSO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No KEYSO_API_TOKEN" });

  const headers = {
    "X-Keyso-TOKEN": token,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  try {
    const url = `https://api.keys.so/report/simple/domain_dashboard?base=msk&domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { headers });
    const status = res.status;
    const text = await res.text();

    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    // Extract just the top-level keys and sample values
    const topKeys = parsed && typeof parsed === "object"
      ? Object.entries(parsed as Record<string, unknown>).slice(0, 40).reduce<Record<string, unknown>>((acc, [k, v]) => {
          acc[k] = Array.isArray(v) ? `[array, len=${(v as unknown[]).length}]` : v;
          return acc;
        }, {})
      : text.slice(0, 500);

    return NextResponse.json({ status, domain, topKeys, rawStart: text.slice(0, 300) });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
