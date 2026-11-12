import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  MissionType,
  MissionStatus,
  ProcedureKind,
  ProcedureStatus,
  Prisma,
} from "@prisma/client";

// =============================================================================
// MISSIONS SERVICE
// =============================================================================

export interface CreateMissionInput {
  matterId: string;
  type: MissionType;
  title: string;
  scope?: string;
  deliverables?: string;
  ownerId?: string;
  status?: MissionStatus;
}

export interface UpdateMissionInput {
  type?: MissionType;
  title?: string;
  scope?: string;
  deliverables?: string;
  ownerId?: string | null;
  status?: MissionStatus;
  workflowStepId?: string | null;
}

/**
 * Creates a mission within a matter.
 * Requires:
 * - Permission `mission.create`
 * - Matter access level `EDIT` or `MANAGE`
 */
export async function createMission(
  input: CreateMissionInput,
  session: AppSession
) {
  await authorize(session, "mission.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "general");

  // Retrieve initial workflow step for MISSION if not specified
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "MISSION",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const mission = await db.mission.create({
    data: {
      matterId: input.matterId,
      type: input.type,
      title: input.title.trim(),
      scope: input.scope?.trim() || null,
      deliverables: input.deliverables?.trim() || null,
      ownerId: input.ownerId || session.user.id,
      status: input.status || "PLANNED",
      workflowStepId: initialStep?.id || null,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflowStep: true,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "mission.create",
    entityType: "Mission",
    entityId: mission.id,
    matterId: input.matterId,
    metadata: {
      title: mission.title,
      type: mission.type,
    },
  });

  return mission;
}

/**
 * Retrieves a mission by ID, verifying matter access.
 */
export async function getMissionById(id: string, session: AppSession) {
  await authorize(session, "mission.view");

  const mission = await db.mission.findUnique({
    where: { id },
    include: {
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflowStep: true,
      procedures: {
        include: {
          workflowStep: true,
        },
      },
    },
  });

  if (!mission) {
    throw new ForbiddenError("Mission introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Mission",
      entityId: id,
    });
  }

  await assertMatterAccess(session, mission.matterId, "VIEW", "general");
  return mission;
}

/**
 * Lists missions for a given matter.
 */
export async function listMissionsForMatter(
  matterId: string,
  session: AppSession
) {
  await authorize(session, "mission.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return await db.mission.findMany({
    where: { matterId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflowStep: true,
      procedures: {
        select: {
          id: true,
          kind: true,
          reference: true,
          jurisdiction: true,
          status: true,
        },
      },
      _count: {
        select: {
          procedures: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Updates a mission.
 */
export async function updateMission(
  id: string,
  input: UpdateMissionInput,
  session: AppSession
) {
  await authorize(session, "mission.edit");

  const existing = await db.mission.findUnique({
    where: { id },
    select: { id: true, matterId: true },
  });

  if (!existing) {
    throw new ForbiddenError("Mission introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Mission",
      entityId: id,
    });
  }

  await assertMatterAccess(session, existing.matterId, "EDIT", "general");

  const updated = await db.mission.update({
    where: { id },
    data: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.scope !== undefined ? { scope: input.scope?.trim() || null } : {}),
      ...(input.deliverables !== undefined
        ? { deliverables: input.deliverables?.trim() || null }
        : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.workflowStepId !== undefined
        ? { workflowStepId: input.workflowStepId || null }
        : {}),
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflowStep: true,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "mission.edit",
    entityType: "Mission",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      changes: input,
    },
  });

  return updated;
}

// =============================================================================
// PROCEDURES SERVICE
// =============================================================================

export interface CreateProcedureInput {
  matterId: string;
  missionId?: string | null;
  kind: ProcedureKind;
  parentProcedureId?: string | null;
  jurisdiction?: string | null;
  reference?: string | null;
  status?: ProcedureStatus;
}

export interface UpdateProcedureInput {
  missionId?: string | null;
  kind?: ProcedureKind;
  parentProcedureId?: string | null;
  jurisdiction?: string | null;
  reference?: string | null;
  status?: ProcedureStatus;
  workflowStepId?: string | null;
}

/**
 * Creates a judicial/arbitral procedure inside a matter.
 * If kind is APPEAL or CASSATION, parentProcedureId links to the previous instance.
 */
export async function createProcedure(
  input: CreateProcedureInput,
  session: AppSession
) {
  await authorize(session, "procedure.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "general");

  // Validate parent procedure if given
  if (input.parentProcedureId) {
    const parent = await db.procedure.findUnique({
      where: { id: input.parentProcedureId },
      select: { id: true, matterId: true },
    });
    if (!parent || parent.matterId !== input.matterId) {
      throw new Error("La procédure parente doit appartenir au même dossier.");
    }
  }

  // Retrieve initial workflow step for PROCEDURE
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "PROCEDURE",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const procedure = await db.procedure.create({
    data: {
      matterId: input.matterId,
      missionId: input.missionId || null,
      kind: input.kind,
      parentProcedureId: input.parentProcedureId || null,
      jurisdiction: input.jurisdiction?.trim() || null,
      reference: input.reference?.trim() || null,
      status: input.status || "PREPARING",
      workflowStepId: initialStep?.id || null,
    },
    include: {
      workflowStep: true,
      parentProcedure: {
        select: {
          id: true,
          kind: true,
          reference: true,
          jurisdiction: true,
          status: true,
        },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "procedure.create",
    entityType: "Procedure",
    entityId: procedure.id,
    matterId: input.matterId,
    metadata: {
      kind: procedure.kind,
      jurisdiction: procedure.jurisdiction,
      parentProcedureId: procedure.parentProcedureId,
    },
  });

  return procedure;
}

/**
 * Retrieves a procedure by ID with parent and child links.
 */
export async function getProcedureById(id: string, session: AppSession) {
  await authorize(session, "procedure.view");

  const procedure = await db.procedure.findUnique({
    where: { id },
    include: {
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
        },
      },
      mission: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
      workflowStep: true,
      parentProcedure: {
        include: {
          workflowStep: true,
        },
      },
      childProcedures: {
        include: {
          workflowStep: true,
        },
      },
      events: {
        orderBy: { startsAt: "asc" },
      },
      tasks: {
        orderBy: { dueAt: "asc" },
      },
    },
  });

  if (!procedure) {
    throw new ForbiddenError("Procédure introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Procedure",
      entityId: id,
    });
  }

  await assertMatterAccess(session, procedure.matterId, "VIEW", "general");
  return procedure;
}

/**
 * Lists procedures for a matter, including parent hierarchy.
 */
export async function listProceduresForMatter(
  matterId: string,
  session: AppSession
) {
  await authorize(session, "procedure.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return await db.procedure.findMany({
    where: { matterId },
    include: {
      mission: {
        select: {
          id: true,
          title: true,
        },
      },
      workflowStep: true,
      parentProcedure: {
        select: {
          id: true,
          kind: true,
          reference: true,
          jurisdiction: true,
          status: true,
        },
      },
      childProcedures: {
        select: {
          id: true,
          kind: true,
          reference: true,
          jurisdiction: true,
          status: true,
        },
      },
      _count: {
        select: {
          events: true,
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Updates a procedure.
 */
export async function updateProcedure(
  id: string,
  input: UpdateProcedureInput,
  session: AppSession
) {
  await authorize(session, "procedure.edit");

  const existing = await db.procedure.findUnique({
    where: { id },
    select: { id: true, matterId: true },
  });

  if (!existing) {
    throw new ForbiddenError("Procédure introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Procedure",
      entityId: id,
    });
  }

  await assertMatterAccess(session, existing.matterId, "EDIT", "general");

  // Validate parent hierarchy if updating parentProcedureId
  if (input.parentProcedureId) {
    if (input.parentProcedureId === id) {
      throw new Error("Une procédure ne peut pas être son propre parent.");
    }
    const parent = await db.procedure.findUnique({
      where: { id: input.parentProcedureId },
      select: { id: true, matterId: true },
    });
    if (!parent || parent.matterId !== existing.matterId) {
      throw new Error("La procédure parente doit appartenir au même dossier.");
    }
  }

  const updated = await db.procedure.update({
    where: { id },
    data: {
      ...(input.missionId !== undefined ? { missionId: input.missionId || null } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.parentProcedureId !== undefined
        ? { parentProcedureId: input.parentProcedureId || null }
        : {}),
      ...(input.jurisdiction !== undefined
        ? { jurisdiction: input.jurisdiction?.trim() || null }
        : {}),
      ...(input.reference !== undefined
        ? { reference: input.reference?.trim() || null }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.workflowStepId !== undefined
        ? { workflowStepId: input.workflowStepId || null }
        : {}),
    },
    include: {
      workflowStep: true,
      parentProcedure: {
        select: {
          id: true,
          kind: true,
          reference: true,
          jurisdiction: true,
        },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "procedure.edit",
    entityType: "Procedure",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      changes: input,
    },
  });

  return updated;
}
