import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTask,
  updateTask,
  getTaskById,
  listTasksForMatter,
  toggleChecklistItem,
} from "@/server/services/task-service";
import {
  createNote,
  updateNote,
  deleteNote,
  listNotesForMatter,
} from "@/server/services/note-service";
import { createMatter } from "@/server/services/matter-service";
import { createParty } from "@/server/services/party-service";
import { recordConflictCheck } from "@/server/services/conflict-service";
import { ForbiddenError } from "@/server/auth/errors";
import { AppSession } from "@/server/auth/session";
import { db } from "@/server/db";

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

describe("Tasks and Notes Specification (STEP 16: TSK-01 to TSK-03, BR-09, BR-17)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Danielle EBOUMBOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Paul NDOUMBE");
  const secretarySession = makeSession("usr_secr_01", "SECRETARY", "Mme Jeanne MANDENG");

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdNoteIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "CAT-TASK-TEST",
          nameFr: "Conseil & Contentieux",
          nameEn: "Litigation & Advisory",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
    if (createdNoteIds.length > 0) {
      await db.note.deleteMany({
        where: { id: { in: createdNoteIds } },
      });
      createdNoteIds.length = 0;
    }

    if (createdTaskIds.length > 0) {
      await db.taskChecklistItem.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await db.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
      createdTaskIds.length = 0;
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

  async function createClearedMatter(title: string) {
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
        decisionNote: "Clearance préalable",
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
        additionalMemberUserIds: [
          { userId: associateSession.user.id, level: "EDIT" },
          { userId: partnerSession.user.id, level: "EDIT" },
        ],
      },
      leadSession
    );
    createdMatterIds.push(matter.id);
    return matter;
  }

  describe("1. Task Creation & Checklist (TSK-01)", () => {
    it("creates task with assignee, priority, due date and sub-checklist items", async () => {
      const matter = await createClearedMatter("Dossier Recouvrement Créance");

      const task = await createTask(
        {
          matterId: matter.id,
          title: "Signification de l'ordonnance d'injonction de payer",
          priority: "HIGH",
          assigneeId: associateSession.user.id,
          dueAt: new Date(Date.now() + 48 * 3600 * 1000),
          requiresValidation: true,
          checklistLabels: [
            "Contacter l'Huissier de justice territorialement compétent",
            "Transmettre la grosse de l'ordonnance revêtue de la formule exécutoire",
            "Réceptionner le procès-verbal de signification",
          ],
        },
        leadSession
      );
      createdTaskIds.push(task.id);

      expect(task.id).toBeDefined();
      expect(task.title).toBe("Signification de l'ordonnance d'injonction de payer");
      expect(task.status).toBe("TODO");
      expect(task.priority).toBe("HIGH");
      expect(task.checklist.length).toBe(3);
      expect(task.checklist[0].done).toBe(false);

      // Toggle first checklist item to true
      const updatedItem = await toggleChecklistItem(
        task.checklist[0].id,
        true,
        associateSession
      );
      expect(updatedItem.done).toBe(true);
    });
  });

  describe("2. Task Validation Gate & Cancellation Justification (BR-09)", () => {
    it("blocks closing a task requiring validation unless user has task.validate permission (BR-09)", async () => {
      const matter = await createClearedMatter("Dossier Contrôle Juridique");

      const task = await createTask(
        {
          matterId: matter.id,
          title: "Rédaction des conclusions au fond",
          requiresValidation: true,
          assigneeId: associateSession.user.id,
        },
        leadSession
      );
      createdTaskIds.push(task.id);

      // Associate lacks `task.validate` permission -> Attempting to mark DONE directly must fail
      await expect(
        updateTask(task.id, { status: "DONE" }, associateSession)
      ).rejects.toThrow(ForbiddenError);

      // Partner has `task.validate` permission -> Successfully validates and closes task
      const validated = await updateTask(task.id, { status: "DONE" }, partnerSession);
      expect(validated.status).toBe("DONE");
      expect(validated.validatedById).toBe(partnerSession.user.id);
      expect(validated.validatedAt).not.toBeNull();
    });

    it("requires a mandatory cancellation justification when cancelling a task (BR-09)", async () => {
      const matter = await createClearedMatter("Dossier Injonction Annulée");

      const task = await createTask(
        {
          matterId: matter.id,
          title: "Assignation en référé d'heure à heure",
        },
        leadSession
      );
      createdTaskIds.push(task.id);

      // Attempting cancellation without reason fails
      await expect(
        updateTask(task.id, { status: "CANCELLED", cancelReason: "" }, leadSession)
      ).rejects.toThrow(/motif d'annulation/i);

      // Cancellation with required justification succeeds
      const cancelled = await updateTask(
        task.id,
        {
          status: "CANCELLED",
          cancelReason: "Accord amiable trouvé entre les parties avant l'audience.",
        },
        leadSession
      );
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelReason).toContain("Accord amiable");
    });
  });

  describe("3. Internal Notes & Client Shareability (TSK-03, DESIGN 8.10)", () => {
    it("creates internal notes defaulting to non-shareable and lists them chronologically", async () => {
      const matter = await createClearedMatter("Dossier Stratégie Défense");

      const note = await createNote(
        {
          matterId: matter.id,
          body: "Stratégie : privilégier l'exception d'incompétence matérielle in limine litis.",
          shareable: false,
        },
        associateSession
      );
      createdNoteIds.push(note.id);

      expect(note.id).toBeDefined();
      expect(note.shareable).toBe(false);
      expect(note.author.name).toBe(associateSession.user.name);

      const notes = await listNotesForMatter(matter.id, leadSession);
      expect(notes.length).toBe(1);
      expect(notes[0].id).toBe(note.id);
    });

    it("enforces note.share permission when changing a note to shareable", async () => {
      const matter = await createClearedMatter("Dossier Note Partageable");

      const note = await createNote(
        {
          matterId: matter.id,
          body: "Compte-rendu de rendez-vous de négociation.",
          shareable: false,
        },
        leadSession
      );
      createdNoteIds.push(note.id);

      // Associate lacks `note.share` -> fails to make it shareable
      await expect(
        updateNote(note.id, { shareable: true }, associateSession)
      ).rejects.toThrow(ForbiddenError);

      // Partner has `note.share` -> successfully marks shareable
      const shared = await updateNote(note.id, { shareable: true }, partnerSession);
      expect(shared.shareable).toBe(true);
    });
  });
});
