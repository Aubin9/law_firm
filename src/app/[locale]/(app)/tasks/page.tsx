import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { listAllTasks } from "@/server/services/task-service";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { TasksClient } from "./tasks-client";

export default async function TasksPage({
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

  const [rawTasks, users, matters] = await Promise.all([
    listAllTasks({}, session),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.matter.findMany({
      where: accessibleMatterFilter(session),
      select: { id: true, reference: true, title: true },
      orderBy: { reference: "asc" },
      take: 100,
    }),
  ]);

  const serializedTasks = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    estimatedMinutes: t.estimatedMinutes,
    matterId: t.matterId,
    matterReference: t.matter?.reference || null,
    matterTitle: t.matter?.title || null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name || null,
    checklistTotal: t.checklist.length,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));

  return (
    <TasksClient
      tasks={serializedTasks}
      users={users}
      matters={matters}
      locale={locale}
      currentUserId={session.user.id}
    />
  );
}

