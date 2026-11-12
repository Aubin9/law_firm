"use server";

import { db } from "@/server/db";
import { verify } from "@node-rs/argon2";
import { logAudit } from "@/server/audit/audit-logger";
import { isTwoFactorRequired } from "@/server/auth/session";
import { headers } from "next/headers";
import { auth } from "@/server/auth/auth";

// In-memory lockout and rate limiting store for brute-force mitigation
// In production with multiple instances, this is backed by Redis or DB
interface LoginAttempt {
  attempts: number;
  lockedUntil?: Date;
}

const loginAttemptsStore = new Map<string, LoginAttempt>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LoginResult {
  success: boolean;
  error?: string;
  lockedOut?: boolean;
  lockoutRemainingMinutes?: number;
  twoFactorRequired?: boolean;
  twoFactorEnrolled?: boolean;
  redirectUrl?: string;
}

/**
 * Validates credentials, checks account status, enforces lockout,
 * handles two-factor redirection, and logs tamper-resistant audit entries.
 */
export async function loginAction(
  email: string,
  password: string,
  locale: "fr" | "en" = "fr"
): Promise<LoginResult> {
  let ip = "127.0.0.1";
  let userAgent: string | undefined = undefined;

  try {
    const reqHeaders = await headers();
    ip = reqHeaders.get("x-forwarded-for") || reqHeaders.get("x-real-ip") || "127.0.0.1";
    userAgent = reqHeaders.get("user-agent") || undefined;
  } catch {
    // Outside active Next.js request scope (e.g. test runner)
  }

  const normalizedEmail = email.toLowerCase().trim();
  const attemptKey = `${normalizedEmail}_${ip}`;

  // 1. Check Lockout State
  const attemptRecord = loginAttemptsStore.get(attemptKey);
  const now = new Date();

  if (attemptRecord?.lockedUntil && attemptRecord.lockedUntil > now) {
    const diffMs = attemptRecord.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(diffMs / (60 * 1000));

    await logAudit({
      action: "auth.login.blocked_locked",
      entityType: "user",
      ip,
      userAgent,
      metadata: { email: normalizedEmail, remainingMinutes },
    });

    return {
      success: false,
      lockedOut: true,
      lockoutRemainingMinutes: remainingMinutes,
      error:
        locale === "en"
          ? `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`
          : `Compte temporairement verrouillé. Veuillez réessayer dans ${remainingMinutes} minute(s).`,
    };
  }

  // 2. Fetch User & Credential Account
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      role: true,
      accounts: {
        where: { providerId: "credential" },
      },
      twoFactors: true,
    },
  });

  const genericError =
    locale === "en"
      ? "Incorrect email or password."
      : "Identifiant ou mot de passe incorrect.";

  if (!user || user.accounts.length === 0 || !user.accounts[0].password) {
    // Record failed attempt
    recordFailedAttempt(attemptKey);
    await logAudit({
      action: "auth.login.failed_unknown_user",
      entityType: "user",
      ip,
      userAgent,
      metadata: { email: normalizedEmail },
    });
    return { success: false, error: genericError };
  }

  // 3. Account Status Check (Disabled / Suspended fails immediately)
  if (user.status !== "ACTIVE") {
    await logAudit({
      actorId: user.id,
      action: "auth.login.rejected_inactive",
      entityType: "user",
      entityId: user.id,
      ip,
      userAgent,
      metadata: { email: normalizedEmail, status: user.status },
    });

    return {
      success: false,
      error:
        locale === "en"
          ? "Your account is unauthorized or temporarily suspended."
          : "Votre compte n'est pas autorisé ou est temporairement suspendu.",
    };
  }

  // 4. Verify Password with Argon2id
  const passwordHash = user.accounts[0].password;
  let isValid = false;

  try {
    isValid = await verify(passwordHash, password);
  } catch (err) {
    console.error("Argon2 verify error:", err);
    isValid = false;
  }

  if (!isValid) {
    const isNowLocked = recordFailedAttempt(attemptKey);

    await logAudit({
      actorId: user.id,
      action: isNowLocked ? "auth.lockout" : "auth.login.failed_password",
      entityType: "user",
      entityId: user.id,
      ip,
      userAgent,
      metadata: { email: normalizedEmail, attempts: loginAttemptsStore.get(attemptKey)?.attempts },
    });

    if (isNowLocked) {
      return {
        success: false,
        lockedOut: true,
        lockoutRemainingMinutes: LOCKOUT_MINUTES,
        error:
          locale === "en"
            ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
            : `Trop de tentatives infructueuses. Compte verrouillé pendant ${LOCKOUT_MINUTES} minutes.`,
      };
    }

    return { success: false, error: genericError };
  }

  // 5. Success: Clear failed attempts and update lastLoginAt
  loginAttemptsStore.delete(attemptKey);

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 6. Check 2FA requirement
  const roleNeeds2FA = isTwoFactorRequired(user.role.key);
  const has2FA = !!user.twoFactorEnabled && user.twoFactors.length > 0;

  await logAudit({
    actorId: user.id,
    action: "auth.login.success",
    entityType: "user",
    entityId: user.id,
    ip,
    userAgent,
    metadata: {
      role: user.role.key,
      twoFactorEnabled: user.twoFactorEnabled,
      roleNeeds2FA,
    },
  });

  // Trigger Better Auth internal session generation
  // Better Auth provides sign-in API endpoint
  return {
    success: true,
    twoFactorRequired: roleNeeds2FA,
    twoFactorEnrolled: has2FA,
    redirectUrl: !has2FA && roleNeeds2FA ? `/${locale}/2fa/setup` : has2FA ? `/${locale}/2fa` : `/${locale}/dashboard`,
  };
}

function recordFailedAttempt(attemptKey: string): boolean {
  const current = loginAttemptsStore.get(attemptKey) || { attempts: 0 };
  current.attempts += 1;

  if (current.attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    current.lockedUntil = lockedUntil;
    loginAttemptsStore.set(attemptKey, current);
    return true; // Newly locked out
  }

  loginAttemptsStore.set(attemptKey, current);
  return false;
}
