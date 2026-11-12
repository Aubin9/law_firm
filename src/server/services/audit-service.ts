import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { ForbiddenError } from "@/server/auth/errors";

export interface ListAuditLogsFilters {
  page?: number;
  pageSize?: number;
  actorId?: string;
  matterId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Audit Service (AUD, ADM, PERMISSIONS 3.7, DESIGN 8.13).
 *
 * Append-only immutable log:
 * - NO update methods.
 * - NO delete methods.
 * - Matter audit trail requires `audit.view` and matter access.
 * - Global audit trail requires `audit.view_global`.
 *   - For TECHNICAL_ADMIN: strictly limited to system/admin events (no matter content).
 * - Audit export requires `audit.export` (PARTNER only) and is itself audited!
 */
export async function listAuditLogs(
  session: AppSession,
  filters: ListAuditLogsFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: any = {};

  // 1. Matter-scoped query
  if (filters.matterId) {
    await authorize(session, "audit.view");
    await assertMatterAccess(session, filters.matterId, "VIEW");
    where.matterId = filters.matterId;
  } else {
    // 2. Global audit query
    await authorize(session, "audit.view_global");

    // Technical admin rule (PERMISSIONS 3.7):
    // "audit.view_global": PARTNER: Y, TADMIN: Y (system events only)
    if (session.user.roleKey === "TECHNICAL_ADMIN") {
      where.OR = [
        { matterId: null },
        {
          entityType: {
            in: [
              "system",
              "user",
              "backup",
              "incident",
              "feature_flag",
              "admin_access_grant",
              "session",
            ],
          },
        },
      ];
    }
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                key: true,
                nameFr: true,
                nameEn: true,
              },
            },
          },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    items: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAuditLogDetail(session: AppSession, id: string) {
  const log = await db.auditLog.findUnique({
    where: { id },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              key: true,
              nameFr: true,
              nameEn: true,
            },
          },
        },
      },
    },
  });

  if (!log) {
    throw new ForbiddenError("Entrée d'audit introuvable.", { reason: "NOT_FOUND", entityId: id });
  }

  if (log.matterId) {
    await authorize(session, "audit.view");
    await assertMatterAccess(session, log.matterId, "VIEW");
  } else {
    await authorize(session, "audit.view_global");
    if (session.user.roleKey === "TECHNICAL_ADMIN" && log.matterId) {
      throw new ForbiddenError("Accès interdit aux événements de dossiers.", { reason: "SYSTEM_EVENTS_ONLY", entityId: id });
    }
  }

  return log;
}

/**
 * Export audit logs to CSV for Partners.
 * CRITICAL RULE: The export itself is permanently audit-logged.
 */
export async function exportAuditLogs(
  session: AppSession,
  filters: ListAuditLogsFilters = {},
) {
  await authorize(session, "audit.export");

  const where: any = {};

  if (filters.matterId) {
    await assertMatterAccess(session, filters.matterId, "VIEW");
    where.matterId = filters.matterId;
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      actor: {
        select: {
          name: true,
          email: true,
          role: {
            select: { key: true },
          },
        },
      },
    },
  });

  // Mandatory audit of the export itself
  await logAudit({
    actorId: session.user.id,
    action: "audit.export",
    entityType: "audit_log",
    metadata: {
      filters,
      rowCount: logs.length,
      exportedAt: new Date().toISOString(),
    },
  });

  // Generate CSV formatted content with escaped values
  const headers = [
    "Date (UTC)",
    "Acteur",
    "Email",
    "Rôle",
    "Action",
    "Type Entité",
    "ID Entité",
    "ID Dossier",
    "Adresse IP",
    "Métadonnées",
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = logs.map((l) => [
    escapeCsv(l.createdAt.toISOString()),
    escapeCsv(l.actor?.name ?? "Système"),
    escapeCsv(l.actor?.email ?? ""),
    escapeCsv(l.actor?.role?.key ?? ""),
    escapeCsv(l.action),
    escapeCsv(l.entityType),
    escapeCsv(l.entityId ?? ""),
    escapeCsv(l.matterId ?? ""),
    escapeCsv(l.ip ?? ""),
    escapeCsv(l.metadata ?? ""),
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

  return {
    filename: `audit-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csvContent,
    rowCount: logs.length,
  };
}
