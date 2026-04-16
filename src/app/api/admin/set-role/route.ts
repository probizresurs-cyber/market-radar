import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// Called from native form (multipart/form-data or urlencoded) OR JSON
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    let userId: string, role: string;

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      userId = body.userId; role = body.role;
    } else {
      const fd = await req.formData();
      userId = fd.get("userId") as string;
      role = fd.get("role") as string;
    }

    if (!userId || !["admin", "user"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Invalid params" }, { status: 400 });
    }

    await query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);

    // Redirect back to user page
    return NextResponse.redirect(new URL(`/admin/user/${userId}`, req.url));
  } catch (e) {
    console.error("set-role error", e);
    return NextResponse.json({ ok: false, error: "Ошибка" }, { status: 500 });
  }
}
