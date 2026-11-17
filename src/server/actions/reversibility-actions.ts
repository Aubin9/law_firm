"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  checkReversibilityPreconditions,
  toggleReversibilityFlag,
  buildMatterExportArchive,
} from "@/server/services/reversibility-export-service";

export async function checkReversibilityPreconditionsAction() {
  try {
    const preconditions = await checkReversibilityPreconditions();
    return { success: true as const, preconditions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la vérification des préconditions" };
  }
}

export async function toggleReversibilityFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const flag = await toggleReversibilityFlag(session, enabled);
    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la modification du paramètre" };
  }
}

export async function getMatterExportManifestPreviewAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const res = await buildMatterExportArchive(session, matterId);
    return {
      success: true as const,
      data: {
        filename: res.filename,
        sizeBytes: res.sizeBytes,
        sha256: res.sha256,
        manifest: res.manifest,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de générer le manifeste d'export" };
  }
}

