import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { listEvents } from "@/server/services/event-service";
import { listMatters } from "@/server/services/matter-service";
import { CalendarClient, SerializedEvent } from "./calendar-client";

export default async function CalendarPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  // Fetch events for initial view (e.g. current month +/- 2 months)
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [rawEvents, mattersResult] = await Promise.all([
    listEvents({ from, to }, session),
    listMatters({ pageSize: 100 }, session),
  ]);

  const serializedEvents: SerializedEvent[] = rawEvents.map((ev) => ({
    id: ev.id,
    type: ev.type,
    status: ev.status,
    title: ev.title,
    startsAt: ev.startsAt.toISOString(),
    endsAt: ev.endsAt ? ev.endsAt.toISOString() : null,
    allDay: ev.allDay,
    location: ev.location,
    description: ev.description,
    source: ev.source,
    matterId: ev.matterId,
    matter: ev.matter
      ? {
          id: ev.matter.id,
          reference: ev.matter.reference,
          title: ev.matter.title,
          confidentiality: ev.matter.confidentiality,
        }
      : null,
    procedureId: ev.procedureId,
    procedure: ev.procedure
      ? {
          id: ev.procedure.id,
          jurisdiction: ev.procedure.jurisdiction,
          kind: ev.procedure.kind,
          reference: ev.procedure.reference,
        }
      : null,
    party: ev.party
      ? {
          id: ev.party.id,
          displayName: ev.party.displayName,
        }
      : null,
    attendees: ev.attendees.map((a) => ({
      user: {
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      },
    })),
    deadlineValidatedById: ev.deadlineValidatedById,
    deadlineValidatedBy: ev.deadlineValidatedBy
      ? {
          id: ev.deadlineValidatedBy.id,
          name: ev.deadlineValidatedBy.name,
        }
      : null,
    deadlineValidatedAt: ev.deadlineValidatedAt
      ? ev.deadlineValidatedAt.toISOString()
      : null,
    replacesEventId: ev.replacesEventId,
    replacesEvent: ev.replacesEvent
      ? {
          id: ev.replacesEvent.id,
          title: ev.replacesEvent.title,
          startsAt: ev.replacesEvent.startsAt.toISOString(),
          status: ev.replacesEvent.status,
        }
      : null,
    replacedBy: ev.replacedBy
      ? {
          id: ev.replacedBy.id,
          title: ev.replacedBy.title,
          startsAt: ev.replacedBy.startsAt.toISOString(),
          status: ev.replacedBy.status,
        }
      : null,
    reminders: ev.reminders.map((r) => ({
      id: r.id,
      remindBeforeMinutes: r.remindBeforeMinutes,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    })),
  }));

  const accessibleMatters = mattersResult.matters.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
  }));

  return (
    <CalendarClient
      initialEvents={serializedEvents}
      accessibleMatters={accessibleMatters}
      currentUserId={session.user.id}
      currentUserRole={session.user.roleKey}
    />
  );
}

