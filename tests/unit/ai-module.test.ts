import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  isAiEnabled,
  checkAiPreconditions,
  requestAiSuggestion,
  acceptAiSuggestion,
  rejectAiSuggestion,
  toggleMatterAiSwitch,
  recordExternalTransferApproval,
  redactText,
  restoreText,
  AI_FLAG_KEY,
} from "@/server/ai";
import { storageProvider } from "@/server/storage";
import {
  TransferProvider,
  Confidentiality,
  AiSuggestionKind,
  AiSuggestionStatus,
} from "@prisma/client";
import crypto from "crypto";

describe("AI Module Specification (Step 27: AI-01 to AI-07, BR-18, REC-25, ARCHITECTURE §10, CLAUDE §8)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let outsiderSession: AppSession;
  let partnerUser: any;
  let lawyerUser: any;
  let outsiderUser: any;
  let testMatter: any;
  let restrictedMatter: any;
  let testDocument: any;
  let testVersion: any;
  let restrictedDocument: any;
  let restrictedVersion: any;
  let approvalId: string;

  beforeAll(async () => {
    // 1. Fetch test users
    [partnerUser, lawyerUser, outsiderUser] = await Promise.all([
      db.user.findFirst({ where: { role: { key: "PARTNER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" } }),
    ]);

    if (!partnerUser || !lawyerUser || !outsiderUser) {
      throw new Error("Missing seeded test users");
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

    // 2. Set feature flag AI_FLAG_KEY to true for test execution
    await db.featureFlag.upsert({
      where: { key: AI_FLAG_KEY },
      create: {
        key: AI_FLAG_KEY,
        enabled: true,
        description: "AI module flag",
      },
      update: {
        enabled: true,
      },
    });

    // 3. Create active ExternalTransferApproval for OPENAI
    const approval = await recordExternalTransferApproval(
      {
        provider: TransferProvider.OPENAI,
        purpose: "Assistance à l'analyse et à la rédaction juridique",
        dataCategories: "Actes de procédure, pièces contractuelles pseudonymisées",
        legalReview: "Revue juridique formelle validée selon la Loi camerounaise n° 2024/017.",
      },
      partnerSession
    );
    approvalId = approval.id;

    // 4. Create standard test matter
    const category = await db.matterCategory.findFirst();
    testMatter = await db.matter.create({
      data: {
        reference: `TEST-AI-STD-${Date.now()}`,
        title: "Dossier Contentieux Commercial Test IA",
        status: "OPEN",
        confidentiality: Confidentiality.STANDARD,
        aiEnabled: true, // enabled per-matter
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

    // 5. Create restricted test matter
    restrictedMatter = await db.matter.create({
      data: {
        reference: `TEST-AI-RST-${Date.now()}`,
        title: "Dossier Confidentiel Défense STRICT",
        status: "OPEN",
        confidentiality: Confidentiality.STRICT,
        aiEnabled: true,
        openedAt: new Date(),
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        members: {
          create: [{ userId: lawyerUser.id, level: "MANAGE" }],
        },
      },
    });

    // 6. Create standard test document in GED
    const docCategory = await db.documentCategory.findFirst();
    const docKey = `doc_ai_test_${Date.now()}`;
    const docBytes = Buffer.from(
      "Aux termes de l'assignation du 12 Janvier 2024, la société demanderesse réclame le paiement de 45 000 000 FCFA.",
      "utf-8"
    );
    await storageProvider.put(docKey, docBytes, "text/plain");

    testDocument = await db.document.create({
      data: {
        matter: { connect: { id: testMatter.id } },
        title: "Assignation_Paiement_Factures",
        category: { connect: { id: docCategory!.id } },
        confidentiality: Confidentiality.STANDARD,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "assignation.txt",
            mimeType: "text/plain",
            sizeBytes: docBytes.length,
            sha256: crypto.createHash("sha256").update(docBytes).digest("hex"),
            storageKey: docKey,
            status: "DRAFT",
            uploadedBy: { connect: { id: lawyerUser.id } },
          },
        },
      },
      include: { versions: true },
    });
    testVersion = testDocument.versions[0];

    // 7. Create restricted document in testMatter
    const rstDocKey = `doc_ai_rst_${Date.now()}`;
    const rstBytes = Buffer.from("Secret des affaires et correspondances confidentielles.", "utf-8");
    await storageProvider.put(rstDocKey, rstBytes, "text/plain");

    restrictedDocument = await db.document.create({
      data: {
        matter: { connect: { id: testMatter.id } },
        title: "Piece_Ultra_Confidentielle",
        category: { connect: { id: docCategory!.id } },
        confidentiality: Confidentiality.RESTRICTED,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "secret.txt",
            mimeType: "text/plain",
            sizeBytes: rstBytes.length,
            sha256: crypto.createHash("sha256").update(rstBytes).digest("hex"),
            storageKey: rstDocKey,
            status: "DRAFT",
            uploadedBy: { connect: { id: lawyerUser.id } },
          },
        },
      },
      include: { versions: true },
    });
    restrictedVersion = restrictedDocument.versions[0];
  });

  afterAll(async () => {
    // Reset AI flag to false (air-gap default)
    await db.featureFlag.upsert({
      where: { key: AI_FLAG_KEY },
      create: { key: AI_FLAG_KEY, enabled: false },
      update: { enabled: false },
    });
  });

  it("1. Air-gap test: blocks AI processing when global flag is off", async () => {
    // Temporarily disable flag
    await db.featureFlag.update({
      where: { key: AI_FLAG_KEY },
      data: { enabled: false },
    });

    await expect(
      requestAiSuggestion(
        {
          matterId: testMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          documentVersionIds: [testVersion.id],
        },
        lawyerSession
      )
    ).rejects.toThrow(/désactivé au niveau du cabinet/);

    // Re-enable flag
    await db.featureFlag.update({
      where: { key: AI_FLAG_KEY },
      data: { enabled: true },
    });
  });

  it("2. Transfer approval test: blocks AI when ExternalTransferApproval is revoked or missing", async () => {
    // Revoke all approvals for OPENAI
    await db.externalTransferApproval.updateMany({
      where: { provider: TransferProvider.OPENAI },
      data: { revokedAt: new Date() },
    });

    await expect(
      requestAiSuggestion(
        {
          matterId: testMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          documentVersionIds: [testVersion.id],
        },
        lawyerSession
      )
    ).rejects.toThrow(/Aucune autorisation formelle de transfert externe/);

    // Un-revoke approval
    await db.externalTransferApproval.update({
      where: { id: approvalId },
      data: { revokedAt: null },
    });
  });

  it("3. Per-matter sovereign switch test: blocks AI when matter.aiEnabled is false", async () => {
    await db.matter.update({
      where: { id: testMatter.id },
      data: { aiEnabled: false },
    });

    await expect(
      requestAiSuggestion(
        {
          matterId: testMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          documentVersionIds: [testVersion.id],
        },
        lawyerSession
      )
    ).rejects.toThrow(/désactivée pour ce dossier spécifique/);

    // Restore
    await db.matter.update({
      where: { id: testMatter.id },
      data: { aiEnabled: true },
    });
  });

  it("4. Confidentiality guards test: strictly rejects STRICT matters and RESTRICTED documents", async () => {
    // A. STRICT matter
    await expect(
      requestAiSuggestion(
        {
          matterId: restrictedMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          rawText: "Texte à résumer",
        },
        lawyerSession
      )
    ).rejects.toThrow(/Traitement IA interdit : Ce dossier a un niveau de confidentialité STRICT/);

    // B. RESTRICTED document in standard matter
    await expect(
      requestAiSuggestion(
        {
          matterId: testMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          documentVersionIds: [restrictedVersion.id],
        },
        lawyerSession
      )
    ).rejects.toThrow(/Traitement IA interdit : La pièce 'Piece_Ultra_Confidentielle' est classée RESTRICTED/);
  });

  it("5. Permission test: denies unauthorized users from invoking AI", async () => {
    await expect(
      requestAiSuggestion(
        {
          matterId: testMatter.id,
          kind: AiSuggestionKind.SUMMARY,
          documentVersionIds: [testVersion.id],
        },
        outsiderSession
      )
    ).rejects.toThrow();
  });

  it("6. Redaction pipeline test: redacts phones, emails, bank accounts and known entities", () => {
    const raw = "M. Jean Dupont (contact: jean.dupont@test.cm, tel: +237 670123456, RIB: 10005 00001 12345678901 45) a versé des fonds.";
    const { redactedText, placeholderMap } = redactText(raw, ["Jean Dupont"]);

    expect(redactedText).not.toContain("Jean Dupont");
    expect(redactedText).not.toContain("jean.dupont@test.cm");
    expect(redactedText).not.toContain("+237 670123456");
    expect(redactedText).toContain("[PERSONNE_1]");
    expect(redactedText).toContain("[EMAIL_1]");
    expect(redactedText).toContain("[TELEPHONE_1]");

    const restored = restoreText(redactedText, placeholderMap);
    expect(restored).toBe(raw);
  });

  it("7. AI suggestion generation & lifecycle: requests, stores, and validates AI suggestion", async () => {
    // A. Request SUMMARY (AI-01)
    const suggestion = await requestAiSuggestion(
      {
        matterId: testMatter.id,
        kind: AiSuggestionKind.SUMMARY,
        documentVersionIds: [testVersion.id],
      },
      lawyerSession
    );

    expect(suggestion.id).toBeDefined();
    expect(suggestion.status).toBe(AiSuggestionStatus.PENDING_REVIEW);
    expect(suggestion.kind).toBe(AiSuggestionKind.SUMMARY);
    expect(suggestion.promptVersion).toBe("1.0.0");
    expect(suggestion.output).toContain("Synthèse Juridique de l'Acte");
    expect(suggestion.sources).toBeDefined();

    // Verify audit log exists
    const audit = await db.auditLog.findFirst({
      where: {
        entityId: suggestion.id,
        action: "ai.request",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.matterId).toBe(testMatter.id);

    // B. Reject suggestion
    const rejectRes = await rejectAiSuggestion(
      suggestion.id,
      testMatter.id,
      "Thèse non applicable au contentieux actuel.",
      lawyerSession
    );
    expect(rejectRes.suggestion.status).toBe(AiSuggestionStatus.REJECTED);
    expect(rejectRes.suggestion.reviewedById).toBe(lawyerUser.id);
  });

  it("8. Draft acceptance (BR-18): accepting DRAFT suggestion creates genuine document version authored by lawyer", async () => {
    // Generate DRAFT suggestion (AI-04)
    const draftSuggestion = await requestAiSuggestion(
      {
        matterId: testMatter.id,
        kind: AiSuggestionKind.DRAFT,
        customInstructions: "Rédiger des conclusions responsives devant le TPI de Douala.",
        documentVersionIds: [testVersion.id],
      },
      lawyerSession
    );

    expect(draftSuggestion.kind).toBe(AiSuggestionKind.DRAFT);
    expect(draftSuggestion.output).toContain("PLAISE AU TRIBUNAL");

    // Accept draft suggestion
    const acceptRes = await acceptAiSuggestion(
      draftSuggestion.id,
      testMatter.id,
      lawyerSession
    );

    expect(acceptRes.suggestion.status).toBe(AiSuggestionStatus.ACCEPTED);
    expect(acceptRes.createdDocumentId).toBeDefined();
    expect(acceptRes.createdVersionId).toBeDefined();

    // Verify document was created in GED and authored by the lawyer (BR-18 compliance)
    const createdDoc = await db.document.findUnique({
      where: { id: acceptRes.createdDocumentId! },
      include: { versions: { include: { uploadedBy: true } } },
    });

    expect(createdDoc).not.toBeNull();
    expect(createdDoc?.matterId).toBe(testMatter.id);
    expect(createdDoc?.versions[0]?.uploadedBy.id).toBe(lawyerUser.id);
    expect(createdDoc?.versions[0]?.status).toBe("DRAFT");
  });

  it("9. Toggle per-matter switch: allows lead lawyer or partner and audits change", async () => {
    const updated = await toggleMatterAiSwitch(testMatter.id, false, lawyerSession);
    expect(updated.aiEnabled).toBe(false);

    const reUpdated = await toggleMatterAiSwitch(testMatter.id, true, partnerSession);
    expect(reUpdated.aiEnabled).toBe(true);

    const audit = await db.auditLog.findFirst({
      where: {
        entityId: testMatter.id,
        action: "matter.ai.toggle",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });
});

