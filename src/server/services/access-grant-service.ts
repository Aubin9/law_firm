import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import { ForbiddenError, NotFoundError } from "@/server/auth/errors";

export type GrantStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";

export interface RequestGrantInput {
  matterId: string;
  reason: string;
}

export interface ApproveGrantInput {
  grantId: string;
  durationMinutes: number; // e.g. 15, 30, 60, 120
}

export interface RevokeGrantInput {
  grantId: string;
  reason?: string;
}

export interface ListGrantsFilter {
  status?: GrantStatus | "ALL";
  matterId?: string;
}

export function computeGrantStatus(grant: {
  startsAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  approvedById: string | null;
}): GrantStatus {
  if (grant.revokedAt) return "REVOKED";
  if (!grant.approvedById || !grant.startsAt || !grant.expiresAt) return "PENDING";
  const now = new Date();
  if (now > grant.expiresAt) return "EXPIRED";
  if (now >= grant.startsAt && now <= grant.expiresAt) return "ACTIVE";
  return "PENDING";
}

/**
 * Exceptional Access Flow (SPECIFICATIONS.md ADM, PERMISSIONS.md 3.7, DESIGN.md 8.13).
 *
 * Professional secrecy safeguard:
 * Technical administrator gets zero default access to business matters.
 * Access must be explicitly requested, partner-approved, countdown-timed, auto-expired,
 * revokable at any moment, and all actions audited.
 */
export async function requestAccessGrant(
  session: AppSession,
  input: RequestGrantInput,
) {
  await authorize(session, "accessgrant.request");

  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Une justification détaillée (minimum 10 caractères) est obligatoire.");
  }

  const matter = await db.matter.findUnique({
    where: { id: input.matterId, deletedAt: null },
    select: { id: true, reference: true, leadLawyerId: true },
  });

  if (!matter) {
    throw new NotFoundError("Dossier introuvable ou supprimé.");
  }

  // Create pending grant
  const grant = await db.adminAccessGrant.create({
    data: {
      adminId: session.user.id,
      matterId: input.matterId,
      reason: input.reason.trim(),
      approvedById: null,
      startsAt: null,
      expiresAt: null,
    },
    include: {
      matter: {
        select: { reference: true },
      },
    },
  });

  // Log audit
  await logAudit({
    actorId: session.user.id,
    action: "accessgrant.requested",
    entityType: "admin_access_grant",
    entityId: grant.id,
    matterId: input.matterId,
    metadata: {
      reason: input.reason.trim(),
      matterReference: matter.reference,
    },
  });

  // Notify all Partners
  const partners = await db.user.findMany({
    where: {
      status: "ACTIVE",
      role: { key: "PARTNER" },
    },
    select: { id: true },
  });

  for (const p of partners) {
    await db.notification.create({
      data: {
        userId: p.id,
        type: "accessgrant.requested",
        payload: {
          grantId: grant.id,
          matterId: matter.id,
          matterReference: matter.reference,
          adminName: session.user.name,
          reason: input.reason.trim(),
        },
      },
    });
  }

  return grant;
}

export async function approveAccessGrant(
  session: AppSession,
  input: ApproveGrantInput,
) {
  await authorize(session, "accessgrant.approve");

  const grant = await db.adminAccessGrant.findUnique({
    where: { id: input.grantId },
    include: {
      matter: { select: { id: true, reference: true } },
      admin: { select: { id: true, name: true, email: true } },
    },
  });

  if (!grant) {
    throw new NotFoundError("Demande d'accès introuvable.");
  }

  if (grant.approvedById) {
    throw new Error("Cette demande d'accès a déjà été traitée.");
  }

  const minutes = Math.max(5, Math.min(240, input.durationMinutes || 30));
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + minutes * 60 * 1000);

  const updated = await db.adminAccessGrant.update({
    where: { id: grant.id },
    data: {
      approvedById: session.user.id,
      startsAt,
      expiresAt,
    },
  });

  // Mandatory Audit Trail
  await logAudit({
    actorId: session.user.id,
    action: "accessgrant.approved",
    entityType: "admin_access_grant",
    entityId: grant.id,
    matterId: grant.matterId,
    metadata: {
      adminId: grant.adminId,
      adminName: grant.admin.name,
      matterReference: grant.matter.reference,
      durationMinutes: minutes,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });

  // Notify requesting admin
  await db.notification.create({
    data: {
      userId: grant.adminId,
      type: "accessgrant.approved",
      payload: {
        grantId: grant.id,
        matterId: grant.matter.id,
        matterReference: grant.matter.reference,
        durationMinutes: minutes,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  return updated;
}

export async function revokeAccessGrant(
  session: AppSession,
  input: RevokeGrantInput,
) {
  const grant = await db.adminAccessGrant.findUnique({
    where: { id: input.grantId },
    include: {
      matter: { select: { reference: true } },
    },
  });

  if (!grant) {
    throw new NotFoundError("Demande d'accès introuvable.");
  }

  // Only PARTNER or the admin themselves can revoke
  const isPartner = session.user.roleKey === "PARTNER";
  const isSelf = session.user.id === grant.adminId;

  if (!isPartner && !isSelf) {
    throw new ForbiddenError("Non autorisé à révoquer cet accès exceptionnel.");
  }

  if (grant.revokedAt) {
    return grant; // Already revoked
  }

  const updated = await db.adminAccessGrant.update({
    where: { id: grant.id },
    data: {
      revokedAt: new Date(),
    },
  });

  // Log revocation
  await logAudit({
    actorId: session.user.id,
    action: "accessgrant.revoked",
    entityType: "admin_access_grant",
    entityId: grant.id,
    matterId: grant.matterId,
    metadata: {
      revokedBy: session.user.name,
      revokedById: session.user.id,
      reason: input.reason ?? "Révocation manuelle",
    },
  });

  return updated;
}

export async function listAccessGrants(
  session: AppSession,
  filters: ListGrantsFilter = {},
) {
  const isPartner = session.user.roleKey === "PARTNER";
  const isTadmin = session.user.roleKey === "TECHNICAL_ADMIN";

  if (!isPartner && !isTadmin) {
    throw new ForbiddenError("Accès réservé aux Associés et Administrateurs Techniques.");
  }

  const where: any = {};

  // Technical admin only sees their own grants
  if (!isPartner) {
    where.adminId = session.user.id;
  }

  if (filters.matterId) {
    where.matterId = filters.matterId;
  }

  const grants = await db.adminAccessGrant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          confidentiality: true,
        },
      },
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const now = new Date();

  const formatted = grants.map((g) => {
    const status = computeGrantStatus(g);
    let remainingSeconds = 0;
    if (status === "ACTIVE" && g.expiresAt) {
      remainingSeconds = Math.max(0, Math.floor((g.expiresAt.getTime() - now.getTime()) / 1000));
    }

    return {
      ...g,
      computedStatus: status,
      remainingSeconds,
    };
  });

  if (filters.status && filters.status !== "ALL") {
    return formatted.filter((g) => g.computedStatus === filters.status);
  }

  return formatted;
}

/**
 * Returns active grants for the current user (used to render countdown banner in UI).
 */
export async function getActiveGrantsForUser(session: AppSession) {
  if (session.user.roleKey !== "TECHNICAL_ADMIN") {
    return [];
  }

  const now = new Date();
  const grants = await db.adminAccessGrant.findMany({
    where: {
      adminId: session.user.id,
      startsAt: { lte: now },
      expiresAt: { gt: now },
      revokedAt: null,
    },
    include: {
      matter: {
        select: { id: true, reference: true, title: true },
      },
    },
  });

  return grants.map((g) => ({
    id: g.id,
    matterId: g.matterId,
    matterReference: g.matter.reference,
    matterTitle: g.matter.title,
    expiresAt: g.expiresAt!,
    remainingSeconds: Math.max(0, Math.floor((g.expiresAt!.getTime() - now.getTime()) / 1000)),
  }));
}
