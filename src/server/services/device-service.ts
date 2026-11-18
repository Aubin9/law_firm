import { db } from "@/server/db";
import { logAudit } from "@/server/audit/audit-logger";

export interface RegisterDeviceInput {
  userId: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ip: string;
}

export async function registerOrHeartbeatDevice(input: RegisterDeviceInput) {
  const existing = await db.userDevice.findUnique({
    where: { deviceId: input.deviceId },
  });

  if (existing) {
    if (existing.revokedAt) {
      return { status: "REVOKED" as const, device: existing };
    }

    const updated = await db.userDevice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        lastIp: input.ip,
        userAgent: input.userAgent,
        deviceName: input.deviceName || existing.deviceName,
      },
    });

    return { status: "ACTIVE" as const, device: updated };
  }

  // Register new device
  const device = await db.userDevice.create({
    data: {
      userId: input.userId,
      deviceId: input.deviceId,
      deviceName: input.deviceName || "Appareil Mobile / Tablette",
      userAgent: input.userAgent,
      lastIp: input.ip,
      isTrusted: true,
    },
  });

  await logAudit({
    actorId: input.userId,
    action: "USER_DEVICE_REGISTERED",
    entityType: "UserDevice",
    entityId: device.id,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      deviceId: input.deviceId,
      deviceName: device.deviceName,
    },
  });

  return { status: "ACTIVE" as const, device };
}

export async function listUserDevices(userId: string) {
  return db.userDevice.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function listAllDevices() {
  return db.userDevice.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { key: true, nameFr: true, nameEn: true } },
        },
      },
      revokedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function revokeDevice(deviceId: string, revokedByUserId: string) {
  const device = await db.userDevice.findUnique({
    where: { deviceId },
  });

  if (!device) {
    throw new Error("Appareil introuvable.");
  }

  if (device.revokedAt) {
    return device;
  }

  const updated = await db.userDevice.update({
    where: { deviceId },
    data: {
      revokedAt: new Date(),
      revokedById: revokedByUserId,
      isTrusted: false,
    },
  });

  await logAudit({
    actorId: revokedByUserId,
    action: "USER_DEVICE_REVOKED",
    entityType: "UserDevice",
    entityId: device.id,
    metadata: {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      targetUserId: device.userId,
    },
  });

  return updated;
}

export async function isDeviceRevoked(deviceId: string): Promise<boolean> {
  const device = await db.userDevice.findUnique({
    where: { deviceId },
    select: { revokedAt: true },
  });
  return !!device?.revokedAt;
}
