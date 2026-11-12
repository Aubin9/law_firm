import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess, accessibleMatterFilter } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { Priority, TaskStatus, Prisma } from "@prisma/client";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  matterId?: string | null;
  procedureId?: string | null;
  documentId?: string | null;
  eventId?: string | null;
  inquiryId?: string | null;
  assigneeId?: string | null;
  startAt?: Date | null;
  dueAt?: Date | null;
  estimatedMinutes?: number | null;
  requiresValidation?: boolean;
  checklistLabels?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startAt?: Date | null;
  dueAt?: Date | null;
  estimatedMinutes?: number | null;
  requiresValidation?: boolean;
  cancelReason?: string | null;
}

/**
 * Creates a new task (TSK-01).
 * If attached to a matter, verifies matter access.
 */
export async function createTask(input: CreateTaskInput, session: AppSession) {
  await authorize(session, "task.create");

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "EDIT", "general");
  }

  // Retrieve initial workflow step for TASK
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "TASK",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const task = await db.task.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority || "NORMAL",
      matterId: input.matterId || null,
      procedureId: input.procedureId || null,
      documentId: input.documentId || null,
      eventId: input.eventId || null,
      inquiryId: input.inquiryId || null,
      assigneeId: input.assigneeId || null,
      createdById: session.user.id,
      startAt: input.startAt || null,
      dueAt: input.dueAt || null,
      estimatedMinutes: input.estimatedMinutes || null,
      requiresValidation: input.requiresValidation ?? false,
      status: "TODO",
      workflowStepId: initialStep?.id || null,
      checklist: input.checklistLabels?.length
        ? {
            create: input.checklistLabels.map((label, index) => ({
              label: label.trim(),
              done: false,
              position: index,
            })),
          }
        : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      workflowStep: true,
      checklist: { orderBy: { position: "asc" } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "task.create",
    entityType: "Task",
    entityId: task.id,
    matterId: input.matterId || undefined,
    metadata: {
      title: task.title,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueAt: task.dueAt,
    },
  });

  return task;
}

/**
 * Updates a task or transitions its status (TSK-02, BR-09).
 * If task requiresValidation: moving to DONE requires permission `task.validate`.
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  session: AppSession
) {
  const existing = await db.task.findUnique({
    where: { id },
    include: { matter: true },
  });

  if (!existing) {
    throw new ForbiddenError("Tâche introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Task",
      entityId: id,
    });
  }

  if (existing.matterId) {
    await assertMatterAccess(session, existing.matterId, "EDIT", "general");
  }

  // Permission check
  if (input.status === "DONE" && existing.requiresValidation) {
    // BR-09: Task validation gate
    await authorize(session, "task.validate");
  } else if (input.status === "CANCELLED") {
    await authorize(session, "task.cancel");
    if (!input.cancelReason?.trim()) {
      throw new Error("Un motif d'annulation est obligatoire (BR-09).");
    }
  } else {
    await authorize(session, "task.edit");
  }

  const isCompleting = input.status === "DONE" && existing.status !== "DONE";

  const updated = await db.task.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined
        ? { assigneeId: input.assigneeId || null }
        : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.estimatedMinutes !== undefined
        ? { estimatedMinutes: input.estimatedMinutes }
        : {}),
      ...(input.requiresValidation !== undefined
        ? { requiresValidation: input.requiresValidation }
        : {}),
      ...(input.cancelReason !== undefined
        ? { cancelReason: input.cancelReason }
        : {}),
      ...(isCompleting
        ? {
            completedAt: new Date(),
            validatedById: existing.requiresValidation ? session.user.id : null,
            validatedAt: existing.requiresValidation ? new Date() : null,
          }
        : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      workflowStep: true,
      checklist: { orderBy: { position: "asc" } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: isCompleting ? "task.complete" : "task.edit",
    entityType: "Task",
    entityId: id,
    matterId: existing.matterId || undefined,
    metadata: {
      status: updated.status,
      changes: input,
    },
  });

  return updated;
}

/**
 * Toggles a checklist item done status.
 */
export async function toggleChecklistItem(
  itemId: string,
  done: boolean,
  session: AppSession
) {
  await authorize(session, "task.edit");

  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    include: { task: true },
  });

  if (!item) {
    throw new ForbiddenError("Élément de checklist introuvable.", {
      reason: "NOT_FOUND",
      entityType: "TaskChecklistItem",
      entityId: itemId,
    });
  }

  if (item.task.matterId) {
    await assertMatterAccess(session, item.task.matterId, "EDIT", "general");
  }

  return await db.taskChecklistItem.update({
    where: { id: itemId },
    data: { done },
  });
}

/**
 * Retrieves a task by ID.
 */
export async function getTaskById(id: string, session: AppSession) {
  await authorize(session, "task.view");

  const task = await db.task.findUnique({
    where: { id },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      procedure: { select: { id: true, kind: true, jurisdiction: true } },
      document: { select: { id: true, title: true } },
      event: { select: { id: true, title: true, startsAt: true } },
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      checklist: { orderBy: { position: "asc" } },
      workflowStep: true,
    },
  });

  if (!task) {
    throw new ForbiddenError("Tâche introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Task",
      entityId: id,
    });
  }

  if (task.matterId) {
    await assertMatterAccess(session, task.matterId, "VIEW", "general");
  }

  return task;
}

/**
 * Lists tasks for a matter.
 */
export async function listTasksForMatter(matterId: string, session: AppSession) {
  await authorize(session, "task.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return await db.task.findMany({
    where: { matterId },
    include: {
      assignee: { select: { id: true, name: true } },
      checklist: { orderBy: { position: "asc" } },
      workflowStep: true,
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
}

/**
 * Lists all tasks accessible to the current user (TSK-01 / REC-22).
 */
export async function listAllTasks(
  options: {
    assigneeId?: string;
    status?: TaskStatus;
    matterId?: string;
    search?: string;
  } = {},
  session: AppSession
) {
  await authorize(session, "task.view");

  const matterFilter = accessibleMatterFilter(session);

  const where: Prisma.TaskWhereInput = {
    AND: [
      {
        OR: [
          { matterId: null },
          { matter: matterFilter },
        ],
      },
      options.assigneeId ? { assigneeId: options.assigneeId } : {},
      options.status ? { status: options.status } : {},
      options.matterId ? { matterId: options.matterId } : {},
      options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { description: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  return await db.task.findMany({
    where,
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      assignee: { select: { id: true, name: true, email: true } },
      workflowStep: true,
      checklist: { orderBy: { position: "asc" } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
}

