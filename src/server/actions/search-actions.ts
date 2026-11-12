"use server";

import { getServerSession } from "@/server/auth/session";
import { globalSearch, GlobalSearchResult } from "@/server/services/search-service";

export async function globalSearchAction(
  query: string
): Promise<{ success: boolean; data?: GlobalSearchResult; error?: string }> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      data: { matters: [], parties: [], documents: [], tasks: [] },
      error: "Non authentifié",
    };
  }

  try {
    const results = await globalSearch(query, session);
    return { success: true, data: results };
  } catch (err: any) {
    return {
      success: false,
      data: { matters: [], parties: [], documents: [], tasks: [] },
      error: err.message || "Erreur de recherche",
    };
  }
}

