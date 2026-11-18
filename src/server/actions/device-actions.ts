"use server";

import { getServerSession } from "@/server/auth/session";
import { headers } from "next/headers";
import { z } from "zod";
import {
  registerOrHeartbeatDevice,
  listUserDevices,
  listAllDevices,
  revokeDevice,
  isDeviceRevoked,
} from "@/server/services/device-service";

const RegisterDeviceSchema = z.object({
  deviceId: z.string().min(8).max(128),
  deviceName: z.string().min(1).max(128),
});

export async function registerDeviceAction(rawInput: z.infer<typeof RegisterDeviceSchema>) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  const parsed = RegisterDeviceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: "Données d'appareil invalides." };
  }

  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = reqHeaders.get("user-agent") || "Inconnu";

  try {
    const result = await registerOrHeartbeatDevice({
      userId: session.user.id,
      deviceId: parsed.data.deviceId,
      deviceName: parsed.data.deviceName,
      userAgent,
      ip,
    });
    return { success: true as const, ...result };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur d'enregistrement appareil." };
  }
}

export async function listMyDevicesAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    const devices = await listUserDevices(session.user.id);
    return { success: true as const, devices };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de charger les appareils." };
  }
}

export async function listAllDevicesAction() {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  const isPrivileged =
    session.user.roleKey === "PARTNER" ||
    session.user.roleKey === "TECHNICAL_ADMIN" ||
    session.user.roleKey === "FUNCTIONAL_ADMIN";

  if (!isPrivileged) {
    return { success: false as const, error: "Droit d'administration requis." };
  }

  try {
    const devices = await listAllDevices();
    return { success: true as const, devices };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Impossible de charger tous les appareils." };
  }
}

export async function revokeDeviceAction(deviceId: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false as const, error: "Non authentifié." };
  }

  try {
    // If not partner/technical admin, verify the user owns the device
    const isPrivileged =
      session.user.roleKey === "PARTNER" ||
      session.user.roleKey === "TECHNICAL_ADMIN" ||
      session.user.roleKey === "FUNCTIONAL_ADMIN";

    if (!isPrivileged) {
      const myDevices = await listUserDevices(session.user.id);
      const owns = myDevices.some((d) => d.deviceId === deviceId);
      if (!owns) {
        return { success: false as const, error: "Vous ne pouvez pas révoquer cet appareil." };
      }
    }

    const revoked = await revokeDevice(deviceId, session.user.id);
    return { success: true as const, device: revoked };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erreur de révocation." };
  }
}

export async function checkDeviceRevokedAction(deviceId: string) {
  try {
    const revoked = await isDeviceRevoked(deviceId);
    return { success: true as const, revoked };
  } catch (err: any) {
    return { success: false as const, error: err.message };
  }
}
