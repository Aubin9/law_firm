import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ZipArchiveBuilder, calculateCrc32 } from "@/server/services/zip-builder";
import {
  isReversibilityExportEnabled,
  toggleReversibilityFlag,
  buildMatterExportArchive,
  buildGlobalReversibilityExport,
  REVERSIBILITY_FLAG_KEY,
} from "@/server/services/reversibility-export-service";
import { storageProvider } from "@/server/storage";
import crypto from "crypto";

describe("Advanced Import/Export & Reversibility Specification (INT-07, NF-12, REC-17)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let accountantSession: AppSession;
  let testMatter: any;
  let testDocument: any;

  beforeAll(async () => {
    // 1. Reset Feature Flag to disabled (air-gap default)
    await db.featureFlag.upsert({
      where: { key: REVERSIBILITY_FLAG_KEY },
      create: {
        key: REVERSIBILITY_FLAG_KEY,
        enabled: false,
        description: "Reversibility export",
      },
      update: {
        enabled: false,
      },
    });

    // 2. Fetch test users
    const [partner, lawyer, accountant] = await Promise.all([
      db.user.findFirst({ where: { role: { key: "PARTNER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" } }),
    ]);

    if (!partner || !lawyer || !accountant) {
      throw new Error("Missing test users");
    }

    partnerSession = {
      user: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        roleKey: "PARTNER",
      },
    } as AppSession;

    lawyerSession = {
      user: {
        id: lawyer.id,
        name: lawyer.name,
        email: lawyer.email,
        roleKey: "LEAD_LAWYER",
      },
    } as AppSession;

    accountantSession = {
      user: {
        id: accountant.id,
        name: accountant.name,
        email: accountant.email,
        roleKey: "ACCOUNTANT",
      },
    } as AppSession;

    // 3. Create or find test matter
    const category = await db.matterCategory.findFirst();
    testMatter = await db.matter.create({
      data: {
        reference: `TEST-REV-${Date.now()}`,
        title: "Dossier Test Export Réversibilité NF-12",
        description: "Litige commercial sous arbitrage CCJA",
        status: "OPEN",
        confidentiality: "STANDARD",
        openedAt: new Date(),
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: partner.id } },
        createdBy: { connect: { id: partner.id } },
        members: {
          create: [{ userId: partner.id, level: "MANAGE" }],
        },
      },
    });

    // Create a document and document version in the matter
    const docCategory = await db.documentCategory.findFirst();
    const docKey = `doc_rev_${Date.now()}`;
    const sampleContent = Buffer.from("Contenu probant du contrat commercial pour test réversibilité.", "utf-8");
    await storageProvider.put(docKey, sampleContent, "text/plain");

    testDocument = await db.document.create({
      data: {
        matter: { connect: { id: testMatter.id } },
        title: "Contenu_Contrat_Commercial",
        category: { connect: { id: docCategory!.id } },
        confidentiality: "STANDARD",
        versions: {
          create: {
            versionNumber: 1,
            fileName: "Contrat_Commercial.txt",
            mimeType: "text/plain",
            sizeBytes: sampleContent.length,
            sha256: crypto.createHash("sha256").update(sampleContent).digest("hex"),
            storageKey: docKey,
            status: "VALIDATED",
            uploadedBy: { connect: { id: partner.id } },
            validatedBy: { connect: { id: partner.id } },
            validatedAt: new Date(),
          },
        },
      },
      include: {
        versions: true,
      },
    });
  });

  afterAll(async () => {
    // Reset flag to disabled
    await db.featureFlag.upsert({
      where: { key: REVERSIBILITY_FLAG_KEY },
      create: { key: REVERSIBILITY_FLAG_KEY, enabled: false, description: "Reversibility" },
      update: { enabled: false },
    });

    if (testMatter) {
      await db.documentVersion.deleteMany({ where: { document: { matterId: testMatter.id } } });
      await db.document.deleteMany({ where: { matterId: testMatter.id } });
      await db.matterMember.deleteMany({ where: { matterId: testMatter.id } });
      await db.matter.deleteMany({ where: { id: testMatter.id } });
    }
  });

  it("1. builds a standard PKZIP archive with valid headers and CRC-32", () => {
    const builder = new ZipArchiveBuilder();
    const sampleData = Buffer.from("Contenu du document de réversibilité", "utf-8");
    const crc = calculateCrc32(sampleData);

    expect(crc).toBeGreaterThan(0);

    builder.addFile("manifest.json", JSON.stringify({ test: true }));
    builder.addFile("pieces/Actes/contrat.txt", sampleData);

    const zipBuffer = builder.build();

    expect(zipBuffer.length).toBeGreaterThan(100);

    // Verify PKZIP local file header signature 0x04034b50
    expect(zipBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Verify PKZIP End of Central Directory signature 0x06054b50 near the end
    const eocdSig = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdSig).toBeGreaterThan(0);
  });

  it("2. enforces feature flag off-switch (air-gap default NF-11)", async () => {
    // When flag is disabled, export must fail with ForbiddenError
    const enabled = await isReversibilityExportEnabled();
    expect(enabled).toBe(false);

    await expect(buildMatterExportArchive(partnerSession, testMatter.id)).rejects.toThrow(
      /air-gap/i
    );
  });

  it("3. restricts flag management to Partners and Technical Admins", async () => {
    // Accountant cannot toggle flag
    await expect(toggleReversibilityFlag(accountantSession, true)).rejects.toThrow();

    // Partner can toggle flag
    const updated = await toggleReversibilityFlag(partnerSession, true);
    expect(updated.enabled).toBe(true);

    const isNowEnabled = await isReversibilityExportEnabled();
    expect(isNowEnabled).toBe(true);
  });

  it("4. generates a complete matter export archive with manifest and SHA-256 sealing", async () => {
    // Enable flag
    await toggleReversibilityFlag(partnerSession, true);

    const exportResult = await buildMatterExportArchive(partnerSession, testMatter.id);

    expect(exportResult.filename).toContain(testMatter.reference);
    expect(exportResult.sizeBytes).toBeGreaterThan(200);
    expect(exportResult.sha256).toBeDefined();
    expect(exportResult.sha256.length).toBe(64); // SHA-256 hex string

    // Verify manifest contents
    const manifest = exportResult.manifest;
    expect(manifest.firmExportFormatVersion).toBe("1.0-OHADA-REVERSIBILITY");
    expect(manifest.matter.reference).toBe(testMatter.reference);
    expect(manifest.documents.length).toBeGreaterThan(0);
    expect(manifest.documents[0].versions[0].archivePath).toContain("pieces/");
    expect(manifest.documents[0].versions[0].sha256Calculated).toBeDefined();

    // Verify audit log entry was recorded
    const auditLog = await db.auditLog.findFirst({
      where: {
        entityId: testMatter.id,
        action: "matter.exported",
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(partnerSession.user.id);
  });

  it("5. restricts global reversibility export to Partner role and logs system audit", async () => {
    // Enable flag
    await toggleReversibilityFlag(partnerSession, true);

    // Accountant cannot perform global firm export
    await expect(buildGlobalReversibilityExport(accountantSession)).rejects.toThrow();

    // Partner can perform global firm export
    const globalExport = await buildGlobalReversibilityExport(partnerSession);
    expect(globalExport.totalMatters).toBeGreaterThan(0);
    expect(globalExport.zipBuffer.length).toBeGreaterThan(200);
    expect(globalExport.sha256.length).toBe(64);

    const auditLog = await db.auditLog.findFirst({
      where: {
        action: "system.reversibility_export",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).toBeDefined();
  });
});
