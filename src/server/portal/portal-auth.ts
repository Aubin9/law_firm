import crypto from "crypto";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/auth/errors";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import { Confidentiality } from "@prisma/client";

export const PORTAL_FLAG_KEY = "portal.enabled";
export const PORTAL_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-portal_session" : "portal_session";
const PORTAL_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const PORTAL_INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface PortalSessionContext {
  sessionId: string;
  accountId: string;
  partyId: string;
  email: string;
  partyName: string;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Checks whether the public Client Portal is globally enabled (air-gapped by default).
 */
export async function isPortalEnabled(): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({
    where: { key: PORTAL_FLAG_KEY },
  });
  if (flag !== null) return flag.enabled;
  return process.env.PORTAL_ENABLED === "true";
}

/**
 * Invites a verified client Party to the Client Portal for a specific Matter.
 * Returns the one-time activation token (must be communicated securely, never stored in clear).
 */
export async function inviteClientToPortal(
  input: { partyId: string; matterId: string; email: string },
  session: AppSession
) {
  await assertMatterAccess(session, input.matterId, "MANAGE", "general");

  const matter = await db.matter.findUnique({
    where: { id: input.matterId },
    include: { parties: true },
  });
  if (!matter || matter.deletedAt) {
    throw new NotFoundError("Dossier introuvable.");
  }

  if (
    matter.confidentiality === Confidentiality.STRICT ||
    matter.confidentiality === Confidentiality.RESTRICTED
  ) {
    throw new ForbiddenError(
      `Portail client interdit : les dossiers classés ${matter.confidentiality} sont exclus du portail par défaut (PORTAL_DESIGN §4).`
    );
  }

  const isPartyInMatter = matter.parties.some((mp) => mp.partyId === input.partyId);
  if (!isPartyInMatter) {
    throw new ValidationError("Cette partie n'est pas rattachée à ce dossier.");
  }

  const party = await db.party.findUnique({
    where: { id: input.partyId },
  });
  if (!party || party.deletedAt) {
    throw new NotFoundError("Partie introuvable.");
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new ValidationError("Adresse e-mail invalide.");
  }

  const rawInviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenHash = sha256Hex(rawInviteToken);
  const inviteExpiresAt = new Date(Date.now() + PORTAL_INVITE_TTL_MS);

  let account = await db.clientPortalAccount.findUnique({
    where: { partyId: input.partyId },
  });

  if (account) {
    account = await db.clientPortalAccount.update({
      where: { id: account.id },
      data: {
        email: normalizedEmail,
        status: account.status === "ACTIVE" ? "ACTIVE" : "INVITED",
        inviteTokenHash: account.status === "ACTIVE" ? null : inviteTokenHash,
        inviteExpiresAt: account.status === "ACTIVE" ? null : inviteExpiresAt,
        revokedAt: null,
      },
    });
  } else {
    account = await db.clientPortalAccount.create({
      data: {
        partyId: input.partyId,
        email: normalizedEmail,
        status: "INVITED",
        inviteTokenHash,
        inviteExpiresAt,
        invitedById: session.user.id,
      },
    });
  }

  // Grant or restore access to this specific matter
  await db.clientPortalMatterAccess.upsert({
    where: {
      accountId_matterId: {
        accountId: account.id,
        matterId: input.matterId,
      },
    },
    update: {
      revokedAt: null,
      grantedById: session.user.id,
      grantedAt: new Date(),
    },
    create: {
      accountId: account.id,
      matterId: input.matterId,
      grantedById: session.user.id,
    },
  });

  // Enable portal on matter if not already enabled
  if (!matter.portalEnabled) {
    await db.matter.update({
      where: { id: matter.id },
      data: { portalEnabled: true },
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: "portal.account.invited",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    matterId: input.matterId,
    metadata: {
      partyId: input.partyId,
      email: normalizedEmail,
    },
  });

  return {
    account,
    activationToken: account.status === "INVITED" ? rawInviteToken : null,
  };
}

/**
 * Activates a client portal account using the one-time invitation token.
 */
export async function activatePortalAccount(rawToken: string, password: string) {
  const enabled = await isPortalEnabled();
  if (!enabled) {
    throw new ForbiddenError("Le portail client est actuellement désactivé.");
  }

  if (!rawToken || !password || password.length < 10) {
    throw new ValidationError(
      "Le mot de passe doit contenir au moins 10 caractères pour respecter les exigences de sécurité."
    );
  }

  const tokenHash = sha256Hex(rawToken.trim());
  const account = await db.clientPortalAccount.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      revokedAt: null,
    },
  });

  if (!account || !account.inviteExpiresAt || account.inviteExpiresAt < new Date()) {
    throw new ValidationError("Jeton d'activation invalide ou expiré.");
  }

  const passwordHash = await hash(password);

  const updated = await db.clientPortalAccount.update({
    where: { id: account.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  await logAudit({
    action: "portal.account.activated",
    entityType: "ClientPortalAccount",
    entityId: updated.id,
    metadata: {
      partyId: updated.partyId,
      email: updated.email,
    },
  });

  return { accountId: updated.id, email: updated.email };
}

/**
 * Authenticates an external client in the isolated Client Portal realm.
 */
export async function loginPortalAccount(
  email: string,
  password: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const enabled = await isPortalEnabled();
  if (!enabled) {
    throw new ForbiddenError("Le portail client est actuellement désactivé.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const account = await db.clientPortalAccount.findUnique({
    where: { email: normalizedEmail },
    include: { party: true },
  });

  if (!account || account.revokedAt || account.status !== "ACTIVE" || !account.passwordHash) {
    await logAudit({
      action: "portal.auth.login_failed",
      entityType: "ClientPortalAccount",
      entityId: account?.id,
      metadata: {
        email: normalizedEmail,
        reason: "Account not active or unknown",
        ipAddress: meta?.ipAddress,
      },
    });
    throw new ForbiddenError("Identifiants invalides ou accès révoqué.");
  }

  if (account.lockedUntil && account.lockedUntil > new Date()) {
    await logAudit({
      action: "portal.auth.login_failed",
      entityType: "ClientPortalAccount",
      entityId: account.id,
      metadata: {
        reason: "Account locked due to repeated failures",
        ipAddress: meta?.ipAddress,
      },
    });
    throw new ForbiddenError("Compte temporairement verrouillé suite à plusieurs échecs. Réessayez plus tard.");
  }

  const valid = await verify(account.passwordHash, password);
  if (!valid) {
    const nextFailures = account.failedAttempts + 1;
    const lockedUntil =
      nextFailures >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await db.clientPortalAccount.update({
      where: { id: account.id },
      data: {
        failedAttempts: nextFailures,
        lockedUntil,
      },
    });

    await logAudit({
      action: "portal.auth.login_failed",
      entityType: "ClientPortalAccount",
      entityId: account.id,
      metadata: {
        failedAttempts: nextFailures,
        locked: !!lockedUntil,
        ipAddress: meta?.ipAddress,
      },
    });

    throw new ForbiddenError("Identifiants invalides.");
  }

  // Success: reset failure counters and issue isolated session token
  const rawSessionToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawSessionToken);
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_MS);

  await db.clientPortalAccount.update({
    where: { id: account.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const portalSession = await db.clientPortalSession.create({
    data: {
      accountId: account.id,
      tokenHash,
      ipAddress: meta?.ipAddress || null,
      userAgent: meta?.userAgent || null,
      expiresAt,
    },
  });

  await logAudit({
    action: "portal.auth.login_success",
    entityType: "ClientPortalSession",
    entityId: portalSession.id,
    metadata: {
      accountId: account.id,
      partyId: account.partyId,
      ipAddress: meta?.ipAddress,
    },
  });

  return {
    rawSessionToken,
    expiresAt,
    context: {
      sessionId: portalSession.id,
      accountId: account.id,
      partyId: account.partyId,
      email: account.email,
      partyName: account.party.displayName,
    } satisfies PortalSessionContext,
  };
}

/**
 * Validates a raw portal session token and checks global flag & account status.
 */
export async function getPortalSession(rawToken: string | undefined | null): Promise<PortalSessionContext | null> {
  if (!rawToken) return null;

  const enabled = await isPortalEnabled();
  if (!enabled) return null;

  const tokenHash = sha256Hex(rawToken);
  const sessionRecord = await db.clientPortalSession.findUnique({
    where: { tokenHash },
    include: {
      account: {
        include: { party: true },
      },
    },
  });

  if (
    !sessionRecord ||
    sessionRecord.revokedAt ||
    sessionRecord.expiresAt < new Date() ||
    sessionRecord.account.revokedAt ||
    sessionRecord.account.status !== "ACTIVE"
  ) {
    return null;
  }

  return {
    sessionId: sessionRecord.id,
    accountId: sessionRecord.accountId,
    partyId: sessionRecord.account.partyId,
    email: sessionRecord.account.email,
    partyName: sessionRecord.account.party.displayName,
  };
}

export async function getPortalSessionFromCookies(): Promise<PortalSessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  return getPortalSession(rawToken);
}

export async function logoutPortalSession(rawToken: string | undefined | null) {
  if (!rawToken) return;
  const tokenHash = sha256Hex(rawToken);

  const existing = await db.clientPortalSession.findUnique({
    where: { tokenHash },
  });
  if (existing && !existing.revokedAt) {
    await db.clientPortalSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await logAudit({
      action: "portal.auth.logout",
      entityType: "ClientPortalSession",
      entityId: existing.id,
      metadata: { accountId: existing.accountId },
    });
  }
}

/**
 * Immediately revokes a client's portal account and all active sessions.
 */
export async function revokePortalAccount(accountId: string, session: AppSession) {
  const isPartner = session.user.roleKey === "PARTNER";
  if (!isPartner) {
    await authorize(session, "matter.edit");
  }

  const account = await db.clientPortalAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    throw new NotFoundError("Compte portail introuvable.");
  }

  const now = new Date();
  await db.$transaction([
    db.clientPortalAccount.update({
      where: { id: accountId },
      data: {
        status: "REVOKED",
        revokedAt: now,
        inviteTokenHash: null,
      },
    }),
    db.clientPortalSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    }),
    db.clientPortalMatterAccess.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "portal.account.revoked",
    entityType: "ClientPortalAccount",
    entityId: accountId,
    metadata: { partyId: account.partyId, email: account.email },
  });

  return { success: true };
}

