import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { ApprovalStatus, ExpenseKind, Prisma } from "@prisma/client";

export interface CreateExpenseInput {
  matterId?: string | null;
  kind: ExpenseKind;
  categoryId: string;
  amount: number;
  currency?: string;
  incurredAt?: Date;
  description: string;
  receiptDocumentId?: string | null;
  rebillable?: boolean;
}

/**
 * Creates an expense or client disbursement (FIN-05).
 * Requires: expense.create
 */
export async function createExpense(input: CreateExpenseInput, session: AppSession) {
  await authorize(session, "expense.create");

  if (!input.description || !input.description.trim()) {
    throw new Error("La description de la dépense ou du débours est obligatoire.");
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error("Le montant doit être supérieur à zéro.");
  }

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "VIEW", "general");
  }

  const expense = await db.expense.create({
    data: {
      matterId: input.matterId || null,
      kind: input.kind,
      categoryId: input.categoryId,
      amount: new Prisma.Decimal(input.amount),
      currency: input.currency || "XAF",
      incurredAt: input.incurredAt || new Date(),
      description: input.description.trim(),
      receiptDocumentId: input.receiptDocumentId || null,
      rebillable: Boolean(input.rebillable),
      status: ApprovalStatus.DRAFT,
      recordedById: session.user.id,
    },
    include: {
      category: true,
      matter: { select: { id: true, reference: true, title: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "expense.create",
    entityType: "Expense",
    entityId: expense.id,
    matterId: input.matterId || null,
    metadata: {
      kind: expense.kind,
      amount: expense.amount.toString(),
      rebillable: expense.rebillable,
    },
  });

  return expense;
}

/**
 * Approves a declared expense/disbursement (FIN-05).
 * Requires: expense.approve
 */
export async function approveExpense(id: string, session: AppSession) {
  await authorize(session, "expense.approve");

  const expense = await db.expense.findUnique({ where: { id } });
  if (!expense) throw new Error("Dépense introuvable.");

  if (expense.matterId) {
    await assertMatterAccess(session, expense.matterId, "VIEW", "general");
  }

  const updated = await db.expense.update({
    where: { id },
    data: {
      status: ApprovalStatus.APPROVED,
      approvedById: session.user.id,
    },
    include: {
      category: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "expense.approve",
    entityType: "Expense",
    entityId: id,
    matterId: expense.matterId,
    metadata: {
      amount: expense.amount.toString(),
    },
  });

  return updated;
}

/**
 * Links an approved disbursement to an invoice for re-billing (FIN-05).
 */
export async function linkExpenseToInvoice(
  expenseId: string,
  invoiceId: string,
  session: AppSession
) {
  await authorize(session, "expense.approve");

  const [expense, invoice] = await Promise.all([
    db.expense.findUnique({ where: { id: expenseId } }),
    db.invoice.findUnique({ where: { id: invoiceId } }),
  ]);

  if (!expense || !invoice) throw new Error("Dépense ou facture introuvable.");

  if (!expense.rebillable) {
    throw new Error("Cette dépense n'est pas marquée comme refacturable au client.");
  }

  const updated = await db.expense.update({
    where: { id: expenseId },
    data: { invoiceId },
    include: {
      invoice: { select: { id: true, number: true } },
    },
  });

  return updated;
}

/**
 * Lists expenses for a matter or global register.
 * Requires: expense.view
 */
export async function listExpenses(
  params: { matterId?: string; rebillableOnly?: boolean } = {},
  session: AppSession
) {
  await authorize(session, "expense.view");

  if (params.matterId) {
    await assertMatterAccess(session, params.matterId, "VIEW", "general");
  }

  return await db.expense.findMany({
    where: {
      ...(params.matterId ? { matterId: params.matterId } : {}),
      ...(params.rebillableOnly ? { rebillable: true } : {}),
    },
    orderBy: { incurredAt: "desc" },
    include: {
      category: true,
      receiptDocument: { select: { id: true, title: true } },
      invoice: { select: { id: true, number: true } },
      recordedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
}

