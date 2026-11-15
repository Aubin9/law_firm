import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";

export interface PlaceHoldInput {
  matterId?: string | null;
  documentId?: string | null;
  reason: string;
}

export interface RequestDestructionInput {
  matterId?: string | null;
  documentId?: string | null;
  reason: string;
}

/**
 * Checks whether a given matter or document is protected by an active legal destruction hold (BR-15).
 */
export async function isUnderDestructionHold(
  matterId?: string | null,
  documentId?: string | null
): Promise<{ underHold: boolean; activeHolds: Array<{ id: string; reason: string; placedAt: Date }> }> {
  if (!matterId && !documentId) {
    return { underHold: false, activeHolds: [] };
  }

  const activeHolds = await db.destructionHold.findMany({
    where: {
      releasedAt: null,
      OR: [
        matterId ? { matterId } : {},
        documentId ? { documentId } : {},
      ],
    },
    select: {
      id: true,
      reason: true,
      placedAt: true,
      matterId: true,
      documentId: true,
    },
  });

  return {
    underHold: activeHolds.length > 0,
    activeHolds,
  };
}

/**
 * Places a legal destruction hold (gel conservatoire) on a matter or document (BR-15).
 * While active, any deletion or destruction request is strictly blocked.
 */
export async function placeDestructionHold(
  input: PlaceHoldInput,
  session: AppSession
) {
  await authorize(session, "hold.place");

  if (!input.matterId && !input.documentId) {
    throw new Error("Un dossier ou un document cible est obligatoire pour poser un gel conservatoire.");
  }

  if (!input.reason || !input.reason.trim()) {
    throw new Error("Le motif juridique du gel conservatoire est obligatoire (BR-15).");
  }

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "EDIT", "general");
  }

  const hold = await db.destructionHold.create({
    data: {
      matterId: input.matterId || null,
      documentId: input.documentId || null,
      reason: input.reason.trim(),
      placedById: session.user.id,
      placedAt: new Date(),
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      document: { select: { id: true, title: true } },
      placedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "retention.hold.place",
    entityType: "DestructionHold",
    entityId: hold.id,
    matterId: input.matterId || undefined,
    metadata: {
      reason: input.reason.trim(),
      documentId: input.documentId,
      placedBy: session.user.name,
    },
  });

  return hold;
}

/**
 * Releases an active legal hold.
 */
export async function releaseDestructionHold(
  holdId: string,
  session: AppSession
) {
  await authorize(session, "hold.release");

  const hold = await db.destructionHold.findUnique({
    where: { id: holdId },
    include: { matter: true },
  });

  if (!hold) {
    throw new ForbiddenError("Gel conservatoire introuvable.", {
      entityType: "DestructionHold",
      entityId: holdId,
      reason: "NOT_FOUND",
    });
  }

  if (hold.releasedAt) {
    throw new Error("Ce gel conservatoire a déjà été levé.");
  }

  if (hold.matterId) {
    await assertMatterAccess(session, hold.matterId, "EDIT", "general");
  }

  const updated = await db.destructionHold.update({
    where: { id: holdId },
    data: {
      releasedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "retention.hold.release",
    entityType: "DestructionHold",
    entityId: hold.id,
    matterId: hold.matterId || undefined,
    metadata: {
      releasedBy: session.user.name,
    },
  });

  return updated;
}

/**
 * Creates a formal destruction request for archives reaching retention limit (BR-15).
 * Strictly blocked if an active DestructionHold protects the target.
 */
export async function requestDestruction(
  input: RequestDestructionInput,
  session: AppSession
) {
  await authorize(session, "destruction.request");

  if (!input.matterId && !input.documentId) {
    throw new Error("Un dossier ou un document doit être spécifié pour la demande de destruction.");
  }

  if (!input.reason || !input.reason.trim()) {
    throw new Error("Un motif réglementaire de destruction est obligatoire (BR-15).");
  }

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "EDIT", "general");
  }

  // Security gate BR-15: Check active destruction holds
  const { underHold, activeHolds } = await isUnderDestructionHold(
    input.matterId,
    input.documentId
  );

  if (underHold) {
    throw new Error(
      `Destruction impossible : un gel conservatoire (Destruction Hold) actif protège ces données (Motif : ${activeHolds[0]?.reason}) (BR-15).`
    );
  }

  const request = await db.destructionRequest.create({
    data: {
      matterId: input.matterId || null,
      documentId: input.documentId || null,
      reason: input.reason.trim(),
      status: "REQUESTED",
      requestedById: session.user.id,
      requestedAt: new Date(),
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      document: { select: { id: true, title: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "retention.destruction.request",
    entityType: "DestructionRequest",
    entityId: request.id,
    matterId: input.matterId || undefined,
    metadata: {
      reason: input.reason.trim(),
      documentId: input.documentId,
    },
  });

  return request;
}

/**
 * Decides a destruction request (APPROVED / REJECTED) - Partner authorization required (BR-15).
 */
export async function decideDestruction(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  session: AppSession
) {
  await authorize(session, "destruction.approve");

  const request = await db.destructionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new ForbiddenError("Demande de destruction introuvable.", {
      entityType: "DestructionRequest",
      entityId: requestId,
      reason: "NOT_FOUND",
    });
  }

  if (request.status !== "REQUESTED") {
    throw new Error(`Cette demande a déjà été traitée (Statut : ${request.status}).`);
  }

  // Re-verify holds at decision time (BR-15)
  if (decision === "APPROVED") {
    const { underHold, activeHolds } = await isUnderDestructionHold(
      request.matterId,
      request.documentId
    );

    if (underHold) {
      throw new Error(
        `Approbation impossible : un gel conservatoire actif a été posé entre-temps (Motif : ${activeHolds[0]?.reason}) (BR-15).`
      );
    }
  }

  const now = new Date();

  const updated = await db.destructionRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      approvedById: session.user.id,
      decidedAt: now,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: decision === "APPROVED" ? "retention.destruction.approve" : "retention.destruction.reject",
    entityType: "DestructionRequest",
    entityId: requestId,
    matterId: request.matterId || undefined,
    metadata: {
      decidedBy: session.user.name,
      status: decision,
    },
  });

  return updated;
}

/**
 * Executes an approved destruction request with audit trail (BR-15).
 */
export async function executeDestruction(
  requestId: string,
  session: AppSession
) {
  await authorize(session, "destruction.approve");

  const request = await db.destructionRequest.findUnique({
    where: { id: requestId },
    include: { matter: true, document: true },
  });

  if (!request) {
    throw new ForbiddenError("Demande de destruction introuvable.", {
      entityType: "DestructionRequest",
      entityId: requestId,
      reason: "NOT_FOUND",
    });
  }

  if (request.status !== "APPROVED") {
    throw new Error("Seule une demande approuvée par un associé peut être exécutée.");
  }

  // Re-verify holds at execution time (BR-15)
  const { underHold, activeHolds } = await isUnderDestructionHold(
    request.matterId,
    request.documentId
  );

  if (underHold) {
    throw new Error(
      `Exécution bloquée : un gel conservatoire actif a été identifié (Motif : ${activeHolds[0]?.reason}) (BR-15).`
    );
  }

  const now = new Date();

  // Perform destruction (soft delete with purged references according to privacy rules)
  if (request.documentId) {
    await db.document.update({
      where: { id: request.documentId },
      data: { deletedAt: now },
    });
  } else if (request.matterId) {
    await db.matter.update({
      where: { id: request.matterId },
      data: { deletedAt: now, status: "ARCHIVED" },
    });
  }

  const updated = await db.destructionRequest.update({
    where: { id: requestId },
    data: {
      status: "EXECUTED",
      executedAt: now,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "retention.destruction.execute",
    entityType: "DestructionRequest",
    entityId: requestId,
    matterId: request.matterId || undefined,
    metadata: {
      executedBy: session.user.name,
      documentId: request.documentId,
      executedAt: now,
    },
  });

  return updated;
}

/**
 * Lists legal holds for a matter or across the firm.
 */
export async function listDestructionHolds(
  matterId?: string,
  session?: AppSession
) {
  if (session) {
    await authorize(session, "matter.view");
    if (matterId) {
      await assertMatterAccess(session, matterId, "VIEW", "general");
    }
  }

  return await db.destructionHold.findMany({
    where: matterId ? { matterId } : {},
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      document: { select: { id: true, title: true } },
      placedBy: { select: { id: true, name: true } },
    },
    orderBy: { placedAt: "desc" },
  });
}

