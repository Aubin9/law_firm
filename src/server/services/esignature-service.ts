import crypto from "crypto";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/auth/errors";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { storageProvider } from "@/server/storage";
import { VisaStatus, VisaRole } from "@prisma/client";

export const ESIGNATURE_FLAG_KEY = "esignature.enabled";

function getEsignatureSecret(): string {
  return (
    process.env.ESIGNATURE_SECRET_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "fallback-dev-esignature-secret-key-32chars"
  );
}

/**
 * Checks whether electronic signature workflow is enabled.
 */
export async function isEsignatureEnabled(): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({
    where: { key: ESIGNATURE_FLAG_KEY },
  });
  if (flag !== null) return flag.enabled;
  return process.env.ESIGNATURE_ENABLED === "true";
}

/**
 * Checks preconditions for internal electronic signature and visa circuit.
 */
export async function checkEsignaturePreconditions() {
  const enabled = await isEsignatureEnabled();
  return {
    enabled,
    cryptographicEngine: "HMAC-SHA256 & SHA-256 Digest",
    legalFramework: "Loi camerounaise n° 2024/017 (Articles 15-22) / Déontologie OHADA",
    airGapCompliant: true,
    timezone: "Africa/Douala",
  };
}

/**
 * Toggles the electronic signature feature flag.
 * Restricted to PARTNER or TECHNICAL_ADMIN.
 */
export async function toggleEsignatureFlag(session: AppSession, enabled: boolean) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN") {
    throw new ForbiddenError(
      "Seuls les Associés et Administrateurs peuvent modifier les paramètres de signature électronique."
    );
  }

  const flag = await db.featureFlag.upsert({
    where: { key: ESIGNATURE_FLAG_KEY },
    create: {
      key: ESIGNATURE_FLAG_KEY,
      enabled,
      description: "Circuit de visa interne et signature électronique probante (INT-06 / Loi n° 2024/017).",
    },
    update: {
      enabled,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "feature_flag.update",
    entityType: "feature_flag",
    entityId: ESIGNATURE_FLAG_KEY,
    metadata: {
      key: ESIGNATURE_FLAG_KEY,
      enabled,
      reason: "Modification du paramètre de signature électronique (INT-06)",
    },
  });

  return flag;
}

/**
 * Computes a tamper-evident cryptographic digital seal for a document version visa.
 */
export function generateSignatureSeal(
  documentVersionId: string,
  sha256Digest: string,
  signatoryId: string,
  timestamp: Date
): string {
  const secret = getEsignatureSecret();
  const payload = `${documentVersionId}:${sha256Digest}:${signatoryId}:${timestamp.toISOString()}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export interface RequestDocumentVisaInput {
  documentVersionId: string;
  signatoryId: string;
  role?: VisaRole;
  comment?: string | null;
}

/**
 * Initiates an internal visa request for a document version.
 */
export async function requestDocumentVisa(session: AppSession, input: RequestDocumentVisaInput) {
  const isEnabled = await isEsignatureEnabled();
  if (!isEnabled) {
    throw new ForbiddenError("Le module de signature électronique est désactivé (air-gap NF-11).");
  }

  const version = await db.documentVersion.findUnique({
    where: { id: input.documentVersionId },
    include: {
      document: true,
    },
  });

  if (!version) {
    throw new NotFoundError("Version documentaire introuvable.");
  }

  // Check access to matter (requires EDIT)
  await assertMatterAccess(session, version.document.matterId, "EDIT");

  const signatory = await db.user.findUnique({
    where: { id: input.signatoryId },
  });

  if (!signatory || signatory.status !== "ACTIVE") {
    throw new NotFoundError("Signataire introuvable ou inactif.");
  }

  // Ensure document SHA-256 exists
  let sha256 = version.sha256;
  if (!sha256) {
    try {
      const buffer = await storageProvider.getBuffer(version.storageKey);
      sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    } catch {
      sha256 = crypto.createHash("sha256").update(version.id).digest("hex");
    }
  }

  const visa = await db.documentVisa.create({
    data: {
      documentVersionId: version.id,
      signatoryId: signatory.id,
      role: input.role ?? VisaRole.SIGNATORY,
      status: VisaStatus.PENDING,
      comment: input.comment ?? null,
      sha256Digest: sha256,
    },
    include: {
      signatory: { select: { id: true, name: true, email: true } },
      documentVersion: { select: { id: true, fileName: true, versionNumber: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "document.visa_requested",
    entityType: "document_visa",
    entityId: visa.id,
    matterId: version.document.matterId,
    metadata: {
      documentId: version.documentId,
      versionId: version.id,
      signatoryId: signatory.id,
      signatoryName: signatory.name,
      role: visa.role,
      sha256: sha256,
    },
  });

  return visa;
}

export interface SignDocumentVisaInput {
  visaId: string;
  comment?: string | null;
  ipAddress?: string | null;
}

/**
 * Signs and seals a document version with probative cryptographic verification (Loi n° 2024/017).
 */
export async function signDocumentVisa(session: AppSession, input: SignDocumentVisaInput) {
  const isEnabled = await isEsignatureEnabled();
  if (!isEnabled) {
    throw new ForbiddenError("Le module de signature électronique est désactivé (air-gap NF-11).");
  }

  const visa = await db.documentVisa.findUnique({
    where: { id: input.visaId },
    include: {
      documentVersion: {
        include: {
          document: true,
        },
      },
      signatory: true,
    },
  });

  if (!visa) {
    throw new NotFoundError("Demande de visa introuvable.");
  }

  if (visa.status !== VisaStatus.PENDING) {
    throw new ValidationError("Ce visa a déjà été traité (statut: " + visa.status + ").");
  }

  // Only the assigned signatory or a Partner can sign
  const isTargetSignatory = session.user.id === visa.signatoryId;
  const isPartner = session.user.roleKey === "PARTNER";

  if (!isTargetSignatory && !isPartner) {
    throw new ForbiddenError("Seul le signataire désigné ou un Associé peut apposer ce visa.");
  }

  await assertMatterAccess(session, visa.documentVersion.document.matterId, "EDIT");

  const signedAt = new Date();
  const signatureSeal = generateSignatureSeal(
    visa.documentVersionId,
    visa.sha256Digest,
    session.user.id,
    signedAt
  );

  const updatedVisa = await db.documentVisa.update({
    where: { id: visa.id },
    data: {
      status: VisaStatus.APPROVED,
      signedAt,
      signatureSeal,
      ipAddress: input.ipAddress ?? null,
      comment: input.comment ?? visa.comment,
    },
    include: {
      signatory: { select: { id: true, name: true, email: true } },
    },
  });

  // If signatory is a Partner or Signatory, validate the document version
  if (visa.role === VisaRole.SIGNATORY || visa.role === VisaRole.PARTNER || isPartner) {
    await db.documentVersion.update({
      where: { id: visa.documentVersionId },
      data: {
        status: "VALIDATED",
        validatedById: session.user.id,
        validatedAt: signedAt,
      },
    });
  }

  // Immutable audit trail
  await logAudit({
    actorId: session.user.id,
    action: "document.signed",
    entityType: "document_visa",
    entityId: visa.id,
    matterId: visa.documentVersion.document.matterId,
    metadata: {
      documentId: visa.documentVersion.documentId,
      versionId: visa.documentVersionId,
      signedAt: signedAt.toISOString(),
      signatureSeal,
      sha256Digest: visa.sha256Digest,
      role: visa.role,
      ipAddress: input.ipAddress ?? null,
      legalFramework: "Loi camerounaise n° 2024/017 / OHADA",
    },
  });

  return updatedVisa;
}

export interface RejectDocumentVisaInput {
  visaId: string;
  reason: string;
}

/**
 * Rejects a document visa with mandatory justification.
 */
export async function rejectDocumentVisa(session: AppSession, input: RejectDocumentVisaInput) {
  const isEnabled = await isEsignatureEnabled();
  if (!isEnabled) {
    throw new ForbiddenError("Le module de signature électronique est désactivé (air-gap NF-11).");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new ValidationError("Le motif du rejet ou des réserves formulées est obligatoire.");
  }

  const visa = await db.documentVisa.findUnique({
    where: { id: input.visaId },
    include: {
      documentVersion: {
        include: {
          document: true,
        },
      },
    },
  });

  if (!visa) {
    throw new NotFoundError("Demande de visa introuvable.");
  }

  if (visa.status !== VisaStatus.PENDING) {
    throw new ValidationError("Ce visa a déjà été traité (statut: " + visa.status + ").");
  }

  const isTargetSignatory = session.user.id === visa.signatoryId;
  const isPartner = session.user.roleKey === "PARTNER";

  if (!isTargetSignatory && !isPartner) {
    throw new ForbiddenError("Seul le signataire désigné ou un Associé peut rejeter ce visa.");
  }

  await assertMatterAccess(session, visa.documentVersion.document.matterId, "EDIT");

  const updatedVisa = await db.documentVisa.update({
    where: { id: visa.id },
    data: {
      status: VisaStatus.REJECTED,
      comment: input.reason.trim(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "document.visa_rejected",
    entityType: "document_visa",
    entityId: visa.id,
    matterId: visa.documentVersion.document.matterId,
    metadata: {
      documentId: visa.documentVersion.documentId,
      versionId: visa.documentVersionId,
      reason: input.reason.trim(),
      rejectedBy: session.user.id,
    },
  });

  return updatedVisa;
}

/**
 * Retrieves the full visa audit trail for a document version.
 */
export async function getDocumentVisaTrail(session: AppSession, documentVersionId: string) {
  const version = await db.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: {
      document: true,
      visas: {
        orderBy: { createdAt: "asc" },
        include: {
          signatory: {
            select: { id: true, name: true, email: true, role: { select: { key: true } } },
          },
        },
      },
    },
  });

  if (!version) {
    throw new NotFoundError("Version documentaire introuvable.");
  }

  await assertMatterAccess(session, version.document.matterId, "VIEW");

  return version.visas.map((v) => ({
    id: v.id,
    role: v.role,
    status: v.status,
    comment: v.comment,
    signedAt: v.signedAt ? v.signedAt.toISOString() : null,
    sha256Digest: v.sha256Digest,
    signatureSeal: v.signatureSeal,
    ipAddress: v.ipAddress,
    createdAt: v.createdAt.toISOString(),
    signatory: {
      id: v.signatory.id,
      name: v.signatory.name,
      email: v.signatory.email,
      roleKey: v.signatory.role?.key ?? null,
    },
  }));
}

