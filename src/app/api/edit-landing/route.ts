import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sanitizeUserPrompt } from "@/lib/prompt-sanitize";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  // Stitch edits тоже платные + раньше любой залогиненный мог
  // править чужой лендинг по утечке projectId (IDOR).
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GOOGLE_STITCH_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, screenId, editPrompt, action } = body;

    if (!projectId || !screenId) {
      return NextResponse.json({ ok: false, error: "projectId and screenId required" }, { status: 400 });
    }

    // КРИТИЧНО (P0): теперь требуем явную запись владельца. Раньше при
    // отсутствии record'а в landing_projects fallback пропускал edit —
    // это означало что legacy-projectId (созданный до migration или
    // напрямую через Stitch UI) могли редактировать ВСЕ залогиненные,
    // зная projectId. Если запись отсутствует → 404 «лендинг не найден»,
    // юзер должен регенерировать его через /api/generate-landing
    // (там сразу запишется ownership).
    const session = await getSessionUser().catch(() => null);
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }
    const owned = await query<{ user_id: string }>(
      "SELECT user_id FROM landing_projects WHERE project_id = $1",
      [projectId],
    );
    if (owned.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Лендинг не найден или создан до миграции. Сгенерируйте заново — он автоматически прикрепится к вашему аккаунту." },
        { status: 404 },
      );
    }
    if (owned[0].user_id !== session.userId) {
      return NextResponse.json(
        { ok: false, error: "Этот лендинг принадлежит другому аккаунту" },
        { status: 403 },
      );
    }
    // Sanitize editPrompt (prompt injection защита для Stitch / Gemini 3 Pro).
    const safeEditPrompt = editPrompt ? sanitizeUserPrompt(editPrompt, { maxLength: 800 }) : "";

    const { StitchToolClient, Stitch } = await import("@google/stitch-sdk");
    const client = new StitchToolClient({ apiKey });
    const stitchInstance = new Stitch(client);

    const project = stitchInstance.project(projectId);
    const screen = await project.getScreen(screenId);

    // ── Action: edit ──────────────────────────────────────────
    if (action === "edit" && safeEditPrompt) {
      const edited = await screen.edit(safeEditPrompt, "DESKTOP");
      const [htmlUrl, imageUrl] = await Promise.all([
        edited.getHtml(),
        edited.getImage(),
      ]);
      await client.close();
      await access.log({ endpoint: "edit-landing", model: "stitch-edit", success: true });
      return NextResponse.json({
        ok: true,
        screenId: edited.id,
        htmlUrl,
        imageUrl,
      });
    }

    // ── Action: variants ────────────────────────────────────
    if (action === "variants") {
      const variants = await screen.variants(
        safeEditPrompt || "Create alternative layout variants",
        { variantCount: 3, creativeRange: "EXPLORE", aspects: ["LAYOUT", "COLOR_SCHEME"] },
        "DESKTOP"
      );
      const results = await Promise.all(
        variants.map(async (v) => ({
          screenId: v.id,
          htmlUrl: await v.getHtml(),
          imageUrl: await v.getImage(),
        }))
      );
      await client.close();
      await access.log({ endpoint: "edit-landing", model: "stitch-variants", success: true });
      return NextResponse.json({ ok: true, variants: results });
    }

    // ── Action: mobile version ──────────────────────────────
    if (action === "mobile") {
      const mobile = await screen.edit(
        safeEditPrompt || "Optimize this design for mobile. Stack elements vertically, increase touch targets, make text larger.",
        "MOBILE"
      );
      const [htmlUrl, imageUrl] = await Promise.all([
        mobile.getHtml(),
        mobile.getImage(),
      ]);
      await client.close();
      await access.log({ endpoint: "edit-landing", model: "stitch-mobile", success: true });
      return NextResponse.json({
        ok: true,
        screenId: mobile.id,
        htmlUrl,
        imageUrl,
        device: "mobile",
      });
    }

    // ── Default: get current HTML/image ─────────────────────
    const [htmlUrl, imageUrl] = await Promise.all([
      screen.getHtml(),
      screen.getImage(),
    ]);
    await client.close();
    return NextResponse.json({ ok: true, htmlUrl, imageUrl });

  } catch (err: unknown) {
    console.error("edit-landing error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Stitch API error" },
      { status: 500 }
    );
  }
}
