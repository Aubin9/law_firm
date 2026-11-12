import { auth } from "@/server/auth/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/lib/env";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  locale: "FR" | "EN";
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  roleId: string;
  roleKey: string;
  twoFactorEnabled?: boolean;
}

export interface AppSession {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

/**
 * Checks whether a given role key requires two-factor authentication.
 */
export function isTwoFactorRequired(roleKey: string): boolean {
  const requiredRoles = (env.TWO_FACTOR_REQUIRED_ROLES || "")
    .split(",")
    .map((r) => r.trim());
  return requiredRoles.includes(roleKey);
}

/**
 * Retrieves and validates the current session from incoming request headers.
 * Rule: A disabled or suspended user fails immediately on the next request.
 */
export async function getServerSession(): Promise<AppSession | null> {
  const headersList = await headers();
  const rawSession = await auth.api.getSession({
    headers: headersList,
  });

  if (!rawSession || !rawSession.user) {
    return null;
  }

  // Load fresh user data with role from DB to guarantee live status check
  const dbUser = await db.user.findUnique({
    where: { id: rawSession.user.id },
    include: {
      role: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  // A disabled or suspended user fails immediately on the next request
  if (dbUser.status !== "ACTIVE") {
    return null;
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      locale: dbUser.locale as "FR" | "EN",
      status: dbUser.status as "ACTIVE" | "SUSPENDED" | "DISABLED",
      roleId: dbUser.roleId,
      roleKey: dbUser.role.key,
      twoFactorEnabled: !!dbUser.twoFactorEnabled,
    },
    session: {
      id: rawSession.session.id,
      expiresAt: new Date(rawSession.session.expiresAt),
      token: rawSession.session.token,
      ipAddress: rawSession.session.ipAddress,
      userAgent: rawSession.session.userAgent,
    },
  };
}

