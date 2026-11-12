import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage({
  params,
}: {
  params: { locale: string } | Promise<{ locale: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const locale = (resolvedParams?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const session = await getServerSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const matterFilter = accessibleMatterFilter(session);
  const now = new Date();

  const [
    totalMatters,
    categoriesWithCount,
    totalParties,
    partiesByType,
    totalTasks,
    doneTasks,
    overdueTasks,
    upcomingHearings,
  ] = await Promise.all([
    db.matter.count({ where: matterFilter }),
    db.matterCategory.findMany({
      select: {
        id: true,
        nameFr: true,
        nameEn: true,
        _count: {
          select: { matters: { where: matterFilter } },
        },
      },
      orderBy: { nameFr: "asc" },
    }),
    db.party.count({ where: { deletedAt: null } }),
    db.party.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
    db.task.count(),
    db.task.count({ where: { status: "DONE" } }),
    db.task.count({
      where: {
        dueAt: { lt: now },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
    db.event.findMany({
      where: {
        startsAt: { gte: now },
        matter: matterFilter,
      },
      include: {
        matter: { select: { reference: true, title: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
  ]);

  const categoryDistribution = categoriesWithCount.map((c) => ({
    name: locale === "en" ? c.nameEn : c.nameFr,
    count: c._count.matters,
  }));

  const companyParties = partiesByType.find((p) => p.type === "COMPANY")?._count._all || 0;
  const individualParties = partiesByType.find((p) => p.type === "INDIVIDUAL")?._count._all || 0;

  const serializedHearings = upcomingHearings.map((h) => ({
    id: h.id,
    title: h.title,
    type: h.type,
    startsAt: h.startsAt.toISOString(),
    location: h.location,
    matterReference: h.matter?.reference || null,
    matterTitle: h.matter?.title || null,
  }));

  return (
    <ReportsClient
      totalMatters={totalMatters}
      categoryDistribution={categoryDistribution}
      totalParties={totalParties}
      companyParties={companyParties}
      individualParties={individualParties}
      totalTasks={totalTasks}
      doneTasks={doneTasks}
      overdueTasks={overdueTasks}
      upcomingHearings={serializedHearings}
      locale={locale}
      currentUserRole={session.user.roleKey}
    />
  );
}

