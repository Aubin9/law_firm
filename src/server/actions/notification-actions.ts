"use server";

import { getServerSession } from "@/server/auth/session";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/server/services/notification-service";

export async function fetchUserNotificationsAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié", notifications: [], unreadCount: 0 };
  }

  try {
    const data = await listNotifications(session);
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: err.message, notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationReadAction(notificationId: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    await markNotificationAsRead(notificationId, session);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAllNotificationsReadAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    await markAllNotificationsAsRead(session);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

