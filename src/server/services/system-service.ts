import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";

export interface ReportIncidentInput {
  title: string;
  severity: IncidentSeverity;
  description: string;
}

export interface ResolveIncidentInput {
  incidentId: string;
  actionsTaken: string;
}

const CANONICAL_FLAGS = [
  {
    key: "ai.enabled",
    enabled: false,
    description: "Gemini / OpenAI external AI processing (Air-gapped by default).",
  },
  {
    key: "drive.sync.enabled",
    enabled: false,
    description: "Google Drive external synchronization.",
  },
  {
    key: "storage.cloudflare.enabled",
    enabled: false,
    description: "Cloudflare R2 external cloud storage.",
  },
  {
    key: "portal.enabled",
    enabled: false,
    description: "Public client portal exposure (LAN-only by default).",
  },
];

/**
 * System and Operational Supervision Service (SPECIFICATIONS.md ADM, DESIGN.md 8.13).
 */
export async function getSystemOverview(session: AppSession) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    throw new ForbiddenError("Accès restreint aux administrateurs et associés.");
  }

  // 1. Health & Database connectivity
  const dbStart = Date.now();
  let dbHealthy = true;
  let dbLatencyMs = 0;
  let dbError: string | null = null;

  try {
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    dbHealthy = false;
    dbError = err?.message ?? "Database unreachable";
  }

  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  const health = {
    database: {
      status: dbHealthy ? ("HEALTHY" as const) : ("DEGRADED" as const),
      latencyMs: dbLatencyMs,
      error: dbError,
    },
    runtime: {
      nodeVersion: process.version,
      uptimeSeconds,
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024),
    },
    compliance: {
      mode: "LAN / VPN Self-Hosted",
      telemetry: "Disabled (NEXT_TELEMETRY_DISABLED=1)",
      regulation: "Loi Camerounaise n° 2024/017 (Protection des données à caractère personnel)",
      egressBlocked: true,
    },
  };

  // 2. Backup runs (latest 10)
  const backupRuns = await db.backupRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  // Convert BigInt sizeBytes to string for JSON serialization
  const serializedBackups = backupRuns.map((b) => ({
    ...b,
    sizeBytes: b.sizeBytes ? b.sizeBytes.toString() : null,
  }));

  // 3. Incidents register
  const incidents = await db.incident.findMany({
    orderBy: { detectedAt: "desc" },
    take: 20,
    include: {
      reportedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // 4. Feature flags (ensure canonical flags exist in database)
  let flags = await db.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  if (flags.length === 0) {
    for (const cf of CANONICAL_FLAGS) {
      await db.featureFlag.upsert({
        where: { key: cf.key },
        create: cf,
        update: {},
      });
    }
    flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  return {
    health,
    backupRuns: serializedBackups,
    incidents,
    featureFlags: flags,
  };
}

export async function reportIncident(
  session: AppSession,
  input: ReportIncidentInput,
) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    throw new ForbiddenError("Non autorisé à consigner un incident de sécurité.");
  }

  if (!input.title || input.title.trim().length < 5) {
    throw new Error("Le titre de l'incident doit contenir au moins 5 caractères.");
  }

  const incident = await db.incident.create({
    data: {
      title: input.title.trim(),
      severity: input.severity,
      description: input.description.trim(),
      reportedById: session.user.id,
      status: IncidentStatus.DETECTED,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "incident.reported",
    entityType: "incident",
    entityId: incident.id,
    metadata: {
      title: incident.title,
      severity: incident.severity,
    },
  });

  return incident;
}

export async function resolveIncident(
  session: AppSession,
  input: ResolveIncidentInput,
) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN") {
    throw new ForbiddenError("Non autorisé à clore un incident.");
  }

  const incident = await db.incident.update({
    where: { id: input.incidentId },
    data: {
      status: IncidentStatus.CLOSED,
      resolvedAt: new Date(),
      actionsTaken: input.actionsTaken.trim(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "incident.resolved",
    entityType: "incident",
    entityId: incident.id,
    metadata: {
      actionsTaken: input.actionsTaken,
    },
  });

  return incident;
}
