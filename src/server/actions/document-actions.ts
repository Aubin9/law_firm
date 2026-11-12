"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createDocument,
  addDocumentVersion,
  validateDocumentVersion,
  getDocumentById,
} from "@/server/services/document-service";
import { Confidentiality } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function uploadDocumentAction(formData: FormData) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const matterId = formData.get("matterId") as string;
  const title = formData.get("title") as string;
  const categoryId = (formData.get("categoryId") as string) || null;
  const confidentiality = (formData.get("confidentiality") as Confidentiality) || "STANDARD";
  const comment = (formData.get("comment") as string) || null;
  const file = formData.get("file") as File;

  if (!matterId || !title || !file) {
    return { success: false, error: "Dossier, titre et fichier sont obligatoires." };
  }

  // Size limit check (max 50MB per firm standard)
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { success: false, error: "Le fichier dépasse la taille maximale autorisée (50 Mo)." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const document = await createDocument(
      {
        matterId,
        title,
        categoryId,
        confidentiality,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        comment,
      },
      session
    );

    revalidatePath(`/matters/${matterId}`);
    return { success: true, document };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors du versement du document" };
  }
}

export async function addDocumentVersionAction(formData: FormData) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const documentId = formData.get("documentId") as string;
  const matterId = formData.get("matterId") as string;
  const comment = (formData.get("comment") as string) || null;
  const file = formData.get("file") as File;

  if (!documentId || !file) {
    return { success: false, error: "Document et fichier sont obligatoires." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const version = await addDocumentVersion(
      {
        documentId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        comment,
      },
      session
    );

    if (matterId) {
      revalidatePath(`/matters/${matterId}`);
    }
    return { success: true, version };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de l'ajout de version" };
  }
}

export async function validateDocumentVersionAction(
  versionId: string,
  matterId: string
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const version = await validateDocumentVersion(versionId, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true, version };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la validation juridique" };
  }
}

