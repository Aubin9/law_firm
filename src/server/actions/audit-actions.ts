"use server";

import { getServerSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  listAuditLogs,
  getAuditLogDetail,
  exportAuditLogs,
  ListAuditLogsFilters,
} from "@/server/services/audit-service";

export async function listAuditLogsAction(filters: ListAuditLogsFilters = {}) {
  const session = await getServerSession();
  if (!session) {
    throw new ForbiddenError("Authentification requise.");
  }
  return await listAuditLogs(session, filters);
}

export async function getAuditLogDetailAction(id: string) {
  const session = await getServerSession();
  if (!session) {
    throw new ForbiddenError("Authentification requise.");
  }
  return await getAuditLogDetail(session, id);
}

export async function exportAuditLogsAction(filters: ListAuditLogsFilters = {}) {
  const session = await getServerSession();
  if (!session) {
    throw new ForbiddenError("Authentification requise.");
  }
  return await exportAuditLogs(session, filters);
}

