import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createInquiry,
  decideInquiry,
  convertInquiryToClient,
  getInquiryById,
} from "@/server/services/inquiry-service";
import { recordConflictCheck } from "@/server/services/conflict-service";
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

describe("Inquiries & Prospect Pipeline Specification (INQ-01 to INQ-07, BR-01, BR-04)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Danielle EBOUMBOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Sandrine NGO");

  const createdInquiryIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];

  afterEach(async () => {
    if (createdCheckIds.length > 0) {
      await db.conflictCheck.deleteMany({
        where: { id: { in: createdCheckIds } },
      });
      createdCheckIds.length = 0;
    }

    if (createdInquiryIds.length > 0) {
      await db.task.deleteMany({
        where: { inquiryId: { in: createdInquiryIds } },
      });
      await db.acceptanceDecision.deleteMany({
        where: { inquiryId: { in: createdInquiryIds } },
      });
      await db.inquiry.deleteMany({
        where: { id: { in: createdInquiryIds } },
      });
      createdInquiryIds.length = 0;
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

  describe("1. Inquiry Creation & Qualification Task (INQ-01, INQ-02, INQ-03, BR-01)", () => {
    it("creates an inquiry, auto-generates prospect party, and creates a 24h qualification task", async () => {
      const inquiry = await createInquiry(
        {
          newParty: {
            type: "COMPANY",
            companyName: "Cameroon Cocoa Traders SARL",
            email: "contact@cocoa-traders.cm",
            phone: "+237 677 11 22 33",
            city: "Kumba",
          },
          channel: "PHONE",
          subject: "Consultation sur contrat d'exportation de fèves",
          description: "Le directeur général souhaite un accompagnement pour sécuriser un contrat d'exportation vers Anvers.",
          origin: "Recommandation Me Fokou",
          assignedToId: leadSession.user.id,
        },
        leadSession
      );

      createdInquiryIds.push(inquiry.id);
      createdPartyIds.push(inquiry.partyId);

      expect(inquiry.id).toBeDefined();
      expect(inquiry.party.displayName).toBe("Cameroon Cocoa Traders SARL");
      expect(inquiry.party.clientStatus).toBe("PROSPECT");
      expect(inquiry.assignedToId).toBe(leadSession.user.id);

      // Verify the auto-created 24-hour qualification task (INQ-03, BR-01)
      const tasks = await db.task.findMany({
        where: { inquiryId: inquiry.id },
      });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toContain("Qualification de la demande");
      expect(tasks[0].assigneeId).toBe(leadSession.user.id);
      expect(tasks[0].dueAt).not.toBeNull();
    });
  });

  describe("2. Decision Making & History Preservation (INQ-06, BR-04)", () => {
    it("enforces inquiry.decide permission (refuses Associate Lawyer)", async () => {
      const party = await createParty(
        {
          type: "INDIVIDUAL",
          lastName: "Demandeur Test",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      const inquiry = await createInquiry(
        {
          partyId: party.id,
          channel: "EMAIL",
          subject: "Test rejet autorisation",
        },
        leadSession
      );
      createdInquiryIds.push(inquiry.id);

      await expect(
        decideInquiry(
          {
            inquiryId: inquiry.id,
            outcome: "REFUSED",
            reason: "Non recevable",
          },
          associateSession
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("preserves full history and lostReason when prospect is refused", async () => {
      const inquiry = await createInquiry(
        {
          newParty: {
            type: "COMPANY",
            companyName: "Société Refusée SA",
          },
          channel: "WALK_IN",
          subject: "Demande hors domaine d'activité",
        },
        leadSession
      );
      createdInquiryIds.push(inquiry.id);
      createdPartyIds.push(inquiry.partyId);

      const decision = await decideInquiry(
        {
          inquiryId: inquiry.id,
          outcome: "REFUSED",
          reason: "Le cabinet ne traite pas le droit de l'environnement maritime.",
        },
        leadSession
      );

      expect(decision.outcome).toBe("REFUSED");
      expect(decision.decidedById).toBe(leadSession.user.id);

      // Verify inquiry remains in DB with lostReason and history intact
      const updated = await getInquiryById(inquiry.id, leadSession);
      expect(updated?.lostReason).toContain("droit de l'environnement maritime");
      expect(updated?.decisions.length).toBe(1);
      expect(updated?.tasks.length).toBe(1);
    });
  });

  describe("3. Conflict Guard on Conversion (BR-03, CON-04, INQ-07)", () => {
    it("blocks acceptance and conversion if conflict of interest has not been resolved", async () => {
      const inquiry = await createInquiry(
        {
          newParty: {
            type: "COMPANY",
            companyName: "Prospect Sans Contrôle Conflit",
          },
          channel: "EMAIL",
          subject: "Demande d'assistance contentieuse",
        },
        partnerSession
      );
      createdInquiryIds.push(inquiry.id);
      createdPartyIds.push(inquiry.partyId);

      // Attempt conversion without prior conflict check
      await expect(
        convertInquiryToClient(inquiry.id, partnerSession)
      ).rejects.toThrow(/bloquée/i);

      // Attempt formal acceptance decision without prior conflict check
      await expect(
        decideInquiry(
          {
            inquiryId: inquiry.id,
            outcome: "ACCEPTED",
            reason: "Dossier rentable",
          },
          partnerSession
        )
      ).rejects.toThrow(/bloquée par le contrôle des conflits/i);
    });
  });

  describe("4. Client Conversion & Re-entry Prevention (INQ-07)", () => {
    it("converts prospect to client, updates same party record, and prevents re-entry", async () => {
      const inquiry = await createInquiry(
        {
          newParty: {
            type: "COMPANY",
            companyName: "Entreprise Camerounaise Innovante SA",
          },
          channel: "PHONE",
          subject: "Dépôt de brevet et propriété intellectuelle",
        },
        partnerSession
      );
      createdInquiryIds.push(inquiry.id);
      createdPartyIds.push(inquiry.partyId);

      // 1. Clear conflict check
      const check = await recordConflictCheck(
        {
          queryText: "Entreprise Camerounaise Innovante SA",
          partyId: inquiry.partyId,
          result: "NONE_FOUND",
          decisionNote: "Aucune concordance déontologique trouvée.",
        },
        partnerSession
      );
      createdCheckIds.push(check.id);

      // 2. Convert to client
      const convertedInquiry = await convertInquiryToClient(inquiry.id, partnerSession);
      expect(convertedInquiry.convertedAt).not.toBeNull();
      expect(convertedInquiry.party.clientStatus).toBe("CLIENT");
      expect(convertedInquiry.party.convertedAt).not.toBeNull();

      // Verify the party record ID remained identical (no duplicate created)
      expect(convertedInquiry.party.id).toBe(inquiry.partyId);

      // 3. Prevent re-entry on conversion (INQ-07)
      await expect(
        convertInquiryToClient(inquiry.id, partnerSession)
      ).rejects.toThrow(/déjà été convertie/i);

      // Prevent deciding on already converted inquiry
      await expect(
        decideInquiry(
          {
            inquiryId: inquiry.id,
            outcome: "REFUSED",
            reason: "Annulation tardive",
          },
          partnerSession
        )
      ).rejects.toThrow(/déjà été convertie en client/i);
    });
  });
});

