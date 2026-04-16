import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "MarketRadar Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Login page is always accessible
  return (
    <html lang="ru">
      <head />
      <body style={{ margin: 0, background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}

// Guard used in individual pages (not layout to allow login page)
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/admin/login");
  }
  return user;
}
