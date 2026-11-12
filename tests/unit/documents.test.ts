import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocument,
  addDocumentVersion,
  validateDocumentVersion,
  getDocumentById,
  listDocumentsForMatter,
  getDocumentVersionFileForDownload,
} from "@/server/services/document-service";
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

describe("Document Management Specification (STEP 15: DOC-01 to DOC-08, BR-06)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Danielle EBOUMBOU");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Sandrine NGO");
  const outsideLawyerSession = makeSession("usr_secr_01", "SECRETARY", "Mme Jeanne MANDENG");

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  const createdDocIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "CAT-DOC-TEST",
          nameFr: "Conseil & Contentieux",
          nameEn: "Litigation & Advisory",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
    if (createdDocIds.length > 0) {
      await db.documentVersion.deleteMany({
        where: { documentId: { in: createdDocIds } },
      });
      await db.auditLog.deleteMany({
        where: { entityId: { in: createdDocIds } },
      });
      await db.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
      createdDocIds.length = 0;
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

  async function createClearedMatter(title: string, confidentiality: "STANDARD" | "STRICT" = "STANDARD") {
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
        confidentiality,
        additionalMemberUserIds: [
          { userId: associateSession.user.id, level: "EDIT" },
        ],
      },
      leadSession
    );
    createdMatterIds.push(matter.id);
    return matter;
  }

  describe("1. Document Creation & Automatic Versioning (DOC-01, DOC-02)", () => {
    it("creates a document with version 1, SHA-256 hash, and clean scan status", async () => {
      const matter = await createClearedMatter("Dossier Acquisition Portuaire");
      const sampleContent = Buffer.from("Contenu officiel du contrat d'acquisition.");

      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Contrat de cession d'actions",
          fileName: "contrat_cession.pdf",
          mimeType: "application/pdf",
          buffer: sampleContent,
          comment: "Premier projet",
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe("Contrat de cession d'actions");
      expect(doc.versions.length).toBe(1);

      const v1 = doc.versions[0];
      expect(v1.versionNumber).toBe(1);
      expect(v1.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(v1.scanStatus).toBe("CLEAN");
      expect(v1.status).toBe("DRAFT");
    });

    it("adds a second version, keeping previous version intact (DOC-02)", async () => {
      const matter = await createClearedMatter("Dossier Bail Commercial");
      const v1Content = Buffer.from("Version 1 initiale");
      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Bail Commercial Akwa",
          fileName: "bail_v1.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: v1Content,
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      // Add version 2
      const v2Content = Buffer.from("Version 2 amendée après observations du bailleur");
      const v2 = await addDocumentVersion(
        {
          documentId: doc.id,
          fileName: "bail_v2.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: v2Content,
          comment: "Prise en compte des remarques",
        },
        associateSession
      );

      expect(v2.versionNumber).toBe(2);
      expect(v2.sha256).not.toBe(doc.versions[0].sha256);

      const fetched = await getDocumentById(doc.id, leadSession);
      expect(fetched.versions.length).toBe(2);
      expect(fetched.versions[0].versionNumber).toBe(2);
      expect(fetched.versions[1].versionNumber).toBe(1);
    });
  });

  describe("2. Antivirus Scan & Quarantine Guard (DOC-04)", () => {
    it("flags an infected file as INFECTED and prevents its download", async () => {
      const matter = await createClearedMatter("Dossier Test Sécurité");
      // Standard EICAR signature test
      const infectedBuffer = Buffer.from(
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
      );

      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Pièce Jointe Suspecte",
          fileName: "eicar_test.com",
          mimeType: "application/octet-stream",
          buffer: infectedBuffer,
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      expect(doc.versions[0].scanStatus).toBe("INFECTED");

      // Attempting to download the infected file MUST be blocked (DOC-04)
      await expect(
        getDocumentVersionFileForDownload(doc.versions[0].id, leadSession)
      ).rejects.toThrow(/quarantaine|virus|sécurité/i);
    });
  });

  describe("3. Immutability of Validated Versions (DOC-03)", () => {
    it("locks validated version and forbids re-validation", async () => {
      const matter = await createClearedMatter("Dossier Protocole Transactionnel");
      const buffer = Buffer.from("Protocole transactionnel final signé.");

      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Protocole d'accord transactionnel",
          fileName: "protocole_signe.pdf",
          mimeType: "application/pdf",
          buffer,
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      // Validate version
      const validated = await validateDocumentVersion(doc.versions[0].id, leadSession);
      expect(validated.status).toBe("VALIDATED");
      expect(validated.validatedById).toBe(leadSession.user.id);
      expect(validated.validatedAt).not.toBeNull();

      // Attempting to re-validate should throw
      await expect(
        validateDocumentVersion(doc.versions[0].id, leadSession)
      ).rejects.toThrow(/déjà validée/i);
    });
  });

  describe("4. Security Clearance & Download Audit Trail (DOC-05, DOC-06)", () => {
    it("blocks document access for users without matter access", async () => {
      const matter = await createClearedMatter("Dossier Strict Restreint", "STRICT");
      const buffer = Buffer.from("Document confidentiel strict.");

      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Audit Juridique Secret",
          fileName: "secret.pdf",
          mimeType: "application/pdf",
          buffer,
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      // Outside lawyer (not member of STRICT matter) cannot get document metadata or download
      await expect(
        getDocumentById(doc.id, outsideLawyerSession)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        getDocumentVersionFileForDownload(doc.versions[0].id, outsideLawyerSession)
      ).rejects.toThrow(ForbiddenError);
    });

    it("streams clean file to authorized member and records an immutable audit log entry", async () => {
      const matter = await createClearedMatter("Dossier Téléchargement Conforme");
      const buffer = Buffer.from("Fichier sain autorisé au téléchargement.");

      const doc = await createDocument(
        {
          matterId: matter.id,
          title: "Mémoire en défense",
          fileName: "memoire.pdf",
          mimeType: "application/pdf",
          buffer,
        },
        leadSession
      );
      createdDocIds.push(doc.id);

      const downloadResult = await getDocumentVersionFileForDownload(
        doc.versions[0].id,
        associateSession
      );

      expect(downloadResult.fileName).toBe("memoire.pdf");
      expect(downloadResult.sizeBytes).toBe(buffer.length);
      expect(downloadResult.stream).toBeDefined();

      // Verify audit log record exists for document.download
      const auditLog = await db.auditLog.findFirst({
        where: {
          entityId: doc.versions[0].id,
          action: "document.download",
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(associateSession.user.id);
      expect(auditLog?.matterId).toBe(matter.id);
    });
  });
});
