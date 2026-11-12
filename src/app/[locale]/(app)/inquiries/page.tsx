import React from "react";
import { getServerSession } from "@/server/auth/session";
import { listInquiries } from "@/server/services/inquiry-service";
import { InquiriesClient } from "./inquiries-client";
import { db } from "@/server/db";
import { redirect } from "next/navigation";

export default async function InquiriesPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Fetch inquiries, workflow steps, lawyers, and parties
  const [inquiriesResult, steps, lawyers, parties] = await Promise.all([
    listInquiries({ pageSize: 100 }, session),
    db.workflowStep.findMany({
      where: {
        definition: {
          entity: "INQUIRY",
          isActive: true,
        },
      },
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        nameFr: true,
        nameEn: true,
        color: true,
        position: true,
      },
    }),
    db.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          key: { in: ["PARTNER", "LEAD_LAWYER", "ASSOCIATE_LAWYER"] },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    db.party.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        clientStatus: true,
      },
      take: 50,
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <InquiriesClient
      initialInquiries={inquiriesResult.inquiries as any}
      steps={steps}
      lawyers={lawyers}
      parties={parties}
      currentUserRole={session.user.roleKey}
    />
  );
}
