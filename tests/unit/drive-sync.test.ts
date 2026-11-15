import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  checkDriveSyncPreconditions,
  grantDriveTransferApproval,
  revokeDriveTransferApproval,
  toggleDriveSyncFlag,
  executeDriveSyncJob,
  runDriveRestoreTest,
} from "@/server/services/drive-sync-service";
import { BackupKind, RunStatus, TransferProvider } from "@prisma/client";

describe("Google Drive Backup Sync (Step 25: ARCHITECTURE.md 9, CLAUDE.md 6 & 9, REC-18)", () => {
  let partnerSession: AppSession;
  let secretarySession: AppSession;
  let techAdminSession: AppSession;

  let createdApprovalId: string | null = null;

  beforeAll(async () => {
    const [partnerUser, secretaryUser, techAdminUser] = await Promise.all([
      db.user.findFirst({
        where: { role: { key: "PARTNER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "SECRETARY" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "TECHNICAL_ADMIN" }, status: "ACTIVE" },
      }),
    ]);

    if (!partnerUser || !secretaryUser || !techAdminUser) {
      throw new Error("Missing test users");
    }

    partnerSession = {
      user: {
        id: partnerUser.id,
        name: partnerUser.name,
        email: partnerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: partnerUser.roleId,
        roleKey: "PARTNER",
      },
      session: {
        id: "sess_drive_partner",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_drive_partner",
      },
    };

    secretarySession = {
      user: {
        id: secretaryUser.id,
        name: secretaryUser.name,
        email: secretaryUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: secretaryUser.roleId,
        roleKey: "SECRETARY",
      },
      session: {
        id: "sess_drive_secr",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_drive_secr",
      },
    };

    techAdminSession = {
      user: {
        id: techAdminUser.id,
        name: techAdminUser.name,
        email: techAdminUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: techAdminUser.roleId,
        roleKey: "TECHNICAL_ADMIN",
      },
      session: {
        id: "sess_drive_admin",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_drive_admin",
      },
    };

    // Reset flag to false before tests
    await db.featureFlag.upsert({
      where: { key: "drive.sync.enabled" },
      update: { enabled: false },
      create: { key: "drive.sync.enabled", enabled: false, description: "Google Drive sync" },
    });
  });

  afterAll(async () => {
    // Cleanup created test approval and runs
    if (createdApprovalId) {
      await db.externalTransferApproval.deleteMany({
        where: { id: createdApprovalId },
      });
    }
    await db.backupRun.deleteMany({
      where: {
        kind: { in: [BackupKind.OFFSITE_SYNC, BackupKind.RESTORE_TEST] },
        location: { contains: "gdrive" },
      },
    });
    await db.featureFlag.updateMany({
      where: { key: "drive.sync.enabled" },
      data: { enabled: false },
    });
  });

  describe("1. Strict Preconditions & Legal Approval Gate", () => {
    it("refuses sync when drive.sync.enabled flag is OFF", async () => {
      const preconditions = await checkDriveSyncPreconditions();
      expect(preconditions.allowed).toBe(false);
      expect(preconditions.reason).toBe("FEATURE_FLAG_DISABLED");

      await expect(executeDriveSyncJob()).rejects.toThrow(/FEATURE_FLAG_DISABLED/);
    });

    it("restricts granting ExternalTransferApproval to PARTNER only", async () => {
      // Secretary attempt must be blocked
      await expect(
        grantDriveTransferApproval(
          secretarySession,
          "Tentative non autorisée par le secrétariat"
        )
      ).rejects.toThrow(/Seul un Associé peut autoriser un transfert/);
    });

    it("allows a Partner to grant legal transfer approval under Law n° 2024/017", async () => {
      const approval = await grantDriveTransferApproval(
        partnerSession,
        "Conformité validée: chiffrement AES-256 restic en local avant tout transfert sortant."
      );

      createdApprovalId = approval.id;
      expect(approval.provider).toBe(TransferProvider.GOOGLE_DRIVE);
      expect(approval.approvedById).toBe(partnerSession.user.id);
      expect(approval.revokedAt).toBeNull();
    });

    it("allows enabling the feature flag only once an active approval exists", async () => {
      const flag = await toggleDriveSyncFlag(partnerSession, true);
      expect(flag.enabled).toBe(true);

      const preconditions = await checkDriveSyncPreconditions();
      expect(preconditions.allowed).toBe(true);
      expect(preconditions.flagEnabled).toBe(true);
      expect(preconditions.activeApproval).not.toBeNull();
    });
  });

  describe("2. Security: Encryption Enforcement (CLAUDE.md Rule 11)", () => {
    it("strictly blocks transfer if unencrypted payload is detected", async () => {
      await expect(
        executeDriveSyncJob(partnerSession, {
          isEncrypted: false,
        })
      ).rejects.toThrow(/VIOLATION DE SÉCURITÉ: Tentative d'envoi de données non chiffrées/);
    });
  });

  describe("3. REC-18: Error Handling, Visible Failure, and Retry Without Duplicates", () => {
    const testChecksum = `sha256:test_checksum_${Date.now()}`;

    it("records a failure when upload error occurs, making it visible with clear message", async () => {
      const res = await executeDriveSyncJob(partnerSession, {
        forceFailForTest: true,
        mockPayloadChecksum: testChecksum,
      });

      expect(res.status).toBe("FAILED");
      expect(res.error).toContain("503 Service Unavailable");

      // Verify in DB
      const dbRun = await db.backupRun.findUnique({
        where: { id: res.run.id },
      });
      expect(dbRun?.status).toBe(RunStatus.FAILED);
      expect(dbRun?.error).toContain("Réessayable");
    });

    it("allows retrying the failed sync successfully with the same payload", async () => {
      const res = await executeDriveSyncJob(partnerSession, {
        forceFailForTest: false,
        mockPayloadChecksum: testChecksum,
      });

      expect(res.status).toBe("SUCCESS");
      expect(res.run.status).toBe(RunStatus.SUCCESS);
      expect(res.run.location).toContain("gdrive://");
    });

    it("skips duplicate upload when the encrypted archive has already succeeded (idempotency)", async () => {
      const res = await executeDriveSyncJob(partnerSession, {
        mockPayloadChecksum: testChecksum,
      });

      expect(res.status).toBe("SKIPPED_DUPLICATE");
      expect(res.message).toContain("aucun doublon créé");
    });
  });

  describe("4. Restore Test From Google Drive", () => {
    it("measures restore duration and writes RESTORE_TEST run", async () => {
      const restoreRes = await runDriveRestoreTest(partnerSession);
      expect(restoreRes.run.kind).toBe(BackupKind.RESTORE_TEST);
      expect(restoreRes.run.status).toBe(RunStatus.SUCCESS);
      expect(restoreRes.restoreSeconds).toBeGreaterThan(0);
      expect(restoreRes.sourceLocation).toContain("gdrive://");
    });
  });

  describe("5. Emergency Revocation (Killswitch)", () => {
    it("revoking approval immediately disables the feature flag", async () => {
      if (!createdApprovalId) return;

      const revoked = await revokeDriveTransferApproval(partnerSession, createdApprovalId);
      expect(revoked.revokedAt).not.toBeNull();

      const flag = await db.featureFlag.findUnique({
        where: { key: "drive.sync.enabled" },
      });
      expect(flag?.enabled).toBe(false);

      const preconditions = await checkDriveSyncPreconditions();
      expect(preconditions.allowed).toBe(false);

      // Attempting to sync now must fail
      await expect(executeDriveSyncJob()).rejects.toThrow();
    });
  });
});

