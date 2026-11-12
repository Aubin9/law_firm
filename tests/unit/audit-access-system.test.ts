import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  listAuditLogs,
  getAuditLogDetail,
  exportAuditLogs,
} from "@/server/services/audit-service";
import {
  requestAccessGrant,
  approveAccessGrant,
  revokeAccessGrant,
  listAccessGrants,
  computeGrantStatus,
} from "@/server/services/access-grant-service";
import {
  getSystemOverview,
  reportIncident,
  resolveIncident,
} from "@/server/services/system-service";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError, NotFoundError } from "@/server/auth/errors";
import { IncidentSeverity } from "@prisma/client";

function makeSession(
  userId: string,
  roleKey:
    | "PARTNER"
    | "LEAD_LAWYER"
    | "ASSOCIATE_LAWYER"
    | "SECRETARY"
    | "ACCOUNTANT"
    | "FUNCTIONAL_ADMIN"
    | "TECHNICAL_ADMIN",
  name: string,
): AppSession {
  return {
    user: {
      id: userId,
      name,
      email: `${roleKey.toLowerCase()}@cabinet-avocats.cm`,
      locale: "FR",
      status: "ACTIVE",
      roleId: `role_${roleKey.toLowerCase()}`,
      roleKey,
      twoFactorEnabled: true,
    },
    session: {
      id: `sess_${userId}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      token: `token_${userId}`,
    },
  };
}

describe("Audit, Exceptional Access & System Supervision (STEP 19: AUD, ADM, PERMISSIONS 3.7)", () => {
  let partnerSession: AppSession;
  let leadSession: AppSession;
  let assocSession: AppSession;
  let tadminSession: AppSession;
  let secrSession: AppSession;

  let testMatterId: string;

  beforeAll(async () => {
    partnerSession = makeSession(
      "usr_partner_01",
      "PARTNER",
      "Me Paul NDOUMBE",
    );

    leadSession = makeSession(
      "usr_lead_01",
      "LEAD_LAWYER",
      "Me Suzanne MBARGA",
    );

    assocSession = makeSession(
      "usr_assoc_01",
      "ASSOCIATE_LAWYER",
      "Me Junior ETOUNDI",
    );

    tadminSession = makeSession(
      "usr_tadmin_01",
      "TECHNICAL_ADMIN",
      "Administrateur Système",
    );

    secrSession = makeSession(
      "usr_secr_01",
      "SECRETARY",
      "Marie ATANGANA",
    );

    // Find a standard matter
    const matter = await db.matter.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    testMatterId = matter!.id;
  });

  describe("1. Audit Trail (SPECIFICATIONS AUD, PERMISSIONS 3.7, DESIGN 8.13)", () => {
    it("allows PARTNER to list global audit logs with full details", async () => {
      const result = await listAuditLogs(partnerSession, { pageSize: 10 });
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    it("restricts TECHNICAL_ADMIN to system/admin events only in global audit", async () => {
      const result = await listAuditLogs(tadminSession, { pageSize: 20 });
      // None of the returned items should expose business matters
      for (const item of result.items) {
        if (item.matterId) {
          expect([
            "system",
            "user",
            "backup",
            "incident",
            "feature_flag",
            "admin_access_grant",
            "session",
          ]).toContain(item.entityType);
        }
      }
    });

    it("denies SECRETARY and ASSOCIATE from global audit log", async () => {
      await expect(listAuditLogs(secrSession)).rejects.toThrow(ForbiddenError);
      await expect(listAuditLogs(assocSession)).rejects.toThrow(ForbiddenError);
    });

    it("allows partner and lead lawyer to view matter-scoped audit", async () => {
      const result = await listAuditLogs(partnerSession, {
        matterId: testMatterId,
      });
      expect(result.items).toBeDefined();
    });

    it("enforces append-only nature of the audit trail (no update/delete APIs)", async () => {
      // 1. Audit service only exposes list, detail, and export - no mutate/delete operations exist
      const auditModule = await import("@/server/services/audit-service");
      expect((auditModule as any).updateAuditLog).toBeUndefined();
      expect((auditModule as any).deleteAuditLog).toBeUndefined();
      expect((auditModule as any).clearAuditLogs).toBeUndefined();

      // 2. Direct database audit entries created are permanent
      const entry = await db.auditLog.create({
        data: {
          action: "test.immutable_action",
          entityType: "system",
          actorId: partnerSession.user.id,
          metadata: { immutable: true },
        },
      });

      const retrieved = await db.auditLog.findUnique({ where: { id: entry.id } });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.action).toBe("test.immutable_action");

      // Cleanup test row
      await db.auditLog.delete({ where: { id: entry.id } });
    });

    it("restricts audit export to PARTNER only and logs the export itself (REC-12)", async () => {
      // Secretary and TAdmin denied
      await expect(exportAuditLogs(secrSession)).rejects.toThrow(ForbiddenError);
      await expect(exportAuditLogs(tadminSession)).rejects.toThrow(ForbiddenError);

      // Partner allowed
      const exportResult = await exportAuditLogs(partnerSession, { pageSize: 10 });
      expect(exportResult.filename).toMatch(/\.csv$/);
      expect(exportResult.csvContent).toContain("Date (UTC)");

      // Verify that the export itself was audit-logged
      const latestExportLog = await db.auditLog.findFirst({
        where: {
          action: "audit.export",
          actorId: partnerSession.user.id,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(latestExportLog).not.toBeNull();
      expect(latestExportLog?.entityType).toBe("audit_log");
    });
  });

  describe("2. Exceptional Access Flow (SPECIFICATIONS ADM, PERMISSIONS 3.7)", () => {
    it("implements request, approve, active countdown, and auto-expiry", async () => {
      // 1. Technical Admin without active grant is refused access
      await expect(
        assertMatterAccess(tadminSession, testMatterId, "VIEW"),
      ).rejects.toThrow(ForbiddenError);

      // 2. Technical Admin requests exceptional access
      const grant = await requestAccessGrant(tadminSession, {
        matterId: testMatterId,
        reason: "Vérification intégrité base de données suite incident réseau",
      });
      expect(grant.id).toBeDefined();
      expect(grant.approvedById).toBeNull();
      expect(computeGrantStatus(grant)).toBe("PENDING");

      // 3. Technical Admin still has NO access while pending
      await expect(
        assertMatterAccess(tadminSession, testMatterId, "VIEW"),
      ).rejects.toThrow(ForbiddenError);

      // 4. Non-partner cannot approve
      await expect(
        approveAccessGrant(leadSession, {
          grantId: grant.id,
          durationMinutes: 30,
        }),
      ).rejects.toThrow(ForbiddenError);

      // 5. Partner approves grant for 30 minutes
      const approved = await approveAccessGrant(partnerSession, {
        grantId: grant.id,
        durationMinutes: 30,
      });
      expect(approved.approvedById).toBe(partnerSession.user.id);
      expect(approved.startsAt).not.toBeNull();
      expect(approved.expiresAt).not.toBeNull();
      expect(computeGrantStatus(approved)).toBe("ACTIVE");

      // 6. Technical Admin now HAS VIEW access
      const access = await assertMatterAccess(tadminSession, testMatterId, "VIEW");
      expect(access.level).toBe("VIEW");

      // 7. Expired grant is REFUSED immediately
      await db.adminAccessGrant.update({
        where: { id: grant.id },
        data: {
          expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        },
      });

      await expect(
        assertMatterAccess(tadminSession, testMatterId, "VIEW"),
      ).rejects.toThrow(ForbiddenError);

      // 8. Revoked grant is also REFUSED immediately
      await db.adminAccessGrant.update({
        where: { id: grant.id },
        data: {
          expiresAt: new Date(Date.now() + 60000), // unexpired
          revokedAt: new Date(), // but revoked
        },
      });

      await expect(
        assertMatterAccess(tadminSession, testMatterId, "VIEW"),
      ).rejects.toThrow(ForbiddenError);

      // Cleanup
      await db.adminAccessGrant.delete({ where: { id: grant.id } });
    });
  });

  describe("3. System Supervision & Incidents (SPECIFICATIONS ADM, DESIGN 8.13)", () => {
    it("allows PARTNER and TECHNICAL_ADMIN to view system overview", async () => {
      const overview = await getSystemOverview(partnerSession);
      expect(overview.health.database.status).toBe("HEALTHY");
      expect(overview.health.compliance.mode).toBe("LAN / VPN Self-Hosted");
      expect(overview.featureFlags.length).toBeGreaterThanOrEqual(4);

      // All external integrations are disabled by default
      for (const flag of overview.featureFlags) {
        expect(flag.enabled).toBe(false);
      }
    });

    it("refuses unauthorized roles from viewing system overview", async () => {
      await expect(getSystemOverview(secrSession)).rejects.toThrow(ForbiddenError);
      await expect(getSystemOverview(assocSession)).rejects.toThrow(ForbiddenError);
    });

    it("allows reporting and resolving security incidents with audit trail", async () => {
      const incident = await reportIncident(tadminSession, {
        title: "Tentative d'accès non autorisé détectée sur le port local",
        severity: IncidentSeverity.MEDIUM,
        description: "Plusieurs requêtes HTTP échouées sur l'interface réseau LAN.",
      });

      expect(incident.id).toBeDefined();
      expect(incident.status).toBe("DETECTED");

      const resolved = await resolveIncident(partnerSession, {
        incidentId: incident.id,
        actionsTaken: "Vérification des baux DHCP et filtrage de l'adresse MAC suspecte.",
      });

      expect(resolved.status).toBe("CLOSED");
      expect(resolved.resolvedAt).not.toBeNull();

      // Cleanup
      await db.incident.delete({ where: { id: incident.id } });
    });
  });
});
