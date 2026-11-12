import React from "react";
import { getServerSession } from "@/server/auth/session";
import { MatterCreateStepper } from "./matter-create-stepper";
import { db } from "@/server/db";
import { redirect } from "next/navigation";

export default async function NewMatterPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [categories, lawyers, clients] = await Promise.all([
    db.matterCategory.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, nameFr: true, nameEn: true },
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
    db.party.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        clientStatus: true,
        type: true,
      },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <MatterCreateStepper
      categories={categories}
      lawyers={lawyers}
      clients={clients}
      currentUserId={session.user.id}
    />
  );
}

