import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { globalSearch } from "@/server/services/search-service";
import { getDashboardData } from "@/server/services/dashboard-service";
import { createMatter } from "@/server/services/matter-service";
import { createParty } from "@/server/services/party-service";
import { recordConflictCheck } from "@/server/services/conflict-service";
import { createEvent } from "@/server/services/event-service";
import { createTask } from "@/server/services/task-service";
import { EventType } from "@prisma/client";

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
  name: string
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

describe("Global Search & Landing Dashboard Specification (STEP 18: ARCHITECTURE 12, DESIGN 5 & 8.2)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Paul NDOUMBE");

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdTaskIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "CAT-SEARCH-TEST",
          nameFr: "Contentieux & Arbitrage",
          nameEn: "Litigation & Arbitration",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
    if (createdTaskIds.length > 0) {
      await db.taskChecklistItem.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await db.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
      createdTaskIds.length = 0;
    }

    if (createdEventIds.length > 0) {
      await db.eventAttendee.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await db.eventReminder.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await db.event.deleteMany({
        where: { id: { in: createdEventIds } },
      });
      createdEventIds.length = 0;
    }

    if (createdMatterIds.length > 0) {
      await db.matterMember.deleteMany({
        where: { matterId: { in: createdMatterIds } },
      });
      await db.matterParty.deleteMany({
        where: { matterId: { in: createdMatterIds } },
      });
      await db.auditLog.deleteMany({
        where: { entityId: { in: createdMatterIds } },
      });
      await db.matter.deleteMany({
        where: { id: { in: createdMatterIds } },
      });
      createdMatterIds.length = 0;
    }

    if (createdCheckIds.length > 0) {
      await db.conflictCheck.deleteMany({
        where: { id: { in: createdCheckIds } },
      });
      createdCheckIds.length = 0;
    }

    if (createdPartyIds.length > 0) {
      await db.party.deleteMany({
        where: { id: { in: createdPartyIds } },
      });
      createdPartyIds.length = 0;
    }
  });

  async function createClearedMatter(
    title: string,
    confidentiality: "STANDARD" | "STRICT" = "STANDARD",
    includeAssociate = true
  ) {
    const party = await createParty(
      {
        displayName: `Client Pour ${title}`,
        type: "COMPANY",
        companyName: `Client Pour ${title}`,
        clientStatus: "CLIENT",
      },
      partnerSession
    );
    createdPartyIds.push(party.id);

    const check = await recordConflictCheck(
      {
        partyId: party.id,
        queryText: party.displayName,
        result: "CLEARED",
        decisionNote: "Clearance",
      },
      partnerSession
    );
    createdCheckIds.push(check.id);

    const matter = await createMatter(
      {
        clientId: party.id,
        title,
        categoryId: defaultCategoryId,
        leadLawyerId: leadSession.user.id,
        confidentiality,
        additionalMemberUserIds: includeAssociate
          ? [
              { userId: associateSession.user.id, level: "EDIT" },
              { userId: partnerSession.user.id, level: "EDIT" },
            ]
          : [{ userId: partnerSession.user.id, level: "EDIT" }],
      },
      leadSession
    );
    createdMatterIds.push(matter.id);
    return matter;
  }

  describe("1. Global Command Search (ARCHITECTURE 12, DESIGN 5)", () => {
    it("searches across matters, parties and tasks simultaneously", async () => {
      const matter = await createClearedMatter("Dossier Recouvrement SABC");

      const task = await createTask(
        {
          matterId: matter.id,
          title: "Rédaction des conclusions au fond pour SABC",
          priority: "HIGH",
          assigneeId: associateSession.user.id,
        },
        leadSession
      );
      createdTaskIds.push(task.id);

      // Search query "SABC"
      const results = await globalSearch("SABC", leadSession);

      expect(results.matters.some((m) => m.id === matter.id)).toBe(true);
      expect(results.parties.some((p) => p.displayName.includes("SABC"))).toBe(true);
      expect(results.tasks.some((t) => t.id === task.id)).toBe(true);
    });

    it("strictly excludes hidden/STRICT matters and their tasks from search for non-members (NF-02)", async () => {
      // Create a STRICT matter without associate lawyer
      const strictMatter = await createClearedMatter(
        "Secret Industriel Confidentiel",
        "STRICT",
        false // Do not include associate
      );

      const secretTask = await createTask(
        {
          matterId: strictMatter.id,
          title: "Audit confidentiel brevets et licences",
          assigneeId: leadSession.user.id,
        },
        leadSession
      );
      createdTaskIds.push(secretTask.id);

      // Lead Lawyer can find both matter and task
      const leadResults = await globalSearch("Brevets", leadSession);
      expect(leadResults.tasks.some((t) => t.id === secretTask.id)).toBe(true);

      // Associate Lawyer (not member of STRICT matter) MUST NOT find the task or matter
      const associateResults = await globalSearch("Brevets", associateSession);
      expect(associateResults.tasks.some((t) => t.id === secretTask.id)).toBe(false);

      const associateMatterResults = await globalSearch("Secret Industriel", associateSession);
      expect(associateMatterResults.matters.some((m) => m.id === strictMatter.id)).toBe(false);
    });

    it("supports case-insensitive and partial match queries", async () => {
      const matter = await createClearedMatter("Arbitrage International OHADA");

      // Searching lowercase "ohada"
      const resultsLower = await globalSearch("ohada", leadSession);
      expect(resultsLower.matters.some((m) => m.id === matter.id)).toBe(true);

      // Searching uppercase "OHADA"
      const resultsUpper = await globalSearch("OHADA", leadSession);
      expect(resultsUpper.matters.some((m) => m.id === matter.id)).toBe(true);
    });
  });

  describe("2. Role-Tailored Landing Dashboard (DESIGN.md 8.2)", () => {
    it("computes accurate attention strip counters and role data", async () => {
      const matter = await createClearedMatter("Dossier Dashboard Test");

      // Create an overdue task
      const overdueTask = await createTask(
        {
          matterId: matter.id,
          title: "Diligence urgente en retard",
          priority: "URGENT",
          assigneeId: associateSession.user.id,
          dueAt: new Date(Date.now() - 48 * 3600 * 1000), // 2 days ago
        },
        leadSession
      );
      createdTaskIds.push(overdueTask.id);

      // Create an unvalidated procedural deadline
      const deadline = await createEvent(
        {
          matterId: matter.id,
          type: EventType.PROCEDURAL_DEADLINE,
          title: "Délai de signification d'acte",
          startsAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), // in 3 days
          source: "Art. 6 AUPVE",
        },
        leadSession
      );
      createdEventIds.push(deadline.id);

      // Fetch dashboard data for Lead Lawyer
      const dashData = await getDashboardData(leadSession);

      expect(dashData.user.name).toBe(leadSession.user.name);
      expect(dashData.attention.overdueTasksCount).toBeGreaterThanOrEqual(1);
      expect(dashData.attention.itemsToValidateCount).toBeGreaterThanOrEqual(1);
      expect(dashData.attention.deadlinesNext7DaysCount).toBeGreaterThanOrEqual(1);

      // Partner dashboard includes firm metrics
      const partnerData = await getDashboardData(partnerSession);
      expect(partnerData.roleData.firmMetrics).toBeDefined();
      expect(partnerData.roleData.firmMetrics?.activeMattersCount).toBeGreaterThanOrEqual(0);
    });
  });
});

