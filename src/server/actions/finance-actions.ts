"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  recordPayment,
  validatePayment,
  rejectPayment,
  listPendingPayments,
  RecordPaymentInput,
} from "@/server/services/payment-service";
import {
  recordClientFundEntry,
  validateClientFundEntry,
  getClientFundLedger,
  RecordFundEntryInput,
} from "@/server/services/carpa-service";
import {
  createFeeAgreement,
  signFeeAgreement,
  listFeeAgreementsForMatter,
  CreateFeeAgreementInput,
} from "@/server/services/fee-agreement-service";
import {
  createExpense,
  approveExpense,
  linkExpenseToInvoice,
  listExpenses,
  CreateExpenseInput,
} from "@/server/services/expense-service";

// --- Payments ---
export async function recordPaymentAction(input: RecordPaymentInput, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const payment = await recordPayment(input, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, payment };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'enregistrement du règlement" };
  }
}

export async function validatePaymentAction(id: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const result = await validatePayment(id, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation du règlement" };
  }
}

export async function rejectPaymentAction(id: string, reason: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const payment = await rejectPayment(id, reason, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, payment };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du rejet du règlement" };
  }
}

export async function listPendingPaymentsAction() {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const list = await listPendingPayments(session);
    return { success: true, payments: list };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement des règlements en attente" };
  }
}

// --- CARPA Escrow / Client Funds ---
export async function recordClientFundEntryAction(input: RecordFundEntryInput) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const entry = await recordClientFundEntry(input, session);
    revalidatePath("/finance");
    revalidatePath(`/matters/${input.matterId}`);
    return { success: true, entry };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du mouvement de fonds CARPA" };
  }
}

export async function validateClientFundEntryAction(id: string, matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const entry = await validateClientFundEntry(id, session);
    revalidatePath("/finance");
    revalidatePath(`/matters/${matterId}`);
    return { success: true, entry };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation du mouvement CARPA" };
  }
}

export async function getClientFundLedgerAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const ledger = await getClientFundLedger(matterId, session);
    return { success: true, ...ledger };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement du grand livre CARPA" };
  }
}

// --- Fee Agreements ---
export async function createFeeAgreementAction(input: CreateFeeAgreementInput) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const agreement = await createFeeAgreement(input, session);
    revalidatePath("/finance");
    revalidatePath(`/matters/${input.matterId}`);
    return { success: true, agreement };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de création de la convention" };
  }
}

export async function signFeeAgreementAction(id: string, documentId: string | null, matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const agreement = await signFeeAgreement(id, documentId, session);
    revalidatePath("/finance");
    revalidatePath(`/matters/${matterId}`);
    return { success: true, agreement };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de signature de la convention" };
  }
}

export async function listFeeAgreementsAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const list = await listFeeAgreementsForMatter(matterId, session);
    return { success: true, agreements: list };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement des conventions" };
  }
}

// --- Expenses & Disbursements ---
export async function createExpenseAction(input: CreateExpenseInput) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const expense = await createExpense(input, session);
    revalidatePath("/finance");
    if (input.matterId) revalidatePath(`/matters/${input.matterId}`);
    return { success: true, expense };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de déclaration de dépense" };
  }
}

export async function approveExpenseAction(id: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const expense = await approveExpense(id, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, expense };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur d'approbation de la dépense" };
  }
}

export async function linkExpenseToInvoiceAction(expenseId: string, invoiceId: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const expense = await linkExpenseToInvoice(expenseId, invoiceId, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, expense };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de liaison du débours à la facture" };
  }
}

export async function listExpensesAction(params: any = {}) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const list = await listExpenses(params, session);
    return { success: true, expenses: list };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement des dépenses" };
  }
}

