import crypto from "crypto";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/auth/errors";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import { storageProvider } from "@/server/storage";
import {
  CommunicationChannel,
  CommunicationDirection,
  Confidentiality,
  DocumentStatus,
  PaymentStatus,
  ScanStatus,
} from "@prisma/client";
import { isPortalEnabled, PORTAL_FLAG_KEY, PortalSessionContext } from "./portal-auth";

const MAX_PORTAL_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_PORTAL_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Verifies that the authenticated client portal account has active access to a specific matter.
 * Strict allow-list: denies STRICT/RESTRICTED matters, deleted matters, and matters with portalEnabled=false.
 */
export async function assertPortalMatterAccess(
  portalSession: PortalSessionContext,
  matterId: string
) {
  const enabled = await isPortalEnabled();
  if (!enabled) {
    throw new ForbiddenError("Le portail client est actuellement désactivé.");
  }

  const access = await db.clientPortalMatterAccess.findUnique({
    where: {
      accountId_matterId: {
        accountId: portalSession.accountId,
        matterId,
      },
    },
    include: {
      matter: {
        include: {
          category: true,
          leadLawyer: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (
    !access ||
    access.revokedAt !== null ||
    !access.matter ||
    access.matter.deletedAt !== null ||
    !access.matter.portalEnabled ||
    access.matter.confidentiality === Confidentiality.STRICT ||
    access.matter.confidentiality === Confidentiality.RESTRICTED
  ) {
    await logAudit({
      action: "portal.access.denied",
      entityType: "Matter",
      entityId: matterId,
      matterId,
      metadata: {
        accountId: portalSession.accountId,
        partyId: portalSession.partyId,
      },
    });
    throw new ForbiddenError("Accès refusé à ce dossier sur le portail client.");
  }

  return access.matter;
}

/**
 * Lists matters accessible to the logged-in client using strict public DTOs.
 */
export async function listClientMatters(portalSession: PortalSessionContext) {
  const enabled = await isPortalEnabled();
  if (!enabled) {
    throw new ForbiddenError("Le portail client est actuellement désactivé.");
  }

  const accesses = await db.clientPortalMatterAccess.findMany({
    where: {
      accountId: portalSession.accountId,
      revokedAt: null,
      matter: {
        deletedAt: null,
        portalEnabled: true,
        confidentiality: Confidentiality.STANDARD,
      },
    },
    include: {
      matter: {
        include: {
          category: true,
          leadLawyer: { select: { name: true } },
        },
      },
    },
    orderBy: { grantedAt: "desc" },
  });

  return accesses.map((a) => ({
    id: a.matter.id,
    reference: a.matter.reference,
    title: a.matter.title,
    status: a.matter.status,
    categoryFr: a.matter.category.nameFr,
    categoryEn: a.matter.category.nameEn,
    leadLawyerName: a.matter.leadLawyer.name,
    openedAt: a.matter.openedAt,
  }));
}

/**
 * Returns strictly filtered, client-visible matter details (allow-list only).
 * Never exposes internal notes (shareable=false), DRAFT document versions,
 * tasks, conflict checks, audit logs, or AI suggestions.
 */
export async function getClientMatterDetail(
  portalSession: PortalSessionContext,
  matterId: string
) {
  const matter = await assertPortalMatterAccess(portalSession, matterId);

  const [documents, shareableNotes, sharedEvents, invoices, portalMessages] = await Promise.all([
    // 1. Only shared, non-deleted, STANDARD documents with VALIDATED + CLEAN versions
    db.document.findMany({
      where: {
        matterId,
        deletedAt: null,
        sharedWithClient: true,
        confidentiality: Confidentiality.STANDARD,
      },
      include: {
        category: true,
        versions: {
          where: {
            status: DocumentStatus.VALIDATED,
            scanStatus: ScanStatus.CLEAN,
          },
          orderBy: { versionNumber: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),

    // 2. Only notes explicitly flagged shareable=true
    db.note.findMany({
      where: {
        matterId,
        shareable: true,
      },
      include: {
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 3. Only events explicitly flagged sharedWithClient=true
    db.event.findMany({
      where: {
        matterId,
        sharedWithClient: true,
      },
      orderBy: { startsAt: "asc" },
    }),

    // 4. Only issued, non-cancelled invoices belonging to this client party
    db.invoice.findMany({
      where: {
        matterId,
        partyId: portalSession.partyId,
        issuedAt: { not: null },
        cancelledAt: null,
      },
      include: {
        payments: {
          where: { status: PaymentStatus.VALIDATED },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),

    // 5. Portal messages exchanged with this client party
    db.communication.findMany({
      where: {
        matterId,
        partyId: portalSession.partyId,
        confidentiality: Confidentiality.STANDARD,
        subject: { startsWith: "[Portail]" },
      },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  await logAudit({
    action: "portal.matter.viewed",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: {
      accountId: portalSession.accountId,
      partyId: portalSession.partyId,
    },
  });

  // Map to strict client-safe DTOs
  return {
    matter: {
      id: matter.id,
      reference: matter.reference,
      title: matter.title,
      status: matter.status,
      categoryFr: matter.category.nameFr,
      categoryEn: matter.category.nameEn,
      leadLawyerName: matter.leadLawyer.name,
      openedAt: matter.openedAt,
    },
    documents: documents
      .filter((d) => d.versions.length > 0)
      .map((d) => ({
        id: d.id,
        title: d.title,
        categoryFr: d.category?.nameFr || "Pièce",
        categoryEn: d.category?.nameEn || "Document",
        latestVersion: {
          id: d.versions[0].id,
          versionNumber: d.versions[0].versionNumber,
          fileName: d.versions[0].fileName,
          mimeType: d.versions[0].mimeType,
          sizeBytes: d.versions[0].sizeBytes,
          sha256: d.versions[0].sha256,
          createdAt: d.versions[0].createdAt,
        },
      })),
    notes: shareableNotes.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author.name,
      createdAt: n.createdAt,
    })),
    events: sharedEvents.map((e) => ({
      id: e.id,
      type: e.type,
      status: e.status,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
    })),
    invoices: invoices.map((inv) => {
      const total = Number(inv.total);
      const paid = inv.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      return {
        id: inv.id,
        number: inv.number,
        currency: inv.currency,
        total,
        paid,
        remainingDue: Math.max(0, total - paid),
        issuedAt: inv.issuedAt,
        dueAt: inv.dueAt,
      };
    }),
    messages: portalMessages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject?.replace(/^\[Portail\]\s*/i, "") || "Message",
      body: m.body || "",
      occurredAt: m.occurredAt,
    })),
  };
}

/**
 * Downloads a shared, validated, and clean document version for an authenticated client.
 */
export async function downloadClientDocument(
  portalSession: PortalSessionContext,
  versionId: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });

  if (!version || !version.document) {
    throw new NotFoundError("Document introuvable.");
  }

  await assertPortalMatterAccess(portalSession, version.document.matterId);

  if (
    version.document.deletedAt !== null ||
    !version.document.sharedWithClient ||
    version.document.confidentiality !== Confidentiality.STANDARD ||
    version.status !== DocumentStatus.VALIDATED ||
    version.scanStatus !== ScanStatus.CLEAN
  ) {
    await logAudit({
      action: "portal.access.denied",
      entityType: "DocumentVersion",
      entityId: versionId,
      matterId: version.document.matterId,
      metadata: {
        accountId: portalSession.accountId,
        reason: "Document not shared, not validated, or not clean",
      },
    });
    throw new ForbiddenError("Cette pièce n'est pas disponible au téléchargement client.");
  }

  const buffer = await storageProvider.getBuffer(version.storageKey);

  await logAudit({
    action: "portal.document.downloaded",
    entityType: "DocumentVersion",
    entityId: versionId,
    matterId: version.document.matterId,
    metadata: {
      accountId: portalSession.accountId,
      sha256: version.sha256,
      ipAddress: meta?.ipAddress,
    },
  });

  return {
    buffer,
    fileName: version.fileName,
    mimeType: version.mimeType,
  };
}

/**
 * Allows a client to upload a supporting document into quarantine (ScanStatus.PENDING, DRAFT).
 */
export async function uploadClientDocument(
  portalSession: PortalSessionContext,
  matterId: string,
  input: { title: string; fileName: string; mimeType: string; buffer: Buffer }
) {
  const matter = await assertPortalMatterAccess(portalSession, matterId);

  if (!input.buffer || input.buffer.length === 0) {
    throw new ValidationError("Le fichier est vide.");
  }
  if (input.buffer.length > MAX_PORTAL_UPLOAD_BYTES) {
    throw new ValidationError("La taille maximale autorisée par fichier est de 20 Mo.");
  }
  if (!ALLOWED_PORTAL_MIME_TYPES.has(input.mimeType)) {
    throw new ValidationError(
      "Format non autorisé. Formats acceptés : PDF, JPEG, PNG, TXT, DOCX."
    );
  }

  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const storageKey = `portal/${matterId}/${Date.now()}-${crypto.randomUUID()}`;
  await storageProvider.put(storageKey, input.buffer, input.mimeType);

  const defaultCategory = await db.documentCategory.findFirst();

  const doc = await db.document.create({
    data: {
      matterId,
      title: input.title.trim() || input.fileName,
      categoryId: defaultCategory?.id || null,
      confidentiality: Confidentiality.STANDARD,
      sharedWithClient: true,
      sharedAt: new Date(),
      versions: {
        create: {
          versionNumber: 1,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.buffer.length,
          sha256,
          storageKey,
          status: DocumentStatus.DRAFT,
          scanStatus: ScanStatus.PENDING, // Mandatory quarantine until internal scan/review
          comment: `Dépôt client via Portail (${portalSession.partyName}) — En quarantaine antivirus.`,
          uploadedById: matter.leadLawyerId,
        },
      },
    },
    include: { versions: true },
  });

  await logAudit({
    action: "portal.document.uploaded",
    entityType: "Document",
    entityId: doc.id,
    matterId,
    metadata: {
      accountId: portalSession.accountId,
      fileName: input.fileName,
      sizeBytes: input.buffer.length,
      sha256,
    },
  });

  return {
    documentId: doc.id,
    versionId: doc.versions[0].id,
    scanStatus: ScanStatus.PENDING,
  };
}

/**
 * Sends a structured client portal message into the matter's Communication log.
 */
export async function sendClientPortalMessage(
  portalSession: PortalSessionContext,
  matterId: string,
  input: { subject: string; body: string }
) {
  const matter = await assertPortalMatterAccess(portalSession, matterId);

  const body = input.body?.trim();
  if (!body) {
    throw new ValidationError("Le message ne peut pas être vide.");
  }

  const subject = `[Portail] ${input.subject?.trim() || "Message client"}`;

  const comm = await db.communication.create({
    data: {
      matterId,
      partyId: portalSession.partyId,
      channel: CommunicationChannel.OTHER,
      direction: CommunicationDirection.INBOUND,
      subject,
      body,
      occurredAt: new Date(),
      confidentiality: Confidentiality.STANDARD,
      authorId: matter.leadLawyerId,
    },
  });

  await logAudit({
    action: "portal.message.sent",
    entityType: "Communication",
    entityId: comm.id,
    matterId,
    metadata: {
      accountId: portalSession.accountId,
      partyId: portalSession.partyId,
    },
  });

  return comm;
}

// ============================================================================
// Internal Cabinet Staff Helpers (Sharing & Flag Controls)
// ============================================================================

export async function togglePortalFlag(enabled: boolean, session: AppSession) {
  const isPartner = session.user.roleKey === "PARTNER";
  if (!isPartner) {
    await authorize(session, "integration.admin");
  }

  const flag = await db.featureFlag.upsert({
    where: { key: PORTAL_FLAG_KEY },
    update: { enabled },
    create: {
      key: PORTAL_FLAG_KEY,
      enabled,
      description: "Public client portal exposure (LAN-only by default).",
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "integration.flag.toggle",
    entityType: "FeatureFlag",
    entityId: flag.key,
    metadata: { key: PORTAL_FLAG_KEY, enabled },
  });

  return flag;
}

export async function toggleMatterPortal(matterId: string, enabled: boolean, session: AppSession) {
  await assertMatterAccess(session, matterId, "MANAGE", "general");

  const matter = await db.matter.findUnique({ where: { id: matterId } });
  if (!matter) throw new NotFoundError("Dossier introuvable.");

  if (
    enabled &&
    (matter.confidentiality === Confidentiality.STRICT ||
      matter.confidentiality === Confidentiality.RESTRICTED)
  ) {
    throw new ForbiddenError(
      `Impossible d'activer le portail sur un dossier classé ${matter.confidentiality}.`
    );
  }

  const updated = await db.matter.update({
    where: { id: matterId },
    data: { portalEnabled: enabled },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.portal.toggle",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: { portalEnabled: enabled },
  });

  return updated;
}

export async function toggleDocumentShare(documentId: string, shared: boolean, session: AppSession) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError("Document introuvable.");

  await assertMatterAccess(session, doc.matterId, "EDIT", "general");

  if (
    shared &&
    (doc.confidentiality === Confidentiality.STRICT ||
      doc.confidentiality === Confidentiality.RESTRICTED)
  ) {
    throw new ForbiddenError(
      `Impossible de partager une pièce classée ${doc.confidentiality} sur le portail client.`
    );
  }

  const updated = await db.document.update({
    where: { id: documentId },
    data: {
      sharedWithClient: shared,
      sharedAt: shared ? new Date() : null,
      sharedById: shared ? session.user.id : null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: shared ? "document.portal.shared" : "document.portal.unshared",
    entityType: "Document",
    entityId: documentId,
    matterId: doc.matterId,
    metadata: { sharedWithClient: shared },
  });

  return updated;
}

