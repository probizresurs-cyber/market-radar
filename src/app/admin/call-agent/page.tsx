import { redirect } from "next/navigation";

export default function CallAgentAdminRoot() {
  redirect("/admin/call-agent/users");
}
