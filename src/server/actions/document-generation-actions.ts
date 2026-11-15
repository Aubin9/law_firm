"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  checkTemplateGenerationPreconditions,
  toggleTemplateGenerationFlag,
  listDocumentTemplates,
  getTemplatePreview,
  generateDocumentFromTemplate,
  GenerateDocumentInput,
} from "@/server/services/document-generation-service";

export async function checkTemplateGenerationPreconditionsAction() {
  try {
    const preconditions = await checkTemplateGenerationPreconditions();
    return { success: true as const, preconditions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la vérification des préconditions" };
  }
}

export async function toggleTemplateGenerationFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const flag = await toggleTemplateGenerationFlag(session, enabled);
    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de modification du drapeau" };
  }
}

export async function listDocumentTemplatesAction() {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const templates = await listDocumentTemplates(session);
    return { success: true as const, templates };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de récupération des modèles" };
  }
}

export async function getTemplatePreviewAction(
  templateId: string,
  matterId: string,
  customVariables?: Record<string, any>
) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const preview = await getTemplatePreview(session, templateId, matterId, customVariables);
    return { success: true as const, preview };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la prévisualisation" };
  }
}

export async function generateDocumentFromTemplateAction(input: GenerateDocumentInput) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const res = await generateDocumentFromTemplate(session, input);
    revalidatePath(`/matters/${input.matterId}`);
    return { success: true as const, ...res };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la génération du document" };
  }
}

