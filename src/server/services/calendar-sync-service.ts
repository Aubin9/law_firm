import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { createHmac, randomBytes } from "crypto";
import { EventStatus, Confidentiality } from "@prisma/client";

const CALENDAR_SECRET =
  process.env.CALENDAR_FEED_SECRET ||
  "lawfirm-default-calendar-feed-secret-salt-2026-min-32-chars";

/**
 * Checks if the calendar synchronization feature flag is enabled.
 */
export async function checkCalendarSyncPreconditions() {
  const flag = await db.featureFlag.findUnique({
    where: { key: "calendar.sync.enabled" },
  });

  return {
    enabled: flag ? flag.enabled : false,
    flagKey: "calendar.sync.enabled",
  };
}

/**
 * Toggles the calendar sync feature flag (Partners and Admins only).
 */
export async function toggleCalendarSyncFlag(session: AppSession, enabled: boolean) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    throw new ForbiddenError("Seuls les associés et administrateurs peuvent modifier ce réglage.");
  }

  const flag = await db.featureFlag.upsert({
    where: { key: "calendar.sync.enabled" },
    create: {
      key: "calendar.sync.enabled",
      enabled,
      description: "Synchronisation externe du calendrier (iCal / RFC 5545) (INT-03).",
    },
    update: {
      enabled,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "calendar_sync.flag_toggled",
    entityType: "FeatureFlag",
    entityId: flag.key,
    metadata: { key: flag.key, enabled },
  });

  return flag;
}

/**
 * Computes an HMAC signature for a user ID and salt.
 */
function computeSignature(userId: string, salt: string): string {
  return createHmac("sha256", CALENDAR_SECRET)
    .update(`${userId}:${salt}`)
    .digest("hex");
}

/**
 * Retrieves or generates a secure, revocable calendar feed token for the session user.
 */
export async function getOrCreateUserCalendarToken(session: AppSession) {
  const identifier = `cal_feed_${session.user.id}`;

  const existing = await db.verification.findFirst({
    where: {
      identifier,
      expiresAt: { gt: new Date() },
    },
  });

  if (existing) {
    const salt = existing.value;
    const sig = computeSignature(session.user.id, salt);
    return `${session.user.id}.${salt}.${sig}`;
  }

  // Generate new token
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 year validity

  await db.verification.deleteMany({
    where: { identifier },
  });

  await db.verification.create({
    data: {
      id: `vf_${randomBytes(12).toString("hex")}`,
      identifier,
      value: salt,
      expiresAt,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "calendar_sync.token_generated",
    entityType: "User",
    entityId: session.user.id,
    metadata: { expiresAt: expiresAt.toISOString() },
  });

  const sig = computeSignature(session.user.id, salt);
  return `${session.user.id}.${salt}.${sig}`;
}

/**
 * Immediately revokes the user's current calendar sync token (Emergency killswitch).
 */
export async function revokeUserCalendarToken(session: AppSession) {
  const identifier = `cal_feed_${session.user.id}`;

  await db.verification.deleteMany({
    where: { identifier },
  });

  await logAudit({
    actorId: session.user.id,
    action: "calendar_sync.token_revoked",
    entityType: "User",
    entityId: session.user.id,
    metadata: { revokedAt: new Date().toISOString() },
  });

  return { success: true };
}

/**
 * Validates a feed token and retrieves the associated user.
 */
export async function verifyCalendarToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new ForbiddenError("Jeton de calendrier invalide ou corrompu.");
  }

  const [userId, salt, sig] = parts;
  const expectedSig = computeSignature(userId, salt);
  if (sig !== expectedSig) {
    throw new ForbiddenError("Signature du jeton de calendrier invalide.");
  }

  const record = await db.verification.findFirst({
    where: {
      identifier: `cal_feed_${userId}`,
      value: salt,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new ForbiddenError("Ce jeton d'accès a été révoqué ou a expiré.");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ForbiddenError("Compte utilisateur inactif ou introuvable.");
  }

  return user;
}

/**
 * Formats a Date object into iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
 */
function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escapes characters for iCalendar text fields.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Generates the RFC 5545 iCalendar feed content for a given token.
 */
export async function generateIcsFeed(token: string, baseUrl?: string): Promise<string> {
  const preconditions = await checkCalendarSyncPreconditions();
  if (!preconditions.enabled) {
    throw new ForbiddenError(
      "La synchronisation de calendrier externe est actuellement désactivée par la politique du cabinet (drapeau calendar.sync.enabled = false)."
    );
  }

  const user = await verifyCalendarToken(token);

  // Synthesize user session for matter permissions
  const syntheticSession: AppSession = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      status: user.status,
      roleId: user.roleId,
      roleKey: user.role.key,
    },
    session: {
      id: `feed_${user.id}`,
      expiresAt: new Date(Date.now() + 3600000),
      token: "synthetic_feed_token",
    },
  };

  const matterFilter = accessibleMatterFilter(syntheticSession);

  // Retrieve events from 30 days ago to future
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const events = await db.event.findMany({
    where: {
      status: { not: EventStatus.CANCELLED },
      startsAt: { gte: thirtyDaysAgo },
      OR: [
        {
          matter: matterFilter,
        },
        {
          matterId: null,
          createdById: user.id,
        },
      ],
    },
    include: {
      matter: {
        select: {
          id: true,
          reference: true,
          title: true,
          confidentiality: true,
        },
      },
      procedure: {
        select: {
          id: true,
          reference: true,
          jurisdiction: true,
        },
      },
      party: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  const now = new Date();
  const calName = `Cabinet Juridique — Agenda de ${user.name}`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LawFirm Platform//Cabinet Avocats Cameroun//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    "X-WR-TIMEZONE:Africa/Douala",
  ];

  for (const ev of events) {
    const isStrict = ev.matter?.confidentiality === Confidentiality.STRICT;

    let summary: string;
    let description: string;
    let location = ev.location || ev.procedure?.jurisdiction || "";

    if (isStrict) {
      // Professional secrecy protection (NF-02 / Law 2024/017):
      // Mask matter title and parties for external calendar export
      summary = `[Audience Confidentielle] Dossier Réservé`;
      description = `Événement confidentiel soumis au secret professionnel absolu.\nConsultez l'application du cabinet sur le réseau local pour les détails.`;
      location = "Juridiction compétente (Confidentiel)";
    } else {
      const matterPrefix = ev.matter ? `[${ev.matter.reference}] ` : "";
      summary = `${matterPrefix}${ev.title}`;

      const descParts: string[] = [];
      if (ev.description) descParts.push(ev.description);
      if (ev.matter) descParts.push(`Dossier : ${ev.matter.title} (${ev.matter.reference})`);
      if (ev.procedure) descParts.push(`Juridiction : ${ev.procedure.jurisdiction || "Tribunal"}`);
      if (ev.party) descParts.push(`Partie : ${ev.party.displayName}`);
      if (baseUrl && ev.matter) {
        descParts.push(`Lien interne : ${baseUrl}/matters/${ev.matter.id}`);
      }
      description = descParts.join("\n\n");
    }

    const dtStart = formatIcsDate(ev.startsAt);
    const dtEnd = ev.endsAt
      ? formatIcsDate(ev.endsAt)
      : formatIcsDate(new Date(ev.startsAt.getTime() + 60 * 60 * 1000)); // 1h default

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event_${ev.id}@lawfirm.local`);
    lines.push(`DTSTAMP:${formatIcsDate(now)}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push("STATUS:CONFIRMED");

    // 24h & 2h reminders (VALARM)
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:Rappel audience : ${escapeIcsText(summary)}`);
    lines.push("TRIGGER:-P1D");
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Log feed access audit
  await logAudit({
    actorId: user.id,
    action: "calendar_sync.feed_accessed",
    entityType: "User",
    entityId: user.id,
    metadata: {
      eventCount: events.length,
      syncedAt: now.toISOString(),
    },
  });

  return lines.join("\r\n");
}

