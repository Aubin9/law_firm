import { db } from "@/server/db";

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  matterId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Append-only immutable audit logger.
 * Writes directly to the AuditLog table.
 * Never called directly from UI components, only from server actions/services.
 */
export async function logAudit(params: LogAuditParams) {
  try {
    return await db.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        matterId: params.matterId ?? undefined,
        ip: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (error) {
    // In critical security logging, do not crash the caller if DB fails,
    // but output to stderr for container logs
    console.error("[CRITICAL] Failed to write audit log entry:", error, params);
    return null;
  }
}

