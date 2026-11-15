import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";

export interface ClosureReadinessReport {
  isReady: boolean;
  blockingReasons: string[];
  warnings: string[];
  checklist: {
    tasksCompleted: boolean;
    pendingTasksCount: number;
    hearingsCleared: boolean;
    upcomingHearingsCount: number;
    documentsValidated: boolean;
    unvalidatedDocsCount: number;
    clientFundsReconciled: boolean;
    carpaBalance: number;
    invoicesSettled: boolean;
    unpaidInvoicesCount: number;
  };
}

/**
 * Validates matter closure checklist against Rule BR-14 (tasks, deadlines, documents, finances).
 */
export async function validateMatterClosureReadiness(
  matterId: string,
  session: AppSession
): Promise<ClosureReadinessReport> {
  await authorize(session, "matter.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  const now = new Date();

  const [matter, pendingTasks, upcomingEvents, documents, fundEntries, invoices] =
    await Promise.all([
      db.matter.findUnique({
        where: { id: matterId },
        include: { leadLawyer: true, category: true },
      }),
      db.task.findMany({
        where: {
          matterId,
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        select: { id: true, title: true, status: true },
      }),
      db.event.findMany({
        where: {
          matterId,
          startsAt: { gte: now },
          status: { notIn: ["POSTPONED"] },
        },
        select: { id: true, title: true, startsAt: true, type: true },
      }),
      db.document.findMany({
        where: {
          matterId,
          deletedAt: null,
        },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      }),
      db.clientFundEntry.findMany({
        where: { matterId },
        select: { type: true, amount: true },
      }),
      db.invoice.findMany({
        where: { matterId },
        include: { payments: true },
      }),
    ]);

  if (!matter || matter.deletedAt) {
    throw new ForbiddenError("Dossier introuvable.", {
      entityType: "Matter",
      entityId: matterId,
      reason: "NOT_FOUND",
    });
  }

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // 1. Tasks: All tasks must be completed or cancelled
  const pendingTasksCount = pendingTasks.length;
  const tasksCompleted = pendingTasksCount === 0;
  if (!tasksCompleted) {
    blockingReasons.push(
      `${pendingTasksCount} diligence(s)/tâche(s) restent en cours ou non finalisées.`
    );
  }

  // 2. Upcoming events: No active upcoming hearing/deadline
  const upcomingHearingsCount = upcomingEvents.length;
  const hearingsCleared = upcomingHearingsCount === 0;
  if (!hearingsCleared) {
    blockingReasons.push(
      `${upcomingHearingsCount} audience(s) ou échéance(s) procédurale(s) future(s) non échue(s).`
    );
  }

  // 3. Documents: Check unvalidated or quarantined versions
  let unvalidatedDocsCount = 0;
  for (const doc of documents) {
    const latest = doc.versions[0];
    if (latest && latest.scanStatus === "INFECTED") {
      blockingReasons.push(`Le document "${doc.title}" contient un fichier infecté en quarantaine.`);
    }
    if (latest && latest.status === "DRAFT") {
      unvalidatedDocsCount++;
    }
  }
  const documentsValidated = unvalidatedDocsCount === 0;
  if (unvalidatedDocsCount > 0) {
    warnings.push(`${unvalidatedDocsCount} document(s) sont encore à l'état de brouillon non validé.`);
  }

  // 4. CARPA Client funds: Net balance must be zero (no remaining unallocated funds)
  const carpaIn = fundEntries
    .filter((f) => f.type === "DEPOSIT")
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const carpaOut = fundEntries
    .filter((f) => f.type === "WITHDRAWAL" || f.type === "TRANSFER_TO_INVOICE")
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const carpaBalance = carpaIn - carpaOut;
  const clientFundsReconciled = Math.abs(carpaBalance) < 0.01;
  if (!clientFundsReconciled) {
    blockingReasons.push(
      `Solde de séquestre CARPA non nul (${carpaBalance.toLocaleString("fr-FR")} XAF). Une rétrocession ou affectation est requise avant clôture.`
    );
  }

  // 5. Invoices settled
  let unpaidInvoicesCount = 0;
  for (const inv of invoices) {
    const totalPaid = inv.payments
      .filter((p) => p.status === "VALIDATED")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (totalPaid < Number(inv.total)) {
      unpaidInvoicesCount++;
    }
  }
  const invoicesSettled = unpaidInvoicesCount === 0;
  if (unpaidInvoicesCount > 0) {
    warnings.push(`${unpaidInvoicesCount} facture(s) présentent un solde impayé.`);
  }

  const isReady = blockingReasons.length === 0;

  return {
    isReady,
    blockingReasons,
    warnings,
    checklist: {
      tasksCompleted,
      pendingTasksCount,
      hearingsCleared,
      upcomingHearingsCount,
      documentsValidated,
      unvalidatedDocsCount,
      clientFundsReconciled,
      carpaBalance,
      invoicesSettled,
      unpaidInvoicesCount,
    },
  };
}

/**
 * Requests matter closure with a required justification (BR-14).
 */
export async function requestMatterClosure(
  matterId: string,
  reason: string,
  session: AppSession
) {
  await authorize(session, "matter.request_closure");
  await assertMatterAccess(session, matterId, "EDIT", "general");

  if (!reason || !reason.trim()) {
    throw new Error("Un motif de clôture est obligatoire (BR-14).");
  }

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { id: true, status: true, reference: true },
  });

  if (!matter) {
    throw new ForbiddenError("Dossier introuvable.", {
      entityType: "Matter",
      entityId: matterId,
      reason: "NOT_FOUND",
    });
  }

  if (matter.status === "CLOSED" || matter.status === "ARCHIVED") {
    throw new Error("Ce dossier est déjà clôturé.");
  }

  const updated = await db.matter.update({
    where: { id: matterId },
    data: {
      closureReason: reason.trim(),
      closureRequestedById: session.user.id,
      closureRequestedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.closure.request",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: {
      reference: matter.reference,
      reason: reason.trim(),
    },
  });

  return updated;
}

/**
 * Formally validates and approves matter closure (BR-14: recorded approver, Partner required).
 */
export async function approveMatterClosure(
  matterId: string,
  archiveImmediately: boolean = false,
  session: AppSession
) {
  // BR-14: Recording closure approver requires Partner authorization
  await authorize(session, "matter.validate_closure");
  await assertMatterAccess(session, matterId, "EDIT", "general");

  const readiness = await validateMatterClosureReadiness(matterId, session);
  if (!readiness.isReady) {
    throw new Error(
      `Impossible de clôturer le dossier : ${readiness.blockingReasons.join(" ")}`
    );
  }

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: { workflowStep: true },
  });

  if (!matter) {
    throw new ForbiddenError("Dossier introuvable.", {
      entityType: "Matter",
      entityId: matterId,
      reason: "NOT_FOUND",
    });
  }

  // Find final workflow step for MATTER if available
  const finalStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "MATTER",
        isActive: true,
      },
      isFinal: true,
    },
  });

  const now = new Date();
  const nextStatus = archiveImmediately ? "ARCHIVED" : "CLOSED";

  const updated = await db.matter.update({
    where: { id: matterId },
    data: {
      status: nextStatus,
      closureApprovedById: session.user.id,
      closureApprovedAt: now,
      closedAt: now,
      archivedAt: archiveImmediately ? now : matter.archivedAt,
      workflowStepId: finalStep ? finalStep.id : matter.workflowStepId,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: archiveImmediately ? "matter.archive" : "matter.close",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: {
      reference: matter.reference,
      approvedBy: session.user.name,
      closedAt: now,
      archived: archiveImmediately,
    },
  });

  return updated;
}

/**
 * Re-opens a closed matter with a mandatory justification.
 */
export async function reopenMatter(
  matterId: string,
  justification: string,
  session: AppSession
) {
  await authorize(session, "matter.edit");
  await assertMatterAccess(session, matterId, "EDIT", "general");

  if (!justification || !justification.trim()) {
    throw new Error("Une justification est obligatoire pour réouvrir un dossier.");
  }

  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "MATTER",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const updated = await db.matter.update({
    where: { id: matterId },
    data: {
      status: "OPEN",
      closedAt: null,
      archivedAt: null,
      closureApprovedById: null,
      closureApprovedAt: null,
      closureRequestedById: null,
      closureRequestedAt: null,
      workflowStepId: initialStep ? initialStep.id : undefined,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.reopen",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: {
      justification: justification.trim(),
    },
  });

  return updated;
}
