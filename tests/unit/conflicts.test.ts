import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  searchConflicts,
  recordConflictCheck,
  mandatoryConflictResolved,
} from "@/server/services/conflict-service";
import { createParty } from "@/server/services/party-service";
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

describe("Conflict of Interest Specification (SPECIFICATIONS.md CON-01 to CON-04, BR-03)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Danielle EBOUMBOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Sandrine NGO");

  const createdPartyIds: string[] = [];
  const createdMatterIds: string[] = [];
  const createdCheckIds: string[] = [];

  afterEach(async () => {
    if (createdCheckIds.length > 0) {
      await db.conflictCheck.deleteMany({
        where: { id: { in: createdCheckIds } },
      });
      createdCheckIds.length = 0;
    }

    if (createdMatterIds.length > 0) {
      await db.matterParty.deleteMany({
        where: { matterId: { in: createdMatterIds } },
      });
      await db.matter.deleteMany({
        where: { id: { in: createdMatterIds } },
      });
      createdMatterIds.length = 0;
    }

    if (createdPartyIds.length > 0) {
      await db.partyContact.deleteMany({
        where: { partyId: { in: createdPartyIds } },
      });
      await db.party.deleteMany({
        where: { id: { in: createdPartyIds } },
      });
      createdPartyIds.length = 0;
    }
  });

  describe("1. Accents and Variant Search (CON-01, CON-02)", () => {
    it("finds parties and opposing parties regardless of accents, cases, and word variants", async () => {
      // 1. Create a client party
      const company = await createParty(
        {
          type: "COMPANY",
          companyName: "Société Équatoriale de Télécoms (SETEL)",
          registrationNumber: "RC/DLA/2026/B/8888",
        },
        partnerSession
      );
      createdPartyIds.push(company.id);

      // Search with unaccented, lowercase variation
      const matches1 = await searchConflicts(
        { query: "equatoriale" },
        associateSession
      );
      expect(matches1.some((m) => m.displayName.includes("SETEL"))).toBe(true);

      // Search with partial name
      const matches2 = await searchConflicts(
        { query: "telecoms" },
        associateSession
      );
      expect(matches2.some((m) => m.displayName.includes("SETEL"))).toBe(true);

      // Search by RCCM
      const matches3 = await searchConflicts(
        { query: "RC/DLA/2026/B/8888" },
        associateSession
      );
      expect(matches3.some((m) => m.displayName.includes("SETEL"))).toBe(true);
      expect(matches3[0].matchScore).toBe(1.0);
    });

    it("detects opposing party status in prior matters with elevated risk flag", async () => {
      // 1. Create an opposing party
      const opposing = await createParty(
        {
          type: "COMPANY",
          companyName: "Banque Atlantique Cameroun (Adverse)",
        },
        partnerSession
      );
      createdPartyIds.push(opposing.id);

      // 2. Create a test matter where this company is registered as opposing party
      const matterCategory = await db.matterCategory.findFirst();
      const step = await db.workflowStep.findFirst();

      const matter = await db.matter.create({
        data: {
          reference: "MAT-2026-TEST-ADVERSE",
          title: "Litige commercial c/ Banque Atlantique",
          category: { connect: { id: matterCategory!.id } },
          workflowStep: { connect: { id: step!.id } },
          leadLawyer: { connect: { id: partnerSession.user.id } },
          createdBy: { connect: { id: partnerSession.user.id } },
          confidentiality: "STANDARD",
          priority: "HIGH",
        },
      });
      createdMatterIds.push(matter.id);

      await db.matterParty.create({
        data: {
          matterId: matter.id,
          partyId: opposing.id,
          role: "OPPOSING_PARTY",
        },
      });

      // Search conflict for Banque Atlantique
      const matches = await searchConflicts(
        { query: "Banque Atlantique" },
        leadSession
      );

      const adverseMatch = matches.find((m) => m.matterId === matter.id);
      expect(adverseMatch).toBeDefined();
      expect(adverseMatch?.isAdverse).toBe(true);
      expect(adverseMatch?.roleInMatter).toBe("OPPOSING_PARTY");
    });
  });

  describe("2. Partner-Only Waiver (BR-03, CON-04)", () => {
    it("refuses waiver execution by non-partners with ForbiddenError", async () => {
      await expect(
        recordConflictCheck(
          {
            queryText: "Test Prohibited Waiver",
            result: "WAIVED",
            decisionNote: "Tentative non autorisée",
          },
          leadSession
        )
      ).rejects.toThrow(ForbiddenError);

      await expect(
        recordConflictCheck(
          {
            queryText: "Test Prohibited Waiver",
            result: "WAIVED",
            decisionNote: "Tentative non autorisée",
          },
          associateSession
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("requires a non-empty justification note when partner grants waiver", async () => {
      await expect(
        recordConflictCheck(
          {
            queryText: "Test Partner Waiver Missing Reason",
            result: "WAIVED",
            decisionNote: "",
          },
          partnerSession
        )
      ).rejects.toThrow(/justification détaillée est obligatoire/i);
    });

    it("allows partner to waive conflict with detailed justification and audit trail", async () => {
      const check = await recordConflictCheck(
        {
          queryText: "Groupe SABC Cameroun",
          result: "WAIVED",
          decisionNote:
            "Dérogation accordée après analyse : litige clôturé il y a plus de 7 ans, absence d'information confidentielle en cours.",
        },
        partnerSession
      );
      createdCheckIds.push(check.id);

      expect(check.id).toBeDefined();
      expect(check.result).toBe("WAIVED");
      expect(check.decisionNote).toContain("Dérogation accordée");
    });
  });

  describe("3. Gatekeeper Guard mandatoryConflictResolved() (CON-04, BR-03)", () => {
    it("blocks guard when no conflict check has ever been performed for party", async () => {
      const party = await createParty(
        {
          type: "INDIVIDUAL",
          lastName: "Nouveau Client Inconnu",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      const status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(false);
      expect(status.reason).toContain("Aucune vérification de conflit");
    });

    it("blocks guard when latest check is CONFIRMED_CONFLICT or POTENTIAL_CONFLICT", async () => {
      const party = await createParty(
        {
          type: "COMPANY",
          companyName: "Entité En Conflit SA",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      // Record POTENTIAL_CONFLICT
      const check1 = await recordConflictCheck(
        {
          queryText: "Entité En Conflit SA",
          partyId: party.id,
          result: "POTENTIAL_CONFLICT",
          decisionNote: "En attente de vérification complémentaire",
        },
        leadSession
      );
      createdCheckIds.push(check1.id);

      let status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(false);
      expect(status.reason).toContain("conflit d'intérêts potentiel");

      // Record CONFIRMED_CONFLICT
      const check2 = await recordConflictCheck(
        {
          queryText: "Entité En Conflit SA",
          partyId: party.id,
          result: "CONFIRMED_CONFLICT",
          decisionNote: "Représentation simultanée de parties opposées",
        },
        leadSession
      );
      createdCheckIds.push(check2.id);

      status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(false);
      expect(status.reason).toContain("conflit d'intérêts avéré");
    });

    it("allows guard when latest check is NONE_FOUND, CLEARED, or WAIVED", async () => {
      const party = await createParty(
        {
          type: "COMPANY",
          companyName: "Client Conforme SAS",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      // 1. Check with NONE_FOUND
      const checkClean = await recordConflictCheck(
        {
          queryText: "Client Conforme SAS",
          partyId: party.id,
          result: "NONE_FOUND",
          decisionNote: "Aucun dossier ni partie concordante dans la base",
        },
        leadSession
      );
      createdCheckIds.push(checkClean.id);

      let status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(true);
      expect(status.latestCheck?.result).toBe("NONE_FOUND");

      // 2. Later, conflict potential arises then CLEARED
      const checkCleared = await recordConflictCheck(
        {
          queryText: "Client Conforme SAS",
          partyId: party.id,
          result: "CLEARED",
          decisionNote: "Homonymie écartée après vérification du NIU",
        },
        leadSession
      );
      createdCheckIds.push(checkCleared.id);

      status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(true);
      expect(status.latestCheck?.result).toBe("CLEARED");

      // 3. Or formally WAIVED by partner
      const checkWaived = await recordConflictCheck(
        {
          queryText: "Client Conforme SAS",
          partyId: party.id,
          result: "WAIVED",
          decisionNote: "Dérogation formelle signée par associé",
        },
        partnerSession
      );
      createdCheckIds.push(checkWaived.id);

      status = await mandatoryConflictResolved({ partyId: party.id });
      expect(status.resolved).toBe(true);
      expect(status.latestCheck?.result).toBe("WAIVED");
    });
  });
});
