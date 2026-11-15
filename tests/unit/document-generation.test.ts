import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  seedBuiltinTemplates,
  listDocumentTemplates,
  substituteVariables,
  getTemplatePreview,
  generateDocumentFromTemplate,
  toggleTemplateGenerationFlag,
  checkTemplateGenerationPreconditions,
} from "@/server/services/document-generation-service";

describe("Document Generation from Templates (Step 26: INT-05)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let outsiderSession: AppSession;

  let testMatter: any;
  let clientParty: any;
  let opposingParty: any;
  let initialFlagState: boolean = false;

  beforeAll(async () => {
    // 1. Fetch test users
    const [partnerUser, lawyerUser, accountantUser] = await Promise.all([
      db.user.findFirst({
        where: { role: { key: "PARTNER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" },
      }),
    ]);

    if (!partnerUser || !lawyerUser || !accountantUser) {
      throw new Error("Missing test users for document generation tests");
    }

    partnerSession = {
      user: {
        id: partnerUser.id,
        name: partnerUser.name,
        email: partnerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: partnerUser.roleId,
        roleKey: "PARTNER",
      },
      session: {
        id: "sess_docgen_partner",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_docgen_partner",
      },
    };

    lawyerSession = {
      user: {
        id: lawyerUser.id,
        name: lawyerUser.name,
        email: lawyerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: lawyerUser.roleId,
        roleKey: "LEAD_LAWYER",
      },
      session: {
        id: "sess_docgen_lawyer",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_docgen_lawyer",
      },
    };

    outsiderSession = {
      user: {
        id: accountantUser.id,
        name: accountantUser.name,
        email: accountantUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: accountantUser.roleId,
        roleKey: "ACCOUNTANT",
      },
      session: {
        id: "sess_docgen_outsider",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_docgen_outsider",
      },
    };

    // 2. Remember initial flag state
    const flag = await db.featureFlag.findUnique({
      where: { key: "templates.generation.enabled" },
    });
    if (flag) {
      initialFlagState = flag.enabled;
    }
    await toggleTemplateGenerationFlag(partnerSession, true);

    // 3. Seed builtin templates
    await seedBuiltinTemplates();

    // 4. Create client party and opposing party
    clientParty = await db.party.create({
      data: {
        type: "COMPANY",
        companyName: "Société Civile Immobilière du Littoral",
        displayName: "Société Civile Immobilière du Littoral",
        address: "Rue Joss, Bonanjo, Douala",
        taxId: "M012345678901A",
        registrationNumber: "RC/DLA/2026/B/100",
      },
    });

    opposingParty = await db.party.create({
      data: {
        type: "COMPANY",
        companyName: "Entreprise Camerounaise de BTP SA",
        displayName: "Entreprise Camerounaise de BTP SA",
        address: "Zone Industrielle de Bassa, Douala",
      },
    });

    // 5. Create test matter
    const category = await db.matterCategory.findFirst();
    if (!category) {
      throw new Error("No matter category found in test database");
    }

    testMatter = await db.matter.create({
      data: {
        reference: "DOS-2026-DOCGEN",
        title: "Contentieux Travaux BTP Littoral",
        confidentiality: "RESTRICTED",
        category: { connect: { id: category.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        parties: {
          create: [
            { partyId: clientParty.id, role: "CLIENT" },
            { partyId: opposingParty.id, role: "OPPOSING_PARTY" },
          ],
        },
      },
    });

    // Add lawyer as member
    await db.matterMember.create({
      data: {
        matterId: testMatter.id,
        userId: lawyerUser.id,
        level: "MANAGE",
      },
    });
  });

  afterAll(async () => {
    // Restore initial flag state
    await toggleTemplateGenerationFlag(partnerSession, initialFlagState);

    // Clean up created entities
    if (testMatter) {
      await db.documentVersion.deleteMany({
        where: { document: { matterId: testMatter.id } },
      });
      await db.document.deleteMany({
        where: { matterId: testMatter.id },
      });
      await db.matterMember.deleteMany({
        where: { matterId: testMatter.id },
      });
      await db.matterParty.deleteMany({
        where: { matterId: testMatter.id },
      });
      await db.auditLog.deleteMany({
        where: { matterId: testMatter.id },
      });
      await db.matter.delete({ where: { id: testMatter.id } });
    }

    if (clientParty) {
      await db.party.delete({ where: { id: clientParty.id } });
    }
    if (opposingParty) {
      await db.party.delete({ where: { id: opposingParty.id } });
    }
  });

  it("1. lists all active built-in legal templates (OHADA & Cameroon)", async () => {
    const templates = await listDocumentTemplates(lawyerSession);
    expect(templates.length).toBeGreaterThanOrEqual(4);

    const keys = templates.map((t) => t.key);
    expect(keys).toContain("MANDATE_REPRESENTATION_FR");
    expect(keys).toContain("FEE_AGREEMENT_STANDARD");
    expect(keys).toContain("FORMAL_NOTICE_DEFAULT");
    expect(keys).toContain("OHADA_PIECES_SCHEDULE");
  });

  it("2. substitutes variables accurately and flags missing optional variables", () => {
    const rawTemplate = "Affaire: {{matter.reference}} - Client: {{client.name}} - Inconnu: {{missing.var}}";
    const vars = {
      "matter.reference": "DOS-2026-DOCGEN",
      "client.name": "SCI Littoral",
    };

    const res = substituteVariables(rawTemplate, vars);
    expect(res.rendered).toContain("Affaire: DOS-2026-DOCGEN");
    expect(res.rendered).toContain("Client: SCI Littoral");
    expect(res.rendered).toContain("[À COMPLÉTER: missing.var]");
    expect(res.missingVariables).toEqual(["missing.var"]);
  });

  it("3. previews a document template rendering with real matter context data", async () => {
    const template = await db.documentTemplate.findUnique({
      where: { key: "MANDATE_REPRESENTATION_FR" },
    });
    expect(template).toBeDefined();

    const preview = await getTemplatePreview(
      lawyerSession,
      template!.id,
      testMatter.id,
      { "custom.powers": "Pouvoirs étendus de représentation en justice" }
    );

    expect(preview.rendered).toContain(testMatter.reference);
    expect(preview.rendered).toContain(clientParty.displayName);
    expect(preview.rendered).toContain(clientParty.taxId);
    expect(preview.rendered).toContain("Pouvoirs étendus de représentation en justice");
    expect(preview.missingVariables.length).toBe(0);
  });

  it("4. generates and stores document v1 in the matter, creating an audit log entry", async () => {
    const template = await db.documentTemplate.findUnique({
      where: { key: "FORMAL_NOTICE_DEFAULT" },
    });
    expect(template).toBeDefined();

    const res = await generateDocumentFromTemplate(lawyerSession, {
      templateId: template!.id,
      matterId: testMatter.id,
      customVariables: {
        "custom.claimAmount": "12500000",
        "custom.remedyPeriodDays": "15",
        "custom.claimCause": "Factures de matériaux impayées n° 102 à 108",
      },
    });

    expect(res.document).toBeDefined();
    expect(res.document.matterId).toBe(testMatter.id);
    expect(res.document.versions.length).toBe(1);
    expect(res.document.versions[0].versionNumber).toBe(1);
    expect(res.document.versions[0].status).toBe("DRAFT");

    // Verify AuditLog
    const audit = await db.auditLog.findFirst({
      where: {
        action: "document.generated_from_template",
        entityId: res.document.id,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(lawyerSession.user.id);
    expect(audit?.matterId).toBe(testMatter.id);
  });

  it("5. blocks document generation when feature flag templates.generation.enabled is disabled", async () => {
    // Turn flag OFF
    await toggleTemplateGenerationFlag(partnerSession, false);

    const template = await db.documentTemplate.findUnique({
      where: { key: "FORMAL_NOTICE_DEFAULT" },
    });

    await expect(
      generateDocumentFromTemplate(lawyerSession, {
        templateId: template!.id,
        matterId: testMatter.id,
      })
    ).rejects.toThrow(/désactivée par la politique du cabinet/);

    // Turn flag back ON
    await toggleTemplateGenerationFlag(partnerSession, true);
  });

  it("6. blocks preview or generation when user has no access to the matter (confidentiality)", async () => {
    const template = await db.documentTemplate.findUnique({
      where: { key: "FORMAL_NOTICE_DEFAULT" },
    });

    // outsiderSession (Accountant) has no member role on RESTRICTED matter
    await expect(
      generateDocumentFromTemplate(outsiderSession, {
        templateId: template!.id,
        matterId: testMatter.id,
      })
    ).rejects.toThrow();
  });
});
