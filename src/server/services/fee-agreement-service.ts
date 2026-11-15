import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { FeeAgreementStatus, FeeAgreementType, Prisma } from "@prisma/client";

export interface CreateFeeAgreementInput {
  matterId: string;
  partyId: string;
  missionId?: string | null;
  title: string;
  type: FeeAgreementType;
  amount?: number | null;
  currency?: string;
  terms?: string | null;
}

/**
 * Creates a fee agreement in DRAFT status (FIN-01).
 * Requires: fee.create
 */
export async function createFeeAgreement(
  input: CreateFeeAgreementInput,
  session: AppSession
) {
  await authorize(session, "fee.create");
  await assertMatterAccess(session, input.matterId, "VIEW", "general");

  if (!input.title || !input.title.trim()) {
    throw new Error("Le titre ou l'objet de la convention d'honoraires est obligatoire.");
  }

  const agreement = await db.feeAgreement.create({
    data: {
      matterId: input.matterId,
      partyId: input.partyId,
      missionId: input.missionId || null,
      title: input.title.trim(),
      type: input.type,
      amount: input.amount ? new Prisma.Decimal(input.amount) : null,
      currency: input.currency || "XAF",
      terms: input.terms?.trim() || null,
      status: FeeAgreementStatus.DRAFT,
      createdById: session.user.id,
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      party: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "fee.create",
    entityType: "FeeAgreement",
    entityId: agreement.id,
    matterId: input.matterId,
    metadata: {
      title: agreement.title,
      type: agreement.type,
      amount: agreement.amount?.toString() || null,
    },
  });

  return agreement;
}

/**
 * Formally activates a fee agreement upon signature and attachment of the scanned/signed copy (FIN-01).
 * Requires: fee.edit
 */
export async function signFeeAgreement(
  id: string,
  documentId: string | null,
  session: AppSession
) {
  await authorize(session, "fee.edit");

  const existing = await db.feeAgreement.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Convention d'honoraires introuvable.");

  await assertMatterAccess(session, existing.matterId, "VIEW", "general");

  const now = new Date();
  const updated = await db.feeAgreement.update({
    where: { id },
    data: {
      status: FeeAgreementStatus.SIGNED,
      signedAt: now,
      documentId: documentId || null,
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      party: { select: { id: true, displayName: true } },
      document: { select: { id: true, title: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "fee.sign",
    entityType: "FeeAgreement",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      title: existing.title,
      signedAt: now.toISOString(),
      documentId,
    },
  });

  return updated;
}

/**
 * Lists fee agreements for a matter.
 * Requires: fee.view
 */
export async function listFeeAgreementsForMatter(matterId: string, session: AppSession) {
  await authorize(session, "fee.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return await db.feeAgreement.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
    include: {
      party: { select: { id: true, displayName: true } },
      document: { select: { id: true, title: true } },
      invoices: {
        select: {
          id: true,
          number: true,
          total: true,
        },
      },
    },
  });
}
