import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { FundEntryType, Prisma } from "@prisma/client";

export interface RecordFundEntryInput {
  matterId: string;
  partyId: string;
  type: FundEntryType;
  amount: number;
  reference?: string | null;
  occurredAt?: Date;
  invoiceId?: string | null;
}

/**
 * Records a client fund movement (CARPA escrow / maniement des fonds clients) (FIN-06).
 * Requires: fund.create (Partner or Accountant).
 */
export async function recordClientFundEntry(
  input: RecordFundEntryInput,
  session: AppSession
) {
  await authorize(session, "fund.create");
  await assertMatterAccess(session, input.matterId, "VIEW", "general");

  if (!input.amount || input.amount <= 0) {
    throw new Error("Le montant du mouvement de fonds doit être supérieur à zéro.");
  }

  // If transferring to invoice, ensure invoice exists and belongs to the matter
  if (input.invoiceId) {
    const inv = await db.invoice.findUnique({
      where: { id: input.invoiceId },
    });
    if (!inv || inv.matterId !== input.matterId) {
      throw new Error("La facture de destination n'appartient pas à ce dossier.");
    }
  }

  const entry = await db.clientFundEntry.create({
    data: {
      matterId: input.matterId,
      partyId: input.partyId,
      type: input.type,
      amount: new Prisma.Decimal(input.amount),
      currency: "XAF",
      reference: input.reference?.trim() || null,
      occurredAt: input.occurredAt || new Date(),
      invoiceId: input.invoiceId || null,
      recordedById: session.user.id,
    },
    include: {
      party: { select: { id: true, displayName: true } },
      matter: { select: { id: true, reference: true, title: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "fund.create",
    entityType: "ClientFundEntry",
    entityId: entry.id,
    matterId: input.matterId,
    metadata: {
      type: entry.type,
      amount: entry.amount.toString(),
      reference: entry.reference,
    },
  });

  return entry;
}

/**
 * Validates a client fund transaction (Partner authorization required) (Rule FIN-06, BR-14).
 * Requires: fund.validate (Partner only).
 */
export async function validateClientFundEntry(id: string, session: AppSession) {
  await authorize(session, "fund.validate");

  const entry = await db.clientFundEntry.findUnique({
    where: { id },
  });
  if (!entry) throw new Error("Mouvement de fonds introuvable.");

  await assertMatterAccess(session, entry.matterId, "VIEW", "general");

  const now = new Date();
  const updated = await db.clientFundEntry.update({
    where: { id },
    data: {
      validatedById: session.user.id,
      validatedAt: now,
    },
    include: {
      validatedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "fund.validate",
    entityType: "ClientFundEntry",
    entityId: id,
    matterId: entry.matterId,
    metadata: {
      amount: entry.amount.toString(),
      type: entry.type,
    },
  });

  return updated;
}

/**
 * Computes and retrieves the CARPA client funds ledger and net escrow balance for a matter.
 * Inflows: DEPOSIT
 * Outflows: WITHDRAWAL, TRANSFER_TO_INVOICE
 */
export async function getClientFundLedger(matterId: string, session: AppSession) {
  await authorize(session, "fund.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  const entries = await db.clientFundEntry.findMany({
    where: { matterId },
    orderBy: { occurredAt: "desc" },
    include: {
      party: { select: { id: true, displayName: true } },
      recordedBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true, total: true } },
    },
  });

  const totalDeposits = entries
    .filter((e) => e.type === "DEPOSIT")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalWithdrawals = entries
    .filter((e) => e.type === "WITHDRAWAL")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalTransfersToInvoice = entries
    .filter((e) => e.type === "TRANSFER_TO_INVOICE")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const currentEscrowBalance = Math.round((totalDeposits - totalWithdrawals - totalTransfersToInvoice) * 100) / 100;

  return {
    entries,
    summary: {
      totalDeposits,
      totalWithdrawals,
      totalTransfersToInvoice,
      currentEscrowBalance,
      isReconciledToZero: Math.abs(currentEscrowBalance) < 0.01,
    },
  };
}

