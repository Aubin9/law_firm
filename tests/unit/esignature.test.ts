import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  isEsignatureEnabled,
  toggleEsignatureFlag,
  generateSignatureSeal,
  requestDocumentVisa,
  signDocumentVisa,
  rejectDocumentVisa,
  getDocumentVisaTrail,
  ESIGNATURE_FLAG_KEY,
} from "@/server/services/esignature-service";
import { storageProvider } from "@/server/storage";
import { VisaStatus, VisaRole } from "@prisma/client";
import crypto from "crypto";

describe("Electronic Signature & Visa Circuit Specification (INT-06, Loi n° 2024/017, OHADA)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let outsiderSession: AppSession;
  let partnerUser: any;
  let lawyerUser: any;
  let outsiderUser: any;
  let testMatter: any;
  let testDocument: any;
  let testVersion: any;

  beforeAll(async () => {
    // 1. Reset Feature Flag to disabled (air-gap default)
    await db.featureFlag.upsert({
      where: { key: ESIGNATURE_FLAG_KEY },
      create: {
        key: ESIGNATURE_FLAG_KEY,
        enabled: false,
        description: "Electronic signature & visa circuit",
      },
      update: {
        enabled: false,
      },
    });

    // 2. Fetch test users
    [partnerUser, lawyerUser, outsiderUser] = await Promise.all([
      db.user.findFirst({ where: { role: { key: "PARTNER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" } }),
    ]);

    if (!partnerUser || !lawyerUser || !outsiderUser) {
      throw new Error("Missing test users");
    }

    partnerSession = {
      user: {
        id: partnerUser.id,
        name: partnerUser.name,
        email: partnerUser.email,
        roleKey: "PARTNER",
      },
    } as AppSession;

    lawyerSession = {
      user: {
        id: lawyerUser.id,
        name: lawyerUser.name,
        email: lawyerUser.email,
        roleKey: "LEAD_LAWYER",
      },
    } as AppSession;

    outsiderSession = {
      user: {
        id: outsiderUser.id,
        name: outsiderUser.name,
        email: outsiderUser.email,
        roleKey: "ACCOUNTANT",
      },
    } as AppSession;

    // 3. Create test matter
    const category = await db.matterCategory.findFirst();
    testMatter = await db.matter.create({
      data: {
        reference: `TEST-ESIGN-${Date.now()}`,
        title: "Dossier Test Circuit de Visa et Parapheur",
        description: "Conclusions en défense devant le TGI de Douala",
        status: "OPEN",
        confidentiality: "STANDARD",
        openedAt: new Date(),
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        members: {
          create: [
            { userId: partnerUser.id, level: "MANAGE" },
            { userId: lawyerUser.id, level: "MANAGE" },
          ],
        },
      },
    });

    // 4. Create test document in GED
    const docCategory = await db.documentCategory.findFirst();
    const docKey = `doc_esign_${Date.now()}`;
    const sampleBytes = Buffer.from("Projet de conclusions récapitulatives n°2 pour visa.", "utf-8");
    await storageProvider.put(docKey, sampleBytes, "text/plain");

    const sha256 = crypto.createHash("sha256").update(sampleBytes).digest("hex");

    testDocument = await db.document.create({
      data: {
        matter: { connect: { id: testMatter.id } },
        title: "Conclusions_Recapitulatives_Defense",
        category: { connect: { id: docCategory!.id } },
        confidentiality: "STANDARD",
        versions: {
          create: {
            versionNumber: 1,
            fileName: "conclusions_v1.txt",
            mimeType: "text/plain",
            sizeBytes: sampleBytes.length,
            sha256,
            storageKey: docKey,
            status: "DRAFT",
            uploadedBy: { connect: { id: lawyerUser.id } },
          },
        },
      },
      include: {
        versions: true,
      },
    });

    testVersion = testDocument.versions[0];
  });

  afterAll(async () => {
    // Reset flag
    await db.featureFlag.upsert({
      where: { key: ESIGNATURE_FLAG_KEY },
      create: { key: ESIGNATURE_FLAG_KEY, enabled: false, description: "E-signature" },
      update: { enabled: false },
    });

    if (testMatter) {
      await db.documentVisa.deleteMany({ where: { documentVersion: { document: { matterId: testMatter.id } } } });
      await db.documentVersion.deleteMany({ where: { document: { matterId: testMatter.id } } });
      await db.document.deleteMany({ where: { matterId: testMatter.id } });
      await db.matterMember.deleteMany({ where: { matterId: testMatter.id } });
      await db.matter.deleteMany({ where: { id: testMatter.id } });
    }
  });

  it("1. generates a tamper-evident HMAC signature seal", () => {
    const timestamp = new Date();
    const digest = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const seal1 = generateSignatureSeal("v1", digest, "u1", timestamp);
    const seal2 = generateSignatureSeal("v1", digest, "u1", timestamp);
    const sealDifferentDigest = generateSignatureSeal("v1", "different", "u1", timestamp);

    expect(seal1).toBeDefined();
    expect(seal1.length).toBe(64);
    expect(seal1).toBe(seal2); // Deterministic for same inputs
    expect(seal1).not.toBe(sealDifferentDigest);
  });

  it("2. enforces feature flag off-switch (air-gap default NF-11)", async () => {
    const enabled = await isEsignatureEnabled();
    expect(enabled).toBe(false);

    // Requesting visa when flag is disabled must throw ForbiddenError
    await expect(
      requestDocumentVisa(lawyerSession, {
        documentVersionId: testVersion.id,
        signatoryId: partnerUser.id,
      })
    ).rejects.toThrow(/air-gap/i);
  });

  it("3. restricts flag management to Partners and Technical Admins", async () => {
    // Non-partner cannot toggle flag
    await expect(toggleEsignatureFlag(outsiderSession, true)).rejects.toThrow();

    // Partner can toggle flag
    const flag = await toggleEsignatureFlag(partnerSession, true);
    expect(flag.enabled).toBe(true);

    const isNowEnabled = await isEsignatureEnabled();
    expect(isNowEnabled).toBe(true);
  });

  it("4. initiates document visa request and creates pending record with SHA-256", async () => {
    await toggleEsignatureFlag(partnerSession, true);

    const visa = await requestDocumentVisa(lawyerSession, {
      documentVersionId: testVersion.id,
      signatoryId: partnerUser.id,
      role: VisaRole.PARTNER,
      comment: "Pour signature finale avant dépôt au greffe",
    });

    expect(visa.id).toBeDefined();
    expect(visa.status).toBe(VisaStatus.PENDING);
    expect(visa.role).toBe(VisaRole.PARTNER);
    expect(visa.sha256Digest).toBe(testVersion.sha256);
    expect(visa.signatoryId).toBe(partnerUser.id);

    // Verify audit log
    const audit = await db.auditLog.findFirst({
      where: {
        entityId: visa.id,
        action: "document.visa_requested",
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(lawyerSession.user.id);
  });

  it("5. rejects visa when written motivation is provided, blocks unauthorized rejection", async () => {
    await toggleEsignatureFlag(partnerSession, true);

    const visa = await requestDocumentVisa(lawyerSession, {
      documentVersionId: testVersion.id,
      signatoryId: partnerUser.id,
      role: VisaRole.PARTNER,
    });

    // Outsider cannot reject
    await expect(
      rejectDocumentVisa(outsiderSession, {
        visaId: visa.id,
        reason: "Refus injustifié",
      })
    ).rejects.toThrow();

    // Empty reason must fail validation
    await expect(
      rejectDocumentVisa(partnerSession, {
        visaId: visa.id,
        reason: "   ",
      })
    ).rejects.toThrow();

    // Valid rejection with reason
    const rejected = await rejectDocumentVisa(partnerSession, {
      visaId: visa.id,
      reason: "Corriger l'article 15 des conclusions avant signature.",
    });

    expect(rejected.status).toBe(VisaStatus.REJECTED);
    expect(rejected.comment).toBe("Corriger l'article 15 des conclusions avant signature.");

    // Cannot re-process an already processed visa
    await expect(
      signDocumentVisa(partnerSession, {
        visaId: visa.id,
      })
    ).rejects.toThrow(/déjà été traité/i);
  });

  it("6. validates electronic signature, records cryptographic seal and transitions document version to VALIDATED", async () => {
    await toggleEsignatureFlag(partnerSession, true);

    const visa = await requestDocumentVisa(lawyerSession, {
      documentVersionId: testVersion.id,
      signatoryId: partnerUser.id,
      role: VisaRole.PARTNER,
      comment: "Soumis pour visa d'associé",
    });

    // Partner signs
    const signed = await signDocumentVisa(partnerSession, {
      visaId: visa.id,
      comment: "Lu et approuvé. Bon pour signification.",
      ipAddress: "192.168.1.100",
    });

    expect(signed.status).toBe(VisaStatus.APPROVED);
    expect(signed.signedAt).toBeDefined();
    expect(signed.signatureSeal).toBeDefined();
    expect(signed.signatureSeal?.length).toBe(64);

    // Verify document version transitioned to VALIDATED
    const updatedVersion = await db.documentVersion.findUnique({
      where: { id: testVersion.id },
    });
    expect(updatedVersion?.status).toBe("VALIDATED");
    expect(updatedVersion?.validatedById).toBe(partnerUser.id);
    expect(updatedVersion?.validatedAt).toBeDefined();

    // Verify full visa trail retrieval
    const trail = await getDocumentVisaTrail(lawyerSession, testVersion.id);
    expect(trail.length).toBeGreaterThan(0);
    const approvedEntry = trail.find((t) => t.id === visa.id);
    expect(approvedEntry?.status).toBe(VisaStatus.APPROVED);
    expect(approvedEntry?.signatureSeal).toBe(signed.signatureSeal);
  });
});

