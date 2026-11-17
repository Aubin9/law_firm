"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  checkEmailAssociationPreconditions,
  toggleEmailAssociationFlag,
  parseEmailPreview,
  importEmailToMatter,
} from "@/server/services/email-association-service";
import { CommunicationDirection } from "@prisma/client";

export async function checkEmailAssociationPreconditionsAction() {
  try {
    const preconditions = await checkEmailAssociationPreconditions();
    return { success: true as const, preconditions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de vérification des préconditions" };
  }
}

export async function toggleEmailAssociationFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const flag = await toggleEmailAssociationFlag(session, enabled);
    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la modification du drapeau" };
  }
}

export async function parseEmailPreviewAction(formData: FormData) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false as const, error: "Fichier .eml manquant" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseEmailPreview(buffer);

    return {
      success: true as const,
      data: {
        from: parsed.from,
        fromEmail: parsed.fromEmail,
        to: parsed.to,
        cc: parsed.cc,
        subject: parsed.subject,
        date: parsed.date.toISOString(),
        bodyExcerpt: parsed.bodyText.slice(0, 500),
        attachments: parsed.attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
        })),
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de l'analyse du fichier .eml" };
  }
}

export async function importEmailToMatterAction(formData: FormData) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const matterId = formData.get("matterId") as string;
    const file = formData.get("file") as File;
    const partyId = (formData.get("partyId") as string) || null;
    const direction = (formData.get("direction") as CommunicationDirection) || undefined;
    const saveAttachments = formData.get("saveAttachments") !== "false";
    const comment = (formData.get("comment") as string) || null;

    if (!matterId) return { success: false as const, error: "Identifiant du dossier manquant" };
    if (!file) return { success: false as const, error: "Fichier .eml manquant" };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await importEmailToMatter(session, {
      matterId,
      emlBuffer: buffer,
      emlFileName: file.name,
      partyId,
      directionOverride: direction,
      saveAttachmentsToGed: saveAttachments,
      comment,
    });

    revalidatePath(`/matters/${matterId}`);

    return {
      success: true as const,
      communicationId: result.communication.id,
      emlDocumentId: result.emlDocument.id,
      attachedDocsCount: result.attachedDocIds.length,
      parsed: result.parsed,
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de l'association de l'e-mail au dossier" };
  }
}

