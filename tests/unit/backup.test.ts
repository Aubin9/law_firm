import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  recordBackupRun,
  getBackupOverview,
  checkMissingBackupsJob,
  runRestoreTestSimulation,
} from "@/server/services/backup-service";
import { ForbiddenError } from "@/server/auth/errors";
import { BackupKind, RunStatus, IncidentStatus, IncidentSeverity } from "@prisma/client";
import fs from "fs";
import path from "path";

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

describe("Backup, Restore Verification & Disaster Recovery (STEP 20: ARCHITECTURE 9, SPECIFICATIONS 11)", () => {
  let partnerSession: AppSession;
  let tadminSession: AppSession;
  let secrSession: AppSession;

  const createdBackupRunIds: string[] = [];
  const createdIncidentIds: string[] = [];

  beforeAll(async () => {
    partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Paul NDOUMBE");
    tadminSession = makeSession("usr_tadmin_01", "TECHNICAL_ADMIN", "Administrateur Système");
    secrSession = makeSession("usr_secr_01", "SECRETARY", "Marie ATANGANA");
  });

  afterAll(async () => {
    if (createdBackupRunIds.length > 0) {
      await db.backupRun.deleteMany({
        where: { id: { in: createdBackupRunIds } },
      });
    }
    if (createdIncidentIds.length > 0) {
      await db.incident.deleteMany({
        where: { id: { in: createdIncidentIds } },
      });
    }
  });

  describe("1. Recording Backup Runs & Permissions (ARCHITECTURE.md Section 9)", () => {
    it("allows TECHNICAL_ADMIN and PARTNER to record a database backup run with audit", async () => {
      const run = await recordBackupRun(tadminSession, {
        kind: BackupKind.DATABASE,
        status: RunStatus.SUCCESS,
        sizeBytes: 15482000,
        location: "/var/backups/lawfirm/db_dump_test.dump",
        checksum: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      });

      expect(run.id).toBeDefined();
      expect(run.kind).toBe("DATABASE");
      expect(run.status).toBe("SUCCESS");
      expect(run.sizeBytes).toBe("15482000");
      createdBackupRunIds.push(run.id);

      // Verify audit log
      const audit = await db.auditLog.findFirst({
        where: {
          action: "backup.run_recorded",
          entityId: run.id,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(tadminSession.user.id);
    });

    it("forbids non-admin non-partner roles from recording backup runs", async () => {
      await expect(
        recordBackupRun(secrSession, {
          kind: BackupKind.DATABASE,
          status: RunStatus.SUCCESS,
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("2. Backup Overview & Freshness Calculation", () => {
    it("calculates backup health status and hours since last successful backup", async () => {
      const overview = await getBackupOverview(partnerSession);
      expect(overview).toBeDefined();
      expect(["HEALTHY", "WARNING", "CRITICAL"]).toContain(overview.healthStatus);
      expect(overview.recentRuns).toBeDefined();
      expect(Array.isArray(overview.recentRuns)).toBe(true);
    });

    it("refuses unauthorized roles from viewing backup overview", async () => {
      await expect(getBackupOverview(secrSession)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("3. Scheduled Monitor Job & RPO Violation Alert", () => {
    it("detects missing backups and raises alert when no DB backup exists within 24h", async () => {
      // Temporarily mark all recent database backups as older than 24h
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await db.backupRun.updateMany({
        where: {
          kind: BackupKind.DATABASE,
          status: RunStatus.SUCCESS,
        },
        data: {
          startedAt: twoDaysAgo,
        },
      });

      // Run scanner job
      const result = await checkMissingBackupsJob();
      expect(result.alertRaised).toBe(true);
      expect(result.runId).toBeDefined();
      createdBackupRunIds.push(result.runId!);

      // Verify notification created for Technical Admin
      const notification = await db.notification.findFirst({
        where: {
          userId: tadminSession.user.id,
          type: "backup.missing_alert",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(notification).not.toBeNull();

      // Verify incident consignation
      const incident = await db.incident.findFirst({
        where: {
          title: { contains: "Sauvegarde quotidienne manquante" },
          status: IncidentStatus.DETECTED,
        },
      });
      expect(incident).not.toBeNull();
      if (incident) createdIncidentIds.push(incident.id);
    });
  });

  describe("4. Restore Test Execution (REC-11, REC-15)", () => {
    it("runs a restore test simulation, measures duration in seconds, and records RESTORE_TEST run", async () => {
      const result = await runRestoreTestSimulation(partnerSession);
      expect(result.restoreSeconds).toBeGreaterThan(0);
      expect(result.verifiedRows.users).toBeGreaterThan(0);
      expect(result.run.kind).toBe("RESTORE_TEST");
      expect(result.run.status).toBe("SUCCESS");
      expect(result.run.restoreSeconds).toBe(result.restoreSeconds);
      createdBackupRunIds.push(result.run.id);

      // Verify audit log
      const audit = await db.auditLog.findFirst({
        where: {
          action: "backup.restore_test",
          entityId: result.run.id,
        },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("5. Scripts & Runbook Compliance (Step 20 Acceptance)", () => {
    it("validates ops/backup.sh exists and enforces 14-day, 8-week, 12-month retention", () => {
      const backupShPath = path.resolve(process.cwd(), "ops/backup.sh");
      expect(fs.existsSync(backupShPath)).toBe(true);
      const content = fs.readFileSync(backupShPath, "utf-8");

      expect(content).toContain("--keep-daily 14");
      expect(content).toContain("--keep-weekly 8");
      expect(content).toContain("--keep-monthly 12");
      expect(content).toContain("pg_dump");
      expect(content).toContain("-F c");
    });

    it("validates ops/restore_test.sh exists and performs data integrity checks", () => {
      const restoreShPath = path.resolve(process.cwd(), "ops/restore_test.sh");
      expect(fs.existsSync(restoreShPath)).toBe(true);
      const content = fs.readFileSync(restoreShPath, "utf-8");

      expect(content).toContain("pg_restore");
      expect(content).toContain("lawfirm_restore_test");
      expect(content).toContain("RESTORE_SECONDS");
    });

    it("validates ops/RESTORE.md exists with SLA objectives RTO < 2h and RPO < 24h", () => {
      const runbookPath = path.resolve(process.cwd(), "ops/RESTORE.md");
      expect(fs.existsSync(runbookPath)).toBe(true);
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain("RTO");
      expect(content).toContain("RPO");
      expect(content).toContain("3-2-1");
      expect(content).toContain("restic");
      expect(content).toContain("Loi camerounaise n° 2024/017");
    });
  });
});

