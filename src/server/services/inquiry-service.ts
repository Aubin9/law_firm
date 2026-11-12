import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { mandatoryConflictResolved } from "@/server/services/conflict-service";
import { createParty } from "@/server/services/party-service";
import { transition } from "@/server/workflow/workflow-engine";
import {
  InquiryChannel,
  DecisionOutcome,
  PartyType,
  ClientStatus,
  Priority,
  Prisma,
} from "@prisma/client";

export interface CreateInquiryInput {
  partyId?: string | null;
  // If partyId not supplied, create new prospect party
  newParty?: {
    type: PartyType;
    displayName?: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
  };
  channel: InquiryChannel;
  subject: string;
  description?: string | null;
  origin?: string | null;
  assignedToId?: string | null;
}

/**
 * Creates an inquiry, creates prospect party if needed, assigns owner,
 * and generates the first qualification task (INQ-01, INQ-02, INQ-03, BR-01).
 * Requires: inquiry.create
 */
export async function createInquiry(input: CreateInquiryInput, session: AppSession) {
  await authorize(session, "inquiry.create");

  let partyId = input.partyId;

  // 1. Create prospect party if not provided
  if (!partyId) {
    if (!input.newParty) {
      throw new Error("Une partie existante ou les coordonnées d'un nouveau prospect sont obligatoires.");
    }

    const party = await createParty(
      {
        type: input.newParty.type,
        clientStatus: "PROSPECT",
        displayName: input.newParty.displayName,
        firstName: input.newParty.firstName,
        lastName: input.newParty.lastName,
        companyName: input.newParty.companyName,
        email: input.newParty.email,
        phone: input.newParty.phone,
        city: input.newParty.city || "Douala",
        country: "CM",
      },
      session
    );
    partyId = party.id;
  } else {
    // If party exists and has status NONE, advance to PROSPECT
    const existing = await db.party.findUnique({ where: { id: partyId } });
    if (existing && existing.clientStatus === "NONE") {
      await db.party.update({
        where: { id: partyId },
        data: { clientStatus: "PROSPECT" },
      });
    }
  }

  // 2. Find initial workflow step for INQUIRY
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "INQUIRY",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const assignedToId = input.assignedToId || session.user.id;

  // 3. Create Inquiry
  const inquiry = await db.inquiry.create({
    data: {
      partyId,
      channel: input.channel,
      subject: input.subject.trim(),
      description: input.description?.trim() || null,
      origin: input.origin?.trim() || null,
      workflowStepId: initialStep?.id || null,
      assignedToId,
      createdById: session.user.id,
    },
    include: {
      party: true,
      workflowStep: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // 4. Auto-generate the first qualification task (INQ-03, BR-01)
  const dueTomorrow = new Date();
  dueTomorrow.setHours(dueTomorrow.getHours() + 24);

  await db.task.create({
    data: {
      title: `Qualification de la demande : ${inquiry.subject}`,
      description: `Prendre contact avec le prospect (${inquiry.party.displayName}) pour qualifier la nature du dossier, les délais et les enjeux juridiques.`,
      priority: Priority.HIGH,
      inquiryId: inquiry.id,
      assigneeId: assignedToId,
      createdById: session.user.id,
      dueAt: dueTomorrow,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "inquiry.create",
    entityType: "Inquiry",
    entityId: inquiry.id,
    metadata: {
      partyId: inquiry.partyId,
      channel: inquiry.channel,
      subject: inquiry.subject,
      assignedToId: inquiry.assignedToId,
    },
  });

  return inquiry;
}

export interface ListInquiriesParams {
  channel?: InquiryChannel;
  assignedToId?: string;
  workflowStepId?: string;
  partyId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Lists inquiries with pagination, filters, and workflow state.
 * Requires: inquiry.view
 */
export async function listInquiries(params: ListInquiriesParams, session: AppSession) {
  await authorize(session, "inquiry.view");

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.InquiryWhereInput = {
    ...(params.channel ? { channel: params.channel } : {}),
    ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    ...(params.workflowStepId ? { workflowStepId: params.workflowStepId } : {}),
    ...(params.partyId ? { partyId: params.partyId } : {}),
  };

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { subject: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { origin: { contains: term, mode: "insensitive" } },
      { party: { displayName: { contains: term, mode: "insensitive" } } },
      { party: { email: { contains: term, mode: "insensitive" } } },
      { party: { phone: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [total, inquiries] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { receivedAt: "desc" },
      include: {
        party: {
          select: {
            id: true,
            displayName: true,
            type: true,
            clientStatus: true,
            phone: true,
            email: true,
            city: true,
          },
        },
        workflowStep: {
          select: {
            id: true,
            key: true,
            nameFr: true,
            nameEn: true,
            color: true,
            position: true,
            isInitial: true,
            isFinal: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        decisions: {
          orderBy: { decidedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    }),
  ]);

  return {
    inquiries,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieves a single inquiry with timeline, decisions, tasks, and conflict status.
 * Requires: inquiry.view
 */
export async function getInquiryById(id: string, session: AppSession) {
  await authorize(session, "inquiry.view");

  const inquiry = await db.inquiry.findUnique({
    where: { id },
    include: {
      party: {
        include: {
          contacts: true,
        },
      },
      workflowStep: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
      decisions: {
        include: {
          decidedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { decidedAt: "desc" },
      },
      tasks: {
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!inquiry) return null;

  // Retrieve conflict clearance status
  const conflictStatus = await mandatoryConflictResolved({ inquiryId: id });

  return {
    ...inquiry,
    conflictStatus,
  };
}

export interface DecideInquiryInput {
  inquiryId: string;
  outcome: DecisionOutcome;
  reason: string;
}

/**
 * Formally decides on an inquiry: ACCEPTED or REFUSED (INQ-06, BR-04).
 * Requires: inquiry.decide (restricted to Partner and Lead Lawyer)
 */
export async function decideInquiry(input: DecideInquiryInput, session: AppSession) {
  await authorize(session, "inquiry.decide");

  if (!input.reason || !input.reason.trim()) {
    throw new Error("Le motif de la décision est obligatoire (INQ-06).");
  }

  const inquiry = await db.inquiry.findUnique({
    where: { id: input.inquiryId },
    include: { workflowStep: true, party: true },
  });

  if (!inquiry) {
    throw new Error("Demande introuvable.");
  }

  // Prevent deciding on already converted inquiries
  if (inquiry.convertedAt) {
    throw new Error("Cette demande a déjà été convertie en client. Impossible de modifier la décision.");
  }

  // If outcome is ACCEPTED, verify that conflict check has passed (BR-03, CON-04)
  if (input.outcome === "ACCEPTED") {
    const conflictCheck = await mandatoryConflictResolved({ inquiryId: inquiry.id });
    if (!conflictCheck.resolved) {
      throw new Error(
        `Acceptation bloquée par le contrôle des conflits d'intérêts : ${conflictCheck.reason}`
      );
    }
  }

  // Record AcceptanceDecision
  const decision = await db.acceptanceDecision.create({
    data: {
      inquiryId: inquiry.id,
      outcome: input.outcome,
      reason: input.reason.trim(),
      decidedById: session.user.id,
    },
    include: {
      decidedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // If refused, transition to LOST
  if (input.outcome === "REFUSED") {
    const lostStep = await db.workflowStep.findFirst({
      where: {
        definition: { entity: "INQUIRY", isActive: true },
        key: "LOST",
      },
    });

    await db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        lostReason: input.reason.trim(),
        workflowStepId: lostStep?.id || inquiry.workflowStepId,
      },
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: input.outcome === "ACCEPTED" ? "inquiry.accept" : "inquiry.refuse",
    entityType: "Inquiry",
    entityId: inquiry.id,
    metadata: {
      outcome: input.outcome,
      reason: input.reason,
    },
  });

  return decision;
}

/**
 * Converts a prospect into a full client and marks inquiry as CONVERTED (INQ-07, BR-04).
 * Keeps the same Party record, changes clientStatus to CLIENT, sets convertedAt,
 * and blocks re-entry.
 * Requires: inquiry.decide (Partner or Lead Lawyer)
 */
export async function convertInquiryToClient(inquiryId: string, session: AppSession) {
  await authorize(session, "inquiry.decide");

  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    include: { party: true, workflowStep: true },
  });

  if (!inquiry) {
    throw new Error("Demande introuvable.");
  }

  // 1. Guard against re-entry (INQ-07)
  if (inquiry.convertedAt) {
    throw new Error("Cette demande a déjà été convertie. Aucune ré-entrée possible.");
  }

  // 2. Guard: conflict of interest must be resolved (BR-03, CON-04)
  const conflictStatus = await mandatoryConflictResolved({ inquiryId });
  if (!conflictStatus.resolved) {
    throw new Error(
      `Conversion bloquée : ${conflictStatus.reason || "Contrôle de conflit d'intérêts non résolu."}`
    );
  }

  // 3. Find CONVERTED workflow step
  const convertedStep = await db.workflowStep.findFirst({
    where: {
      definition: { entity: "INQUIRY", isActive: true },
      key: "CONVERTED",
    },
  });

  const now = new Date();

  // 4. Update Party: change to CLIENT without creating duplicate
  await db.party.update({
    where: { id: inquiry.partyId },
    data: {
      clientStatus: "CLIENT",
      convertedAt: inquiry.party.convertedAt || now,
    },
  });

  // 5. Update Inquiry: set convertedAt and workflowStep
  const updatedInquiry = await db.inquiry.update({
    where: { id: inquiryId },
    data: {
      convertedAt: now,
      workflowStepId: convertedStep?.id || inquiry.workflowStepId,
    },
    include: {
      party: true,
      workflowStep: true,
    },
  });

  // 6. Record acceptance decision if not already recorded
  const existingAcceptance = await db.acceptanceDecision.findFirst({
    where: { inquiryId, outcome: "ACCEPTED" },
  });

  if (!existingAcceptance) {
    await db.acceptanceDecision.create({
      data: {
        inquiryId,
        outcome: "ACCEPTED",
        reason: "Converti en client avec ouverture de dossier autorisée.",
        decidedById: session.user.id,
      },
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: "inquiry.convert",
    entityType: "Inquiry",
    entityId: inquiry.id,
    metadata: {
      partyId: inquiry.partyId,
      convertedAt: now,
    },
  });

  return updatedInquiry;
}

