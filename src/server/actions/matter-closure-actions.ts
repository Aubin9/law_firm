"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  validateMatterClosureReadiness,
  requestMatterClosure,
  approveMatterClosure,
  reopenMatter,
} from "@/server/services/matter-closure-service";

export async function getMatterClosureReadinessAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const report = await validateMatterClosureReadiness(matterId, session);
    return { success: true, report };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation de clôture" };
  }
}

export async function requestMatterClosureAction(matterId: string, reason: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const updated = await requestMatterClosure(matterId, reason, session);
    revalidatePath(`/matters/${matterId}`);
    revalidatePath(`/matters`);
    return { success: true, matter: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la demande de clôture" };
  }
}

export async function approveMatterClosureAction(
  matterId: string,
  archiveImmediately: boolean = false
) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const updated = await approveMatterClosure(matterId, archiveImmediately, session);
    revalidatePath(`/matters/${matterId}`);
    revalidatePath(`/matters`);
    revalidatePath(`/dashboard`);
    return { success: true, matter: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'approbation de clôture" };
  }
}

export async function reopenMatterAction(matterId: string, justification: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const updated = await reopenMatter(matterId, justification, session);
    revalidatePath(`/matters/${matterId}`);
    revalidatePath(`/matters`);
    revalidatePath(`/dashboard`);
    return { success: true, matter: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la réouverture du dossier" };
  }
}

