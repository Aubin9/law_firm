import { Metadata } from "next";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { getSystemOverview } from "@/server/services/system-service";
import { getDriveSyncOverview } from "@/server/services/drive-sync-service";
import { SystemClient } from "./system-client";

export const metadata: Metadata = {
  title: "Supervision Système & Sauvegardes | Administration",
};

export default async function SystemPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/auth/login");
  }

  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    redirect("/dashboard");
  }

  const [overview, driveOverview] = await Promise.all([
    getSystemOverview(session),
    getDriveSyncOverview(session),
  ]);

  return (
    <SystemClient
      initialOverview={overview}
      initialDriveOverview={driveOverview}
      currentUserRole={session.user.roleKey}
      currentUserId={session.user.id}
    />
  );
}

