"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  checkEsignaturePreconditions,
  toggleEsignatureFlag,
  requestDocumentVisa,
  signDocumentVisa,
  rejectDocumentVisa,
  getDocumentVisaTrail,
  RequestDocumentVisaInput,
  SignDocumentVisaInput,
  RejectDocumentVisaInput,
} from "@/server/services/esignature-service";

export async function checkEsignaturePreconditionsAction() {
  try {
    const preconditions = await checkEsignaturePreconditions();
    return { success: true as const, preconditions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de préconditions" };
  }
}

export async function toggleEsignatureFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const flag = await toggleEsignatureFlag(session, enabled);
    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de mise à jour du drapeau" };
  }
}

export async function requestDocumentVisaAction(input: RequestDocumentVisaInput & { matterId?: string }) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const visa = await requestDocumentVisa(session, input);
    if (input.matterId) {
      revalidatePath(`/matters/${input.matterId}`);
    }
    return { success: true as const, visa };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de la demande de visa" };
  }
}

export async function signDocumentVisaAction(input: SignDocumentVisaInput & { matterId?: string }) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const visa = await signDocumentVisa(session, input);
    if (input.matterId) {
      revalidatePath(`/matters/${input.matterId}`);
    }
    return { success: true as const, visa };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de la signature électronique" };
  }
}

export async function rejectDocumentVisaAction(input: RejectDocumentVisaInput & { matterId?: string }) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const visa = await rejectDocumentVisa(session, input);
    if (input.matterId) {
      revalidatePath(`/matters/${input.matterId}`);
    }
    return { success: true as const, visa };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec du refus de visa" };
  }
}

export async function getDocumentVisaTrailAction(documentVersionId: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const trail = await getDocumentVisaTrail(session, documentVersionId);
    return { success: true as const, trail };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de charger la chaîne des visas" };
  }
}

