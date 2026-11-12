import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMission,
  updateMission,
  getMissionById,
  listMissionsForMatter,
  createProcedure,
  updateProcedure,
  getProcedureById,
  listProceduresForMatter,
} from "@/server/services/mission-procedure-service";
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

describe("Missions and Procedures Specification (STEP 14: MAT-04, MAT-05, LEG-01 to LEG-03, BR-08)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Danielle EBOUMBOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Sandrine NGO");
  const secretarySession = makeSession("usr_secr_01", "SECRETARY", "Mme Jeanne MANDENG");

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  const createdMissionIds: string[] = [];
  const createdProcedureIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "CAT-CONTENTIEUX",
          nameFr: "Contentieux Judiciaire",
          nameEn: "Litigation",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
    if (createdProcedureIds.length > 0) {
      await db.procedure.deleteMany({
        where: { id: { in: createdProcedureIds } },
      });
      createdProcedureIds.length = 0;
    }

    if (createdMissionIds.length > 0) {
      await db.mission.deleteMany({
        where: { id: { in: createdMissionIds } },
      });
      createdMissionIds.length = 0;
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
        ],
      },
      leadSession
    );
    createdMatterIds.push(matter.id);
    return matter;
  }

  describe("1. Missions creation and permissions (LEG-01, MAT-05)", () => {
    it("allows lead lawyer and assigned members to create missions within the matter", async () => {
      const matter = await createClearedMatter("Affaire Conseil Fiscal");

      const mission = await createMission(
        {
          matterId: matter.id,
          type: "ADVISORY",
          title: "Audit fiscal et rédaction de la note d'orientation",
          scope: "Revue des exercices fiscaux 2023 à 2025.",
          deliverables: "Mémorandum de synthèse et risques fiscaux.",
          ownerId: associateSession.user.id,
        },
        leadSession
      );
      createdMissionIds.push(mission.id);

      expect(mission.id).toBeDefined();
      expect(mission.title).toBe("Audit fiscal et rédaction de la note d'orientation");
      expect(mission.status).toBe("PLANNED");
      expect(mission.owner?.id).toBe(associateSession.user.id);
      expect(mission.workflowStepId).not.toBeNull();
    });

    it("prevents users without EDIT/MANAGE matter access from creating missions", async () => {
      const matter = await createClearedMatter("Affaire Restreinte Habilitation");

      // Secretary has role permission but is not a member of the matter
      await expect(
        createMission(
          {
            matterId: matter.id,
            type: "DRAFTING",
            title: "Rédaction non autorisée",
          },
          secretarySession
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("2. Procedures creation and Appeal hierarchy chain (LEG-02, LEG-03)", () => {
    it("creates a First Instance procedure and chains an Appeal pointing to it", async () => {
      const matter = await createClearedMatter("Litige Commercial Brasseries");

      // 1. First instance procedure: Tribunal de Première Instance de Douala-Bonanjo
      const firstInstance = await createProcedure(
        {
          matterId: matter.id,
          kind: "FIRST_INSTANCE",
          jurisdiction: "Tribunal de Première Instance de Douala-Bonanjo",
          reference: "RG N° 124/CIV/2026",
          status: "DECIDED",
        },
        leadSession
      );
      createdProcedureIds.push(firstInstance.id);

      expect(firstInstance.id).toBeDefined();
      expect(firstInstance.kind).toBe("FIRST_INSTANCE");
      expect(firstInstance.status).toBe("DECIDED");

      // 2. Appeal procedure: Cour d'Appel du Littoral linked to First Instance parent
      const appeal = await createProcedure(
        {
          matterId: matter.id,
          kind: "APPEAL",
          parentProcedureId: firstInstance.id,
          jurisdiction: "Cour d'Appel du Littoral à Douala",
          reference: "RG N° 78/APP/2026",
          status: "ONGOING",
        },
        leadSession
      );
      createdProcedureIds.push(appeal.id);

      expect(appeal.id).toBeDefined();
      expect(appeal.parentProcedureId).toBe(firstInstance.id);
      expect(appeal.parentProcedure?.jurisdiction).toBe(
        "Tribunal de Première Instance de Douala-Bonanjo"
      );

      // Verify hierarchy through getProcedureById
      const fetchedParent = await getProcedureById(firstInstance.id, leadSession);
      expect(fetchedParent.childProcedures.length).toBe(1);
      expect(fetchedParent.childProcedures[0].id).toBe(appeal.id);
    });

    it("rejects linking an appeal to a procedure from a different matter", async () => {
      const matter1 = await createClearedMatter("Affaire Alpha");
      const matter2 = await createClearedMatter("Affaire Beta");

      const procMatter1 = await createProcedure(
        {
          matterId: matter1.id,
          kind: "FIRST_INSTANCE",
          jurisdiction: "TPI Yaoundé Centre-Administratif",
        },
        leadSession
      );
      createdProcedureIds.push(procMatter1.id);

      // Trying to link appeal in matter2 to procedure in matter1
      await expect(
        createProcedure(
          {
            matterId: matter2.id,
            kind: "APPEAL",
            parentProcedureId: procMatter1.id,
            jurisdiction: "Cour d'Appel du Centre",
          },
          leadSession
        )
      ).rejects.toThrow(/même dossier/i);
    });
  });

  describe("3. Independence of Matter, Mission and Procedure statuses (BR-08)", () => {
    it("ensures matter status changes do not override mission or procedure statuses", async () => {
      const matter = await createClearedMatter("Affaire Litige Foncier Kribi");

      const mission = await createMission(
        {
          matterId: matter.id,
          type: "CONSULTATION",
          title: "Vérification conservation foncière",
          status: "DONE",
        },
        leadSession
      );
      createdMissionIds.push(mission.id);

      const procedure = await createProcedure(
        {
          matterId: matter.id,
          kind: "FIRST_INSTANCE",
          jurisdiction: "TGI Océan à Kribi",
          status: "ONGOING",
        },
        leadSession
      );
      createdProcedureIds.push(procedure.id);

      // Verify initial statuses
      expect(mission.status).toBe("DONE");
      expect(procedure.status).toBe("ONGOING");
      expect(matter.status).toBe("OPEN");

      // Update procedure status independently
      const updatedProc = await updateProcedure(
        procedure.id,
        { status: "DECIDED" },
        leadSession
      );
      expect(updatedProc.status).toBe("DECIDED");

      // Verify mission status remains unchanged
      const refreshedMission = await getMissionById(mission.id, leadSession);
      expect(refreshedMission.status).toBe("DONE");

      // Verify matter status remains OPEN
      const refreshedMatter = await db.matter.findUnique({
        where: { id: matter.id },
      });
      expect(refreshedMatter?.status).toBe("OPEN");
    });
  });
});

