"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  createCommunication,
  listCommunicationsForMatter,
  CreateCommunicationInput,
} from "@/server/services/communication-service";

export async function createCommunicationAction(input: {
  matterId?: string | null;
  partyId?: string | null;
  channel: any;
  direction: any;
  subject?: string | null;
  body?: string | null;
  occurredAt?: string | null;
  confidentiality?: any;
  documentId?: string | null;
}) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const communication = await createCommunication(
      {
        ...input,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      },
      session
    );

    if (input.matterId) {
      revalidatePath(`/matters/${input.matterId}`);
    }

    return { success: true, communication };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'enregistrement de la communication" };
  }
}

export async function listMatterCommunicationsAction(matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false, error: "Non authentifié" };

  try {
    const list = await listCommunicationsForMatter(matterId, session);
    return { success: true, communications: list };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de chargement des communications" };
  }
}

