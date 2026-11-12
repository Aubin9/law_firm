import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess, accessibleMatterFilter } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { storageProvider } from "@/server/storage";
import { scanBuffer, computeSha256 } from "@/server/storage/antivirus";
import {
  Confidentiality,
  DocumentStatus,
  ScanStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

export interface CreateDocumentInput {
  matterId: string;
  title: string;
  categoryId?: string | null;
  confidentiality?: Confidentiality;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  comment?: string | null;
}

export interface AddDocumentVersionInput {
  documentId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  comment?: string | null;
}

/**
 * Creates a new document and its initial version (DOC-01, DOC-02).
 * Runs SHA-256 calculation and antivirus scan before storage.
 */
export async function createDocument(
  input: CreateDocumentInput,
  session: AppSession
) {
  await authorize(session, "document.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "document");

  const sha256 = computeSha256(input.buffer);
  const sizeBytes = input.buffer.length;
  const storageKey = `doc_${randomUUID()}`;

  // Antivirus Scan (DOC-04)
  const scan = await scanBuffer(input.buffer);

  // Store file through StorageProvider with opaque key (no public URL, DOC-05)
  await storageProvider.put(storageKey, input.buffer, input.mimeType);

  // If infected, quarantine immediately
  const scanStatus: ScanStatus = scan.status as ScanStatus;

  // Retrieve initial workflow step for DOCUMENT
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: {
        entity: "DOCUMENT",
        isActive: true,
      },
      isInitial: true,
    },
  });

  const document = await db.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        matterId: input.matterId,
        title: input.title.trim(),
        categoryId: input.categoryId || null,
        confidentiality: input.confidentiality || "STANDARD",
        workflowStepId: initialStep?.id || null,
      },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes,
        sha256,
        storageKey,
        status: "DRAFT",
        scanStatus,
        comment: input.comment || "Version initiale",
        uploadedById: session.user.id,
      },
    });

    return { ...doc, versions: [version] };
  });

  await logAudit({
    actorId: session.user.id,
    action: "document.create",
    entityType: "Document",
    entityId: document.id,
    matterId: input.matterId,
    metadata: {
      title: input.title,
      fileName: input.fileName,
      sizeBytes,
      sha256,
      scanStatus,
    },
  });

  return document;
}

/**
 * Adds a new version to an existing document (DOC-02).
 */
export async function addDocumentVersion(
  input: AddDocumentVersionInput,
  session: AppSession
) {
  await authorize(session, "document.create");

  const document = await db.document.findUnique({
    where: { id: input.documentId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!document || document.deletedAt) {
    throw new ForbiddenError("Document introuvable ou supprimé.", {
      reason: "NOT_FOUND",
      entityType: "Document",
      entityId: input.documentId,
    });
  }

  await assertMatterAccess(session, document.matterId, "EDIT", "document");

  const latestVersion = document.versions[0];
  const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  const sha256 = computeSha256(input.buffer);
  const sizeBytes = input.buffer.length;
  const storageKey = `doc_${randomUUID()}`;

  // Antivirus Scan
  const scan = await scanBuffer(input.buffer);
  const scanStatus: ScanStatus = scan.status as ScanStatus;

  await storageProvider.put(storageKey, input.buffer, input.mimeType);

  const version = await db.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: nextVersionNumber,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes,
      sha256,
      storageKey,
      status: "DRAFT",
      scanStatus,
      comment: input.comment || `Version ${nextVersionNumber}`,
      uploadedById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "document.add_version",
    entityType: "DocumentVersion",
    entityId: version.id,
    matterId: document.matterId,
    metadata: {
      versionNumber: nextVersionNumber,
      fileName: input.fileName,
      sizeBytes,
      sha256,
      scanStatus,
    },
  });

  return version;
}

/**
 * Validates a document version (DOC-03).
 * Once validated, the version is immutable and can never be modified or overwritten.
 * Requires: document.validate
 */
export async function validateDocumentVersion(
  versionId: string,
  session: AppSession
) {
  await authorize(session, "document.validate");

  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });

  if (!version || version.document.deletedAt) {
    throw new ForbiddenError("Version introuvable.", {
      reason: "NOT_FOUND",
      entityType: "DocumentVersion",
      entityId: versionId,
    });
  }

  await assertMatterAccess(session, version.document.matterId, "EDIT", "document");

  if (version.status === "VALIDATED") {
    throw new Error("Cette version est déjà validée.");
  }

  if (version.scanStatus !== "CLEAN") {
    throw new Error(
      "Impossible de valider un document dont l'analyse antivirus n'est pas intègre et saine."
    );
  }

  const updated = await db.documentVersion.update({
    where: { id: versionId },
    data: {
      status: "VALIDATED",
      validatedById: session.user.id,
      validatedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "document.validate",
    entityType: "DocumentVersion",
    entityId: version.id,
    matterId: version.document.matterId,
    metadata: {
      documentId: version.documentId,
      versionNumber: version.versionNumber,
      validatedAt: updated.validatedAt,
    },
  });

  return updated;
}

/**
 * Retrieves a document by ID with version history and completeness requirements.
 */
export async function getDocumentById(id: string, session: AppSession) {
  await authorize(session, "document.view");

  const document = await db.document.findUnique({
    where: { id },
    include: {
      category: true,
      workflowStep: true,
      versions: {
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
          validatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!document || document.deletedAt) {
    throw new ForbiddenError("Document introuvable ou supprimé.", {
      reason: "NOT_FOUND",
      entityType: "Document",
      entityId: id,
    });
  }

  await assertMatterAccess(session, document.matterId, "VIEW", "document");
  return document;
}

/**
 * Lists documents for a matter with filtering and search.
 */
export async function listDocumentsForMatter(
  matterId: string,
  session: AppSession
) {
  await authorize(session, "document.view");
  await assertMatterAccess(session, matterId, "VIEW", "document");

  return await db.document.findMany({
    where: {
      matterId,
      deletedAt: null,
    },
    include: {
      category: true,
      workflowStep: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: {
          versions: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Lists expected documents checklist for a matter (DOC-07).
 */
export async function listExpectedDocumentsForMatter(
  matterId: string,
  session: AppSession
) {
  await authorize(session, "document.view");
  await assertMatterAccess(session, matterId, "VIEW", "document");

  return await db.expectedDocument.findMany({
    where: { matterId },
    include: {
      document: {
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { label: "asc" },
  });
}

/**
 * Prepares file download stream with mandatory security gates:
 * 1. Authenticated session with `document.download` permission
 * 2. Matter access check (`assertMatterAccess`)
 * 3. Confidentiality clearance
 * 4. ScanStatus == CLEAN (strictly blocks INFECTED or PENDING files, DOC-04)
 * 5. Full audit log record (DOC-05)
 */
export async function getDocumentVersionFileForDownload(
  versionId: string,
  session: AppSession
) {
  await authorize(session, "document.download");

  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: {
        include: {
          matter: true,
        },
      },
    },
  });

  if (!version || version.document.deletedAt) {
    throw new ForbiddenError("Fichier introuvable ou supprimé.", {
      reason: "NOT_FOUND",
      entityType: "DocumentVersion",
      entityId: versionId,
    });
  }

  // Security gate: Matter access check
  await assertMatterAccess(session, version.document.matterId, "VIEW", "document");

  // Security gate: Antivirus check (DOC-04)
  if (version.scanStatus === "INFECTED") {
    throw new ForbiddenError(
      "Ce fichier a été mis en quarantaine pour des motifs de sécurité (virus détecté) et ne peut être téléchargé.",
      {
        reason: "INFECTED_FILE",
        entityType: "DocumentVersion",
        entityId: versionId,
      }
    );
  }

  if (version.scanStatus !== "CLEAN") {
    throw new ForbiddenError(
      "Ce fichier est en attente d'analyse antivirus et ne peut être téléchargé.",
      {
        reason: "UNSCANNED_FILE",
        entityType: "DocumentVersion",
        entityId: versionId,
      }
    );
  }

  const stream = await storageProvider.get(version.storageKey);

  // Security gate: Audit Log (DOC-05)
  await logAudit({
    actorId: session.user.id,
    action: "document.download",
    entityType: "DocumentVersion",
    entityId: version.id,
    matterId: version.document.matterId,
    metadata: {
      documentId: version.documentId,
      fileName: version.fileName,
      versionNumber: version.versionNumber,
      sizeBytes: version.sizeBytes,
      sha256: version.sha256,
    },
  });

  return {
    stream,
    fileName: version.fileName,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
  };
}

/**
 * Lists all documents across accessible matters with filters (DOC-01 / REC-22).
 */
export async function listAllDocuments(
  options: {
    categoryId?: string;
    matterId?: string;
    search?: string;
    limit?: number;
  } = {},
  session: AppSession
) {
  await authorize(session, "document.view");
  const matterFilter = accessibleMatterFilter(session);

  const where: Prisma.DocumentWhereInput = {
    deletedAt: null,
    matter: matterFilter,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.matterId ? { matterId: options.matterId } : {}),
    ...(options.search
      ? {
          OR: [
            { title: { contains: options.search, mode: "insensitive" } },
            { matter: { reference: { contains: options.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return await db.document.findMany({
    where,
    include: {
      category: true,
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          confidentiality: true,
        },
      },
      workflowStep: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: {
          versions: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit || 100,
  });
}


