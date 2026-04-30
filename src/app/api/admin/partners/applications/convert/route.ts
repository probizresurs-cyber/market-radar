/**
 * POST /api/admin/partners/applications/convert
 * Admin action: converts a partner_application into a real user account + partner record.
 * Returns temporary credentials the admin can relay to the new partner.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail, partnerWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// Commission rate for new partners
function initialRate(type: string): number {
  return type === "integrator" ? 25 : 20;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();

  const { application_id } = await req.json() as { application_id: string };
  if (!application_id) {
    return NextResponse.json({ ok: false, error: "application_id required" }, { status: 400 });
  }

  // Fetch the application
  const appRows = await query<{
    id: string; name: string; email: string; phone: string | null;
    company_name: string | null; website: string | null;
    type: string; description: string | null;
    client_price_amount: number | null; status: string;
  }>("SELECT * FROM partner_applications WHERE id = $1", [application_id]);

  if (appRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Заявка не найдена" }, { status: 404 });
  }

  const app = appRows[0];

  if (app.status === "converted") {
    return NextResponse.json({ ok: false, error: "Заявка уже конвертирована" }, { status: 400 });
  }

  // Check if user with this email already exists
  const existingUsers = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [app.email.toLowerCase()]);

  let userId: string;
  let tempPassword: string | null = null;

  if (existingUsers.length > 0) {
    // User already exists — just create the partner record
    userId = existingUsers[0].id;
  } else {
    // Create new user with a temp password
    tempPassword = randomBytes(4).toString("hex"); // e.g. "a3f2b1c9"
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    userId = randomBytes(8).toString("hex");

    await query(
      `INSERT INTO users
         (id, email, password_hash, name, role, plan, plan_started_at, plan_expires_at,
          company_name, phone, website, consent_accepted_at)
       VALUES ($1,$2,$3,$4,'user','trial',NOW(),NOW() + INTERVAL '30 days',$5,$6,$7,NOW())`,
      [
        userId,
        app.email.toLowerCase(),
        passwordHash,
        app.name,
        app.company_name || null,
        app.phone || null,
        app.website || null,
      ]
    );
  }

  // Check if partner record already exists for this user
  const existingPartner = await query<{ id: string }>(
    "SELECT id FROM partners WHERE user_id = $1",
    [userId]
  );

  let partnerId: string;

  if (existingPartner.length > 0) {
    // Already has a partner record — just activate it
    partnerId = existingPartner[0].id;
    await query(
      "UPDATE partners SET status = 'active', type = $2 WHERE id = $1",
      [partnerId, app.type]
    );
  } else {
    // Create partner record
    partnerId = randomBytes(8).toString("hex");
    const referralCode = randomBytes(4).toString("hex").toUpperCase();

    await query(
      `INSERT INTO partners
         (id, user_id, type, status, referral_code, commission_rate,
          company_name, website, description, client_price_amount)
       VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9)`,
      [
        partnerId,
        userId,
        app.type,
        referralCode,
        initialRate(app.type),
        app.company_name || null,
        app.website || null,
        app.description || null,
        app.client_price_amount ?? null,
      ]
    );
  }

  // Mark application as converted
  await query(
    "UPDATE partner_applications SET status = 'converted' WHERE id = $1",
    [application_id]
  );

  // Send welcome email (non-blocking — don't fail if email fails)
  const isExistingUser = existingUsers.length > 0;
  const { subject, html } = partnerWelcomeEmail({
    name: app.name,
    type: app.type as "referral" | "integrator",
    email: app.email,
    tempPassword,
    isExistingUser,
  });
  const emailSent = await sendEmail({ to: app.email, subject, html });

  return NextResponse.json({
    ok: true,
    email: app.email,
    tempPassword,
    isExistingUser,
    partnerId,
    type: app.type,
    loginUrl: app.type === "integrator" ? "/integrator" : "/partner",
    emailSent,
  });
}
