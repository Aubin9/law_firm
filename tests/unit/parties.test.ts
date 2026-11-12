import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listParties,
  getPartyById,
  createParty,
  updateParty,
  softDeleteParty,
  restoreParty,
  checkPartyDuplicates,
  addPartyContact,
  updatePartyContact,
  deletePartyContact,
  searchPartiesForCombobox,
  calculateTrigramSimilarity,
  normalizeString,
} from "@/server/services/party-service";
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

describe("Parties Specification (SPECIFICATIONS.md PTY-01 to PTY-05, DESIGN.md 8.4)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Sandrine NGO");
  const techAdminSession = makeSession("usr_tadmin_01", "TECHNICAL_ADMIN", "Admin IT");

  const createdPartyIds: string[] = [];

  afterEach(async () => {
    // Clean up test parties
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

  describe("1. Permissions per Role (PERMISSIONS.md 3.2)", () => {
    it("allows PARTNER and LEAD_LAWYER to view, create, edit, and archive parties", async () => {
      // Create company party
      const party = await createParty(
        {
          type: "COMPANY",
          companyName: "Cameroon Test Holdings SA",
          registrationNumber: "RC/DLA/2026/B/9999",
          taxId: "M999999999999T",
          email: "contact@test-holdings.cm",
          phone: "+237 699 99 99 99",
          city: "Douala",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);
      expect(party.id).toBeDefined();
      expect(party.displayName).toBe("Cameroon Test Holdings SA");
      expect(party.registrationNumber).toBe("RC/DLA/2026/B/9999");

      // Edit party
      const updated = await updateParty(
        party.id,
        { email: "new-email@test-holdings.cm" },
        partnerSession
      );
      expect(updated.email).toBe("new-email@test-holdings.cm");

      // Soft delete party (archive)
      const archived = await softDeleteParty(party.id, partnerSession);
      expect(archived.deletedAt).not.toBeNull();
    });

    it("allows ASSOCIATE_LAWYER to create and edit, but rejects party.archive with ForbiddenError", async () => {
      const party = await createParty(
        {
          type: "INDIVIDUAL",
          firstName: "Jean",
          lastName: "Takam",
          email: "jean.takam@example.cm",
          city: "Yaoundé",
        },
        associateSession
      );
      createdPartyIds.push(party.id);
      expect(party.displayName).toBe("Jean Takam");

      // Edit succeeds
      const updated = await updateParty(
        party.id,
        { phone: "+237 677 88 99 00" },
        associateSession
      );
      expect(updated.phone).toBe("+237 677 88 99 00");

      // Soft delete (archive) fails for Associate Lawyer
      await expect(softDeleteParty(party.id, associateSession)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("rejects TECHNICAL_ADMIN from party.view or party.create per privacy boundaries", async () => {
      await expect(
        listParties({}, techAdminSession)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        createParty(
          {
            type: "INDIVIDUAL",
            lastName: "Forbidden",
          },
          techAdminSession
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("2. Duplicate Detection & Trigram Similarity (PTY-04)", () => {
    it("accurately computes trigram similarity with accent and diacritic normalization", () => {
      const name1 = "Société Générale de Surveillance";
      const name2 = "Societe Generale de Surveillance";
      const similarity = calculateTrigramSimilarity(name1, name2);
      expect(similarity).toBe(1.0);

      const nameA = "Compagnie Camerounaise d'Aluminium";
      const nameB = "Compagnie Camerounaise d'Aluminium SA";
      const simAB = calculateTrigramSimilarity(nameA, nameB);
      expect(simAB).toBeGreaterThan(0.7);

      const diffA = "TotalEnergies Marketing Cameroun";
      const diffB = "Afriland First Bank";
      const simDiff = calculateTrigramSimilarity(diffA, diffB);
      expect(simDiff).toBeLessThan(0.2);
    });

    it("flags duplicate on similar name, exact email, and exact phone", async () => {
      const existing = await createParty(
        {
          type: "COMPANY",
          companyName: "Société des Brasseries du Cameroun",
          email: "contact@brasseries-cm.com",
          phone: "+237 699 00 11 22",
        },
        partnerSession
      );
      createdPartyIds.push(existing.id);

      // Check duplicate by similar name
      const nameMatches = await checkPartyDuplicates({
        displayName: "Societe des Brasseries du Cameroun SA",
      });
      expect(nameMatches.some((m) => m.partyId === existing.id)).toBe(true);

      // Check duplicate by exact email
      const emailMatches = await checkPartyDuplicates({
        displayName: "Brand New Entity",
        email: "contact@brasseries-cm.com",
      });
      expect(emailMatches.some((m) => m.partyId === existing.id)).toBe(true);
      expect(emailMatches[0].reasons).toContain("same_email");

      // Check duplicate by formatted phone
      const phoneMatches = await checkPartyDuplicates({
        displayName: "Another Entity",
        phone: "+237 699001122",
      });
      expect(phoneMatches.some((m) => m.partyId === existing.id)).toBe(true);
      expect(phoneMatches[0].reasons).toContain("same_phone");
    });
  });

  describe("3. Soft Deletion & Listing (PTY-05)", () => {
    it("excludes soft-deleted parties from active lists and autocompletes, allows restoration", async () => {
      const party = await createParty(
        {
          type: "INDIVIDUAL",
          firstName: "Samuel",
          lastName: "Eto'o Fils",
          email: "samuel@fecafoot-test.cm",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      // Initially present in list
      const initialList = await listParties(
        { search: "Eto'o" },
        partnerSession
      );
      expect(initialList.parties.some((p) => p.id === party.id)).toBe(true);

      // Soft delete
      await softDeleteParty(party.id, partnerSession);

      // Now excluded from standard list
      const activeList = await listParties(
        { search: "Eto'o" },
        partnerSession
      );
      expect(activeList.parties.some((p) => p.id === party.id)).toBe(false);

      // Excluded from combobox autocomplete
      const comboboxResults = await searchPartiesForCombobox("Eto'o", partnerSession);
      expect(comboboxResults.some((p) => p.id === party.id)).toBe(false);

      // Included when explicitly requesting includeDeleted
      const allList = await listParties(
        { search: "Eto'o", includeDeleted: true },
        partnerSession
      );
      expect(allList.parties.some((p) => p.id === party.id)).toBe(true);

      // Restore party
      await restoreParty(party.id, partnerSession);
      const restoredList = await listParties(
        { search: "Eto'o" },
        partnerSession
      );
      expect(restoredList.parties.some((p) => p.id === party.id)).toBe(true);
    });
  });

  describe("4. Accent and Case Tolerant Search", () => {
    it("finds parties regardless of accents or letter casing in search term", async () => {
      const party = await createParty(
        {
          type: "COMPANY",
          companyName: "Énergie et Électricité du Littoral",
          taxId: "M102030405060E",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      // Search with unaccented lowercase term
      const res1 = await listParties({ search: "energie" }, partnerSession);
      expect(res1.parties.some((p) => p.id === party.id)).toBe(true);

      // Search with uppercase term
      const res2 = await listParties({ search: "ELECTRICITE" }, partnerSession);
      expect(res2.parties.some((p) => p.id === party.id)).toBe(true);

      // Search by taxId
      const res3 = await listParties({ search: "102030" }, partnerSession);
      expect(res3.parties.some((p) => p.id === party.id)).toBe(true);
    });
  });

  describe("5. Contacts and Legal Representatives (PTY-02)", () => {
    it("adds, updates, and deletes legal representatives and contacts", async () => {
      const company = await createParty(
        {
          type: "COMPANY",
          companyName: "Douala Port Logistics SAS",
        },
        partnerSession
      );
      createdPartyIds.push(company.id);

      // Add legal representative
      const rep = await addPartyContact(
        company.id,
        {
          name: "M. Dieudonné MBALLA",
          title: "Directeur Général",
          email: "d.mballa@dpl-test.cm",
          phone: "+237 670 11 22 33",
          isRepresentative: true,
        },
        partnerSession
      );
      expect(rep.id).toBeDefined();
      expect(rep.isRepresentative).toBe(true);

      // Retrieve party with contacts
      const partyWithContacts = await getPartyById(company.id, partnerSession);
      expect(partyWithContacts?.contacts.length).toBe(1);
      expect(partyWithContacts?.contacts[0].isRepresentative).toBe(true);

      // Update contact
      const updatedRep = await updatePartyContact(
        rep.id,
        { title: "Président Directeur Général (PDG)" },
        partnerSession
      );
      expect(updatedRep.title).toBe("Président Directeur Général (PDG)");

      // Delete contact
      await deletePartyContact(rep.id, partnerSession);
      const afterDelete = await getPartyById(company.id, partnerSession);
      expect(afterDelete?.contacts.length).toBe(0);
    });
  });
});
