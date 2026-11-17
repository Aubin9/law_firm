"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  inviteClientToPortal,
  revokePortalAccount,
  togglePortalFlag,
  toggleMatterPortal,
  toggleDocumentShare,
} from "@/server/portal";

export async function togglePortalFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const flag = await togglePortalFlag(enabled, session);
    revalidatePath("/admin/system");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors du basculement du portail." };
  }
}

export async function toggleMatterPortalAction(matterId: string, enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const matter = await toggleMatterPortal(matterId, enabled, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true as const, matter };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de modifier l'accès portail du dossier." };
  }
}

export async function inviteClientToPortalAction(input: {
  partyId: string;
  matterId: string;
  email: string;
}) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const res = await inviteClientToPortal(input, session);
    revalidatePath(`/matters/${input.matterId}`);
    return {
      success: true as const,
      accountId: res.account.id,
      email: res.account.email,
      activationToken: res.activationToken,
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de l'invitation au portail." };
  }
}

export async function revokePortalAccountAction(accountId: string, matterId?: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    await revokePortalAccount(accountId, session);
    if (matterId) revalidatePath(`/matters/${matterId}`);
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Échec de la révocation du compte client." };
  }
}

export async function toggleDocumentShareAction(documentId: string, shared: boolean, matterId: string) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié." };

  try {
    const doc = await toggleDocumentShare(documentId, shared, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true as const, doc };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de modification du partage client." };
  }
}

