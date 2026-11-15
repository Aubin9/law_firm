import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";

export interface LawyerWorkloadStats {
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  activeLeadMatters: number;
  activeMemberMatters: number;
  pendingTasks: number;
  overdueTasks: number;
  upcomingHearings: number;
  capacityLevel: "LOW" | "NORMAL" | "HIGH" | "OVERLOADED";
  score: number;
}

/**
 * Computes workload and operational capacity across legal staff (LEG-10 / MOD-16).
 */
export async function getLawyerWorkloadOverview(session: AppSession): Promise<LawyerWorkloadStats[]> {
  await authorize(session, "dashboard.view");

  const now = new Date();
  const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const lawyers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      role: {
        key: {
          in: ["PARTNER", "LEAD_LAWYER", "ASSOCIATE_LAWYER", "LEGAL_ASSISTANT"],
        },
      },
    },
    include: {
      role: true,
      leadMatters: {
        where: {
          deletedAt: null,
          status: { in: ["OPEN", "ON_HOLD"] },
        },
        select: { id: true },
      },
      matterAccess: {
        where: {
          matter: {
            deletedAt: null,
            status: { in: ["OPEN", "ON_HOLD"] },
          },
        },
        select: { matterId: true },
      },
      assignedTasks: {
        where: {
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        select: { id: true, dueAt: true },
      },
      eventAttendance: {
        where: {
          event: {
            startsAt: { gte: now, lte: next14Days },
            status: { notIn: ["POSTPONED"] },
          },
        },
        select: { eventId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return lawyers.map((lawyer) => {
    const activeLeadMatters = lawyer.leadMatters.length;
    const activeMemberMatters = lawyer.matterAccess.length;
    const pendingTasks = lawyer.assignedTasks.length;
    const overdueTasks = lawyer.assignedTasks.filter(
      (t) => t.dueAt && new Date(t.dueAt) < now
    ).length;
    const upcomingHearings = lawyer.eventAttendance.length;

    // Weighted operational load score
    const score =
      activeLeadMatters * 3 +
      activeMemberMatters * 1.5 +
      pendingTasks * 1 +
      overdueTasks * 2 +
      upcomingHearings * 2;

    let capacityLevel: "LOW" | "NORMAL" | "HIGH" | "OVERLOADED" = "NORMAL";
    if (score < 5) capacityLevel = "LOW";
    else if (score <= 15) capacityLevel = "NORMAL";
    else if (score <= 25) capacityLevel = "HIGH";
    else capacityLevel = "OVERLOADED";

    return {
      userId: lawyer.id,
      name: lawyer.name,
      email: lawyer.email,
      roleKey: lawyer.role.key,
      activeLeadMatters,
      activeMemberMatters,
      pendingTasks,
      overdueTasks,
      upcomingHearings,
      capacityLevel,
      score,
    };
  });
}
