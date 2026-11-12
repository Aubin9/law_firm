"use server";

import { getServerSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { db } from "@/server/db";
import {
  listFormTemplates,
  getFormTemplateByKey,
  upsertFormTemplate,
  FormTemplateInput,
} from "@/server/services/form-template-service";
import {
  autocompleteParties,
  autocompleteMatters,
  autocompleteUsers,
} from "@/server/services/autocomplete-service";
import {
  getMatterTimeline,
  TimelineEntry,
} from "@/server/services/timeline-service";
import { createWorkflowVersion } from "@/server/workflow/workflow-engine";
import { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getFormTemplatesAction(entityType?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const templates = await listFormTemplates(session, entityType);
    return { success: true, templates };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFormTemplateByKeyAction(key: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const template = await getFormTemplateByKey(session, key);
    return { success: true, template };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function autocompletePartiesAction(query: string, limit: number = 10) {
  const session = await getServerSession();
  if (!session) return { success: false, items: [] };

  try {
    const items = await autocompleteParties(session, query, limit);
    return { success: true, items };
  } catch (error: any) {
    return { success: false, items: [], error: error.message };
  }
}

export async function autocompleteMattersAction(query: string, limit: number = 10) {
  const session = await getServerSession();
  if (!session) return { success: false, items: [] };

  try {
    const items = await autocompleteMatters(session, query, limit);
    return { success: true, items };
  } catch (error: any) {
    return { success: false, items: [], error: error.message };
  }
}

export async function autocompleteUsersAction(query: string, limit: number = 10) {
  const session = await getServerSession();
  if (!session) return { success: false, items: [] };

  try {
    const items = await autocompleteUsers(session, query, limit);
    return { success: true, items };
  } catch (error: any) {
    return { success: false, items: [], error: error.message };
  }
}

export async function getMatterTimelineAction(matterId: string, filter?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, entries: [], error: "Non authentifié" };

  try {
    const entries = await getMatterTimeline(session, matterId, filter);
    return { success: true, entries };
  } catch (error: any) {
    return { success: false, entries: [], error: error.message };
  }
}

const bulkTaskStatusSchema = z.object({
  taskIds: z.array(z.string()).min(1, "Sélectionnez au moins une tâche"),
  status: z.nativeEnum(TaskStatus),
});

export async function bulkUpdateTasksStatusAction(
  taskIds: string[],
  status: TaskStatus
) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  const parsed = bulkTaskStatusSchema.safeParse({ taskIds, status });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  await authorize(session, "task.edit");

  try {
    const updatedTasks = await db.task.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "task.bulk_status_update",
      entityType: "task",
      entityId: taskIds[0] || "multiple",
      metadata: { taskIds, newStatus: status, count: updatedTasks.count },
    });

    revalidatePath("/matters");
    return { success: true, count: updatedTasks.count };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de mise à jour groupée" };
  }
}

const bulkTaskAssignSchema = z.object({
  taskIds: z.array(z.string()).min(1, "Sélectionnez au moins une tâche"),
  assigneeId: z.string().nullable(),
});

export async function bulkAssignTasksAction(
  taskIds: string[],
  assigneeId: string | null
) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  const parsed = bulkTaskAssignSchema.safeParse({ taskIds, assigneeId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  await authorize(session, "task.edit");

  try {
    const updatedTasks = await db.task.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: {
        assigneeId,
        updatedAt: new Date(),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "task.bulk_assign",
      entityType: "task",
      entityId: taskIds[0] || "multiple",
      metadata: { taskIds, assigneeId, count: updatedTasks.count },
    });

    revalidatePath("/matters");
    return { success: true, count: updatedTasks.count };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur d'assignation groupée" };
  }
}

const createWorkflowVersionSchema = z.object({
  definitionId: z.string().min(1),
  steps: z.array(
    z.object({
      key: z.string().min(1),
      nameFr: z.string().min(1),
      nameEn: z.string().min(1),
      color: z.string().min(1),
      position: z.number().int(),
      isInitial: z.boolean().optional(),
      isFinal: z.boolean().optional(),
    })
  ),
  transitions: z.array(
    z.object({
      fromStepKey: z.string().min(1),
      toStepKey: z.string().min(1),
      permission: z.string().optional(),
      requiresConfirmation: z.boolean().optional(),
      requiresJustification: z.boolean().optional(),
      requiresValidation: z.boolean().optional(),
    })
  ),
});

export async function createWorkflowVersionAction(
  definitionId: string,
  steps: any[],
  transitions: any[]
) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  const parsed = createWorkflowVersionSchema.safeParse({
    definitionId,
    steps,
    transitions,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const newDef = await createWorkflowVersion(
      parsed.data.definitionId,
      parsed.data.steps,
      parsed.data.transitions,
      session
    );
    revalidatePath("/admin/workflows");
    return { success: true, definition: newDef };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de création de version de workflow" };
  }
}
