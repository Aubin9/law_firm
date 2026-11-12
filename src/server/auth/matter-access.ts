import { AppSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { db } from "@/server/db";
import { Prisma, MatterAccessLevel, Confidentiality } from "@prisma/client";

export type AccessLevel = "VIEW" | "EDIT" | "MANAGE";
export type MatterResourceType =
  "general" | "header" | "finance" | "document" | "note" | "communication";

const LEVEL_WEIGHT: Record<AccessLevel, number> = {
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

export interface MatterAccessResult {
  allowed: boolean;
  effectiveLevel?: AccessLevel;
  reason?: string;
}

/**
 * Implements the Matter Access Resolution Table from PERMISSIONS.md section 1.
 * Throws ForbiddenError and records a tamper-resistant audit entry if access is denied.
 */
export async function assertMatterAccess(
  session: AppSession | null | undefined,
  matterId: string,
  requiredLevel: AccessLevel = "VIEW",
  resourceType: MatterResourceType = "general",
): Promise<{ level: AccessLevel; isLead: boolean }> {
  if (!session || !session.user) {
    throw new ForbiddenError("Authentication required.", {
      reason: "NO_SESSION",
      matterId,
      requiredLevel,
    });
  }

  const userId = session.user.id;
  const roleKey = session.user.roleKey;
  const now = new Date();

  // Load target matter with lead lawyer, memberships, and active admin grants
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: {
      members: {
        where: { userId },
      },
      adminGrants: {
        where: {
          adminId: userId,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          revokedAt: null,
        },
      },
    },
  });

  if (!matter || matter.deletedAt) {
    // If deleted or not found, hide its existence from unauthorized callers
    await logAudit({
      actorId: userId,
      action: "matter.access_denied_not_found",
      entityType: "matter",
      entityId: matterId,
      matterId,
      metadata: { reason: "MATTER_NOT_FOUND_OR_DELETED" },
    });

    throw new ForbiddenError("Dossier introuvable ou non autorisé.", {
      reason: "NOT_FOUND",
      matterId,
      requiredLevel,
    });
  }

  const isLead = matter.leadLawyerId === userId;
  const memberRow = matter.members[0];
  let effectiveLevel: AccessLevel | null = null;
  let resolutionReason = "";

  // 1. User is the lead lawyer of the matter -> MANAGE
  if (isLead) {
    effectiveLevel = "MANAGE";
    resolutionReason = "LEAD_LAWYER";
  }
  // 2. User has a MatterMember row -> Level on the row
  else if (memberRow) {
    effectiveLevel = memberRow.level as AccessLevel;
    resolutionReason = "MATTER_MEMBER";
  }
  // 3. User is a partner and the matter is STANDARD or RESTRICTED -> VIEW
  else if (
    roleKey === "PARTNER" &&
    (matter.confidentiality === Confidentiality.STANDARD ||
      matter.confidentiality === Confidentiality.RESTRICTED)
  ) {
    effectiveLevel = "VIEW";
    resolutionReason = "PARTNER_DEFAULT_VIEW";
  }
  // 4. Matter is STRICT -> Members only. (Partner without membership must self-add)
  else if (matter.confidentiality === Confidentiality.STRICT) {
    effectiveLevel = null;
    resolutionReason = "STRICT_CONFIDENTIALITY_RESTRICTION";
  }
  // 5. User is the accountant -> Header & finance records only
  else if (roleKey === "ACCOUNTANT") {
    if (
      resourceType === "document" ||
      resourceType === "note" ||
      resourceType === "communication"
    ) {
      effectiveLevel = null;
      resolutionReason = "ACCOUNTANT_CONTENT_RESTRICTED";
    } else {
      effectiveLevel = "VIEW";
      resolutionReason = "ACCOUNTANT_HEADER_AND_FINANCE";
    }
  }
  // 6. User is technical admin -> Allowed ONLY if an active approved AdminAccessGrant exists
  else if (roleKey === "TECHNICAL_ADMIN") {
    if (matter.adminGrants.length > 0) {
      effectiveLevel = "VIEW";
      resolutionReason = "ACTIVE_ADMIN_ACCESS_GRANT";
    } else {
      effectiveLevel = null;
      resolutionReason = "TECHNICAL_ADMIN_NO_GRANT";
    }
  }
  // 7. Anyone else -> No access
  else {
    effectiveLevel = null;
    resolutionReason = "NO_ASSIGNMENT";
  }

  // Check if effective level satisfies the required level
  if (
    !effectiveLevel ||
    LEVEL_WEIGHT[effectiveLevel] < LEVEL_WEIGHT[requiredLevel]
  ) {
    await logAudit({
      actorId: userId,
      action: "matter.access_denied",
      entityType: "matter",
      entityId: matterId,
      matterId,
      metadata: {
        role: roleKey,
        requiredLevel,
        resourceType,
        effectiveLevel,
        confidentiality: matter.confidentiality,
        reason: resolutionReason,
      },
    });

    throw new ForbiddenError(
      `Accès refusé au dossier ${matter.reference} (Niveau requis: ${requiredLevel}, Accordé: ${effectiveLevel ?? "AUCUN"}).`,
      {
        reason: resolutionReason,
        matterId,
        requiredLevel,
      },
    );
  }

  return { level: effectiveLevel, isLead };
}

/**
 * Partner rule on STRICT matters:
 * A partner who is not a member must add themselves explicitly.
 * This action is permanently audit-logged and notifies the lead lawyer.
 */
export async function partnerSelfJoinStrictMatter(
  session: AppSession,
  matterId: string,
  level: AccessLevel = "VIEW",
) {
  if (session.user.roleKey !== "PARTNER") {
    throw new ForbiddenError(
      "Seul un Associé peut s'adjoindre à un dossier strict.",
      {
        reason: "NOT_A_PARTNER",
        matterId,
      },
    );
  }

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: {
      id: true,
      reference: true,
      leadLawyerId: true,
      confidentiality: true,
    },
  });

  if (!matter) {
    throw new ForbiddenError("Dossier introuvable.", {
      reason: "NOT_FOUND",
      matterId,
    });
  }

  // Upsert membership
  const member = await db.matterMember.upsert({
    where: {
      matterId_userId: {
        matterId,
        userId: session.user.id,
      },
    },
    update: {
      level: level as MatterAccessLevel,
    },
    create: {
      matterId,
      userId: session.user.id,
      level: level as MatterAccessLevel,
    },
  });

  // Mandatory Audit Trail
  await logAudit({
    actorId: session.user.id,
    action: "matter.partner_self_joined_strict",
    entityType: "matter",
    entityId: matterId,
    matterId,
    metadata: {
      confidentiality: matter.confidentiality,
      level,
      leadLawyerId: matter.leadLawyerId,
    },
  });

  // Notify the lead lawyer
  if (matter.leadLawyerId && matter.leadLawyerId !== session.user.id) {
    await db.notification.create({
      data: {
        userId: matter.leadLawyerId,
        type: "matter.partner_joined_strict",
        payload: {
          matterId,
          matterReference: matter.reference,
          partnerName: session.user.name,
          partnerId: session.user.id,
        },
      },
    });
  }

  return member;
}

/**
 * Generates a Prisma WHERE fragment that restricts matter queries at the database layer.
 * Hidden matters never leave the database.
 */
export function accessibleMatterFilter(
  session: AppSession,
): Prisma.MatterWhereInput {
  const userId = session.user.id;
  const roleKey = session.user.roleKey;
  const now = new Date();

  // 1. Technical Admin: only matters with active AdminAccessGrant
  if (roleKey === "TECHNICAL_ADMIN") {
    return {
      deletedAt: null,
      adminGrants: {
        some: {
          adminId: userId,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          revokedAt: null,
        },
      },
    };
  }

  // 2. Partner: lead matters OR assigned member OR (STANDARD / RESTRICTED)
  if (roleKey === "PARTNER") {
    return {
      deletedAt: null,
      OR: [
        { leadLawyerId: userId },
        { members: { some: { userId } } },
        {
          confidentiality: {
            in: [Confidentiality.STANDARD, Confidentiality.RESTRICTED],
          },
        },
      ],
    };
  }

  // 3. Accountant: all non-deleted matters (content access strictly checked in service layer)
  if (roleKey === "ACCOUNTANT") {
    return {
      deletedAt: null,
    };
  }

  // 4. Lead Lawyer, Associate Lawyer, Secretary: lead matters OR explicit membership
  return {
    deletedAt: null,
    OR: [{ leadLawyerId: userId }, { members: { some: { userId } } }],
  };
}
