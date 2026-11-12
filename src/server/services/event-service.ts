import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  assertMatterAccess,
  accessibleMatterFilter,
} from "@/server/auth/matter-access";
import { EventStatus, EventType, Prisma } from "@prisma/client";

export interface CreateEventInput {
  type: EventType;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  source?: string | null;
  matterId?: string | null;
  procedureId?: string | null;
  partyId?: string | null;
  attendeeUserIds?: string[];
  reminderMinutes?: number[]; // e.g. [15, 60, 1440, 4320]
}

export interface ListEventsParams {
  from?: Date;
  to?: Date;
  type?: EventType;
  status?: EventStatus;
  matterId?: string;
  userId?: string; // Filter by attendee
}

export interface UpdateEventInput {
  title?: string;
  startsAt?: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  source?: string | null;
  status?: EventStatus;
  attendeeUserIds?: string[];
}

export interface PostponeEventInput {
  newStartsAt: Date;
  newEndsAt?: Date | null;
  reason: string;
  newLocation?: string | null;
}

/**
 * Creates a calendar event, hearing, or procedural deadline (CAL-01, CAL-02, BR-07).
 * - Enforces `event.create`
 * - If linked to a matter, verifies EDIT access on the matter
 * - If procedural deadline, mandates a source (BR-07 / REC-05)
 */
export async function createEvent(input: CreateEventInput, session: AppSession) {
  await authorize(session, "event.create");

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "EDIT", "general");
  }

  // BR-07: Procedural deadlines need a mandatory source
  if (input.type === EventType.PROCEDURAL_DEADLINE) {
    if (!input.source || input.source.trim().length === 0) {
      throw new Error(
        "Une échéance procédurale exige obligatoirement la mention de sa source légale ou judiciaire (ex. Avis d'audience, Notification de jugement)."
      );
    }
  }

  const created = await db.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        type: input.type,
        status: EventStatus.SCHEDULED,
        title: input.title.trim(),
        startsAt: input.startsAt,
        endsAt: input.endsAt || null,
        allDay: input.allDay ?? false,
        location: input.location?.trim() || null,
        description: input.description?.trim() || null,
        source: input.source?.trim() || null,
        matterId: input.matterId || null,
        procedureId: input.procedureId || null,
        partyId: input.partyId || null,
        createdById: session.user.id,
        attendees:
          input.attendeeUserIds && input.attendeeUserIds.length > 0
            ? {
                create: input.attendeeUserIds.map((userId) => ({
                  userId,
                })),
              }
            : undefined,
        reminders:
          input.reminderMinutes && input.reminderMinutes.length > 0
            ? {
                create: input.reminderMinutes.map((mins) => ({
                  userId: session.user.id,
                  remindBeforeMinutes: mins,
                })),
              }
            : undefined,
      },
      include: {
        matter: {
          select: { id: true, reference: true, title: true },
        },
        procedure: {
          select: { id: true, jurisdiction: true, kind: true, reference: true },
        },
        party: {
          select: { id: true, displayName: true },
        },
        attendees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        reminders: true,
      },
    });

    return event;
  });

  await logAudit({
    actorId: session.user.id,
    action: "event.create",
    entityType: "event",
    entityId: created.id,
    matterId: created.matterId,
    metadata: {
      type: created.type,
      title: created.title,
      startsAt: created.startsAt.toISOString(),
    },
  });

  return created;
}

/**
 * Lists calendar events, strictly adhering to matter visibility permissions (CAL-01, NF-02).
 * Events linked to hidden matters (e.g. STRICT matters without membership) are excluded.
 */
export async function listEvents(params: ListEventsParams, session: AppSession) {
  await authorize(session, "event.view");

  const matterFilter = await accessibleMatterFilter(session);

  const where: Prisma.EventWhereInput = {
    // Security gate: Either event has no matter, or the matter is accessible to the user
    OR: [{ matterId: null }, { matter: matterFilter }],
  };

  if (params.from || params.to) {
    where.startsAt = {};
    if (params.from) where.startsAt.gte = params.from;
    if (params.to) where.startsAt.lte = params.to;
  }

  if (params.type) {
    where.type = params.type;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.matterId) {
    where.matterId = params.matterId;
  }

  if (params.userId) {
    where.attendees = {
      some: {
        userId: params.userId,
      },
    };
  }

  return db.event.findMany({
    where,
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
          jurisdiction: true,
          kind: true,
          reference: true,
        },
      },
      party: {
        select: {
          id: true,
          displayName: true,
        },
      },
      attendees: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      deadlineValidatedBy: {
        select: { id: true, name: true },
      },
      replacesEvent: {
        select: { id: true, title: true, startsAt: true, status: true },
      },
      replacedBy: {
        select: { id: true, title: true, startsAt: true, status: true },
      },
      reminders: true,
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Retrieves a single event by ID with access check.
 */
export async function getEventById(id: string, session: AppSession) {
  await authorize(session, "event.view");

  const event = await db.event.findUnique({
    where: { id },
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
          jurisdiction: true,
          kind: true,
          reference: true,
        },
      },
      party: {
        select: {
          id: true,
          displayName: true,
        },
      },
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      deadlineValidatedBy: {
        select: { id: true, name: true },
      },
      replacesEvent: true,
      replacedBy: true,
      reminders: true,
    },
  });

  if (!event) {
    throw new ForbiddenError("Événement introuvable.", {
      entityId: id,
      reason: "NOT_FOUND",
    });
  }

  if (event.matterId) {
    await assertMatterAccess(session, event.matterId, "VIEW", "general");
  }

  return event;
}

/**
 * Updates an event's details.
 */
export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  session: AppSession
) {
  await authorize(session, "event.edit");

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    throw new ForbiddenError("Événement introuvable.", {
      entityId: id,
      reason: "NOT_FOUND",
    });
  }

  if (event.matterId) {
    await assertMatterAccess(session, event.matterId, "EDIT", "general");
  }

  const updated = await db.$transaction(async (tx) => {
    if (input.attendeeUserIds) {
      await tx.eventAttendee.deleteMany({ where: { eventId: id } });
      if (input.attendeeUserIds.length > 0) {
        await tx.eventAttendee.createMany({
          data: input.attendeeUserIds.map((userId) => ({
            eventId: id,
            userId,
          })),
        });
      }
    }

    return tx.event.update({
      where: { id },
      data: {
        title: input.title !== undefined ? input.title.trim() : undefined,
        startsAt: input.startsAt !== undefined ? input.startsAt : undefined,
        endsAt: input.endsAt !== undefined ? input.endsAt : undefined,
        allDay: input.allDay !== undefined ? input.allDay : undefined,
        location: input.location !== undefined ? input.location?.trim() || null : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        source: input.source !== undefined ? input.source?.trim() || null : undefined,
        status: input.status !== undefined ? input.status : undefined,
      },
      include: {
        matter: { select: { id: true, reference: true, title: true } },
        procedure: { select: { id: true, jurisdiction: true, kind: true, reference: true } },
        attendees: { include: { user: { select: { id: true, name: true } } } },
        deadlineValidatedBy: { select: { id: true, name: true } },
        replacesEvent: true,
        replacedBy: true,
      },
    });
  });

  await logAudit({
    actorId: session.user.id,
    action: "event.update",
    entityType: "event",
    entityId: id,
    matterId: updated.matterId,
    metadata: {
      status: updated.status,
      startsAt: updated.startsAt.toISOString(),
    },
  });

  return updated;
}

/**
 * Postpones an event / hearing (BR-05, CAL-03, REC-04).
 * Crucial rule: The old event is NEVER deleted or overwritten.
 * It is marked `POSTPONED` and a new event is created linked via `replacesEventId`.
 */
export async function postponeEvent(
  id: string,
  input: PostponeEventInput,
  session: AppSession
) {
  await authorize(session, "event.postpone");

  const originalEvent = await db.event.findUnique({
    where: { id },
    include: { attendees: true, reminders: true },
  });

  if (!originalEvent) {
    throw new ForbiddenError("Événement à renvoyer introuvable.", {
      entityId: id,
      reason: "NOT_FOUND",
    });
  }

  if (originalEvent.matterId) {
    await assertMatterAccess(session, originalEvent.matterId, "EDIT", "general");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("Un motif de renvoi ou de report est obligatoire.");
  }

  // Perform postponement inside a single atomic transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Mark existing event as POSTPONED
    await tx.event.update({
      where: { id },
      data: {
        status: EventStatus.POSTPONED,
        description: originalEvent.description
          ? `${originalEvent.description}\n[Renvoi du ${new Date().toLocaleDateString("fr-FR")}]: ${input.reason.trim()}`
          : `[Renvoi du ${new Date().toLocaleDateString("fr-FR")}]: ${input.reason.trim()}`,
      },
    });

    // 2. Create the replacement event linked via replacesEventId
    const newEvent = await tx.event.create({
      data: {
        type: originalEvent.type,
        status: EventStatus.SCHEDULED,
        title: originalEvent.title,
        startsAt: input.newStartsAt,
        endsAt: input.newEndsAt || null,
        allDay: originalEvent.allDay,
        location: input.newLocation?.trim() || originalEvent.location,
        description: `Suite au renvoi de l'audience précédente. Motif: ${input.reason.trim()}`,
        source: originalEvent.source,
        matterId: originalEvent.matterId,
        procedureId: originalEvent.procedureId,
        partyId: originalEvent.partyId,
        createdById: session.user.id,
        replacesEventId: originalEvent.id,
        attendees: {
          create: originalEvent.attendees.map((a) => ({
            userId: a.userId,
          })),
        },
        reminders: {
          create: originalEvent.reminders.map((r) => ({
            userId: r.userId,
            remindBeforeMinutes: r.remindBeforeMinutes,
          })),
        },
      },
      include: {
        matter: { select: { id: true, reference: true, title: true } },
        procedure: { select: { id: true, jurisdiction: true, kind: true, reference: true } },
        replacesEvent: true,
        attendees: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    return { oldEventId: originalEvent.id, newEvent };
  });

  await logAudit({
    actorId: session.user.id,
    action: "event.postpone",
    entityType: "event",
    entityId: id,
    matterId: originalEvent.matterId,
    metadata: {
      reason: input.reason.trim(),
      newStartsAt: input.newStartsAt.toISOString(),
      replacementEventId: result.newEvent.id,
    },
  });

  return result.newEvent;
}

/**
 * Validates a procedural deadline (BR-07, CAL-02, REC-05).
 * Requires `deadline.validate` permission.
 */
export async function validateProceduralDeadline(
  id: string,
  session: AppSession
) {
  await authorize(session, "deadline.validate");

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    throw new ForbiddenError("Échéance procédurale introuvable.", {
      entityId: id,
      reason: "NOT_FOUND",
    });
  }

  if (event.matterId) {
    await assertMatterAccess(session, event.matterId, "EDIT", "general");
  }

  if (event.type !== EventType.PROCEDURAL_DEADLINE) {
    throw new Error(
      "Seules les échéances procédurales légales nécessitent une validation d'avocat."
    );
  }

  const updated = await db.event.update({
    where: { id },
    data: {
      deadlineValidatedById: session.user.id,
      deadlineValidatedAt: new Date(),
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
      deadlineValidatedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "deadline.validate",
    entityType: "event",
    entityId: id,
    matterId: updated.matterId,
    metadata: {
      deadlineValidatedAt: updated.deadlineValidatedAt?.toISOString(),
    },
  });

  return updated;
}

/**
 * Cancels a calendar event.
 */
export async function cancelEvent(
  id: string,
  reason: string,
  session: AppSession
) {
  await authorize(session, "event.cancel");

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    throw new ForbiddenError("Événement introuvable.", {
      entityId: id,
      reason: "NOT_FOUND",
    });
  }

  if (event.matterId) {
    await assertMatterAccess(session, event.matterId, "EDIT", "general");
  }

  const updated = await db.event.update({
    where: { id },
    data: {
      status: EventStatus.CANCELLED,
      description: event.description
        ? `${event.description}\n[Annulé]: ${reason}`
        : `[Annulé]: ${reason}`,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "event.cancel",
    entityType: "event",
    entityId: id,
    matterId: updated.matterId,
    metadata: { reason },
  });

  return updated;
}

