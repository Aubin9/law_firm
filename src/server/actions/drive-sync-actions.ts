"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  toggleDriveSyncFlag,
  grantDriveTransferApproval,
  revokeDriveTransferApproval,
  executeDriveSyncJob,
  runDriveRestoreTest,
  getDriveSyncOverview,
} from "@/server/services/drive-sync-service";

export async function toggleDriveSyncFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const flag = await toggleDriveSyncFlag(session, enabled);
    revalidatePath("/admin/system");
    return { success: true, flag };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de modification du drapeau Drive" };
  }
}

export async function grantDriveApprovalAction(legalReviewNote: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const approval = await grantDriveTransferApproval(session, legalReviewNote);
    revalidatePath("/admin/system");
    return { success: true, approval };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'approbation du transfert" };
  }
}

export async function revokeDriveApprovalAction(approvalId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const revoked = await revokeDriveTransferApproval(session, approvalId);
    revalidatePath("/admin/system");
    return { success: true, revoked };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la révocation de l'approbation" };
  }
}

export async function executeDriveSyncAction(): Promise<
  | { success: true; status: string; run: any; message?: string; error?: string | null }
  | { success: false; error: string }
> {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const res = await executeDriveSyncJob(session);
    revalidatePath("/admin/system");
    return { success: true, ...res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la synchronisation Drive" };
  }
}

export async function runDriveRestoreTestAction(): Promise<
  | { success: true; run: any; restoreSeconds: number; sourceLocation: string | null }
  | { success: false; error: string }
> {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const res = await runDriveRestoreTest(session);
    revalidatePath("/admin/system");
    return { success: true, ...res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du test de restauration Drive" };
  }
}

export async function getDriveSyncOverviewAction() {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const data = await getDriveSyncOverview(session);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement du statut Drive" };
  }
}
