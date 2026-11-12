import { Metadata } from "next";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { listAccessGrants } from "@/server/services/access-grant-service";
import { db } from "@/server/db";
import { AccessGrantsClient } from "./access-grants-client";

export const metadata: Metadata = {
  title: "Accès Exceptionnels | Administration",
};

export default async function AccessGrantsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/auth/login");
  }

  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN") {
    redirect("/dashboard");
  }

  const [grants, matters] = await Promise.all([
    listAccessGrants(session, { status: "ALL" }),
    db.matter.findMany({
      where: { deletedAt: null },
      select: { id: true, reference: true, title: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AccessGrantsClient
      initialGrants={grants}
      matters={matters}
      currentUserRole={session.user.roleKey}
      currentUserId={session.user.id}
    />
  );
}

