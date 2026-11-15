import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  validateMatterClosureReadiness,
  requestMatterClosure,
  approveMatterClosure,
} from "@/server/services/matter-closure-service";
import {
  placeDestructionHold,
  releaseDestructionHold,
  requestDestruction,
  decideDestruction,
  executeDestruction,
} from "@/server/services/retention-service";
import {
  createCommunication,
  listCommunicationsForMatter,
} from "@/server/services/communication-service";
import { getLawyerWorkloadOverview } from "@/server/services/workload-service";

describe("Advanced Legal Management (V2: LEG-01 to LEG-10, BR-14, BR-15)", () => {
  let partnerSession: AppSession;
  let associateSession: AppSession;
  let testMatterId: string;
  let testDocId: string;
  let testPartyId: string;

  beforeAll(async () => {
    // 1. Fetch test users
    const partnerUser = await db.user.findFirst({
      where: { role: { key: "PARTNER" }, status: "ACTIVE" },
      include: { role: true },
    });
    const associateUser = await db.user.findFirst({
      where: { role: { key: "ASSOCIATE_LAWYER" }, status: "ACTIVE" },
      include: { role: true },
    });

    if (!partnerUser || !associateUser) {
      throw new Error("Seeded users missing for V2 testing");
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
        id: "sess_test_v2_p",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_test_v2_p",
      },
    };

    associateSession = {
      user: {
        id: associateUser.id,
        name: associateUser.name,
        email: associateUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: associateUser.roleId,
        roleKey: "ASSOCIATE_LAWYER",
      },
      session: {
        id: "sess_test_v2_a",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_test_v2_a",
      },
    };

    // 2. Create test party & category
    const category = await db.matterCategory.findFirst();
    if (!category) throw new Error("No category found for test");
    const party = await db.party.create({
      data: {
        displayName: "Client Test V2 S.A.",
        type: "COMPANY",
        clientStatus: "CLIENT",
      },
    });
    testPartyId = party.id;

    // 3. Create test matter
    const matter = await db.matter.create({
      data: {
        reference: `MAT-V2-${Date.now()}`,
        title: "Dossier Contentieux Pilote V2",
        categoryId: category.id,
        leadLawyerId: partnerUser.id,
        createdById: partnerUser.id,
        confidentiality: "STANDARD",
        status: "OPEN",
        parties: {
          create: {
            partyId: party.id,
            role: "CLIENT",
          },
        },
        members: {
          create: {
            userId: associateUser.id,
            level: "EDIT",
          },
        },
      },
    });
    testMatterId = matter.id;

    // 4. Create test document
    const doc = await db.document.create({
      data: {
        matterId: matter.id,
        title: "Conclusions Récapitulatives V2.pdf",
        confidentiality: "STANDARD",
      },
    });
    testDocId = doc.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.destructionRequest.deleteMany({ where: { matterId: testMatterId } });
    await db.destructionHold.deleteMany({ where: { matterId: testMatterId } });
    await db.communication.deleteMany({ where: { matterId: testMatterId } });
    await db.task.deleteMany({ where: { matterId: testMatterId } });
    await db.document.deleteMany({ where: { matterId: testMatterId } });
    await db.matterParty.deleteMany({ where: { matterId: testMatterId } });
    await db.matterMember.deleteMany({ where: { matterId: testMatterId } });
    await db.matter.deleteMany({ where: { id: testMatterId } });
    await db.party.deleteMany({ where: { id: testPartyId } });
  });

  describe("1. Matter Closure Checklist & BR-14 Governance", () => {
    it("flags matter as not ready for closure when pending tasks exist (BR-14)", async () => {
      // Add an uncompleted task
      const task = await db.task.create({
        data: {
          matterId: testMatterId,
          title: "Signifier assignation par Huissier",
          status: "TODO",
          createdById: partnerSession.user.id,
        },
      });

      const readiness = await validateMatterClosureReadiness(testMatterId, partnerSession);
      expect(readiness.isReady).toBe(false);
      expect(readiness.checklist.tasksCompleted).toBe(false);
      expect(readiness.checklist.pendingTasksCount).toBeGreaterThan(0);
      expect(readiness.blockingReasons.some((r) => r.includes("tâche(s)"))).toBe(true);

      // Clean up task for next test
      await db.task.delete({ where: { id: task.id } });
    });

    it("requires a recorded closure reason when requesting closure (BR-14)", async () => {
      await expect(
        requestMatterClosure(testMatterId, "   ", partnerSession)
      ).rejects.toThrow("Un motif de clôture est obligatoire");

      const updated = await requestMatterClosure(
        testMatterId,
        "Transaction amiable signée et exécutée par les parties",
        partnerSession
      );

      expect(updated.closureReason).toBe(
        "Transaction amiable signée et exécutée par les parties"
      );
      expect(updated.closureRequestedById).toBe(partnerSession.user.id);
      expect(updated.closureRequestedAt).toBeDefined();
    });

    it("enforces Partner role and records approver when approving closure (BR-14)", async () => {
      // Non-partner cannot approve closure
      await expect(
        approveMatterClosure(testMatterId, false, associateSession)
      ).rejects.toThrow();

      // Partner approves closure
      const closed = await approveMatterClosure(testMatterId, false, partnerSession);
      expect(closed.status).toBe("CLOSED");
      expect(closed.closureApprovedById).toBe(partnerSession.user.id);
      expect(closed.closureApprovedAt).toBeDefined();
      expect(closed.closedAt).toBeDefined();
    });
  });

  describe("2. Retention, Legal Holds & Destruction Protection (BR-15)", () => {
    let holdId: string;

    it("places an active destruction hold on a matter (BR-15)", async () => {
      const hold = await placeDestructionHold(
        {
          matterId: testMatterId,
          reason: "Enquête judiciaire et litige fiscal en cours (BR-15)",
        },
        partnerSession
      );

      expect(hold.id).toBeDefined();
      expect(hold.releasedAt).toBeNull();
      holdId = hold.id;
    });

    it("strictly blocks destruction requests while a destruction hold is active (BR-15)", async () => {
      await expect(
        requestDestruction(
          {
            matterId: testMatterId,
            reason: "Délai de rétention légal atteint",
          },
          partnerSession
        )
      ).rejects.toThrow(/gel conservatoire.*Destruction Hold.*actif/i);
    });

    it("allows destruction request and partner decision only after hold is released (BR-15)", async () => {
      // 1. Release hold
      const released = await releaseDestructionHold(holdId, partnerSession);
      expect(released.releasedAt).toBeDefined();

      // 2. Request destruction now succeeds
      const req = await requestDestruction(
        {
          matterId: testMatterId,
          reason: "Purge d'archives validée",
        },
        partnerSession
      );
      expect(req.status).toBe("REQUESTED");

      // 3. Partner approves destruction
      const decided = await decideDestruction(req.id, "APPROVED", partnerSession);
      expect(decided.status).toBe("APPROVED");
      expect(decided.approvedById).toBe(partnerSession.user.id);
    });
  });

  describe("3. Communications History per Matter (LEG-09 / MOD-12)", () => {
    it("logs official communications linked to matter and party", async () => {
      const comm = await createCommunication(
        {
          matterId: testMatterId,
          partyId: testPartyId,
          channel: "EMAIL",
          direction: "OUTBOUND",
          subject: "Transmission projet de protocole d'accord transactionnel",
          body: "Maître, veuillez trouver ci-joint pour examen le projet de protocole d'accord.",
        },
        partnerSession
      );

      expect(comm.id).toBeDefined();
      expect(comm.channel).toBe("EMAIL");
      expect(comm.direction).toBe("OUTBOUND");
      expect(comm.authorId).toBe(partnerSession.user.id);

      const list = await listCommunicationsForMatter(testMatterId, partnerSession);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]?.subject).toContain("protocole d'accord");
    });
  });

  describe("4. Lawyer Workload & Capacity Overview (LEG-10 / MOD-16)", () => {
    it("computes operational workload statistics across lawyers", async () => {
      const workload = await getLawyerWorkloadOverview(partnerSession);
      expect(Array.isArray(workload)).toBe(true);
      expect(workload.length).toBeGreaterThan(0);

      const partnerStats = workload.find((w) => w.userId === partnerSession.user.id);
      expect(partnerStats).toBeDefined();
      expect(partnerStats?.score).toBeGreaterThanOrEqual(0);
      expect(["LOW", "NORMAL", "HIGH", "OVERLOADED"]).toContain(partnerStats?.capacityLevel);
    });
  });
});
