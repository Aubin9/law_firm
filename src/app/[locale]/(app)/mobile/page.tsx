import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { listEvents } from "@/server/services/event-service";
import { listAllTasks } from "@/server/services/task-service";
import { listMatters } from "@/server/services/matter-service";
import { listNotifications } from "@/server/services/notification-service";
import { MobileCourtroomClient } from "./mobile-courtroom-client";

export default async function MobileCourtroomPage({
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

  // Today & 7-day window
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysLater = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch data in parallel
  const [events, allTasks, mattersResult, notifications] = await Promise.all([
    listEvents({ from: startOfToday, to: sevenDaysLater }, session).catch(() => []),
    listAllTasks({}, session).catch(() => []),
    listMatters({ page: 1, pageSize: 50 }, session).catch(() => ({ matters: [], total: 0 })),
    listNotifications(session).catch(() => []),
  ]);

  // Filter tasks to pending or overdue
  const pendingTasks = allTasks.filter(
    (t: any) => t.status === "PENDING" || t.status === "IN_PROGRESS"
  );

  return (
    <MobileCourtroomClient
      locale={locale}
      events={events as any}
      tasks={pendingTasks as any}
      matters={mattersResult.matters as any}
      notifications={notifications as any}
      userName={session.user.name}
    />
  );
}
