import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  WorkflowEntity,
  TaskStatus,
  MatterStatus,
  MissionStatus,
  ProcedureStatus,
} from "@prisma/client";

export interface TransitionInput {
  confirmed?: boolean;
  justification?: string;
  attachmentId?: string;
  comment?: string;
  closureReason?: string;
}

export interface TransitionResult {
  success: boolean;
  entityType: WorkflowEntity;
  entityId: string;
  fromStepKey?: string;
  toStepKey: string;
  statusChangeId: string;
  notificationCount: number;
}

/**
 * Loads the active workflow definition for an entity.
 */
export async function getWorkflowForEntity(
  entityType: WorkflowEntity,
  categoryId?: string
) {
  // If matter category specifies custom workflow, use it
  if (entityType === "MATTER" && categoryId) {
    const category = await db.matterCategory.findUnique({
      where: { id: categoryId },
      include: {
        workflowDefinition: {
          include: {
            steps: { orderBy: { position: "asc" } },
            transitions: {
              include: {
                fromStep: true,
                toStep: true,
              },
            },
          },
        },
      },
    });

    if (category?.workflowDefinition) {
      return category.workflowDefinition;
    }
  }

  // Default active definition for the entity type
  const definition = await db.workflowDefinition.findFirst({
    where: {
      entity: entityType,
      isActive: true,
    },
    orderBy: { version: "desc" },
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

  if (!definition) {
    throw new Error(`Aucun workflow actif trouvé pour l'entité ${entityType}`);
  }

  return definition;
}

/**
 * Retrieves the available transitions for a given entity based on its current step,
 * indicating which transitions require confirmation, justification or validation.
 */
export async function getAvailableTransitions(
  entityType: WorkflowEntity,
  entityId: string,
  session: AppSession
) {
  const currentStep = await getCurrentStepForEntity(entityType, entityId);
  if (!currentStep) return [];

  const transitions = await db.workflowTransition.findMany({
    where: {
      fromStepId: currentStep.id,
    },
    include: {
      toStep: true,
    },
  });

  return transitions.map((t) => ({
    toStepKey: t.toStep.key,
    toStepNameFr: t.toStep.nameFr,
    toStepNameEn: t.toStep.nameEn,
    toStepColor: t.toStep.color,
    isFinal: t.toStep.isFinal,
    requiresConfirmation: t.requiresConfirmation,
    requiresJustification: t.requiresJustification,
    requiresValidation: t.requiresValidation,
    requiredPermissionKey: t.requiredPermissionKey,
  }));
}

/**
 * Helper to fetch the current WorkflowStep of an entity.
 */
async function getCurrentStepForEntity(
  entityType: WorkflowEntity,
  entityId: string
) {
  switch (entityType) {
    case "TASK": {
      const task = await db.task.findUnique({
        where: { id: entityId },
        include: { workflowStep: true },
      });
      return task?.workflowStep || null;
    }
    case "INQUIRY": {
      const inq = await db.inquiry.findUnique({
        where: { id: entityId },
        include: { workflowStep: true },
      });
      return inq?.workflowStep || null;
    }
    case "MATTER": {
      const matter = await db.matter.findUnique({
        where: { id: entityId },
        include: { workflowStep: true },
      });
      return matter?.workflowStep || null;
    }
    default: {
      // For entities without direct workflowStepId link, find initial step of workflow
      const wf = await getWorkflowForEntity(entityType);
      return wf.steps[0] || null;
    }
  }
}

/**
 * The single, mandatory function to execute any state transition across all entities.
 * (ARCHITECTURE.md Section 7, SPECIFICATIONS.md WF-01 to WF-05, BR-08, BR-09, BR-12)
 */
export async function transition(
  entityType: WorkflowEntity,
  entityId: string,
  toStepKey: string,
  input: TransitionInput = {},
  session: AppSession
): Promise<TransitionResult> {
  if (!session || !session.user) {
    throw new ForbiddenError("Authentification requise pour effectuer une transition.", {
      reason: "NO_SESSION",
    });
  }

  // 1. Load active workflow definition & current entity step
  const workflow = await getWorkflowForEntity(entityType);
  const currentStep = await getCurrentStepForEntity(entityType, entityId);

  const targetStep = workflow.steps.find((s) => s.key === toStepKey);
  if (!targetStep) {
    throw new ForbiddenError(
      `Étape cible inconnue "${toStepKey}" pour le workflow ${entityType}.`,
      { reason: "INVALID_TARGET_STEP" }
    );
  }

  // If already at target step, no-op
  if (currentStep?.id === targetStep.id) {
    throw new ForbiddenError("L'élément se trouve déjà à cette étape.", {
      reason: "ALREADY_AT_TARGET_STEP",
    });
  }

  // 2. Validate transition exists
  let allowedTransition = null;
  if (currentStep) {
    allowedTransition = await db.workflowTransition.findUnique({
      where: {
        fromStepId_toStepId: {
          fromStepId: currentStep.id,
          toStepId: targetStep.id,
        },
      },
    });
  } else {
    // If no initial step assigned yet, verify target is an initial step
    if (!targetStep.isInitial) {
      throw new ForbiddenError(
        `Impossible d'initialiser l'élément directement sur "${toStepKey}" (doit être une étape initiale).`,
        { reason: "NOT_INITIAL_STEP" }
      );
    }
  }

  if (currentStep && !allowedTransition) {
    throw new ForbiddenError(
      `Transition interdite de "${currentStep.nameFr}" vers "${targetStep.nameFr}".`,
      {
        reason: "TRANSITION_FORBIDDEN",
        entityType,
        entityId,
      }
    );
  }

  // 3. Security Checks & Permission Gates
  if (allowedTransition?.requiredPermissionKey) {
    await authorize(session, allowedTransition.requiredPermissionKey);
  }

  // 3.1 Confirmation Check
  if (allowedTransition?.requiresConfirmation && !input.confirmed) {
    throw new ForbiddenError(
      `Cette transition requiert une confirmation explicite de l'utilisateur.`,
      { reason: "CONFIRMATION_REQUIRED" }
    );
  }

  // 3.2 Justification Check
  if (
    allowedTransition?.requiresJustification &&
    (!input.justification || input.justification.trim().length < 5)
  ) {
    throw new ForbiddenError(
      `Un motif de justification (minimum 5 caractères) est obligatoire pour cette transition.`,
      { reason: "JUSTIFICATION_REQUIRED" }
    );
  }

  // 3.3 Entity-specific guardrails
  // Guard BR-09: Task validation requirement
  if (entityType === "TASK") {
    const task = await db.task.findUnique({
      where: { id: entityId },
      select: { requiresValidation: true, validatedById: true },
    });

    if (task?.requiresValidation && toStepKey === "DONE") {
      // Must hold task.validate
      await authorize(session, "task.validate");
    }
  }

  // 4. Atomic Database Transaction
  const result = await db.$transaction(async (tx) => {
    // 4.1 Update target entity status / step
    switch (entityType) {
      case "TASK": {
        const isFinal = targetStep.isFinal;
        const isDone = toStepKey === "DONE";
        const isCancelled = toStepKey === "CANCELLED";

        let mappedStatus: TaskStatus = "IN_PROGRESS";
        if (toStepKey === "TODO") mappedStatus = "TODO";
        else if (toStepKey === "WAITING") mappedStatus = "WAITING";
        else if (toStepKey === "TO_VALIDATE") mappedStatus = "TO_VALIDATE";
        else if (isDone) mappedStatus = "DONE";
        else if (isCancelled) mappedStatus = "CANCELLED";

        await tx.task.update({
          where: { id: entityId },
          data: {
            workflowStepId: targetStep.id,
            status: mappedStatus,
            completedAt: isFinal ? new Date() : null,
            cancelReason: isCancelled ? input.justification : null,
            validatedById:
              isDone && allowedTransition?.requiresValidation ? session.user.id : undefined,
            validatedAt:
              isDone && allowedTransition?.requiresValidation ? new Date() : undefined,
          },
        });
        break;
      }
      case "INQUIRY": {
        await tx.inquiry.update({
          where: { id: entityId },
          data: {
            workflowStepId: targetStep.id,
            convertedAt: toStepKey === "CONVERTED" ? new Date() : undefined,
            lostReason: toStepKey === "LOST" ? input.justification : undefined,
          },
        });
        break;
      }
      case "MATTER": {
        let matterStatus: MatterStatus = "OPEN";
        if (toStepKey === "WAITING") matterStatus = "ON_HOLD";
        else if (toStepKey === "CLOSED") matterStatus = "CLOSED";
        else if (toStepKey === "ARCHIVED") matterStatus = "ARCHIVED";

        await tx.matter.update({
          where: { id: entityId },
          data: {
            workflowStepId: targetStep.id,
            status: matterStatus,
            closedAt: toStepKey === "CLOSED" ? new Date() : undefined,
            closureReason: toStepKey === "CLOSED" ? input.justification : undefined,
            closureApprovedById:
              toStepKey === "CLOSED" ? session.user.id : undefined,
            closureApprovedAt:
              toStepKey === "CLOSED" ? new Date() : undefined,
            archivedAt: toStepKey === "ARCHIVED" ? new Date() : undefined,
          },
        });
        break;
      }
      case "MISSION": {
        let mStatus: MissionStatus = "ACTIVE";
        if (toStepKey === "SCOPING") mStatus = "PLANNED";
        else if (toStepKey === "CLOSED") mStatus = "DONE";
        await tx.mission.update({
          where: { id: entityId },
          data: { status: mStatus },
        });
        break;
      }
      case "PROCEDURE": {
        let pStatus: ProcedureStatus = "ONGOING";
        if (toStepKey === "TO_PREPARE" || toStepKey === "TO_CHECK") pStatus = "PREPARING";
        else if (toStepKey === "DECISION_RENDERED") pStatus = "DECIDED";
        else if (toStepKey === "APPEAL_ENFORCEMENT") pStatus = "APPEALED";
        else if (toStepKey === "FINISHED") pStatus = "CLOSED";

        await tx.procedure.update({
          where: { id: entityId },
          data: { status: pStatus },
        });
        break;
      }
      case "INVOICE": {
        await tx.invoice.update({
          where: { id: entityId },
          data: {
            workflowStepId: targetStep.id,
            issuedAt: toStepKey === "ISSUED" ? new Date() : undefined,
            cancelledAt: toStepKey === "CANCELLED" ? new Date() : undefined,
            cancelReason: toStepKey === "CANCELLED" ? input.justification : undefined,
            validatedById: toStepKey === "ISSUED" ? session.user.id : undefined,
            validatedAt: toStepKey === "ISSUED" ? new Date() : undefined,
          },
        });
        break;
      }
      case "CLIENT_REQUEST": {
        await tx.clientRequest.update({
          where: { id: entityId },
          data: {
            workflowStepId: targetStep.id,
          },
        });
        break;
      }
    }

    // 4.2 Append-only StatusChange entry
    const statusChange = await tx.statusChange.create({
      data: {
        entityType,
        entityId,
        fromStepKey: currentStep?.key,
        toStepKey: targetStep.key,
        comment: input.comment || input.justification,
        changedById: session.user.id,
      },
    });

    return { statusChange };
  });

  // 5. Audit Logging
  await logAudit({
    actorId: session.user.id,
    action: "workflow.transition",
    entityType,
    entityId,
    metadata: {
      fromStepKey: currentStep?.key,
      toStepKey: targetStep.key,
      statusChangeId: result.statusChange.id,
      justification: input.justification,
    },
  });

  return {
    success: true,
    entityType,
    entityId,
    fromStepKey: currentStep?.key,
    toStepKey: targetStep.key,
    statusChangeId: result.statusChange.id,
    notificationCount: 0,
  };
}

/**
 * Workflow Versioning (BR-12):
 * Editing or evolving a workflow creates a new WorkflowDefinition version,
 * while leaving past items and historical steps completely intact.
 */
export async function createWorkflowVersion(
  definitionId: string,
  newSteps: { key: string; nameFr: string; nameEn: string; color: string; position: number; isInitial?: boolean; isFinal?: boolean }[],
  newTransitions: { fromStepKey: string; toStepKey: string; permission?: string; requiresConfirmation?: boolean; requiresJustification?: boolean; requiresValidation?: boolean }[],
  session: AppSession
) {
  await authorize(session, "workflow.edit");

  const existing = await db.workflowDefinition.findUnique({
    where: { id: definitionId },
    include: { steps: true },
  });

  if (!existing) {
    throw new Error("Définition de workflow introuvable");
  }

  const nextVersion = existing.version + 1;

  const newDef = await db.$transaction(async (tx) => {
    // 1. Mark existing version as inactive
    await tx.workflowDefinition.update({
      where: { id: definitionId },
      data: { isActive: false },
    });

    // 2. Create new version
    const createdDef = await tx.workflowDefinition.create({
      data: {
        key: existing.key,
        version: nextVersion,
        isActive: true,
        entity: existing.entity,
        nameFr: existing.nameFr,
        nameEn: existing.nameEn,
      },
    });

    // 3. Create new steps
    const stepMap = new Map<string, string>();
    for (const s of newSteps) {
      const createdStep = await tx.workflowStep.create({
        data: {
          definitionId: createdDef.id,
          key: s.key,
          nameFr: s.nameFr,
          nameEn: s.nameEn,
          color: s.color,
          position: s.position,
          isInitial: s.isInitial ?? false,
          isFinal: s.isFinal ?? false,
        },
      });
      stepMap.set(s.key, createdStep.id);
    }

    // 4. Create new transitions
    for (const tr of newTransitions) {
      const fromStepId = stepMap.get(tr.fromStepKey);
      const toStepId = stepMap.get(tr.toStepKey);
      if (!fromStepId || !toStepId) continue;

      await tx.workflowTransition.create({
        data: {
          definitionId: createdDef.id,
          fromStepId,
          toStepId,
          requiredPermissionKey: tr.permission,
          requiresConfirmation: tr.requiresConfirmation ?? false,
          requiresJustification: tr.requiresJustification ?? false,
          requiresValidation: tr.requiresValidation ?? false,
        },
      });
    }

    return createdDef;
  });

  await logAudit({
    actorId: session.user.id,
    action: "workflow.version_created",
    entityType: "workflow",
    entityId: newDef.id,
    metadata: {
      key: existing.key,
      previousVersion: existing.version,
      newVersion: nextVersion,
    },
  });

  return newDef;
}
