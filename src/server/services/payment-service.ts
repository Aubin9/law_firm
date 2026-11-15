import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { computeInvoiceFinancialStatus } from "./invoice-service";

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: Date;
  reference?: string | null;
}

/**
 * Records a client payment towards an invoice (Rule BR-11: multi-payment / partial payment).
 * Status starts as PENDING until validated by accountant or partner.
 * Requires: payment.create
 */
export async function recordPayment(input: RecordPaymentInput, session: AppSession) {
  await authorize(session, "payment.create");

  if (!input.amount || input.amount <= 0) {
    throw new Error("Le montant du règlement doit être supérieur à zéro.");
  }

  const invoice = await db.invoice.findUnique({
    where: { id: input.invoiceId },
    include: {
      workflowStep: true,
      payments: true,
    },
  });

  if (!invoice) throw new Error("Facture introuvable.");

  if (invoice.workflowStep?.key === "CANCELLED") {
    throw new Error("Impossible d'enregistrer un règlement sur une facture annulée.");
  }

  if (invoice.workflowStep?.key === "DRAFT") {
    throw new Error("La facture doit être au moins soumise à validation ou émise pour recevoir un règlement.");
  }

  await assertMatterAccess(session, invoice.matterId, "VIEW", "finance");

  const payment = await db.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount: new Prisma.Decimal(input.amount),
      method: input.method,
      paidAt: input.paidAt || new Date(),
      reference: input.reference?.trim() || null,
      status: PaymentStatus.PENDING,
      recordedById: session.user.id,
    },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          matterId: true,
          total: true,
        },
      },
      recordedBy: {
        select: { id: true, name: true },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "payment.create",
    entityType: "Payment",
    entityId: payment.id,
    matterId: invoice.matterId,
    metadata: {
      invoiceNumber: invoice.number,
      amount: payment.amount.toString(),
      method: payment.method,
      status: payment.status,
    },
  });

  return payment;
}

/**
 * Validates a payment and letters it with the invoice (Rule BR-10).
 * Requires: payment.validate (Partner or Accountant).
 */
export async function validatePayment(id: string, session: AppSession) {
  await authorize(session, "payment.validate");

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          workflowStep: true,
          payments: true,
        },
      },
    },
  });

  if (!payment) throw new Error("Règlement introuvable.");
  if (payment.status === PaymentStatus.VALIDATED) {
    throw new Error("Ce règlement a déjà été validé.");
  }

  await assertMatterAccess(session, payment.invoice.matterId, "VIEW", "finance");

  const now = new Date();
  const updated = await db.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.VALIDATED,
      validatedById: session.user.id,
      validatedAt: now,
      rejectionReason: null,
    },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          matterId: true,
          total: true,
        },
      },
      validatedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "payment.validate",
    entityType: "Payment",
    entityId: id,
    matterId: payment.invoice.matterId,
    metadata: {
      invoiceNumber: payment.invoice.number,
      amount: payment.amount.toString(),
      validatedBy: session.user.id,
    },
  });

  // Re-fetch all payments for invoice to return updated financial status
  const allPayments = await db.payment.findMany({
    where: { invoiceId: payment.invoiceId },
  });
  const computed = computeInvoiceFinancialStatus(payment.invoice, allPayments);

  return {
    payment: updated,
    invoiceComputedStatus: computed,
  };
}

/**
 * Rejects an invalid or bounced payment with a mandatory reason.
 * Requires: payment.reject (Partner or Accountant).
 */
export async function rejectPayment(id: string, reason: string, session: AppSession) {
  await authorize(session, "payment.reject");

  if (!reason || !reason.trim()) {
    throw new Error("Un motif de rejet est obligatoire.");
  }

  const payment = await db.payment.findUnique({
    where: { id },
    include: { invoice: true },
  });

  if (!payment) throw new Error("Règlement introuvable.");

  await assertMatterAccess(session, payment.invoice.matterId, "VIEW", "finance");

  const updated = await db.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.REJECTED,
      rejectionReason: reason.trim(),
    },
    include: {
      invoice: { select: { id: true, number: true, matterId: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "payment.reject",
    entityType: "Payment",
    entityId: id,
    matterId: payment.invoice.matterId,
    metadata: {
      invoiceNumber: payment.invoice.number,
      amount: payment.amount.toString(),
      reason: reason.trim(),
    },
  });

  return updated;
}

/**
 * Lists all pending payments awaiting accounting validation.
 * Requires: payment.view
 */
export async function listPendingPayments(session: AppSession) {
  await authorize(session, "payment.view");

  return await db.payment.findMany({
    where: { status: PaymentStatus.PENDING },
    orderBy: { createdAt: "asc" },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          currency: true,
          party: { select: { id: true, displayName: true } },
          matter: { select: { id: true, reference: true, title: true } },
        },
      },
      recordedBy: { select: { id: true, name: true } },
    },
  });
}
