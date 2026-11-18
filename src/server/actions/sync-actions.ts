"use server";

import { getServerSession } from "@/server/auth/session";
import {
  pullOfflineSnapshot,
  pushOfflineMutations,
  OfflineMutation,
} from "@/server/services/sync-service";

export async function pullOfflineSnapshotAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const snapshot = await pullOfflineSnapshot(session);
    return { success: true as const, snapshot };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de récupérer les données hors-ligne." };
  }
}

export async function pushOfflineMutationsAction(mutations: OfflineMutation[]) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const results = await pushOfflineMutations(session, mutations);
    return { success: true as const, results };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la synchronisation." };
  }
}
