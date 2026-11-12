"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createEvent,
  updateEvent,
  postponeEvent,
  validateProceduralDeadline,
  cancelEvent,
  listEvents,
  getEventById,
} from "@/server/services/event-service";
import { EventStatus, EventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createEventSchema = z.object({
  type: z.nativeEnum(EventType),
  title: z.string().min(1, "Le titre est requis"),
  startsAt: z.string().or(z.date()),
  endsAt: z.string().or(z.date()).optional().nullable(),
  allDay: z.boolean().optional(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  matterId: z.string().uuid().optional().nullable(),
  procedureId: z.string().uuid().optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  attendeeUserIds: z.array(z.string()).optional(),
  reminderMinutes: z.array(z.number()).optional(),
});

const updateEventSchema = z.object({
  title: z.string().optional(),
  startsAt: z.string().or(z.date()).optional(),
  endsAt: z.string().or(z.date()).optional().nullable(),
  allDay: z.boolean().optional(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.nativeEnum(EventStatus).optional(),
  attendeeUserIds: z.array(z.string()).optional(),
});

const postponeEventSchema = z.object({
  newStartsAt: z.string().or(z.date()),
  newEndsAt: z.string().or(z.date()).optional().nullable(),
  reason: z.string().min(1, "Le motif du renvoi est obligatoire"),
  newLocation: z.string().optional().nullable(),
});

export async function createEventAction(rawInput: unknown) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = createEventSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  try {
    const event = await createEvent(
      {
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
      session
    );

    revalidatePath("/calendar");
    if (event.matterId) {
      revalidatePath(`/matters/${event.matterId}`);
    }

    return { success: true, data: event };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la création de l'événement" };
  }
}

export async function updateEventAction(id: string, rawInput: unknown) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = updateEventSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  try {
    const updated = await updateEvent(
      id,
      {
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      },
      session
    );

    revalidatePath("/calendar");
    if (updated.matterId) {
      revalidatePath(`/matters/${updated.matterId}`);
    }

    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la mise à jour" };
  }
}

export async function postponeEventAction(id: string, rawInput: unknown) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = postponeEventSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  try {
    const newEvent = await postponeEvent(
      id,
      {
        newStartsAt: new Date(parsed.data.newStartsAt),
        newEndsAt: parsed.data.newEndsAt ? new Date(parsed.data.newEndsAt) : null,
        reason: parsed.data.reason,
        newLocation: parsed.data.newLocation,
      },
      session
    );

    revalidatePath("/calendar");
    if (newEvent.matterId) {
      revalidatePath(`/matters/${newEvent.matterId}`);
    }

    return { success: true, data: newEvent };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du renvoi de l'audience" };
  }
}

export async function validateProceduralDeadlineAction(id: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const updated = await validateProceduralDeadline(id, session);

    revalidatePath("/calendar");
    if (updated.matterId) {
      revalidatePath(`/matters/${updated.matterId}`);
    }

    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation d'échéance" };
  }
}

export async function cancelEventAction(id: string, reason: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const updated = await cancelEvent(id, reason, session);

    revalidatePath("/calendar");
    if (updated.matterId) {
      revalidatePath(`/matters/${updated.matterId}`);
    }

    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur d'annulation" };
  }
}

export async function getCalendarEventsAction(params: {
  from?: string;
  to?: string;
  type?: EventType;
  status?: EventStatus;
  matterId?: string;
}) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const events = await listEvents(
      {
        from: params.from ? new Date(params.from) : undefined,
        to: params.to ? new Date(params.to) : undefined,
        type: params.type,
        status: params.status,
        matterId: params.matterId,
      },
      session
    );

    return { success: true, data: events };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de récupération des événements" };
  }
}

