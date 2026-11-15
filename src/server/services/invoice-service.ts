import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess, accessibleMatterFilter } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { ForbiddenError } from "@/server/auth/errors";
import { Prisma } from "@prisma/client";

export type ComputedFinancialStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PARTIALLY_PAID_OVERDUE"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface InvoiceLineInput {
  description: string;
  quantity?: number;
  unitPrice: number;
  taxRate?: number; // e.g. 19.25 for TVA, 0 for exempt
}

export interface CreateInvoiceInput {
  matterId: string;
  partyId: string;
  feeAgreementId?: string | null;
  currency?: string;
  dueAt?: Date | null;
  notes?: string | null;
  lines: InvoiceLineInput[];
}

export interface UpdateInvoiceInput {
  partyId?: string;
  feeAgreementId?: string | null;
  dueAt?: Date | null;
  notes?: string | null;
  lines?: InvoiceLineInput[];
}

export interface ListInvoicesParams {
  matterId?: string;
  partyId?: string;
  status?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Generates the next sequential unique invoice number (FAC-YYYY-XXXX).
 * Thread-safe via ReferenceCounter upsert increment.
 */
export async function generateNextInvoiceNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const client = tx || db;
  const currentYear = new Date().getFullYear();
  const counterKey = `INVOICE-${currentYear}`;

  const counter = await client.referenceCounter.upsert({
    where: { key: counterKey },
    update: { value: { increment: 1 } },
    create: { key: counterKey, value: 1 },
  });

  return `FAC-${currentYear}-${String(counter.value).padStart(4, "0")}`;
}

/**
 * Computes an invoice's financial status strictly from validated payments (Rule BR-10).
 * Never stored or manually edited.
 */
export function computeInvoiceFinancialStatus(
  invoice: {
    total: Prisma.Decimal | number;
    dueAt?: Date | null;
    workflowStep?: { key: string } | null;
  },
  payments: Array<{
    amount: Prisma.Decimal | number;
    status: string;
  }> = [],
  now: Date = new Date()
): {
  financialStatus: ComputedFinancialStatus;
  paidAmount: number;
  remainingAmount: number;
  totalAmount: number;
  isOverdue: boolean;
} {
  const stepKey = invoice.workflowStep?.key || "DRAFT";
  const totalAmount = Number(invoice.total);

  const validatedPayments = payments.filter((p) => p.status === "VALIDATED");
  const paidAmount = validatedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

  const isOverdue = Boolean(invoice.dueAt && new Date(invoice.dueAt).getTime() < now.getTime());

  if (stepKey === "CANCELLED") {
    return {
      financialStatus: "CANCELLED",
      paidAmount,
      remainingAmount,
      totalAmount,
      isOverdue,
    };
  }

  if (stepKey === "DRAFT") {
    return {
      financialStatus: "DRAFT",
      paidAmount,
      remainingAmount,
      totalAmount,
      isOverdue: false,
    };
  }

  if (stepKey === "TO_VALIDATE") {
    return {
      financialStatus: "PENDING_VALIDATION",
      paidAmount,
      remainingAmount,
      totalAmount,
      isOverdue: false,
    };
  }

  // ISSUED step
  if (paidAmount >= totalAmount - 0.01) {
    return {
      financialStatus: "PAID",
      paidAmount,
      remainingAmount: 0,
      totalAmount,
      isOverdue: false,
    };
  }

  if (paidAmount > 0) {
    return {
      financialStatus: isOverdue ? "PARTIALLY_PAID_OVERDUE" : "PARTIALLY_PAID",
      paidAmount,
      remainingAmount,
      totalAmount,
      isOverdue,
    };
  }

  return {
    financialStatus: isOverdue ? "OVERDUE" : "UNPAID",
    paidAmount: 0,
    remainingAmount: totalAmount,
    totalAmount,
    isOverdue,
  };
}

/**
 * Creates a new invoice with line items in DRAFT status (FIN-02).
 */
export async function createInvoice(input: CreateInvoiceInput, session: AppSession) {
  await authorize(session, "invoice.create");
  await assertMatterAccess(session, input.matterId, "VIEW", "general");

  if (!input.lines || input.lines.length === 0) {
    throw new Error("Une facture doit comporter au moins une ligne de prestation ou débours.");
  }

  // Verify matter client party
  const party = await db.party.findUnique({
    where: { id: input.partyId },
  });
  if (!party) throw new Error("Client destinataire de la facture introuvable.");

  // Find invoice initial workflow step (DRAFT)
  const initialStep = await db.workflowStep.findFirst({
    where: {
      definition: { entity: "INVOICE", isActive: true },
      isInitial: true,
    },
  });

  return await db.$transaction(async (tx) => {
    const number = await generateNextInvoiceNumber(tx);

    let subtotal = 0;
    let taxTotal = 0;

    const linesData = input.lines.map((line, index) => {
      const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
      const unitPrice = Number(line.unitPrice);
      const taxRate = Number(line.taxRate || 0);

      const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
      const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      return {
        position: index + 1,
        description: line.description.trim(),
        quantity: new Prisma.Decimal(qty),
        unitPrice: new Prisma.Decimal(unitPrice),
        taxRate: new Prisma.Decimal(taxRate),
        amount: new Prisma.Decimal(lineTotal),
      };
    });

    const total = subtotal + taxTotal;
    const dueAt = input.dueAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const invoice = await tx.invoice.create({
      data: {
        number,
        matterId: input.matterId,
        partyId: input.partyId,
        feeAgreementId: input.feeAgreementId || null,
        workflowStepId: initialStep?.id || null,
        currency: input.currency || "XAF",
        subtotal: new Prisma.Decimal(subtotal),
        taxTotal: new Prisma.Decimal(taxTotal),
        total: new Prisma.Decimal(total),
        dueAt,
        notes: input.notes?.trim() || null,
        createdById: session.user.id,
        lines: {
          create: linesData,
        },
      },
      include: {
        lines: { orderBy: { position: "asc" } },
        workflowStep: true,
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "invoice.create",
      entityType: "Invoice",
      entityId: invoice.id,
      matterId: input.matterId,
      metadata: {
        number: invoice.number,
        total: invoice.total.toString(),
        currency: invoice.currency,
      },
    });

    const computed = computeInvoiceFinancialStatus(invoice, []);
    return { ...invoice, ...computed };
  });
}

/**
 * Updates an invoice in DRAFT or TO_VALIDATE status.
 */
export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput,
  session: AppSession
) {
  await authorize(session, "invoice.edit");

  const existing = await db.invoice.findUnique({
    where: { id },
    include: { workflowStep: true },
  });
  if (!existing) throw new Error("Facture introuvable.");

  if (existing.workflowStep?.key === "ISSUED" || existing.workflowStep?.key === "CANCELLED") {
    throw new Error("Une facture déjà émise ou annulée ne peut plus être modifiée.");
  }

  await assertMatterAccess(session, existing.matterId, "VIEW", "general");

  return await db.$transaction(async (tx) => {
    let updateData: Prisma.InvoiceUpdateInput = {
      ...(input.partyId ? { party: { connect: { id: input.partyId } } } : {}),
      ...(input.feeAgreementId !== undefined
        ? {
            feeAgreement: input.feeAgreementId
              ? { connect: { id: input.feeAgreementId } }
              : { disconnect: true },
          }
        : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    };

    if (input.lines && input.lines.length > 0) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

      let subtotal = 0;
      let taxTotal = 0;

      const linesData = input.lines.map((line, index) => {
        const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
        const unitPrice = Number(line.unitPrice);
        const taxRate = Number(line.taxRate || 0);

        const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
        const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;
        taxTotal += lineTax;

        return {
          invoiceId: id,
          position: index + 1,
          description: line.description.trim(),
          quantity: new Prisma.Decimal(qty),
          unitPrice: new Prisma.Decimal(unitPrice),
          taxRate: new Prisma.Decimal(taxRate),
          amount: new Prisma.Decimal(lineTotal),
        };
      });

      await tx.invoiceLine.createMany({ data: linesData });

      const total = subtotal + taxTotal;
      updateData.subtotal = new Prisma.Decimal(subtotal);
      updateData.taxTotal = new Prisma.Decimal(taxTotal);
      updateData.total = new Prisma.Decimal(total);
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: updateData,
      include: {
        lines: { orderBy: { position: "asc" } },
        workflowStep: true,
        payments: true,
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "invoice.edit",
      entityType: "Invoice",
      entityId: id,
      matterId: existing.matterId,
      metadata: { number: existing.number },
    });

    const computed = computeInvoiceFinancialStatus(updated, updated.payments);
    return { ...updated, ...computed };
  });
}

/**
 * Submits an invoice from DRAFT to TO_VALIDATE.
 */
export async function submitInvoiceForValidation(id: string, session: AppSession) {
  await authorize(session, "invoice.edit");

  const existing = await db.invoice.findUnique({
    where: { id },
    include: { workflowStep: true },
  });
  if (!existing) throw new Error("Facture introuvable.");
  await assertMatterAccess(session, existing.matterId, "VIEW", "general");

  const toValidateStep = await db.workflowStep.findFirst({
    where: {
      definition: { entity: "INVOICE", isActive: true },
      key: "TO_VALIDATE",
    },
  });
  if (!toValidateStep) throw new Error("Étape 'À valider' introuvable dans le workflow de facturation.");

  const updated = await db.invoice.update({
    where: { id },
    data: { workflowStepId: toValidateStep.id },
    include: {
      workflowStep: true,
      lines: { orderBy: { position: "asc" } },
      payments: true,
      party: { select: { id: true, displayName: true } },
      matter: { select: { id: true, reference: true, title: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "invoice.submit_validation",
    entityType: "Invoice",
    entityId: id,
    matterId: existing.matterId,
    metadata: { number: existing.number },
  });

  const computed = computeInvoiceFinancialStatus(updated, updated.payments);
  return { ...updated, ...computed };
}

/**
 * Validates and issues an invoice (transitions TO_VALIDATE -> ISSUED).
 * Partner or Accountant permission required (Rule FIN-02).
 */
export async function validateInvoice(id: string, session: AppSession) {
  await authorize(session, "invoice.validate");

  const existing = await db.invoice.findUnique({
    where: { id },
    include: { workflowStep: true },
  });
  if (!existing) throw new Error("Facture introuvable.");

  if (existing.workflowStep?.key !== "TO_VALIDATE" && existing.workflowStep?.key !== "DRAFT") {
    throw new Error("Seule une facture à l'état de brouillon ou en attente de validation peut être émise.");
  }

  await assertMatterAccess(session, existing.matterId, "VIEW", "general");

  const issuedStep = await db.workflowStep.findFirst({
    where: {
      definition: { entity: "INVOICE", isActive: true },
      key: "ISSUED",
    },
  });
  if (!issuedStep) throw new Error("Étape 'Émise' introuvable dans le workflow de facturation.");

  const now = new Date();
  const updated = await db.invoice.update({
    where: { id },
    data: {
      workflowStepId: issuedStep.id,
      validatedById: session.user.id,
      validatedAt: now,
      issuedAt: existing.issuedAt || now,
    },
    include: {
      workflowStep: true,
      lines: { orderBy: { position: "asc" } },
      payments: true,
      party: { select: { id: true, displayName: true } },
      matter: { select: { id: true, reference: true, title: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "invoice.validate",
    entityType: "Invoice",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      number: existing.number,
      validatedBy: session.user.id,
      issuedAt: now.toISOString(),
    },
  });

  const computed = computeInvoiceFinancialStatus(updated, updated.payments);
  return { ...updated, ...computed };
}

/**
 * Cancels an invoice with a mandatory written justification (Rule FIN-02).
 * Blocked if validated payments exist (must refund or cancel payments first).
 */
export async function cancelInvoice(id: string, reason: string, session: AppSession) {
  await authorize(session, "invoice.cancel");

  if (!reason || !reason.trim()) {
    throw new Error("Un motif explicatif est obligatoire pour annuler une facture.");
  }

  const existing = await db.invoice.findUnique({
    where: { id },
    include: {
      workflowStep: true,
      payments: { where: { status: "VALIDATED" } },
    },
  });
  if (!existing) throw new Error("Facture introuvable.");

  if (existing.payments.length > 0) {
    throw new Error(
      "Impossible d'annuler une facture comportant des règlements validés. Rejetez ou annulez les règlements au préalable."
    );
  }

  await assertMatterAccess(session, existing.matterId, "VIEW", "general");

  const cancelledStep = await db.workflowStep.findFirst({
    where: {
      definition: { entity: "INVOICE", isActive: true },
      key: "CANCELLED",
    },
  });
  if (!cancelledStep) throw new Error("Étape 'Annulée' introuvable dans le workflow.");

  const now = new Date();
  const updated = await db.invoice.update({
    where: { id },
    data: {
      workflowStepId: cancelledStep.id,
      cancelledAt: now,
      cancelReason: reason.trim(),
    },
    include: {
      workflowStep: true,
      lines: { orderBy: { position: "asc" } },
      payments: true,
      party: { select: { id: true, displayName: true } },
      matter: { select: { id: true, reference: true, title: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "invoice.cancel",
    entityType: "Invoice",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      number: existing.number,
      reason: reason.trim(),
    },
  });

  const computed = computeInvoiceFinancialStatus(updated, updated.payments);
  return { ...updated, ...computed };
}

/**
 * Retrieves a single invoice with full relations and computed financial status.
 */
export async function getInvoiceById(id: string, session: AppSession) {
  await authorize(session, "invoice.view");

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      workflowStep: true,
      lines: { orderBy: { position: "asc" } },
      payments: {
        include: {
          recordedBy: { select: { id: true, name: true } },
          validatedBy: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: "desc" },
      },
      party: {
        select: {
          id: true,
          displayName: true,
          type: true,
          taxId: true,
          registrationNumber: true,
        },
      },
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          confidentiality: true,
          leadLawyer: { select: { id: true, name: true } },
        },
      },
      feeAgreement: {
        select: {
          id: true,
          title: true,
          type: true,
          amount: true,
        },
      },
      validatedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!invoice) throw new Error("Facture introuvable.");

  await assertMatterAccess(session, invoice.matterId, "VIEW", "general");

  const computed = computeInvoiceFinancialStatus(invoice, invoice.payments);
  return { ...invoice, ...computed };
}

/**
 * Lists invoices filtered by accessible matters and financial filters.
 */
export async function listInvoices(params: ListInvoicesParams = {}, session: AppSession) {
  await authorize(session, "invoice.view");

  const matterFilter = accessibleMatterFilter(session);

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.InvoiceWhereInput = {
    matter: matterFilter,
    ...(params.matterId ? { matterId: params.matterId } : {}),
    ...(params.partyId ? { partyId: params.partyId } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { number: { contains: term, mode: "insensitive" } },
      { party: { displayName: { contains: term, mode: "insensitive" } } },
      { matter: { title: { contains: term, mode: "insensitive" } } },
      { matter: { reference: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        workflowStep: true,
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
      },
    }),
  ]);

  const invoicesWithComputed = items.map((inv) => {
    const computed = computeInvoiceFinancialStatus(inv, inv.payments);
    return {
      ...inv,
      ...computed,
    };
  });

  return {
    items: invoicesWithComputed,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
