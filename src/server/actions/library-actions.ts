"use server";

import { getServerSession } from "@/server/auth/session";
import {
  listLegalTexts,
  getLegalTextById,
  searchLegalArticles,
  seedCanonicalLegalLibrary,
  ListLegalTextsParams,
} from "@/server/services/library-service";
import { LegalJurisdiction } from "@prisma/client";

export async function listLegalTextsAction(params: ListLegalTextsParams = {}) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const texts = await listLegalTexts(params);
    return { success: true as const, texts };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors du chargement des textes." };
  }
}

export async function getLegalTextAction(id: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const text = await getLegalTextById(id);
    if (!text) {
      return { success: false as const, error: "Texte juridique introuvable." };
    }
    return { success: true as const, text };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de lecture du texte." };
  }
}

export async function searchLibraryAction(query: string, jurisdiction?: LegalJurisdiction) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const articles = await searchLegalArticles(query, { jurisdiction });
    return { success: true as const, articles };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de recherche." };
  }
}

export async function seedLibraryAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const res = await seedCanonicalLegalLibrary(session);
    return res;
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur d'initialisation de la bibliothèque." };
  }
}
