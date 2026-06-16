import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminParser() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: "1px solid #2d3748" }}>
        <Link href="/admin" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 12px" }}>← Портал</Link>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Парсер HH</div>
        <a href="/parser" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "#22c55e", fontSize: 13, textDecoration: "none" }}>Открыть в новой вкладке ↗</a>
      </div>
      <iframe src="/parser" style={{ flex: 1, width: "100%", border: "none", minHeight: "calc(100vh - 53px)" }} />
    </div>
  );
}
