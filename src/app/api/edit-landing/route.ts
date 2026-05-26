import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

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

    // Проверяем что projectId принадлежит вызывающему юзеру (или его workspace).
    // Если запись отсутствует — это либо старый лендинг до миграции (мы пускаем
    // только владельца session), либо чужой projectId (отказ).
    const session = await getSessionUser().catch(() => null);
    if (session?.userId) {
      const owned = await query<{ user_id: string }>(
        "SELECT user_id FROM landing_projects WHERE project_id = $1",
        [projectId],
      );
      if (owned.length > 0 && owned[0].user_id !== session.userId) {
        return NextResponse.json(
          { ok: false, error: "Этот лендинг принадлежит другому аккаунту" },
          { status: 403 },
        );
      }
    }

    const { StitchToolClient, Stitch } = await import("@google/stitch-sdk");
    const client = new StitchToolClient({ apiKey });
    const stitchInstance = new Stitch(client);

    const project = stitchInstance.project(projectId);
    const screen = await project.getScreen(screenId);

    // ── Action: edit ──────────────────────────────────────────
    if (action === "edit" && editPrompt) {
      const edited = await screen.edit(editPrompt, "DESKTOP");
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
        editPrompt || "Create alternative layout variants",
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
        editPrompt || "Optimize this design for mobile. Stack elements vertically, increase touch targets, make text larger.",
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
