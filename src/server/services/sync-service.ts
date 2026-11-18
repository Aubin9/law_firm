import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { logAudit } from "@/server/audit/audit-logger";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";

export interface OfflineMutation {
  id: string; // client UUID
  entityType: "TASK" | "NOTE" | "MATTER_STATUS";
  entityId?: string;
  matterId: string;
  clientVersion: number; // timestamp in ms of checkout
  action: "CREATE" | "UPDATE" | "COMPLETE";
  payload: Record<string, any>;
  forceOverwrite?: boolean;
}

export interface SyncResultItem {
  id: string;
  status: "MERGED" | "CONFLICT" | "ERROR";
  error?: string;
  serverData?: any;
  clientData?: any;
  newVersion?: number;
}

/**
 * Pull snapshot of authorized active matters, upcoming 14-day hearings, and user tasks (EXT-03)
 */
export async function pullOfflineSnapshot(session: AppSession) {
  await authorize(session, "matter.view");

  const userId = session.user.id;

  // 1. Assigned active matters only
  const assignedMatters = await db.matter.findMany({
    where: {
      status: "OPEN",
      OR: [
        { leadLawyerId: userId },
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      reference: true,
      title: true,
      confidentiality: true,
      updatedAt: true,
      parties: {
        select: {
          role: true,
          party: { select: { displayName: true } },
        },
      },
    },
    take: 50,
  });

  const matterIds = assignedMatters.map((m) => m.id);

  // 2. Upcoming hearings for next 14 days
  const now = new Date();
  const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const upcomingHearings = await db.event.findMany({
    where: {
      matterId: { in: matterIds },
      startsAt: { gte: now, lte: fourteenDaysLater },
    },
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      endsAt: true,
      location: true,
      matterId: true,
      updatedAt: true,
    },
    orderBy: { startsAt: "asc" },
  });

  // 3. Pending tasks assigned to user or in assigned matters
  const pendingTasks = await db.task.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS"] },
      OR: [
        { assigneeId: userId },
        { matterId: { in: matterIds } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      matterId: true,
      assigneeId: true,
      updatedAt: true,
    },
    orderBy: { dueAt: "asc" },
  });

  await logAudit({
    actorId: userId,
    action: "OFFLINE_SYNC_PULL",
    entityType: "OfflineVault",
    metadata: {
      assignedMattersCount: assignedMatters.length,
      upcomingHearingsCount: upcomingHearings.length,
      pendingTasksCount: pendingTasks.length,
    },
  });

  return {
    pulledAt: new Date().toISOString(),
    matters: assignedMatters.map((m) => ({
      ...m,
      syncVersion: m.updatedAt.getTime(),
    })),
    hearings: upcomingHearings.map((h) => ({
      ...h,
      syncVersion: h.updatedAt.getTime(),
    })),
    tasks: pendingTasks.map((t) => ({
      ...t,
      syncVersion: t.updatedAt.getTime(),
    })),
  };
}

/**
 * Replays offline mutations with optimistic concurrency control (EXT-03, 409 Conflict)
 */
export async function pushOfflineMutations(
  session: AppSession,
  mutations: OfflineMutation[]
): Promise<SyncResultItem[]> {
  const results: SyncResultItem[] = [];

  for (const mut of mutations) {
    try {
      // Security check: user must have access to matter
      await assertMatterAccess(session, mut.matterId, "EDIT", "general");

      if (mut.entityType === "NOTE" && mut.action === "CREATE") {
        const note = await db.note.create({
          data: {
            matterId: mut.matterId,
            eventId: mut.payload.eventId || null,
            authorId: session.user.id,
            body: mut.payload.body,
            shareable: false,
          },
        });

        results.push({
          id: mut.id,
          status: "MERGED",
          newVersion: note.updatedAt.getTime(),
        });
        continue;
      }

      if (mut.entityType === "TASK" && mut.entityId) {
        const currentTask = await db.task.findUnique({
          where: { id: mut.entityId },
        });

        if (!currentTask) {
          results.push({
            id: mut.id,
            status: "ERROR",
            error: "Tâche introuvable sur le serveur.",
          });
          continue;
        }

        const serverVersion = currentTask.updatedAt.getTime();

        // Concurrency Check: If server changed since client checkout and not forced
        if (serverVersion > mut.clientVersion && !mut.forceOverwrite) {
          results.push({
            id: mut.id,
            status: "CONFLICT",
            error: "Conflit détecté : la tâche a été modifiée sur le serveur depuis votre dernière synchronisation.",
            serverData: currentTask,
            clientData: mut.payload,
          });
          continue;
        }

        // Apply update
        const updatedTask = await db.task.update({
          where: { id: mut.entityId },
          data: {
            status: mut.payload.status || currentTask.status,
            title: mut.payload.title || currentTask.title,
            priority: mut.payload.priority || currentTask.priority,
            dueAt: mut.payload.dueAt ? new Date(mut.payload.dueAt) : currentTask.dueAt,
          },
        });

        await logAudit({
          actorId: session.user.id,
          action: mut.forceOverwrite ? "OFFLINE_SYNC_OVERWRITE" : "OFFLINE_SYNC_MUTATION",
          entityType: "Task",
          entityId: updatedTask.id,
          matterId: mut.matterId,
          metadata: {
            clientVersion: mut.clientVersion,
            serverVersion,
            forced: !!mut.forceOverwrite,
          },
        });

        results.push({
          id: mut.id,
          status: "MERGED",
          newVersion: updatedTask.updatedAt.getTime(),
        });
        continue;
      }

      results.push({
        id: mut.id,
        status: "ERROR",
        error: `Type d'entité non pris en charge en synchronisation hors-ligne : ${mut.entityType}`,
      });
    } catch (err: any) {
      results.push({
        id: mut.id,
        status: "ERROR",
        error: err.message || "Erreur interne lors de la synchronisation.",
      });
    }
  }

  return results;
}
