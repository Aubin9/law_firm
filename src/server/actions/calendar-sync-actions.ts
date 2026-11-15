"use server";

import { getServerSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import {
  checkCalendarSyncPreconditions,
  toggleCalendarSyncFlag,
  getOrCreateUserCalendarToken,
  revokeUserCalendarToken,
} from "@/server/services/calendar-sync-service";

export async function checkCalendarSyncPreconditionsAction() {
  try {
    const preconditions = await checkCalendarSyncPreconditions();
    return { success: true as const, preconditions };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de vérification des préconditions" };
  }
}

export async function toggleCalendarSyncFlagAction(enabled: boolean) {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const flag = await toggleCalendarSyncFlag(session, enabled);
    revalidatePath("/admin/system");
    revalidatePath("/calendar");
    return { success: true as const, flag };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la modification du drapeau" };
  }
}

export async function getCalendarFeedUrlAction() {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    const preconditions = await checkCalendarSyncPreconditions();
    const token = await getOrCreateUserCalendarToken(session);
    const appUrl = process.env.APP_URL || "http://localhost:3001";
    const feedUrl = `${appUrl}/api/calendar/feed/${token}`;

    return {
      success: true as const,
      enabled: preconditions.enabled,
      feedUrl,
      token,
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la récupération du lien d'agenda" };
  }
}

export async function regenerateCalendarTokenAction() {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    await revokeUserCalendarToken(session);
    const token = await getOrCreateUserCalendarToken(session);
    const appUrl = process.env.APP_URL || "http://localhost:3001";
    const feedUrl = `${appUrl}/api/calendar/feed/${token}`;
    revalidatePath("/calendar");

    return {
      success: true as const,
      feedUrl,
      token,
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la régénération du lien d'agenda" };
  }
}

export async function revokeCalendarTokenAction() {
  const session = await getServerSession();
  if (!session) return { success: false as const, error: "Non authentifié" };

  try {
    await revokeUserCalendarToken(session);
    revalidatePath("/calendar");
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur lors de la révocation de l'accès agenda" };
  }
}

