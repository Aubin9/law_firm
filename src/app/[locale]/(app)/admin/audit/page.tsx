import { Metadata } from "next";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { listAuditLogs } from "@/server/services/audit-service";
import { AuditClient } from "./audit-client";

export const metadata: Metadata = {
  title: "Journal d'audit | Administration",
};

export default async function AuditPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Only Partner or Technical Admin can access global audit
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN") {
    redirect("/dashboard");
  }

  const initialLogs = await listAuditLogs(session, { page: 1, pageSize: 25 });

  return (
    <AuditClient
      initialLogs={initialLogs}
      currentUserRole={session.user.roleKey}
      currentUserId={session.user.id}
    />
  );
}

