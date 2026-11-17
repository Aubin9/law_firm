import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { storageProvider } from "@/server/storage";
import {
  isPortalEnabled,
  togglePortalFlag,
  inviteClientToPortal,
  activatePortalAccount,
  loginPortalAccount,
  getPortalSession,
  revokePortalAccount,
  listClientMatters,
  getClientMatterDetail,
  downloadClientDocument,
  uploadClientDocument,
  sendClientPortalMessage,
  toggleDocumentShare,
  PORTAL_FLAG_KEY,
} from "@/server/portal";
import {
  Confidentiality,
  DocumentStatus,
  PartyType,
  ScanStatus,
} from "@prisma/client";

describe("Client Portal V4 Specification (EXT-01, docs/PORTAL_DESIGN.md)", () => {
  let partnerSession: AppSession;
  let partnerUser: any;
  let lawyerUser: any;
  let partyA: any;
  let partyB: any;
  let matterA: any;
  let matterB: any;
  let strictMatter: any;
  let sharedCleanDocVersion: any;
  let unsharedDocVersion: any;
  let draftSharedDocVersion: any;
  let matterBDocVersion: any;
  let clientAAccountId: string;
  let clientAActivationToken: string;
  let clientASessionToken: string;

  beforeAll(async () => {
    [partnerUser, lawyerUser] = await Promise.all([
      db.user.findFirst({ where: { role: { key: "PARTNER" }, status: "ACTIVE" } }),
      db.user.findFirst({ where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" } }),
    ]);

    if (!partnerUser || !lawyerUser) {
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

    // Reset portal.enabled to false (air-gap default)
    await db.featureFlag.upsert({
      where: { key: PORTAL_FLAG_KEY },
      create: { key: PORTAL_FLAG_KEY, enabled: false },
      update: { enabled: false },
    });

    // Create Party A & Party B
    partyA = await db.party.create({
      data: {
        type: PartyType.COMPANY,
        displayName: `Client Portail A ${Date.now()}`,
        email: `clienta_${Date.now()}@test.cm`,
      },
    });
    partyB = await db.party.create({
      data: {
        type: PartyType.COMPANY,
        displayName: `Client Portail B ${Date.now()}`,
        email: `clientb_${Date.now()}@test.cm`,
      },
    });

    const category = await db.matterCategory.findFirst();
    const docCat = await db.documentCategory.findFirst();

    // Matter A (STANDARD, for Client A)
    matterA = await db.matter.create({
      data: {
        reference: `PORTAL-A-${Date.now()}`,
        title: "Dossier Commercial Client A",
        status: "OPEN",
        confidentiality: Confidentiality.STANDARD,
        portalEnabled: true,
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        parties: { create: [{ partyId: partyA.id, role: "CLIENT" }] },
        members: { create: [{ userId: partnerUser.id, level: "MANAGE" }] },
      },
    });

    // Matter B (STANDARD, for Client B)
    matterB = await db.matter.create({
      data: {
        reference: `PORTAL-B-${Date.now()}`,
        title: "Dossier Confidentiel Client B",
        status: "OPEN",
        confidentiality: Confidentiality.STANDARD,
        portalEnabled: true,
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        parties: { create: [{ partyId: partyB.id, role: "CLIENT" }] },
        members: { create: [{ userId: partnerUser.id, level: "MANAGE" }] },
      },
    });

    // Strict Matter (blocked from portal)
    strictMatter = await db.matter.create({
      data: {
        reference: `PORTAL-STRICT-${Date.now()}`,
        title: "Dossier Pénal STRICT",
        status: "OPEN",
        confidentiality: Confidentiality.STRICT,
        portalEnabled: false,
        category: { connect: { id: category!.id } },
        leadLawyer: { connect: { id: lawyerUser.id } },
        createdBy: { connect: { id: partnerUser.id } },
        parties: { create: [{ partyId: partyA.id, role: "CLIENT" }] },
        members: { create: [{ userId: partnerUser.id, level: "MANAGE" }] },
      },
    });

    // Create documents in Matter A
    const buf1 = Buffer.from("Assignation validée et partagée", "utf-8");
    const key1 = `portal_test_shared_${Date.now()}`;
    await storageProvider.put(key1, buf1, "text/plain");
    const doc1 = await db.document.create({
      data: {
        matterId: matterA.id,
        title: "Assignation_Validee",
        categoryId: docCat!.id,
        confidentiality: Confidentiality.STANDARD,
        sharedWithClient: true,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "assignation.txt",
            mimeType: "text/plain",
            sizeBytes: buf1.length,
            sha256: crypto.createHash("sha256").update(buf1).digest("hex"),
            storageKey: key1,
            status: DocumentStatus.VALIDATED,
            scanStatus: ScanStatus.CLEAN,
            uploadedById: lawyerUser.id,
          },
        },
      },
      include: { versions: true },
    });
    sharedCleanDocVersion = doc1.versions[0];

    // Unshared document in Matter A
    const buf2 = Buffer.from("Note stratégique interne non partagée", "utf-8");
    const key2 = `portal_test_unshared_${Date.now()}`;
    await storageProvider.put(key2, buf2, "text/plain");
    const doc2 = await db.document.create({
      data: {
        matterId: matterA.id,
        title: "Strategie_Interne_Cabinet",
        categoryId: docCat!.id,
        confidentiality: Confidentiality.STANDARD,
        sharedWithClient: false,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "strategie.txt",
            mimeType: "text/plain",
            sizeBytes: buf2.length,
            sha256: crypto.createHash("sha256").update(buf2).digest("hex"),
            storageKey: key2,
            status: DocumentStatus.VALIDATED,
            scanStatus: ScanStatus.CLEAN,
            uploadedById: lawyerUser.id,
          },
        },
      },
      include: { versions: true },
    });
    unsharedDocVersion = doc2.versions[0];

    // Shared document but DRAFT version in Matter A
    const buf3 = Buffer.from("Brouillon en cours de rédaction", "utf-8");
    const key3 = `portal_test_draft_${Date.now()}`;
    await storageProvider.put(key3, buf3, "text/plain");
    const doc3 = await db.document.create({
      data: {
        matterId: matterA.id,
        title: "Conclusions_Brouillon",
        categoryId: docCat!.id,
        confidentiality: Confidentiality.STANDARD,
        sharedWithClient: true,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "draft.txt",
            mimeType: "text/plain",
            sizeBytes: buf3.length,
            sha256: crypto.createHash("sha256").update(buf3).digest("hex"),
            storageKey: key3,
            status: DocumentStatus.DRAFT,
            scanStatus: ScanStatus.CLEAN,
            uploadedById: lawyerUser.id,
          },
        },
      },
      include: { versions: true },
    });
    draftSharedDocVersion = doc3.versions[0];

    // Document in Matter B
    const bufB = Buffer.from("Document confidentiel du Client B", "utf-8");
    const keyB = `portal_test_b_${Date.now()}`;
    await storageProvider.put(keyB, bufB, "text/plain");
    const docB = await db.document.create({
      data: {
        matterId: matterB.id,
        title: "Piece_Client_B",
        categoryId: docCat!.id,
        confidentiality: Confidentiality.STANDARD,
        sharedWithClient: true,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "client_b.txt",
            mimeType: "text/plain",
            sizeBytes: bufB.length,
            sha256: crypto.createHash("sha256").update(bufB).digest("hex"),
            storageKey: keyB,
            status: DocumentStatus.VALIDATED,
            scanStatus: ScanStatus.CLEAN,
            uploadedById: lawyerUser.id,
          },
        },
      },
      include: { versions: true },
    });
    matterBDocVersion = docB.versions[0];

    // Notes in Matter A: 1 internal, 1 shareable
    await db.note.createMany({
      data: [
        {
          matterId: matterA.id,
          authorId: lawyerUser.id,
          body: "NOTE INTERNE SECRETE : risque élevé de prescription.",
          shareable: false,
        },
        {
          matterId: matterA.id,
          authorId: lawyerUser.id,
          body: "NOTE PARTAGEE : Audience fixée le 15 du mois prochain.",
          shareable: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await db.featureFlag.upsert({
      where: { key: PORTAL_FLAG_KEY },
      create: { key: PORTAL_FLAG_KEY, enabled: false },
      update: { enabled: false },
    });
  });

  it("1. Air-gap default: blocks portal login and activation when portal.enabled is false", async () => {
    expect(await isPortalEnabled()).toBe(false);

    await expect(
      activatePortalAccount("some-token", "SecurePass123!")
    ).rejects.toThrow(/désactivé/);

    await expect(
      loginPortalAccount(partyA.email, "SecurePass123!")
    ).rejects.toThrow(/désactivé/);
  });

  it("2. Blocks inviting a client on a STRICT confidentiality matter", async () => {
    await expect(
      inviteClientToPortal(
        { partyId: partyA.id, matterId: strictMatter.id, email: partyA.email },
        partnerSession
      )
    ).rejects.toThrow(/STRICT/);
  });

  it("3. Full invitation, activation (Argon2id) and isolated login lifecycle", async () => {
    await togglePortalFlag(true, partnerSession);
    expect(await isPortalEnabled()).toBe(true);

    const invite = await inviteClientToPortal(
      { partyId: partyA.id, matterId: matterA.id, email: partyA.email },
      partnerSession
    );
    expect(invite.activationToken).toBeDefined();
    clientAAccountId = invite.account.id;
    clientAActivationToken = invite.activationToken!;

    // Activate account
    const activated = await activatePortalAccount(clientAActivationToken, "CameroonLaw2024!");
    expect(activated.email).toBe(partyA.email.toLowerCase());

    // One-time token cannot be reused
    await expect(
      activatePortalAccount(clientAActivationToken, "AnotherPass123!")
    ).rejects.toThrow(/invalide ou expiré/);

    // Login
    const loginRes = await loginPortalAccount(partyA.email, "CameroonLaw2024!", {
      ipAddress: "127.0.0.1",
    });
    expect(loginRes.rawSessionToken).toBeDefined();
    clientASessionToken = loginRes.rawSessionToken;

    const sessionCtx = await getPortalSession(clientASessionToken);
    expect(sessionCtx).not.toBeNull();
    expect(sessionCtx?.partyId).toBe(partyA.id);
  });

  it("4. Strict Allow-List: exposes ONLY shared validated clean docs and shareable notes", async () => {
    const ctx = await getPortalSession(clientASessionToken);
    expect(ctx).not.toBeNull();

    const matters = await listClientMatters(ctx!);
    expect(matters.length).toBe(1);
    expect(matters[0].id).toBe(matterA.id);

    const detail = await getClientMatterDetail(ctx!, matterA.id);

    // Documents: ONLY Assignation_Validee should be visible
    expect(detail.documents.length).toBe(1);
    expect(detail.documents[0].title).toBe("Assignation_Validee");

    // Notes: ONLY shareable note should be visible, NEVER internal note
    expect(detail.notes.length).toBe(1);
    expect(detail.notes[0].body).toContain("NOTE PARTAGEE");
    expect(detail.notes[0].body).not.toContain("NOTE INTERNE SECRETE");

    // Download shared validated clean document succeeds
    const dl = await downloadClientDocument(ctx!, sharedCleanDocVersion.id);
    expect(dl.buffer.toString("utf-8")).toBe("Assignation validée et partagée");

    // Download unshared or DRAFT document is blocked
    await expect(downloadClientDocument(ctx!, unsharedDocVersion.id)).rejects.toThrow(/pas disponible/);
    await expect(downloadClientDocument(ctx!, draftSharedDocVersion.id)).rejects.toThrow(/pas disponible/);
  });

  it("5. Anti-IDOR / BOLA: Client A cannot access Client B's matter or documents", async () => {
    const ctx = await getPortalSession(clientASessionToken);
    expect(ctx).not.toBeNull();

    await expect(getClientMatterDetail(ctx!, matterB.id)).rejects.toThrow(/Accès refusé/);
    await expect(downloadClientDocument(ctx!, matterBDocVersion.id)).rejects.toThrow(/Accès refusé/);
    await expect(
      sendClientPortalMessage(ctx!, matterB.id, { subject: "Test", body: "Hack" })
    ).rejects.toThrow(/Accès refusé/);

    // Verify audit logged the denied access
    const deniedAudit = await db.auditLog.findFirst({
      where: {
        action: "portal.access.denied",
        matterId: matterB.id,
      },
    });
    expect(deniedAudit).not.toBeNull();
  });

  it("6. Client upload quarantine & messaging", async () => {
    const ctx = await getPortalSession(clientASessionToken);
    expect(ctx).not.toBeNull();

    // Disallowed executable MIME rejected
    await expect(
      uploadClientDocument(ctx!, matterA.id, {
        title: "Malware",
        fileName: "virus.exe",
        mimeType: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
      })
    ).rejects.toThrow(/Format non autorisé/);

    // Valid PDF placed in quarantine (ScanStatus.PENDING)
    const up = await uploadClientDocument(ctx!, matterA.id, {
      title: "Justificatif_Client",
      fileName: "justificatif.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake pdf content"),
    });
    expect(up.scanStatus).toBe(ScanStatus.PENDING);

    // Client message recorded in Communication
    const msg = await sendClientPortalMessage(ctx!, matterA.id, {
      subject: "Question audience",
      body: "Bonjour Maître, à quelle heure est l'audience ?",
    });
    expect(msg.subject).toContain("[Portail]");
  });

  it("7. Document share toggle by lawyer & instant account revocation", async () => {
    // Unshare document
    await toggleDocumentShare(sharedCleanDocVersion.documentId, false, partnerSession);
    const ctx = await getPortalSession(clientASessionToken);
    await expect(downloadClientDocument(ctx!, sharedCleanDocVersion.id)).rejects.toThrow(/pas disponible/);

    // Revoke Client A account -> active session immediately invalidated
    await revokePortalAccount(clientAAccountId, partnerSession);
    const revokedCtx = await getPortalSession(clientASessionToken);
    expect(revokedCtx).toBeNull();
  });
});
