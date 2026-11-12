import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  assertMatterAccess,
  accessibleMatterFilter,
  partnerSelfJoinStrictMatter,
} from "@/server/auth/matter-access";
import { mandatoryConflictResolved } from "@/server/services/conflict-service";
import {
  Confidentiality,
  Priority,
  MatterAccessLevel,
  MatterPartyRole,
  Prisma,
} from "@prisma/client";

/**
 * Generates the next sequential unique matter reference in a thread-safe
 * transaction according to firm scheme (MAT-YYYY-XXXX).
 */
export async function generateNextMatterReference(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || db;
  const currentYear = new Date().getFullYear();
  const counterKey = `MATTER-${currentYear}`;

  const counter = await client.referenceCounter.upsert({
    where: { key: counterKey },
    update: { value: { increment: 1 } },
    create: { key: counterKey, value: 1 },
  });

  return `MAT-${currentYear}-${String(counter.value).padStart(4, "0")}`;
}

export interface ListMattersParams {
  search?: string;
  categoryId?: string;
  workflowStepId?: string;
  leadLawyerId?: string;
  priority?: Priority;
  confidentiality?: Confidentiality;
  onlyMine?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Lists matters strictly filtered through accessibleMatterFilter at the database layer (MAT-01, MAT-02).
 * Hidden matters never leave the database.
 * Requires: matter.view
 */
export async function listMatters(params: ListMattersParams, session: AppSession) {
  await authorize(session, "matter.view");

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
  const skip = (page - 1) * pageSize;

  // Base security filter from matter-access.ts
  const securityFilter = accessibleMatterFilter(session);

  const where: Prisma.MatterWhereInput = {
    ...securityFilter,
    deletedAt: null, // Soft delete only (MAT-07)
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.workflowStepId ? { workflowStepId: params.workflowStepId } : {}),
    ...(params.leadLawyerId ? { leadLawyerId: params.leadLawyerId } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.confidentiality ? { confidentiality: params.confidentiality } : {}),
    ...(params.onlyMine
      ? {
          OR: [
            { leadLawyerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        }
      : {}),
  };

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.AND = [
      {
        OR: [
          { reference: { contains: term, mode: "insensitive" } },
          { title: { contains: term, mode: "insensitive" } },
          {
            parties: {
              some: {
                party: {
                  displayName: { contains: term, mode: "insensitive" },
                },
              },
            },
          },
        ],
      },
    ];
  }

  const [total, matters] = await Promise.all([
    db.matter.count({ where }),
    db.matter.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: {
            id: true,
            key: true,
            nameFr: true,
            nameEn: true,
          },
        },
        leadLawyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workflowStep: {
          select: {
            id: true,
            key: true,
            nameFr: true,
            nameEn: true,
            color: true,
          },
        },
        parties: {
          take: 3,
          include: {
            party: {
              select: {
                id: true,
                displayName: true,
                type: true,
                clientStatus: true,
              },
            },
          },
        },
        members: {
          take: 4,
          select: {
            matterId: true,
            userId: true,
            level: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            documents: true,
            missions: true,
            procedures: true,
          },
        },
      },
    }),
  ]);

  return {
    matters,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieves a matter with all relations, verifying security access (assertMatterAccess).
 * If user is accountant, returns only header and finance info (PERMISSIONS.md Row 6).
 */
export async function getMatterById(id: string, session: AppSession) {
  // Enforces authorization matrix (ForbiddenError thrown if denied)
  const { level, isLead } = await assertMatterAccess(session, id, "VIEW", "general");

  const isAccountant = session.user.roleKey === "ACCOUNTANT";

  const matter = await db.matter.findUnique({
    where: { id },
    include: {
      category: true,
      leadLawyer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflowStep: true,
      parties: {
        include: {
          party: {
            include: {
              contacts: true,
            },
          },
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: {
                select: {
                  nameFr: true,
                  nameEn: true,
                  key: true,
                },
              },
            },
          },
        },
        orderBy: [{ level: "desc" }],
      },
      adminGrants: {
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      // Restricted for accountant
      missions: isAccountant
        ? false
        : {
            include: {
              owner: {
                select: { id: true, name: true },
              },
              workflowStep: true,
            },
            orderBy: { createdAt: "asc" },
          },
      procedures: isAccountant
        ? false
        : {
            include: {
              workflowStep: true,
            },
            orderBy: { createdAt: "asc" },
          },
      tasks: isAccountant
        ? false
        : {
            include: {
              assignee: { select: { id: true, name: true } },
              checklist: { orderBy: { position: "asc" } },
              workflowStep: true,
            },
            orderBy: [{ status: "asc" }, { dueAt: "asc" }],
            take: 20,
          },
      notes: isAccountant
        ? false
        : {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
      documents: isAccountant
        ? false
        : {
            where: { deletedAt: null },
            include: {
              category: true,
              workflowStep: true,
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: {
                  uploadedBy: { select: { id: true, name: true } },
                  validatedBy: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
      events: isAccountant
        ? false
        : {
            include: {
              attendees: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
              deadlineValidatedBy: {
                select: { id: true, name: true },
              },
              replacesEvent: {
                select: { id: true, title: true, startsAt: true, status: true },
              },
              replacedBy: {
                select: { id: true, title: true, startsAt: true, status: true },
              },
            },
            orderBy: { startsAt: "asc" },
          },
      _count: {
        select: {
          tasks: true,
          documents: true,
          missions: true,
          procedures: true,
          events: true,
        },
      },
    },
  });

  if (!matter || matter.deletedAt) {
    throw new ForbiddenError("Dossier introuvable ou supprimé.", {
      matterId: id,
      reason: "NOT_FOUND",
    });
  }

  return {
    ...matter,
    missions: matter.missions || [],
    procedures: matter.procedures || [],
    tasks: matter.tasks || [],
    notes: matter.notes || [],
    documents: matter.documents || [],
    events: matter.events || [],
    currentUserAccessLevel: level,
    isLeadLawyer: isLead,
  };
}

export interface CreateMatterInput {
  clientId: string;
  title: string;
  categoryId: string;
  leadLawyerId: string;
  priority?: Priority;
  confidentiality?: Confidentiality;
  additionalMemberUserIds?: { userId: string; level: MatterAccessLevel }[];
  opposingParties?: { partyId: string; role: MatterPartyRole }[];
  initialMissionTitle?: string;
  inquiryId?: string | null;
}

/**
 * Creates a matter via the 5-step stepper, generating a sequential reference
 * inside a transaction, verifying conflict clearance, and setting lead lawyer to MANAGE (MAT-01, MAT-02, BR-08).
 * Requires: matter.create
 */
export async function createMatter(input: CreateMatterInput, session: AppSession) {
  await authorize(session, "matter.create");

  // 1. Conflict of interest guard (BR-03, CON-04)
  const conflictCheck = await mandatoryConflictResolved({ partyId: input.clientId });
  if (!conflictCheck.resolved) {
    throw new Error(
      `Ouverture du dossier bloquée par le contrôle déontologique : ${conflictCheck.reason}`
    );
  }

  // 2. Fetch category to retrieve initial workflow step
  const category = await db.matterCategory.findUnique({
    where: { id: input.categoryId },
    include: {
      workflowDefinition: {
        include: {
          steps: {
            where: { isInitial: true },
          },
        },
      },
    },
  });

  if (!category) {
    throw new Error("Catégorie de dossier introuvable.");
  }

  const initialStepId = category.workflowDefinition?.steps[0]?.id || null;

  // 3. Execute matter creation in a single transaction
  const matter = await db.$transaction(async (tx) => {
    // Generate sequential unique reference (MAT-YYYY-XXXX)
    const reference = await generateNextMatterReference(tx);

    const created = await tx.matter.create({
      data: {
        reference,
        title: input.title.trim(),
        category: { connect: { id: category.id } },
        leadLawyer: { connect: { id: input.leadLawyerId } },
        workflowStep: initialStepId ? { connect: { id: initialStepId } } : undefined,
        priority: input.priority || "NORMAL",
        confidentiality: input.confidentiality || "STANDARD",
        createdBy: { connect: { id: session.user.id } },
      },
    });

    // Lead lawyer is ALWAYS added as a member with MANAGE level (Rule MAT-02)
    await tx.matterMember.create({
      data: {
        matterId: created.id,
        userId: input.leadLawyerId,
        level: "MANAGE",
      },
    });

    // Add creator as member if different from lead lawyer
    if (session.user.id !== input.leadLawyerId) {
      await tx.matterMember.create({
        data: {
          matterId: created.id,
          userId: session.user.id,
          level: session.user.roleKey === "PARTNER" ? "MANAGE" : "EDIT",
        },
      });
    }

    // Add additional members if selected
    if (input.additionalMemberUserIds && input.additionalMemberUserIds.length > 0) {
      for (const m of input.additionalMemberUserIds) {
        if (m.userId !== input.leadLawyerId && m.userId !== session.user.id) {
          await tx.matterMember.create({
            data: {
              matterId: created.id,
              userId: m.userId,
              level: m.level,
            },
          });
        }
      }
    }

    // Add client as MatterParty
    await tx.matterParty.create({
      data: {
        matterId: created.id,
        partyId: input.clientId,
        role: "CLIENT",
      },
    });

    // Add opposing parties if provided
    if (input.opposingParties && input.opposingParties.length > 0) {
      for (const op of input.opposingParties) {
        await tx.matterParty.create({
          data: {
            matterId: created.id,
            partyId: op.partyId,
            role: op.role,
          },
        });
      }
    }

    // Create initial mission if requested
    if (input.initialMissionTitle?.trim()) {
      await tx.mission.create({
        data: {
          title: input.initialMissionTitle.trim(),
          type: "ADVISORY",
          matterId: created.id,
          ownerId: input.leadLawyerId,
        },
      });
    }

    // If converted from inquiry, link matterId
    if (input.inquiryId) {
      await tx.inquiry.update({
        where: { id: input.inquiryId },
        data: { matterId: created.id },
      });
    }

    return created;
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.create",
    entityType: "Matter",
    entityId: matter.id,
    matterId: matter.id,
    metadata: {
      reference: matter.reference,
      title: matter.title,
      confidentiality: matter.confidentiality,
      leadLawyerId: matter.leadLawyerId,
      clientId: input.clientId,
    },
  });

  return matter;
}

export interface UpdateMatterInput {
  title?: string;
  categoryId?: string;
  leadLawyerId?: string;
  priority?: Priority;
  confidentiality?: Confidentiality;
}

/**
 * Updates matter attributes.
 * Requires: matter.edit + MANAGE or EDIT level
 */
export async function updateMatter(
  id: string,
  input: UpdateMatterInput,
  session: AppSession
) {
  await authorize(session, "matter.edit");
  await assertMatterAccess(session, id, "EDIT", "general");

  const existing = await db.matter.findUnique({ where: { id } });
  if (!existing) throw new Error("Dossier introuvable.");

  // If lead lawyer is changed, ensure new lead lawyer is a MANAGE member
  if (input.leadLawyerId && input.leadLawyerId !== existing.leadLawyerId) {
    await db.matterMember.upsert({
      where: {
        matterId_userId: {
          matterId: id,
          userId: input.leadLawyerId,
        },
      },
      update: { level: "MANAGE" },
      create: {
        matterId: id,
        userId: input.leadLawyerId,
        level: "MANAGE",
      },
    });
  }

  const updated = await db.matter.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.leadLawyerId ? { leadLawyerId: input.leadLawyerId } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.confidentiality ? { confidentiality: input.confidentiality } : {}),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.update",
    entityType: "Matter",
    entityId: id,
    matterId: id,
    metadata: {
      changedFields: Object.keys(input),
      reference: updated.reference,
    },
  });

  return updated;
}

/**
 * Soft delete matter (MAT-07). Never hard deleted.
 * Requires: matter.archive + MANAGE level
 */
export async function softDeleteMatter(id: string, session: AppSession) {
  await authorize(session, "matter.archive");
  await assertMatterAccess(session, id, "MANAGE", "general");

  const matter = await db.matter.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.archive",
    entityType: "Matter",
    entityId: id,
    matterId: id,
    metadata: {
      reference: matter.reference,
      softDeleted: true,
    },
  });

  return matter;
}

/**
 * Restores soft-deleted matter.
 * Requires: matter.archive + PARTNER or LEAD_LAWYER
 */
export async function restoreMatter(id: string, session: AppSession) {
  await authorize(session, "matter.archive");

  const matter = await db.matter.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.restore",
    entityType: "Matter",
    entityId: id,
    matterId: id,
    metadata: {
      reference: matter.reference,
      restored: true,
    },
  });

  return matter;
}

/**
 * Adds or updates a matter member level.
 * Cannot demote the lead lawyer below MANAGE (Rule MAT-02).
 * Requires: matter.member_manage + MANAGE level
 */
export async function setMatterMember(
  matterId: string,
  userId: string,
  level: MatterAccessLevel,
  session: AppSession
) {
  await authorize(session, "matter.member_manage");
  await assertMatterAccess(session, matterId, "MANAGE", "general");

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { leadLawyerId: true },
  });

  if (!matter) throw new Error("Dossier introuvable.");

  // Lead lawyer must remain MANAGE
  if (userId === matter.leadLawyerId && level !== "MANAGE") {
    throw new Error("L'avocat responsable du dossier doit conserver le niveau de gestion (MANAGE).");
  }

  const member = await db.matterMember.upsert({
    where: {
      matterId_userId: {
        matterId,
        userId,
      },
    },
    update: { level },
    create: {
      matterId,
      userId,
      level,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.member_set",
    entityType: "MatterMember",
    entityId: `${matterId}_${userId}`,
    matterId,
    metadata: {
      memberUserId: userId,
      level,
    },
  });

  return member;
}

/**
 * Removes a member from the matter.
 * Cannot remove the lead lawyer (MAT-02).
 * Requires: matter.member_manage + MANAGE level
 */
export async function removeMatterMember(
  matterId: string,
  userId: string,
  session: AppSession
) {
  await authorize(session, "matter.member_manage");
  await assertMatterAccess(session, matterId, "MANAGE", "general");

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { leadLawyerId: true },
  });

  if (!matter) throw new Error("Dossier introuvable.");

  if (userId === matter.leadLawyerId) {
    throw new Error("Impossible de retirer l'avocat responsable de son propre dossier.");
  }

  await db.matterMember.delete({
    where: {
      matterId_userId: {
        matterId,
        userId,
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.member_removed",
    entityType: "MatterMember",
    matterId,
    metadata: {
      removedUserId: userId,
    },
  });

  return { success: true };
}

/**
 * Explicit Partner self-join for a STRICT matter (PERMISSIONS.md Row 4).
 * Always audit-logged.
 */
export async function partnerSelfJoinStrict(
  matterId: string,
  session: AppSession,
  reason?: string
) {
  return await partnerSelfJoinStrictMatter(session, matterId, "VIEW");
}
