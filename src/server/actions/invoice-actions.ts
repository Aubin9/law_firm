"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  createInvoice,
  updateInvoice,
  submitInvoiceForValidation,
  validateInvoice,
  cancelInvoice,
  getInvoiceById,
  listInvoices,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from "@/server/services/invoice-service";

export async function createInvoiceAction(input: CreateInvoiceInput) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await createInvoice(input, session);
    revalidatePath("/finance");
    revalidatePath(`/matters/${input.matterId}`);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la création de la facture" };
  }
}

export async function updateInvoiceAction(id: string, input: UpdateInvoiceInput, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await updateInvoice(id, input, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de mise à jour de la facture" };
  }
}

export async function submitInvoiceForValidationAction(id: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await submitInvoiceForValidation(id, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la soumission de la facture" };
  }
}

export async function validateInvoiceAction(id: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await validateInvoice(id, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation de la facture" };
  }
}

export async function cancelInvoiceAction(id: string, reason: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await cancelInvoice(id, reason, session);
    revalidatePath("/finance");
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'annulation de la facture" };
  }
}

export async function getInvoiceByIdAction(id: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const invoice = await getInvoiceById(id, session);
    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message || "Facture introuvable" };
  }
}

export async function listInvoicesAction(params: any = {}) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const res = await listInvoices(params, session);
    return { success: true, ...res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement des factures" };
  }
}

