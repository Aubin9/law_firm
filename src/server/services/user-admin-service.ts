import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { hash } from "@node-rs/argon2";
import crypto from "crypto";
import { UserStatus, Locale } from "@prisma/client";

export interface CreateUserInput {
  name: string;
  email: string;
  roleId: string;
  locale?: Locale;
}

export interface UpdateUserInput {
  name?: string;
  roleId?: string;
  locale?: Locale;
}

export interface CreateUserResult {
  user: {
    id: string;
    name: string;
    email: string;
    roleKey: string;
    locale: string;
    status: string;
  };
  temporaryPassword: string;
}

/**
 * Lists all firm users with their roles, 2FA status, and session counts.
 * Requires: user.view
 */
export async function listUsers(session: AppSession) {
  await authorize(session, "user.view");

  return await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      status: true,
      roleId: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          key: true,
          nameFr: true,
          nameEn: true,
        },
      },
      _count: {
        select: {
          sessions: true,
          leadMatters: true,
          assignedTasks: true,
        },
      },
    },
  });
}

/**
 * Creates a new user account with an administrator-generated temporary password.
 * Requires: user.create
 * The temporary password is returned once and must be communicated to the user.
 */
export async function createUser(
  session: AppSession,
  input: CreateUserInput
): Promise<CreateUserResult> {
  await authorize(session, "user.create");

  const normalizedEmail = input.email.toLowerCase().trim();

  // Check if email already in use
  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new ForbiddenError("Un utilisateur avec cette adresse email existe déjà.", {
      reason: "EMAIL_ALREADY_EXISTS",
    });
  }

  // Verify role exists
  const targetRole = await db.role.findUnique({
    where: { id: input.roleId },
  });

  if (!targetRole) {
    throw new ForbiddenError("Le rôle sélectionné est invalide.", {
      reason: "INVALID_ROLE",
    });
  }

  // Generate secure temporary password (e.g. 12 characters: alphanumeric + special)
  const temporaryPassword = `Temp-${crypto.randomBytes(4).toString("hex").toUpperCase()}!`;
  const passwordHash = await hash(temporaryPassword);

  const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;

  const createdUser = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        email: normalizedEmail,
        name: input.name.trim(),
        roleId: input.roleId,
        locale: input.locale || "FR",
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    await tx.account.create({
      data: {
        id: `acc_${userId}`,
        accountId: userId,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    return user;
  });

  // Audit trail
  await logAudit({
    actorId: session.user.id,
    action: "user.create",
    entityType: "user",
    entityId: createdUser.id,
    metadata: {
      email: normalizedEmail,
      roleKey: targetRole.key,
      locale: input.locale || "FR",
    },
  });

  return {
    user: {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      roleKey: targetRole.key,
      locale: createdUser.locale,
      status: createdUser.status,
    },
    temporaryPassword,
  };
}

/**
 * Updates a user's profile or assigned role.
 * Requires: user.edit
 * Rule: Nobody can change their own role or permissions.
 */
export async function updateUser(
  session: AppSession,
  userId: string,
  input: UpdateUserInput
) {
  await authorize(session, "user.edit");

  // Rule: Nobody can change their own role
  if (session.user.id === userId && input.roleId) {
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });

    if (currentUser && currentUser.roleId !== input.roleId) {
      await logAudit({
        actorId: session.user.id,
        action: "user.self_role_edit_blocked",
        entityType: "user",
        entityId: userId,
        metadata: { attemptedRoleId: input.roleId },
      });

      throw new ForbiddenError(
        "Vous ne pouvez pas modifier votre propre rôle ou vos propres permissions.",
        {
          reason: "CANNOT_EDIT_OWN_ROLE",
          entityId: userId,
        }
      );
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim(),
      roleId: input.roleId,
      locale: input.locale,
    },
    include: { role: true },
  });

  await logAudit({
    actorId: session.user.id,
    action: "user.edit",
    entityType: "user",
    entityId: userId,
    metadata: {
      updatedFields: Object.keys(input),
      newRoleKey: updated.role.key,
    },
  });

  return updated;
}

/**
 * Changes a user's account status (ACTIVE, SUSPENDED, DISABLED).
 * Requires: user.disable
 * Rule: Nobody can disable or suspend their own account.
 * Rule: Suspending or disabling revokes all active sessions immediately.
 */
export async function setUserStatus(
  session: AppSession,
  userId: string,
  newStatus: UserStatus
) {
  await authorize(session, "user.disable");

  // Rule: Nobody can disable or suspend their own account
  if (session.user.id === userId && newStatus !== "ACTIVE") {
    throw new ForbiddenError(
      "Vous ne pouvez pas désactiver ou suspendre votre propre compte administrateur.",
      {
        reason: "CANNOT_DISABLE_OWN_ACCOUNT",
        entityId: userId,
      }
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    // If suspended or disabled, immediately revoke all active sessions
    if (newStatus !== "ACTIVE") {
      await tx.session.deleteMany({
        where: { userId },
      });
    }

    return user;
  });

  await logAudit({
    actorId: session.user.id,
    action: "user.status_change",
    entityType: "user",
    entityId: userId,
    metadata: {
      newStatus,
      sessionsRevoked: newStatus !== "ACTIVE",
    },
  });

  return updated;
}

/**
 * Revokes all active sessions of a user.
 * Requires: user.revoke_sessions
 */
export async function revokeUserSessions(session: AppSession, userId: string) {
  await authorize(session, "user.revoke_sessions");

  const deleteResult = await db.session.deleteMany({
    where: { userId },
  });

  await logAudit({
    actorId: session.user.id,
    action: "user.sessions_revoked",
    entityType: "user",
    entityId: userId,
    metadata: { count: deleteResult.count },
  });

  return { revokedCount: deleteResult.count };
}

/**
 * Resets 2FA for a user (e.g. if phone lost).
 * Requires: user.edit
 */
export async function resetUserTwoFactor(session: AppSession, userId: string) {
  await authorize(session, "user.edit");

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });

    await tx.twoFactor.deleteMany({
      where: { userId },
    });
  });

  await logAudit({
    actorId: session.user.id,
    action: "user.two_factor_reset",
    entityType: "user",
    entityId: userId,
  });

  return { success: true };
}

/**
 * Attempts to delete a user.
 * Rule (AUTH-05): Users with recorded activity (matters, tasks, audits, notes, invoices)
 * are NEVER deleted; only disabled or suspended.
 */
export async function deleteUser(session: AppSession, userId: string) {
  await authorize(session, "user.edit");

  if (session.user.id === userId) {
    throw new ForbiddenError("Suppression de son propre compte interdite.", {
      reason: "CANNOT_DELETE_SELF",
    });
  }

  // Check activity across models
  const [
    leadMattersCount,
    createdMattersCount,
    assignedTasksCount,
    notesCount,
    auditCount,
    invoiceCount,
  ] = await Promise.all([
    db.matter.count({ where: { leadLawyerId: userId } }),
    db.matter.count({ where: { createdById: userId } }),
    db.task.count({ where: { assigneeId: userId } }),
    db.note.count({ where: { authorId: userId } }),
    db.auditLog.count({ where: { actorId: userId } }),
    db.invoice.count({ where: { createdById: userId } }),
  ]);

  const totalActivity =
    leadMattersCount +
    createdMattersCount +
    assignedTasksCount +
    notesCount +
    auditCount +
    invoiceCount;

  if (totalActivity > 0) {
    throw new ForbiddenError(
      "Règle de conservation : cet utilisateur possède un historique d'activité (dossiers, tâches, actes ou journal d'audit) et ne peut pas être supprimé. Veuillez le désactiver.",
      {
        reason: "USER_HAS_ACTIVITY",
        entityId: userId,
      }
    );
  }

  // If completely zero activity (e.g. freshly created test user with no records)
  await db.account.deleteMany({ where: { userId } });
  await db.session.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });

  await logAudit({
    actorId: session.user.id,
    action: "user.delete",
    entityType: "user",
    entityId: userId,
  });

  return { success: true };
}

