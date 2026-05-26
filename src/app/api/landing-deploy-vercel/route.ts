/**
 * POST /api/landing-deploy-vercel
 *
 * Деплой лендинга на Vercel через REST API. Юзер передаёт свой Vercel
 * access token (получает из vercel.com/account/tokens) — мы создаём project
 * и пушим один index.html.
 *
 * НЕ храним токен на сервере — каждый деплой требует свежего токена.
 * Юзер может сохранить в LocalStorage для удобства (см. LandingGeneratorView).
 *
 * Body: { vercelToken, projectName, htmlUrl }
 * Returns: { ok, data: { deploymentUrl, projectId, deploymentId } }
 *
 * Docs: https://vercel.com/docs/rest-api
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchWithTimeout, NORMAL_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { checkSafeUrl } from "@/lib/url-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VercelDeployment {
  id: string;
  url: string; // hostname без https://
  alias?: string[];
}

interface VercelFileEntry {
  file: string;
  sha?: string;
  size?: number;
  data?: string;
}

interface DeploymentResponse extends VercelDeployment {
  error?: { message?: string };
}

function sanitizeProjectName(raw: string): string {
  // Vercel: 1-100 chars, lowercase letters, digits, hyphens; no leading/trailing hyphen.
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "landing";
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let body: { vercelToken?: string; projectName?: string; htmlUrl?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const token = (body.vercelToken ?? "").trim();
  const projectName = sanitizeProjectName(body.projectName ?? `mr-${Date.now()}`);
  const htmlUrl = (body.htmlUrl ?? "").trim();

  if (!token) return NextResponse.json({ ok: false, error: "Vercel access token required" }, { status: 400 });
  if (!htmlUrl) return NextResponse.json({ ok: false, error: "htmlUrl required" }, { status: 400 });

  // SSRF guard для htmlUrl
  const guard = await checkSafeUrl(htmlUrl, { allowedProtocols: ["https:"], resolveDns: true });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: `htmlUrl rejected: ${guard.reason}` }, { status: 400 });
  }

  // 1. Скачиваем HTML
  let html: string;
  try {
    const res = await fetchWithTimeout(htmlUrl, {}, NORMAL_TIMEOUT_MS);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Не удалось скачать HTML: ${res.status}` }, { status: 502 });
    }
    html = await res.text();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Fetch failed: ${e instanceof Error ? e.message : "error"}`,
    }, { status: 502 });
  }

  if (html.length > 2_000_000) {
    return NextResponse.json({ ok: false, error: "HTML слишком большой (> 2 MB)" }, { status: 413 });
  }

  // 2. Создаём deployment через Vercel REST API.
  // Используем v13 deployments endpoint — он принимает inline files без
  // отдельного PUT на каждый файл.
  const files: VercelFileEntry[] = [
    {
      file: "index.html",
      data: Buffer.from(html, "utf-8").toString("base64"),
    },
  ];

  let deploy: DeploymentResponse;
  try {
    const res = await fetchWithTimeout("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        files,
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    }, NORMAL_TIMEOUT_MS);
    deploy = await res.json() as DeploymentResponse;
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: deploy.error?.message ?? `Vercel API ${res.status}`,
      }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Vercel deploy failed: ${e instanceof Error ? e.message : "error"}`,
    }, { status: 502 });
  }

  const deploymentUrl = `https://${deploy.url}`;
  return NextResponse.json({
    ok: true,
    data: {
      deploymentUrl,
      deploymentId: deploy.id,
      projectName,
      // Юзер может в Vercel dashboard привязать свой домен — даём ссылку.
      dashboardUrl: `https://vercel.com/dashboard/projects/${encodeURIComponent(projectName)}`,
    },
  });
}
