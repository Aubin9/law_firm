import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMatter,
  getMatterById,
  listMatters,
  softDeleteMatter,
  setMatterMember,
  removeMatterMember,
  partnerSelfJoinStrict,
  generateNextMatterReference,
} from "@/server/services/matter-service";
import { createParty } from "@/server/services/party-service";
import { recordConflictCheck } from "@/server/services/conflict-service";
import { ForbiddenError } from "@/server/auth/errors";
import { AppSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { Confidentiality, Priority, MatterAccessLevel } from "@prisma/client";

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

describe("Matters / Dossiers Specification (MAT-01 to MAT-07, BR-01 to BR-05)", () => {
  const partnerSession = makeSession(
    "usr_partner_01",
    "PARTNER",
    "Me Christian FOKOU",
  );
  const leadSession = makeSession(
    "usr_lead_01",
    "LEAD_LAWYER",
    "Me Danielle EBOUMBOU",
  );
  const associateSession = makeSession(
    "usr_assoc_01",
    "ASSOCIATE_LAWYER",
    "Me Sandrine NGO",
  );
  const secretarySession = makeSession(
    "usr_secr_01",
    "SECRETARY",
    "Mme Jeanne MANDENG",
  );
  const accountantSession = makeSession(
    "usr_acct_01",
    "ACCOUNTANT",
    "Mme Chantal BIKOI",
  );

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    // Ensure default matter category exists
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "TEST-CAT",
          nameFr: "Contentieux Général",
          nameEn: "General Litigation",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
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

  async function createClearedClient(name: string) {
    const party = await createParty(
      {
        displayName: name,
        type: "INDIVIDUAL",
        clientStatus: "CLIENT",
      },
      partnerSession,
    );
    createdPartyIds.push(party.id);

    const check = await recordConflictCheck(
      {
        partyId: party.id,
        queryText: name,
        result: "CLEARED",
        decisionNote:
          "Vérification automatisée préalable sans correspondance adverse.",
      },
      partnerSession,
    );
    createdCheckIds.push(check.id);

    return party;
  }

  describe("1. Thread-safe Matter Reference Generation (MAT-03)", () => {
    it("generates references matching MAT-YYYY-XXXX sequentially", async () => {
      const ref1 = await generateNextMatterReference();
      const ref2 = await generateNextMatterReference();

      const currentYear = new Date().getFullYear();
      expect(ref1).toMatch(new RegExp(`^MAT-${currentYear}-\\d{4}$`));
      expect(ref2).toMatch(new RegExp(`^MAT-${currentYear}-\\d{4}$`));

      const num1 = parseInt(ref1.split("-")[2], 10);
      const num2 = parseInt(ref2.split("-")[2], 10);
      expect(num2).toBeGreaterThanOrEqual(num1 + 1);
    });
  });

  describe("2. Conflict Guard on Matter Opening (MAT-04, BR-01)", () => {
    it("blocks matter creation when client has no cleared conflict check", async () => {
      // Party without cleared conflict check
      const party = await createParty(
        {
          displayName: "Client Sans Clearance",
          type: "INDIVIDUAL",
          clientStatus: "CLIENT",
        },
        partnerSession,
      );
      createdPartyIds.push(party.id);

      await expect(
        createMatter(
          {
            clientId: party.id,
            title: "Affaire Non Autorisée",
            categoryId: defaultCategoryId,
            leadLawyerId: leadSession.user.id,
          },
          leadSession,
        ),
      ).rejects.toThrow(/conflit d'intérêts|conflict/i);
    });

    it("allows matter creation when client has a resolved/waived conflict check", async () => {
      const party = await createClearedClient("SABC SARL");

      const matter = await createMatter(
        {
          clientId: party.id,
          title: "Contentieux Bail Commercial Douala",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          confidentiality: "STANDARD",
        },
        leadSession,
      );
      createdMatterIds.push(matter.id);

      expect(matter.id).toBeDefined();
      expect(matter.reference).toMatch(/^MAT-\d{4}-\d{4}$/);
      expect(matter.leadLawyerId).toBe(leadSession.user.id);
    });
  });

  describe("3. Lead Lawyer & Team Membership (MAT-05, BR-02, BR-03)", () => {
    it("automatically assigns MANAGE level to the lead lawyer upon creation", async () => {
      const party = await createClearedClient("Société Générale Cameroun");

      const matter = await createMatter(
        {
          clientId: party.id,
          title: "Recouvrement Créance Bancaire",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          additionalMemberUserIds: [
            { userId: associateSession.user.id, level: "EDIT" },
          ],
        },
        partnerSession,
      );
      createdMatterIds.push(matter.id);

      const fetched = await getMatterById(matter.id, leadSession);
      const leadMember = fetched.members.find(
        (m: any) => m.userId === leadSession.user.id,
      );
      expect(leadMember).toBeDefined();
      expect(leadMember?.level).toBe("MANAGE");

      const assocMember = fetched.members.find(
        (m: any) => m.userId === associateSession.user.id,
      );
      expect(assocMember?.level).toBe("EDIT");
    });

    it("prevents demoting or removing the lead lawyer from matter members", async () => {
      const party = await createClearedClient("BICEC Cameroun");

      const matter = await createMatter(
        {
          clientId: party.id,
          title: "Contentieux Social Bonanjo",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
        },
        leadSession,
      );
      createdMatterIds.push(matter.id);

      // Attempting to demote lead lawyer to VIEW
      await expect(
        setMatterMember(matter.id, leadSession.user.id, "VIEW", leadSession),
      ).rejects.toThrow(/avocat responsable|lead lawyer/i);

      // Attempting to remove lead lawyer
      await expect(
        removeMatterMember(matter.id, leadSession.user.id, leadSession),
      ).rejects.toThrow(/avocat responsable|lead lawyer/i);
    });
  });

  describe("4. Confidentiality & Database-Level Filter (MAT-01, MAT-02, MAT-06)", () => {
    it("hides STRICT matters from non-members in listMatters", async () => {
      const party = await createClearedClient("Dossier Secret Présidence");

      const strictMatter = await createMatter(
        {
          clientId: party.id,
          title: "Affaire Confidentielle Alpha",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          confidentiality: "STRICT",
        },
        leadSession,
      );
      createdMatterIds.push(strictMatter.id);

      // Lead lawyer can see it
      const leadList = await listMatters(
        { search: "Confidentielle Alpha" },
        leadSession,
      );
      expect(leadList.matters.some((m: any) => m.id === strictMatter.id)).toBe(
        true,
      );

      // Unassigned associate CANNOT see it in list (filtered at DB layer)
      const assocList = await listMatters(
        { search: "Confidentielle Alpha" },
        associateSession,
      );
      expect(assocList.matters.some((m: any) => m.id === strictMatter.id)).toBe(
        false,
      );

      // Secretary (non-member) CANNOT access it via getMatterById
      await expect(
        getMatterById(strictMatter.id, secretarySession),
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows a Partner to self-join a STRICT matter with an audit log", async () => {
      const party = await createClearedClient("Projet Pétrolier Kribi");

      const strictMatter = await createMatter(
        {
          clientId: party.id,
          title: "Audit Juridique Kribi Deep Sea",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          confidentiality: "STRICT",
        },
        leadSession,
      );
      createdMatterIds.push(strictMatter.id);

      // Partner cannot directly view prior to joining
      await expect(
        getMatterById(strictMatter.id, partnerSession),
      ).rejects.toThrow(ForbiddenError);

      // Partner self-joins with reason
      await partnerSelfJoinStrict(
        strictMatter.id,
        partnerSession,
        "Supervision des engagements contractuels du cabinet",
      );

      // Now partner has access
      const accessed = await getMatterById(strictMatter.id, partnerSession);
      expect(accessed.id).toBe(strictMatter.id);

      // Audit log must exist
      const auditEntry = await db.auditLog.findFirst({
        where: {
          entityId: strictMatter.id,
          action: "matter.partner_self_joined_strict",
        },
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorId).toBe(partnerSession.user.id);
    });
  });

  describe("5. Accountant Limited Access & Soft Delete (MAT-07, PERMISSIONS.md)", () => {
    it("restricts accountant to financial and header info only", async () => {
      const party = await createClearedClient("TotalEnergies Cameroun");

      const matter = await createMatter(
        {
          clientId: party.id,
          title: "Fiscalité Pétrolière 2026",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          confidentiality: "STANDARD",
        },
        leadSession,
      );
      createdMatterIds.push(matter.id);

      const accountantView = await getMatterById(matter.id, accountantSession);
      expect(accountantView.id).toBe(matter.id);
      expect(accountantView.reference).toBe(matter.reference);
      // Documents and sensitive operational fields should be empty/stripped
      expect(accountantView.documents).toEqual([]);
      expect(accountantView.tasks).toEqual([]);
    });

    it("soft deletes a matter, preserving record with deletedAt", async () => {
      const party = await createClearedClient("Afriland First Bank");

      const matter = await createMatter(
        {
          clientId: party.id,
          title: "Contentieux Recouvrement Yaoundé",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
        },
        leadSession,
      );
      createdMatterIds.push(matter.id);

      await softDeleteMatter(matter.id, leadSession);

      const raw = await db.matter.findUnique({
        where: { id: matter.id },
      });
      expect(raw?.deletedAt).not.toBeNull();

      // Should not be visible in normal list
      const list = await listMatters(
        { search: "Recouvrement Yaoundé" },
        leadSession,
      );
      expect(list.matters.some((m: any) => m.id === matter.id)).toBe(false);
    });
  });
});
