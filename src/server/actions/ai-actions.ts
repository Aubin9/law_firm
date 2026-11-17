"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import {
  isAiEnabled,
  getActiveTransferApproval,
  checkAiPreconditions,
  requestAiSuggestion,
  acceptAiSuggestion,
  rejectAiSuggestion,
  toggleMatterAiSwitch,
  recordExternalTransferApproval,
  listMatterAiSuggestions,
  RequestAiSuggestionInput,
  AI_FLAG_KEY,
} from "@/server/ai";
import { TransferProvider } from "@prisma/client";

export async function checkAiPreconditionsAction(matterId: string, documentVersionIds: string[] = []) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const preconditions = await checkAiPreconditions(matterId, documentVersionIds, session);
    return {
      success: true as const,
      data: {
        matterTitle: preconditions.matter.title,
        approvalId: preconditions.approval.id,
        approvalPurpose: preconditions.approval.purpose,
        approvalDate: preconditions.approval.approvedAt,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec des préconditions IA." };
  }
}

export async function requestAiSuggestionAction(input: RequestAiSuggestionInput) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const suggestion = await requestAiSuggestion(input, session);
    revalidatePath(`/matters/${input.matterId}`);
    return { success: true as const, suggestion };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de génération de la suggestion IA." };
  }
}

export async function acceptAiSuggestionAction(suggestionId: string, matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const res = await acceptAiSuggestion(suggestionId, matterId, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true as const, ...res };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de validation de la suggestion." };
  }
}

export async function rejectAiSuggestionAction(suggestionId: string, matterId: string, reason: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const res = await rejectAiSuggestion(suggestionId, matterId, reason, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true as const, ...res };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec du rejet de la suggestion." };
  }
}

export async function toggleMatterAiSwitchAction(matterId: string, enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const matter = await toggleMatterAiSwitch(matterId, enabled, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true as const, matter };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de mise à jour de l'interrupteur IA du dossier." };
  }
}

export async function listMatterAiSuggestionsAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const suggestions = await listMatterAiSuggestions(matterId, session);
    return { success: true as const, suggestions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de récupération des suggestions." };
  }
}

export async function toggleAiFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    await authorize(session, "integration.admin");

    const flag = await db.featureFlag.upsert({
      where: { key: AI_FLAG_KEY },
      update: { enabled },
      create: {
        key: AI_FLAG_KEY,
        enabled,
        description: "Gemini / OpenAI external AI processing (Air-gapped by default).",
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "integration.flag.toggle",
      entityType: "FeatureFlag",
      entityId: flag.key,
      metadata: { key: AI_FLAG_KEY, enabled },
    });

    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec d'actualisation du drapeau IA." };
  }
}

export async function recordExternalTransferApprovalAction(input: {
  provider: TransferProvider;
  purpose: string;
  dataCategories: string;
  legalReview: string;
}) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const approval = await recordExternalTransferApproval(input, session);
    revalidatePath("/admin/system");
    return { success: true as const, approval };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec d'enregistrement de l'approbation de transfert." };
  }
}

