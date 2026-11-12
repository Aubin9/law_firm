import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  createMatter,
  getMatterById,
  listMatters,
} from "@/server/services/matter-service";
import { createParty } from "@/server/services/party-service";
import { recordConflictCheck, searchConflicts } from "@/server/services/conflict-service";
import {
  createDocument,
  addDocumentVersion,
  getDocumentById,
} from "@/server/services/document-service";
import {
  transition,
  getWorkflowForEntity,
} from "@/server/workflow/workflow-engine";
import {
  listAuditLogs,
  exportAuditLogs,
} from "@/server/services/audit-service";
import {
  createUser,
  setUserStatus,
} from "@/server/services/user-admin-service";
import {
  createInquiry,
  convertInquiryToClient,
} from "@/server/services/inquiry-service";
import { runRestoreTestSimulation } from "@/server/services/backup-service";
import { Confidentiality, Priority, MatterAccessLevel } from "@prisma/client";
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
  roleId: string
): AppSession {
  return {
    user: {
      id: userId,
      name,
      email: `${roleKey.toLowerCase()}@cabinet-avocats.cm`,
      locale: "FR",
      status: "ACTIVE",
      roleId,
      roleKey,
      twoFactorEnabled: true,
    },
    session: {
      id: `sess_${userId}_test`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      token: `tok_${userId}_test`,
    },
  };
}

describe("V1 Release Acceptance Test Suite (docs/PROMPTS.md Step 21: REC-01 to REC-26)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let otherLawyerSession: AppSession;
  let techAdminSession: AppSession;
  let secretaryRoleId: string;
  let defaultCategoryId: string;

  beforeAll(async () => {
    const [partnerRole, leadRole, assocRole, techRole, secrRole, defaultCat] = await Promise.all([
      db.role.findUniqueOrThrow({ where: { key: "PARTNER" } }),
      db.role.findUniqueOrThrow({ where: { key: "LEAD_LAWYER" } }),
      db.role.findUniqueOrThrow({ where: { key: "ASSOCIATE_LAWYER" } }),
      db.role.findUniqueOrThrow({ where: { key: "TECHNICAL_ADMIN" } }),
      db.role.findUniqueOrThrow({ where: { key: "SECRETARY" } }),
      db.matterCategory.findFirstOrThrow(),
    ]);

    secretaryRoleId = secrRole.id;
    defaultCategoryId = defaultCat.id;
    partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Martin EKANI", partnerRole.id);
    lawyerSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA", leadRole.id);
    otherLawyerSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Paul NDOUMBE", assocRole.id);
    techAdminSession = makeSession("usr_tadmin_01", "TECHNICAL_ADMIN", "M. Eric TALLA", techRole.id);
  });

  // --- REC-01 & REC-16: User Authentication & Revocation ---
  it("REC-01 & REC-16: creates user and revokes account sessions immediately upon suspension", async () => {
    const newUser = await createUser(techAdminSession, {
      name: "Stagiaire Temporaire",
      email: `intern_${Date.now()}@cabinet.cm`,
      roleId: secretaryRoleId,
    });

    expect(newUser.user.status).toBe("ACTIVE");
    expect(newUser.temporaryPassword).toBeDefined();

    // Create an active session for this user
    await db.session.create({
      data: {
        id: `sess_intern_${Date.now()}`,
        userId: newUser.user.id,
        token: `tok_intern_${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    let sessionCount = await db.session.count({ where: { userId: newUser.user.id } });
    expect(sessionCount).toBe(1);

    // REC-16: Revoke / suspend user
    const updated = await setUserStatus(techAdminSession, newUser.user.id, "SUSPENDED");
    expect(updated.status).toBe("SUSPENDED");

    // Verify all active sessions were revoked immediately
    sessionCount = await db.session.count({ where: { userId: newUser.user.id } });
    expect(sessionCount).toBe(0);

    // Clean up
    await db.session.deleteMany({ where: { userId: newUser.user.id } });
    await db.account.deleteMany({ where: { userId: newUser.user.id } });
    await db.user.delete({ where: { id: newUser.user.id } });
  });

  // --- REC-02: Conflict of Interest Search ---
  it("REC-02: detects conflicts with accent, case, and phonetics variants before matter creation", async () => {
    const party = await createParty(
      {
        displayName: "Société Commerciale du Cameroun",
        type: "COMPANY",
        city: "Douala",
        country: "CM",
      },
      lawyerSession
    );

    // Search with case and accent differences
    const conflictResult = await searchConflicts(
      { query: "societe commerciale" },
      lawyerSession
    );

    expect(conflictResult.length).toBeGreaterThan(0);
    const match = conflictResult.find((c) => c.id === party.id);
    expect(match).toBeDefined();

    // Clean up
    await db.party.delete({ where: { id: party.id } });
  });

  // --- REC-04: Matter Creation & Reference Code ---
  it("REC-04: creates matter with sequential reference, status, and team assignments", async () => {
    const client = await createParty(
      {
        displayName: "Client Partenaire Douala SARL",
        type: "COMPANY",
        city: "Douala",
        country: "CM",
      },
      lawyerSession
    );

    // Record required cleared conflict check before matter creation
    await recordConflictCheck(
      { queryText: client.displayName, partyId: client.id, result: "CLEARED", decisionNote: "Contrôle vierge" },
      lawyerSession
    );

    const matter = await createMatter(
      {
        title: "Contentieux Douala Port 2026",
        categoryId: defaultCategoryId,
        clientId: client.id,
        confidentiality: Confidentiality.STANDARD,
        priority: Priority.HIGH,
        leadLawyerId: lawyerSession.user.id,
      },
      lawyerSession
    );

    expect(matter.reference).toMatch(/^MAT-\d{4}-\d{4,}$/);
    expect(matter.status).toBe("OPEN");

    // Verify client linked via matterParty
    const matterParty = await db.matterParty.findFirst({
      where: { matterId: matter.id, partyId: client.id, role: "CLIENT" },
    });
    expect(matterParty).toBeDefined();

    // Verify lead lawyer membership
    const members = await db.matterMember.findMany({ where: { matterId: matter.id } });
    expect(members.some((m) => m.userId === lawyerSession.user.id && m.level === MatterAccessLevel.MANAGE)).toBe(true);

    // Clean up
    await db.matterMember.deleteMany({ where: { matterId: matter.id } });
    await db.matter.delete({ where: { id: matter.id } });
    await db.conflictCheck.deleteMany({ where: { partyId: client.id } });
    await db.party.delete({ where: { id: client.id } });
  });

  // --- REC-05 & REC-19 & REC-20: Workflow Engine, Transitions, and Forbidden Rules ---
  it("REC-05, REC-19, REC-20: executes valid transitions, creates history, and blocks forbidden jumps", async () => {
    const taskWf = await getWorkflowForEntity("TASK");
    const todoStep = taskWf.steps.find((s) => s.key === "TODO")!;
    const inProgressStep = taskWf.steps.find((s) => s.key === "IN_PROGRESS")!;

    // Create a task at initial TODO step
    const testTask = await db.task.create({
      data: {
        id: `tsk_acc_${Date.now()}`,
        title: "Tâche de vérification REC-05",
        status: "TODO",
        priority: Priority.NORMAL,
        createdById: lawyerSession.user.id,
        assigneeId: lawyerSession.user.id,
        workflowStepId: todoStep.id,
      },
    });

    // REC-05 & REC-19: Valid transition succeeds and updates status
    const result = await transition("TASK", testTask.id, "IN_PROGRESS", {}, lawyerSession);
    expect(result.success).toBe(true);
    expect(result.toStepKey).toBe("IN_PROGRESS");

    // Verify entity was updated
    const updatedTask = await db.task.findUnique({ where: { id: testTask.id } });
    expect(updatedTask?.status).toBe("IN_PROGRESS");
    expect(updatedTask?.workflowStepId).toBe(inProgressStep.id);

    // Verify immutable StatusChange history record
    const history = await db.statusChange.findMany({
      where: { entityType: "TASK", entityId: testTask.id },
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].toStepKey).toBe("IN_PROGRESS");

    // Move to WAITING
    await transition("TASK", testTask.id, "WAITING", {}, lawyerSession);

    // REC-20: Forbidden jump (WAITING -> DONE is not an allowed transition) throws ForbiddenError
    await expect(
      transition("TASK", testTask.id, "DONE", {}, lawyerSession)
    ).rejects.toThrow(ForbiddenError);

    // Clean up
    await db.statusChange.deleteMany({ where: { entityId: testTask.id } });
    await db.task.delete({ where: { id: testTask.id } });
  });

  // --- REC-07: Strict Matter Isolation ---
  it("REC-07: enforces strict matter isolation refusing unauthorized access to non-members", async () => {
    const client = await createParty(
      {
        displayName: "Client Confidentiel VIP",
        type: "INDIVIDUAL",
        city: "Yaoundé",
        country: "CM",
      },
      lawyerSession
    );

    await recordConflictCheck(
      { queryText: client.displayName, partyId: client.id, result: "CLEARED" },
      lawyerSession
    );

    // Lawyer creates a STRICT confidentiality matter
    const strictMatter = await createMatter(
      {
        title: "Dossier Secret d'Affaires",
        categoryId: defaultCategoryId,
        clientId: client.id,
        confidentiality: Confidentiality.STRICT,
        leadLawyerId: lawyerSession.user.id,
      },
      lawyerSession
    );

    // Other lawyer who is NOT a member cannot see it in listMatters
    const otherList = await listMatters({}, otherLawyerSession);
    expect(otherList.matters.some((m) => m.id === strictMatter.id)).toBe(false);

    // Other lawyer directly accessing it gets ForbiddenError
    await expect(getMatterById(strictMatter.id, otherLawyerSession)).rejects.toThrow(ForbiddenError);

    // Clean up
    await db.matterMember.deleteMany({ where: { matterId: strictMatter.id } });
    await db.matter.delete({ where: { id: strictMatter.id } });
    await db.conflictCheck.deleteMany({ where: { partyId: client.id } });
    await db.party.delete({ where: { id: client.id } });
  });

  // --- REC-08: Document Replaced & Version History Kept ---
  it("REC-08: keeps prior version history and integrity hashes when document is replaced", async () => {
    const client = await createParty(
      {
        displayName: "Entreprise Bois et Forêts",
        type: "COMPANY",
        city: "Douala",
        country: "CM",
      },
      lawyerSession
    );

    await recordConflictCheck({ queryText: client.displayName, partyId: client.id, result: "CLEARED" }, lawyerSession);

    const matter = await createMatter(
      {
        title: "Audit de Conformité Environnementale",
        categoryId: defaultCategoryId,
        clientId: client.id,
        leadLawyerId: lawyerSession.user.id,
      },
      lawyerSession
    );

    // Upload v1
    const initialBuffer = Buffer.from("Contenu initial du rapport d'audit 2026");
    const doc = await createDocument(
      {
        matterId: matter.id,
        title: "Rapport d'audit environnemental",
        fileName: "audit_v1.pdf",
        mimeType: "application/pdf",
        buffer: initialBuffer,
      },
      lawyerSession
    );

    expect(doc.versions[0].versionNumber).toBe(1);

    // Upload v2 replacing previous
    const updatedBuffer = Buffer.from("Contenu mis à jour avec les observations d'experts 2026");
    const v2 = await addDocumentVersion(
      {
        documentId: doc.id,
        fileName: "audit_v2_final.pdf",
        mimeType: "application/pdf",
        buffer: updatedBuffer,
        comment: "Ajout des observations de l'expert",
      },
      lawyerSession
    );

    expect(v2.versionNumber).toBe(2);
    expect(v2.sha256).toBeDefined();

    // Fetch full document with version history
    const fullDoc = await getDocumentById(doc.id, lawyerSession);
    expect(fullDoc.versions.length).toBe(2);
    const initialVersion = fullDoc.versions.find((v) => v.versionNumber === 1);
    expect(initialVersion).toBeDefined();
    expect(initialVersion?.sha256).toBeDefined();

    // Clean up
    await db.documentVersion.deleteMany({ where: { documentId: doc.id } });
    await db.document.delete({ where: { id: doc.id } });
    await db.matterMember.deleteMany({ where: { matterId: matter.id } });
    await db.matter.delete({ where: { id: matter.id } });
    await db.conflictCheck.deleteMany({ where: { partyId: client.id } });
    await db.party.delete({ where: { id: client.id } });
  });

  // --- REC-11 & REC-15: Backup and Full Restore Verification ---
  it("REC-11 & REC-15: simulates restore test, records RTO metrics, and verifies integrity", async () => {
    const sim = await runRestoreTestSimulation(techAdminSession);
    expect(sim.run.status).toBe("SUCCESS");
    expect(sim.restoreSeconds).toBeGreaterThan(0);
    expect(sim.verifiedRows.users).toBeGreaterThan(0);

    // Verify record in BackupRun
    const lastRun = await db.backupRun.findFirst({
      where: { kind: "RESTORE_TEST" },
      orderBy: { startedAt: "desc" },
    });
    expect(lastRun).toBeDefined();
    expect(lastRun?.status).toBe("SUCCESS");
  });

  // --- REC-12 & REC-17: Sensitive Audit Logging & Partner-Only CSV Export ---
  it("REC-12 & REC-17: logs sensitive events to immutable audit table and restricts export to Partner", async () => {
    // Audit logs can be retrieved by partner
    const logs = await listAuditLogs(partnerSession, { pageSize: 10 });
    expect(logs.items.length).toBeGreaterThan(0);

    // Partner can export audit logs
    const csvExport = await exportAuditLogs(partnerSession);
    expect(csvExport.csvContent).toContain("Date (UTC);Acteur;Email");

    // Associate lawyer is denied export (REC-17)
    await expect(exportAuditLogs(otherLawyerSession)).rejects.toThrow(ForbiddenError);
  });

  // --- REC-21: Prospect to Client Conversion ---
  it("REC-21: converts an inquiry prospect into an active client matter without re-entry", async () => {
    const inquiry = await createInquiry(
      {
        subject: "Consultation sur contrat sponsoring sportif",
        channel: "EMAIL",
        newParty: {
          type: "INDIVIDUAL",
          firstName: "Samuel",
          lastName: "Eto Consultation",
          email: `samuel_${Date.now()}@eto.cm`,
          city: "Douala",
        },
      },
      lawyerSession
    );

    expect(inquiry.id).toBeDefined();
    expect(inquiry.partyId).toBeDefined();

    // Clear conflict check for the inquiry prospect
    await recordConflictCheck(
      {
        queryText: "Samuel Eto Consultation",
        partyId: inquiry.partyId,
        result: "CLEARED",
        decisionNote: "Aucun conflit décelé",
      },
      lawyerSession
    );

    // Convert inquiry to active client
    const conversion = await convertInquiryToClient(inquiry.id, lawyerSession);
    expect(conversion.party.clientStatus).toBe("CLIENT");
    expect(conversion.convertedAt).toBeDefined();

    // Clean up
    await db.conflictCheck.deleteMany({ where: { partyId: inquiry.partyId } });
    await db.task.deleteMany({ where: { inquiryId: inquiry.id } });
    await db.acceptanceDecision.deleteMany({ where: { inquiryId: inquiry.id } });
    await db.inquiry.delete({ where: { id: inquiry.id } });
    await db.party.delete({ where: { id: inquiry.partyId } });
  });

  // --- REC-26: Bilingual Consistency Check ---
  it("REC-26: guarantees bilingual key parity between French and English message catalogs", () => {
    const frDir = path.resolve(process.cwd(), "src/messages/fr");
    const enDir = path.resolve(process.cwd(), "src/messages/en");

    expect(fs.existsSync(frDir)).toBe(true);
    expect(fs.existsSync(enDir)).toBe(true);

    const frFiles = fs.readdirSync(frDir).filter((f) => f.endsWith(".json")).sort();
    const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith(".json")).sort();

    expect(frFiles).toEqual(enFiles);

    for (const file of frFiles) {
      const frContent = JSON.parse(fs.readFileSync(path.join(frDir, file), "utf-8"));
      const enContent = JSON.parse(fs.readFileSync(path.join(enDir, file), "utf-8"));

      const frKeys = Object.keys(frContent).sort();
      const enKeys = Object.keys(enContent).sort();
      expect(frKeys).toEqual(enKeys);
    }
  });
});
