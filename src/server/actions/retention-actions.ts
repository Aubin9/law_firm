"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  placeDestructionHold,
  releaseDestructionHold,
  requestDestruction,
  decideDestruction,
  executeDestruction,
  isUnderDestructionHold,
  listDestructionHolds,
} from "@/server/services/retention-service";

export async function placeDestructionHoldAction(input: {
  matterId?: string | null;
  documentId?: string | null;
  reason: string;
}) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const hold = await placeDestructionHold(input, session);
    if (input.matterId) revalidatePath(`/matters/${input.matterId}`);
    return { success: true, hold };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la pose du gel conservatoire" };
  }
}

export async function releaseDestructionHoldAction(holdId: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const hold = await releaseDestructionHold(holdId, session);
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, hold };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la levée du gel conservatoire" };
  }
}

export async function requestDestructionAction(input: {
  matterId?: string | null;
  documentId?: string | null;
  reason: string;
}) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const request = await requestDestruction(input, session);
    if (input.matterId) revalidatePath(`/matters/${input.matterId}`);
    return { success: true, request };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la demande de destruction" };
  }
}

export async function decideDestructionAction(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  matterId?: string
) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const decided = await decideDestruction(requestId, decision, session);
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true, request: decided };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la décision" };
  }
}

export async function executeDestructionAction(requestId: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const executed = await executeDestruction(requestId, session);
    if (matterId) revalidatePath(`/matters/${matterId}`);
    revalidatePath("/matters");
    revalidatePath("/documents");
    return { success: true, request: executed };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'exécution de la destruction" };
  }
}

export async function checkMatterLegalHoldAction(matterId: string) {
  try {
    const holdStatus = await isUnderDestructionHold(matterId);
    return { success: true, ...holdStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

