import { describe, it, expect, beforeEach } from "vitest";
import {
  transition,
  createWorkflowVersion,
  getWorkflowForEntity,
} from "@/server/workflow/workflow-engine";
import { ForbiddenError } from "@/server/auth/errors";
import { AppSession } from "@/server/auth/session";
import { db } from "@/server/db";

function makeSession(
  userId: string,
  roleKey: "PARTNER" | "LEAD_LAWYER" | "ASSOCIATE_LAWYER" | "SECRETARY" | "ACCOUNTANT" | "FUNCTIONAL_ADMIN" | "TECHNICAL_ADMIN",
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

describe("Workflow Engine Specification (WF-01 to WF-05, BR-08, BR-09, BR-12)", () => {
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA");
  const secrSession = makeSession("usr_secr_01", "SECRETARY", "Mme Clarisse FOTSO");
  const fadminSession = makeSession("usr_fadmin_01", "FUNCTIONAL_ADMIN", "M. David TCHINDA");

  let todoStepId: string;
  let inProgressStepId: string;
  let toValidateStepId: string;
  let doneStepId: string;
  let cancelledStepId: string;

  beforeEach(async () => {
    const taskWf = await getWorkflowForEntity("TASK");
    todoStepId = taskWf.steps.find((s) => s.key === "TODO")!.id;
    inProgressStepId = taskWf.steps.find((s) => s.key === "IN_PROGRESS")!.id;
    toValidateStepId = taskWf.steps.find((s) => s.key === "TO_VALIDATE")!.id;
    doneStepId = taskWf.steps.find((s) => s.key === "DONE")!.id;
    cancelledStepId = taskWf.steps.find((s) => s.key === "CANCELLED")!.id;
  });

  it("executes an allowed transition, updates entity step, and records an immutable StatusChange", async () => {
    // Create test task
    const testTask = await db.task.create({
      data: {
        id: "tsk_wf_test_01",
        title: "Test Task Workflow Transition",
        status: "TODO",
        workflowStepId: todoStepId,
        createdById: leadSession.user.id,
      },
    });

    try {
      // Execute transition TODO -> IN_PROGRESS
      const result = await transition(
        "TASK",
        testTask.id,
        "IN_PROGRESS",
        { comment: "Démarrage des travaux" },
        leadSession
      );

      expect(result.success).toBe(true);
      expect(result.fromStepKey).toBe("TODO");
      expect(result.toStepKey).toBe("IN_PROGRESS");

      // Verify task updated
      const updatedTask = await db.task.findUnique({
        where: { id: testTask.id },
      });
      expect(updatedTask?.workflowStepId).toBe(inProgressStepId);
      expect(updatedTask?.status).toBe("IN_PROGRESS");

      // Verify StatusChange recorded
      const statusChange = await db.statusChange.findUnique({
        where: { id: result.statusChangeId },
      });
      expect(statusChange).toBeDefined();
      expect(statusChange?.fromStepKey).toBe("TODO");
      expect(statusChange?.toStepKey).toBe("IN_PROGRESS");
      expect(statusChange?.comment).toBe("Démarrage des travaux");
      expect(statusChange?.changedById).toBe(leadSession.user.id);
    } finally {
      await db.statusChange.deleteMany({ where: { entityId: testTask.id } });
      await db.task.delete({ where: { id: testTask.id } });
    }
  });

  it("rejects an illegal/forbidden transition (WF-01)", async () => {
    // Create test task in TODO
    const testTask = await db.task.create({
      data: {
        id: "tsk_wf_test_02",
        title: "Test Task Forbidden Transition",
        status: "TODO",
        workflowStepId: todoStepId,
        createdById: leadSession.user.id,
      },
    });

    try {
      // TODO -> DONE directly is not allowed in TASK workflow (must go through IN_PROGRESS or TO_VALIDATE)
      await expect(
        transition("TASK", testTask.id, "DONE", {}, leadSession)
      ).rejects.toThrow(ForbiddenError);
    } finally {
      await db.task.delete({ where: { id: testTask.id } });
    }
  });

  it("requires justification when transition has requiresJustification flag (WF-02)", async () => {
    // Cancellation requires justification
    const testTask = await db.task.create({
      data: {
        id: "tsk_wf_test_03",
        title: "Test Task Justification Required",
        status: "TODO",
        workflowStepId: todoStepId,
        createdById: leadSession.user.id,
      },
    });

    try {
      // Missing justification -> Refused
      await expect(
        transition("TASK", testTask.id, "CANCELLED", {}, leadSession)
      ).rejects.toThrow(ForbiddenError);

      // Justification too short -> Refused
      await expect(
        transition("TASK", testTask.id, "CANCELLED", { justification: "ab" }, leadSession)
      ).rejects.toThrow(ForbiddenError);

      // Valid justification -> Allowed
      const res = await transition(
        "TASK",
        testTask.id,
        "CANCELLED",
        { justification: "Dossier clôturé avant achèvement" },
        leadSession
      );
      expect(res.success).toBe(true);

      const updated = await db.task.findUnique({ where: { id: testTask.id } });
      expect(updated?.status).toBe("CANCELLED");
      expect(updated?.cancelReason).toBe("Dossier clôturé avant achèvement");
    } finally {
      await db.statusChange.deleteMany({ where: { entityId: testTask.id } });
      await db.task.delete({ where: { id: testTask.id } });
    }
  });

  it("blocks task validation to DONE without task.validate permission (BR-09)", async () => {
    // Task flagged requiresValidation: true
    const testTask = await db.task.create({
      data: {
        id: "tsk_wf_test_04",
        title: "Legal Validation Task",
        status: "IN_PROGRESS",
        workflowStepId: inProgressStepId,
        requiresValidation: true,
        createdById: leadSession.user.id,
      },
    });

    try {
      // Move to TO_VALIDATE
      await transition("TASK", testTask.id, "TO_VALIDATE", {}, leadSession);

      // Secretary attempts to validate to DONE -> Refused (lacks task.validate)
      await expect(
        transition("TASK", testTask.id, "DONE", {}, secrSession)
      ).rejects.toThrow(ForbiddenError);

      // Lead lawyer holds task.validate -> Allowed
      const res = await transition("TASK", testTask.id, "DONE", {}, leadSession);
      expect(res.success).toBe(true);

      const updated = await db.task.findUnique({ where: { id: testTask.id } });
      expect(updated?.status).toBe("DONE");
      expect(updated?.validatedById).toBe(leadSession.user.id);
      expect(updated?.validatedAt).toBeDefined();
    } finally {
      await db.statusChange.deleteMany({ where: { entityId: testTask.id } });
      await db.task.delete({ where: { id: testTask.id } });
    }
  });

  it("preserves item history and past steps when a new workflow version is created (BR-12)", async () => {
    const taskWf = await getWorkflowForEntity("TASK");

    // Create item pointing to v1 step
    const testTask = await db.task.create({
      data: {
        id: "tsk_wf_test_versioning",
        title: "Historical Task",
        status: "TODO",
        workflowStepId: todoStepId,
        createdById: leadSession.user.id,
      },
    });

    try {
      // Create workflow version 2
      const newDef = await createWorkflowVersion(
        taskWf.id,
        [
          { key: "TODO", nameFr: "À faire v2", nameEn: "To Do v2", color: "#4B5563", position: 1, isInitial: true },
          { key: "DONE", nameFr: "Terminé v2", nameEn: "Done v2", color: "#16A34A", position: 2, isFinal: true },
        ],
        [{ fromStepKey: "TODO", toStepKey: "DONE" }],
        fadminSession
      );

      expect(newDef.version).toBe(taskWf.version + 1);
      expect(newDef.isActive).toBe(true);

      // Check that existing task STILL retains its v1 step id and history intact!
      const historicalTask = await db.task.findUnique({
        where: { id: testTask.id },
      });
      expect(historicalTask?.workflowStepId).toBe(todoStepId);

      // Clean up version 2 and reactivate v1
      await db.workflowTransition.deleteMany({ where: { definitionId: newDef.id } });
      await db.workflowStep.deleteMany({ where: { definitionId: newDef.id } });
      await db.workflowDefinition.delete({ where: { id: newDef.id } });
      await db.workflowDefinition.update({
        where: { id: taskWf.id },
        data: { isActive: true },
      });
    } finally {
      await db.statusChange.deleteMany({ where: { entityId: testTask.id } });
      await db.task.delete({ where: { id: testTask.id } });
    }
  });
});

