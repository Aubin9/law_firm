import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { parseEml } from "@/server/services/email-parser";
import {
  importEmailToMatter,
  toggleEmailAssociationFlag,
} from "@/server/services/email-association-service";
import { CommunicationChannel, CommunicationDirection } from "@prisma/client";

describe("Email Association to Matters (Step 26: INT-04)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let outsiderSession: AppSession;

  let testMatter: any;
  let clientParty: any;

  const sampleEmlContent = `From: "Paul NDOUMBE" <ndoumbe@sci-littoral.cm>
To: "Maître Avocat" <avocat@cabinet-associes.cm>
Cc: "Secrétariat" <secretariat@cabinet-associes.cm>
Date: Fri, 13 Nov 2026 10:15:00 +0100
Subject: =?UTF-8?B?VHJhbnNtaXNzaW9uIGRlcyBwacOoY2VzIGRlIGZvbmRhdGlvbg==?=
Content-Type: multipart/mixed; boundary="BOUNDARY_TEST_123"

--BOUNDARY_TEST_123
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

Bonjour Ma=C3=AEtre,

Veuillez trouver ci-joint les documents requis pour la r=C3=A9daction de l'=
assignation en justice.

Restant =C3=A0 votre disposition,
Paul NDOUMBE
--BOUNDARY_TEST_123
Content-Type: application/pdf
Content-Disposition: attachment; filename="pv_constat_huissier.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiAvRmlsdGVyIC9G
bGF0ZURlY29kZSA+PgpzdHJlYW0KeAEr5HIKWbB30d5Fe4sBCRMEegplbmRzdHJlYW0KZW5kb2Jq
Cg==
--BOUNDARY_TEST_123--
`;

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
      throw new Error("Missing test users");
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
        id: "sess_email_partner",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_email_partner",
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
        id: "sess_email_lawyer",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_email_lawyer",
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
        id: "sess_email_outsider",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_email_outsider",
      },
    };

    // 2. Enable flag for tests
    await toggleEmailAssociationFlag(partnerSession, true);

    const category = await db.matterCategory.findFirst();
    if (!category) throw new Error("Missing matter category");

    // 3. Create client party with email matching sender
    clientParty = await db.party.create({
      data: {
        type: "COMPANY",
        companyName: "SCI Littoral Douala",
        displayName: "SCI Littoral Douala",
        email: "ndoumbe@sci-littoral.cm",
        address: "Bonanjo, Douala",
      },
    });

    // 4. Create test matter
    testMatter = await db.matter.create({
      data: {
        reference: "DOS-2026-EMAIL",
        title: "Contentieux Foncier et BTP Littoral",
        confidentiality: "RESTRICTED",
        category: { connect: { id: category.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        parties: {
          create: [{ partyId: clientParty.id, role: "CLIENT" }],
        },
        members: {
          create: [{ userId: lawyerUser.id, level: "MANAGE" }],
        },
      },
    });
  });

  afterAll(async () => {
    // Reset flag to false (Air-gap étanche)
    await toggleEmailAssociationFlag(partnerSession, false);

    if (testMatter) {
      await db.communication.deleteMany({ where: { matterId: testMatter.id } });
      await db.documentVersion.deleteMany({ where: { document: { matterId: testMatter.id } } });
      await db.document.deleteMany({ where: { matterId: testMatter.id } });
      await db.matterMember.deleteMany({ where: { matterId: testMatter.id } });
      await db.matterParty.deleteMany({ where: { matterId: testMatter.id } });
      await db.auditLog.deleteMany({ where: { matterId: testMatter.id } });
      await db.matter.delete({ where: { id: testMatter.id } });
    }

    if (clientParty) {
      await db.party.delete({ where: { id: clientParty.id } });
    }
  });

  it("1. parses standard RFC 822 .eml headers, body and attachments accurately", () => {
    const parsed = parseEml(sampleEmlContent);

    expect(parsed.fromEmail).toBe("ndoumbe@sci-littoral.cm");
    expect(parsed.to).toContain("avocat@cabinet-associes.cm");
    expect(parsed.subject).toBe("Transmission des pièces de fondation");
    expect(parsed.bodyText).toContain("assignation en justice");
    expect(parsed.attachments.length).toBe(1);
    expect(parsed.attachments[0].filename).toBe("pv_constat_huissier.pdf");
    expect(parsed.attachments[0].sizeBytes).toBeGreaterThan(0);
  });

  it("2. imports .eml into matter, creating Communication record and archiving in GED", async () => {
    const emlBuffer = Buffer.from(sampleEmlContent, "utf-8");

    const res = await importEmailToMatter(lawyerSession, {
      matterId: testMatter.id,
      emlBuffer,
      emlFileName: "message_client_ndoumbe.eml",
      saveAttachmentsToGed: true,
    });

    expect(res.communication).toBeDefined();
    expect(res.communication.channel).toBe(CommunicationChannel.EMAIL);
    expect(res.communication.direction).toBe(CommunicationDirection.INBOUND);
    expect(res.communication.subject).toBe("Transmission des pièces de fondation");
    expect(res.communication.partyId).toBe(clientParty.id); // Auto-matched

    // Check eml document in GED
    expect(res.emlDocument).toBeDefined();
    expect(res.emlDocument.versions[0].mimeType).toBe("message/rfc822");

    // Check attachment ingested in GED
    expect(res.attachedDocIds.length).toBe(1);

    const attachedDoc = await db.document.findUnique({
      where: { id: res.attachedDocIds[0] },
      include: { versions: true },
    });
    expect(attachedDoc).toBeDefined();
    expect(attachedDoc?.title).toContain("pv_constat_huissier.pdf");
    expect(attachedDoc?.versions.length).toBe(1);
    expect(attachedDoc?.versions[0].versionNumber).toBe(1);

    // Verify AuditLog entry
    const audit = await db.auditLog.findFirst({
      where: {
        action: "email.associated_to_matter",
        entityId: res.communication.id,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(lawyerSession.user.id);
  });

  it("3. blocks email association when feature flag email.association.enabled is off", async () => {
    await toggleEmailAssociationFlag(partnerSession, false);

    const emlBuffer = Buffer.from(sampleEmlContent, "utf-8");

    await expect(
      importEmailToMatter(lawyerSession, {
        matterId: testMatter.id,
        emlBuffer,
        emlFileName: "test.eml",
      })
    ).rejects.toThrow(/désactivée par la politique du cabinet/);

    await toggleEmailAssociationFlag(partnerSession, true);
  });

  it("4. rejects import if user does not have EDIT access to the matter", async () => {
    const emlBuffer = Buffer.from(sampleEmlContent, "utf-8");

    await expect(
      importEmailToMatter(outsiderSession, {
        matterId: testMatter.id,
        emlBuffer,
        emlFileName: "test.eml",
      })
    ).rejects.toThrow();
  });
});
