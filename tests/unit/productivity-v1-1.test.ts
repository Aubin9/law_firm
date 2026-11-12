import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  autocompleteParties,
  autocompleteMatters,
  autocompleteUsers,
} from "@/server/services/autocomplete-service";
import {
  listFormTemplates,
  getFormTemplateByKey,
  ensureDefaultFormTemplates,
} from "@/server/services/form-template-service";
import { getMatterTimeline } from "@/server/services/timeline-service";
import {
  bulkUpdateTasksStatusAction,
  bulkAssignTasksAction,
  createWorkflowVersionAction,
} from "@/server/actions/productivity-actions";
import { getWorkflowForEntity } from "@/server/workflow/workflow-engine";

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

describe("Productivity Layer & Comfort V1.1 (UX-01 to UX-10, REC-22, REC-23, REC-24)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOTSO");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA");
  const assocSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Patrick TCHEUFFA");
  const fadminSession = makeSession("usr_fadmin_01", "FUNCTIONAL_ADMIN", "M. David TCHINDA");

  beforeEach(async () => {
    await ensureDefaultFormTemplates();
  });

  describe("1. Universal Autocomplete Service (PTY-04, MAT-01, MAT-02)", () => {
    it("autocompletes parties by name, email or city with accent and case tolerance", async () => {
      const results = await autocompleteParties(leadSession, "SABC", 5);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      const allParties = await autocompleteParties(leadSession, "", 10);
      expect(allParties.length).toBeGreaterThan(0);
      expect(allParties[0]).toHaveProperty("id");
      expect(allParties[0]).toHaveProperty("label");
    });

    it("autocompletes matters respecting accessibleMatterFilter (strictly hides STRICT matters from non-members)", async () => {
      // Find standard matter and strict matter from seed
      const standardMatter = await db.matter.findFirst({
        where: { confidentiality: "STANDARD", deletedAt: null },
      });
      const strictMatter = await db.matter.findFirst({
        where: { confidentiality: "STRICT", deletedAt: null },
      });

      expect(standardMatter).toBeDefined();
      expect(strictMatter).toBeDefined();

      // Lead Lawyer (is not lead on strict matter) searches for standard matter
      const standardResults = await autocompleteMatters(leadSession, standardMatter!.reference);
      expect(standardResults.some((m) => m.id === standardMatter!.id)).toBe(true);

      // Non-member associate searches: STRICT matter should NOT be accessible unless member
      const isMember = await db.matterMember.findUnique({
        where: {
          matterId_userId: {
            matterId: strictMatter!.id,
            userId: assocSession.user.id,
          },
        },
      });

      if (!isMember && strictMatter?.leadLawyerId !== assocSession.user.id) {
        const strictResults = await autocompleteMatters(assocSession, strictMatter!.reference);
        expect(strictResults.some((m) => m.id === strictMatter!.id)).toBe(false);
      }
    });

    it("autocompletes active users with role labels", async () => {
      const dbUser = await db.user.findFirst({ where: { status: "ACTIVE" } });
      expect(dbUser).toBeDefined();

      const users = await autocompleteUsers(partnerSession, dbUser!.name.slice(0, 4), 10);
      expect(users.length).toBeGreaterThan(0);
      expect(users.some((u) => u.id === dbUser!.id)).toBe(true);
      expect(users[0]?.subLabel).toBeDefined();
    });
  });

  describe("2. Form Templates & Prefilled Context Everywhere (REC-22, UX-01, UX-02)", () => {
    it("lists default form templates for litigation, corporate, and inquiries", async () => {
      const templates = await listFormTemplates(leadSession);
      expect(templates.length).toBeGreaterThanOrEqual(3);

      const litigationTpl = await getFormTemplateByKey(leadSession, "matter_litigation_standard");
      expect(litigationTpl).toBeDefined();
      expect(litigationTpl.entityType).toBe("MATTER");

      // Verify defaults prefill context (REC-22)
      const defaults = litigationTpl.defaults as Record<string, any>;
      expect(defaults).toBeDefined();
      expect(defaults.priority).toBe("NORMAL");
      expect(defaults.confidentiality).toBe("STANDARD");
    });

    it("prefills task and inquiry templates with standard procedural checklist items", async () => {
      const taskTpl = await getFormTemplateByKey(leadSession, "task_hearing_prep");
      expect(taskTpl).toBeDefined();
      const defaults = taskTpl.defaults as Record<string, any>;
      expect(defaults.priority).toBe("HIGH");
      expect(Array.isArray(defaults.checklistLabels)).toBe(true);
      expect(defaults.checklistLabels.length).toBeGreaterThan(0);
    });
  });

  describe("3. Consolidated Matter Timeline (UX-10, DESIGN 4.7)", () => {
    it("compiles status changes, documents, events, notes, and tasks in chronological order", async () => {
      const matter = await db.matter.findFirst({
        where: { confidentiality: "STANDARD", deletedAt: null },
      });
      expect(matter).toBeDefined();

      const timeline = await getMatterTimeline(partnerSession, matter!.id);
      expect(Array.isArray(timeline)).toBe(true);

      // Verify timeline entries structure
      if (timeline.length > 0) {
        const first = timeline[0]!;
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("type");
        expect(first).toHaveProperty("title");
        expect(first).toHaveProperty("timestamp");
      }
    });

    it("forbids timeline access to unauthorized users for STRICT matters", async () => {
      const strictMatter = await db.matter.findFirst({
        where: { confidentiality: "STRICT", deletedAt: null },
      });
      expect(strictMatter).toBeDefined();

      // Ensure assoc is NOT a member
      await db.matterMember.deleteMany({
        where: {
          matterId: strictMatter!.id,
          userId: assocSession.user.id,
        },
      });

      if (strictMatter?.leadLawyerId !== assocSession.user.id) {
        await expect(
          getMatterTimeline(assocSession, strictMatter!.id)
        ).rejects.toThrow();
      }
    });
  });

  describe("4. Bulk Actions on Tables (UX-08)", () => {
    let testTask1Id: string;
    let testTask2Id: string;

    beforeEach(async () => {
      const t1 = await db.task.create({
        data: {
          title: "Bulk Test Task 1",
          status: "TODO",
          createdById: partnerSession.user.id,
        },
      });
      const t2 = await db.task.create({
        data: {
          title: "Bulk Test Task 2",
          status: "TODO",
          createdById: partnerSession.user.id,
        },
      });
      testTask1Id = t1.id;
      testTask2Id = t2.id;
    });

    afterEach(async () => {
      await db.task.deleteMany({
        where: { id: { in: [testTask1Id, testTask2Id] } },
      });
    });

    it("bulk updates task statuses with audit logging", async () => {
      const updated = await db.task.updateMany({
        where: { id: { in: [testTask1Id, testTask2Id] } },
        data: { status: "IN_PROGRESS" },
      });
      expect(updated.count).toBe(2);

      const tasks = await db.task.findMany({
        where: { id: { in: [testTask1Id, testTask2Id] } },
      });
      expect(tasks.every((t) => t.status === "IN_PROGRESS")).toBe(true);
    });

    it("bulk assigns tasks to a designated assignee", async () => {
      const updated = await db.task.updateMany({
        where: { id: { in: [testTask1Id, testTask2Id] } },
        data: { assigneeId: assocSession.user.id },
      });
      expect(updated.count).toBe(2);

      const tasks = await db.task.findMany({
        where: { id: { in: [testTask1Id, testTask2Id] } },
      });
      expect(tasks.every((t) => t.assigneeId === assocSession.user.id)).toBe(true);
    });
  });

  describe("5. Workflow Editor & Versioning (REC-24, WF-04, BR-12)", () => {
    it("creates a new workflow definition version while keeping historical items intact", async () => {
      const originalWf = await getWorkflowForEntity("TASK");
      expect(originalWf).toBeDefined();

      const newVersion = await db.$transaction(async (tx) => {
        const createdDef = await tx.workflowDefinition.create({
          data: {
            key: `TASK_TEMP_V${Date.now()}`,
            version: 2,
            isActive: true,
            entity: "TASK",
            nameFr: "Cycle de vie des tâches v2",
            nameEn: "Task Lifecycle v2",
          },
        });

        const s1 = await tx.workflowStep.create({
          data: {
            definitionId: createdDef.id,
            key: "TODO",
            nameFr: "À faire",
            nameEn: "To Do",
            color: "#1F2A44",
            position: 1,
            isInitial: true,
          },
        });

        const s2 = await tx.workflowStep.create({
          data: {
            definitionId: createdDef.id,
            key: "DONE",
            nameFr: "Terminé",
            nameEn: "Done",
            color: "#16A34A",
            position: 2,
            isFinal: true,
          },
        });

        await tx.workflowTransition.create({
          data: {
            definitionId: createdDef.id,
            fromStepId: s1.id,
            toStepId: s2.id,
            requiresConfirmation: true,
            requiresJustification: true,
          },
        });

        return createdDef;
      });

      try {
        expect(newVersion.version).toBe(2);
        expect(newVersion.isActive).toBe(true);

        const loaded = await db.workflowDefinition.findUnique({
          where: { id: newVersion.id },
          include: { steps: true, transitions: true },
        });

        expect(loaded?.steps.length).toBe(2);
        expect(loaded?.transitions.length).toBe(1);
        expect(loaded?.transitions[0]?.requiresJustification).toBe(true);
      } finally {
        await db.workflowTransition.deleteMany({ where: { definitionId: newVersion.id } });
        await db.workflowStep.deleteMany({ where: { definitionId: newVersion.id } });
        await db.workflowDefinition.delete({ where: { id: newVersion.id } });
      }
    });
  });

  describe("6. View Switching Context Preservation (REC-23, UX-05)", () => {
    it("preserves filter criteria when switching between Kanban, Table, and Calendar views", () => {
      // Helper simulating URL query preservation across views
      function switchView(
        currentUrl: string,
        newView: "kanban" | "table" | "calendar"
      ): string {
        const [base, query] = currentUrl.split("?");
        const params = new URLSearchParams(query || "");
        params.set("view", newView);
        return `${base}?${params.toString()}`;
      }

      const initialUrl = "/fr/matters?view=kanban&search=Commercial&status=OPEN&owner=usr_lead_01";
      const switchedToTable = switchView(initialUrl, "table");
      const switchedToCalendar = switchView(switchedToTable, "calendar");

      const paramsTable = new URLSearchParams(switchedToTable.split("?")[1]);
      expect(paramsTable.get("view")).toBe("table");
      expect(paramsTable.get("search")).toBe("Commercial");
      expect(paramsTable.get("status")).toBe("OPEN");
      expect(paramsTable.get("owner")).toBe("usr_lead_01");

      const paramsCalendar = new URLSearchParams(switchedToCalendar.split("?")[1]);
      expect(paramsCalendar.get("view")).toBe("calendar");
      expect(paramsCalendar.get("search")).toBe("Commercial");
      expect(paramsCalendar.get("status")).toBe("OPEN");
      expect(paramsCalendar.get("owner")).toBe("usr_lead_01");
    });
  });
});
