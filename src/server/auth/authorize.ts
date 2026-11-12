import { AppSession } from "@/server/auth/session";
import { ROLE_PERMISSIONS_MATRIX, RoleKey } from "@/server/auth/permission-matrix";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { db } from "@/server/db";

// Per-request in-memory cache of role permissions
const rolePermissionsCache = new Map<string, Set<string>>();

/**
 * Loads and caches permissions for a given role from the database
 * (falls back to static matrix if DB is unavailable).
 */
export async function getCachedRolePermissions(roleId?: string, roleKey?: RoleKey): Promise<Set<string>> {
  const cacheKey = roleId || roleKey || "unknown";
  if (rolePermissionsCache.has(cacheKey)) {
    return rolePermissionsCache.get(cacheKey)!;
  }

  try {
    const roleWithPerms = await db.role.findFirst({
      where: roleId ? { id: roleId } : roleKey ? { key: roleKey } : undefined,
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (roleWithPerms && roleWithPerms.permissions.length > 0) {
      const keys = new Set(roleWithPerms.permissions.map((rp) => rp.permission.key));
      rolePermissionsCache.set(cacheKey, keys);
      return keys;
    }
  } catch (err) {
    console.warn("Could not query DB role permissions, falling back to static matrix:", err);
  }

  // Fallback to static matrix
  const staticKeys = new Set(roleKey ? ROLE_PERMISSIONS_MATRIX[roleKey] || [] : []);
  rolePermissionsCache.set(cacheKey, staticKeys);
  return staticKeys;
}

/**
 * Clear the cache (called when roles or permissions are modified)
 */
export function clearRolePermissionsCache() {
  rolePermissionsCache.clear();
}

/**
 * Verifies if an authenticated user's role holds the required permission key.
 * Throws ForbiddenError and records an audit log if denied.
 */
export async function authorize(
  session: AppSession | null | undefined,
  requiredPermissionKey: string
): Promise<boolean> {
  if (!session || !session.user) {
    throw new ForbiddenError("Authentication required.", {
      reason: "NO_SESSION",
      requiredPermission: requiredPermissionKey,
    });
  }

  const roleKey = session.user.roleKey as RoleKey;
  const permissions = await getCachedRolePermissions(session.user.roleId, roleKey);

  if (!permissions.has(requiredPermissionKey)) {
    await logAudit({
      actorId: session.user.id,
      action: "access.permission_denied",
      entityType: "permission",
      entityId: requiredPermissionKey,
      metadata: {
        role: roleKey,
        requiredPermission: requiredPermissionKey,
      },
    });

    throw new ForbiddenError(
      `Permission denied: role ${roleKey} lacks required permission "${requiredPermissionKey}".`,
      {
        reason: "MISSING_PERMISSION",
        requiredPermission: requiredPermissionKey,
      }
    );
  }

  return true;
}

