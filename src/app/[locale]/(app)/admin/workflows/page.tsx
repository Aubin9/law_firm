import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { WorkflowEditorClient } from "./workflow-editor-client";

export default async function AdminWorkflowsPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  const canEdit = role === "PARTNER" || role === "FUNCTIONAL_ADMIN";

  const workflows = await db.workflowDefinition.findMany({
    where: { isActive: true },
    orderBy: { entity: "asc" },
    include: {
      steps: { orderBy: { position: "asc" } },
      transitions: {
        include: {
          fromStep: true,
          toStep: true,
        },
      },
    },
  });

  return (
    <WorkflowEditorClient
      workflows={workflows as any}
      locale={locale as any}
      canEdit={canEdit}
      userName={session.user.name}
      userRoleLabel={
        role === "PARTNER"
          ? (locale === "fr" ? "Avocat Associé" : "Partner")
          : (locale === "fr" ? "Administrateur fonctionnel" : "Functional Admin")
      }
    />
  );
}
