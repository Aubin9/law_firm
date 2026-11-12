import React from "react";
import { getServerSession } from "@/server/auth/session";
import { listMatters } from "@/server/services/matter-service";
import { MattersClient } from "./matters-client";
import { db } from "@/server/db";
import { redirect } from "next/navigation";

export default async function MattersPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [mattersResult, categories, steps, lawyers] = await Promise.all([
    listMatters({ pageSize: 100 }, session),
    db.matterCategory.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, nameFr: true, nameEn: true },
    }),
    db.workflowStep.findMany({
      where: {
        definition: {
          entity: "MATTER",
          isActive: true,
        },
      },
      orderBy: { position: "asc" },
      select: { id: true, key: true, nameFr: true, nameEn: true, color: true },
    }),
    db.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          key: { in: ["PARTNER", "LEAD_LAWYER"] },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <MattersClient
      initialMatters={mattersResult.matters as any}
      categories={categories}
      steps={steps}
      lawyers={lawyers}
      currentUserId={session.user.id}
      currentUserRole={session.user.roleKey}
    />
  );
}

