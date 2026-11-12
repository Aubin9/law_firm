import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  createEvent,
  listEvents,
  getEventById,
  postponeEvent,
  validateProceduralDeadline,
  cancelEvent,
} from "@/server/services/event-service";
import {
  processEventReminders,
  listNotifications,
  markNotificationAsRead,
} from "@/server/services/notification-service";
import { createMatter } from "@/server/services/matter-service";
import { createParty } from "@/server/services/party-service";
import { recordConflictCheck } from "@/server/services/conflict-service";
import { EventStatus, EventType } from "@prisma/client";

function makeSession(
  userId: string,
  roleKey:
    | "PARTNER"
    | "LEAD_LAWYER"
    | "ASSOCIATE_LAWYER"
    | "SECRETARY"
    | "ACCOUNTANT"
    | "FUNCTIONAL_ADMIN"
    | "TECHNICAL_ADMIN",
  name: string
): AppSession {
  return {
    user: {
      id: userId,
      name,
      email: `${roleKey.toLowerCase()}@cabinet-avocats.cm`,
      locale: "FR",
      status: "ACTIVE",
      roleId: `role_${roleKey.toLowerCase()}`,
      roleKey,
      twoFactorEnabled: true,
    },
    session: {
      id: `sess_${userId}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      token: `token_${userId}`,
    },
  };
}

describe("Calendar, Events and Notifications Specification (STEP 17: CAL-01 to CAL-05, BR-05, BR-07)", () => {
  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Christian FOKOU");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA");
  const associateSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Paul NDOUMBE");
  const secretarySession = makeSession("usr_secr_01", "SECRETARY", "Mme Clarisse FOTSO");
  const accountantSession = makeSession("usr_acct_01", "ACCOUNTANT", "M. Christian BEKOLO");

  const createdMatterIds: string[] = [];
  const createdPartyIds: string[] = [];
  const createdCheckIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdNotificationIds: string[] = [];
  let defaultCategoryId: string = "";

  beforeEach(async () => {
    let cat = await db.matterCategory.findFirst();
    if (!cat) {
      cat = await db.matterCategory.create({
        data: {
          key: "CAT-CAL-TEST",
          nameFr: "Contentieux Judiciaire",
          nameEn: "Litigation",
        },
      });
    }
    defaultCategoryId = cat.id;
  });

  afterEach(async () => {
    if (createdNotificationIds.length > 0) {
      await db.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
      createdNotificationIds.length = 0;
    }

    if (createdEventIds.length > 0) {
      await db.eventAttendee.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await db.eventReminder.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await db.event.deleteMany({
        where: { id: { in: createdEventIds } },
      });
      createdEventIds.length = 0;
    }

    if (createdMatterIds.length > 0) {
      await db.matterMember.deleteMany({
        where: { matterId: { in: createdMatterIds } },
      });
      await db.matterParty.deleteMany({
        where: { matterId: { in: createdMatterIds } },
      });
      await db.auditLog.deleteMany({
        where: { entityId: { in: createdMatterIds } },
      });
      await db.matter.deleteMany({
        where: { id: { in: createdMatterIds } },
      });
      createdMatterIds.length = 0;
    }

    if (createdCheckIds.length > 0) {
      await db.conflictCheck.deleteMany({
        where: { id: { in: createdCheckIds } },
      });
      createdCheckIds.length = 0;
    }

    if (createdPartyIds.length > 0) {
      await db.party.deleteMany({
        where: { id: { in: createdPartyIds } },
      });
      createdPartyIds.length = 0;
    }
  });

  async function createClearedMatter(title: string, confidentiality: "STANDARD" | "STRICT" = "STANDARD") {
    const party = await createParty(
      {
        displayName: `Client Pour ${title}`,
        type: "COMPANY",
        companyName: `Client Pour ${title}`,
        clientStatus: "CLIENT",
      },
      partnerSession
    );
    createdPartyIds.push(party.id);

    const check = await recordConflictCheck(
      {
        partyId: party.id,
        queryText: party.displayName,
        result: "CLEARED",
        decisionNote: "Clearance préalable",
      },
      partnerSession
    );
    createdCheckIds.push(check.id);

    const matter = await createMatter(
      {
        clientId: party.id,
        title,
        categoryId: defaultCategoryId,
        leadLawyerId: leadSession.user.id,
        confidentiality,
        additionalMemberUserIds: [
          { userId: associateSession.user.id, level: "EDIT" },
          { userId: partnerSession.user.id, level: "EDIT" },
        ],
      },
      leadSession
    );
    createdMatterIds.push(matter.id);
    return matter;
  }

  describe("1. Event Creation & Matter Visibility Gate (CAL-01, CAL-05, NF-02)", () => {
    it("creates a hearing event with attendees and automated reminders", async () => {
      const matter = await createClearedMatter("Dossier Contentieux Fiscal");

      const event = await createEvent(
        {
          type: EventType.HEARING,
          title: "Audience d'évocation - TPI de Douala Bonanjo",
          startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          location: "Palais de Justice, Salle 2",
          description: "Plaidoirie sur l'exception de nullité de la saisie",
          matterId: matter.id,
          attendeeUserIds: [leadSession.user.id, associateSession.user.id],
          reminderMinutes: [60, 1440],
        },
        leadSession
      );
      createdEventIds.push(event.id);

      expect(event.id).toBeDefined();
      expect(event.status).toBe(EventStatus.SCHEDULED);
      expect(event.attendees.length).toBe(2);
      expect(event.reminders.length).toBe(2);
      expect(event.matter?.reference).toBe(matter.reference);
    });

    it("strictly excludes events on hidden/inaccessible matters from listEvents (CAL-01, NF-02)", async () => {
      // Create a STRICT matter where only leadSession and partner are members
      const party = await createParty(
        {
          displayName: "Client Secret Strict",
          type: "COMPANY",
          companyName: "Client Secret Strict",
          clientStatus: "CLIENT",
        },
        partnerSession
      );
      createdPartyIds.push(party.id);

      const check = await recordConflictCheck(
        {
          partyId: party.id,
          queryText: party.displayName,
          result: "CLEARED",
          decisionNote: "Clearance",
        },
        partnerSession
      );
      createdCheckIds.push(check.id);

      // Lead Lawyer creates a STRICT matter without adding associateSession
      const strictMatter = await createMatter(
        {
          clientId: party.id,
          title: "Dossier Strict Ultra Confidentiel",
          categoryId: defaultCategoryId,
          leadLawyerId: leadSession.user.id,
          confidentiality: "STRICT",
        },
        leadSession
      );
      createdMatterIds.push(strictMatter.id);

      // Create a hearing on this STRICT matter
      const secretEvent = await createEvent(
        {
          type: EventType.HEARING,
          title: "Audience à huis clos ultra-confidentielle",
          startsAt: new Date(Date.now() + 48 * 3600 * 1000),
          matterId: strictMatter.id,
        },
        leadSession
      );
      createdEventIds.push(secretEvent.id);

      // Lead lawyer can see it
      const leadEvents = await listEvents({ matterId: strictMatter.id }, leadSession);
      expect(leadEvents.some((e) => e.id === secretEvent.id)).toBe(true);

      // Associate Lawyer (not member of STRICT matter) MUST NOT see it
      const associateEvents = await listEvents({}, associateSession);
      expect(associateEvents.some((e) => e.id === secretEvent.id)).toBe(false);

      // Direct lookup by Associate Lawyer on hidden event must throw ForbiddenError
      await expect(getEventById(secretEvent.id, associateSession)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("2. Procedural Deadlines & Lawyer Validation Gate (BR-07, CAL-02, REC-05)", () => {
    it("mandates a source when creating a procedural deadline", async () => {
      const matter = await createClearedMatter("Dossier Injonction de Payer");

      // Attempting to create PROCEDURAL_DEADLINE without source fails
      await expect(
        createEvent(
          {
            type: EventType.PROCEDURAL_DEADLINE,
            title: "Délai d'opposition à injonction de payer (15 jours)",
            startsAt: new Date(Date.now() + 15 * 24 * 3600 * 1000),
            matterId: matter.id,
            source: "", // Missing source
          },
          leadSession
        )
      ).rejects.toThrow(/source légale ou judiciaire/i);
    });

    it("blocks deadline validation by unauthorized roles and allows lawyer validation (BR-07)", async () => {
      const matter = await createClearedMatter("Dossier Recours Contentieux");

      const deadline = await createEvent(
        {
          type: EventType.PROCEDURAL_DEADLINE,
          title: "Délai de recours gracieux préalable",
          startsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          matterId: matter.id,
          source: "Art. 18 de la Loi n° 2006/022 fixant l'organisation du contentieux administratif",
        },
        leadSession
      );
      createdEventIds.push(deadline.id);

      expect(deadline.deadlineValidatedById).toBeNull();
      expect(deadline.deadlineValidatedAt).toBeNull();

      // Secretary lacks `deadline.validate` permission -> Attempt must fail
      await expect(
        validateProceduralDeadline(deadline.id, secretarySession)
      ).rejects.toThrow(ForbiddenError);

      // Lead Lawyer has `deadline.validate` -> Successfully validates
      const validated = await validateProceduralDeadline(deadline.id, leadSession);
      expect(validated.deadlineValidatedById).toBe(leadSession.user.id);
      expect(validated.deadlineValidatedAt).not.toBeNull();
      expect(validated.deadlineValidatedBy?.name).toBe(leadSession.user.name);
    });
  });

  describe("3. Hearing Postponement Non-Destructive Rule (BR-05, CAL-03, REC-04)", () => {
    it("preserves original hearing as POSTPONED and creates a linked replacement event", async () => {
      const matter = await createClearedMatter("Dossier Voies d'Exécution");

      const originalHearing = await createEvent(
        {
          type: EventType.HEARING,
          title: "Audience préliminaire de conciliation",
          startsAt: new Date(Date.now() + 24 * 3600 * 1000),
          location: "TPI Douala Salle 1",
          matterId: matter.id,
          attendeeUserIds: [leadSession.user.id],
        },
        leadSession
      );
      createdEventIds.push(originalHearing.id);

      const newDate = new Date(Date.now() + 14 * 24 * 3600 * 1000);
      const reason = "Renvoyé pour échange contradictoire des pièces comptables";

      // Postpone original hearing
      const replacement = await postponeEvent(
        originalHearing.id,
        {
          newStartsAt: newDate,
          reason,
          newLocation: "TPI Douala Salle 4",
        },
        leadSession
      );
      createdEventIds.push(replacement.id);

      // Verify the old hearing still exists with POSTPONED status (BR-05)
      const oldHearingRefetched = await db.event.findUnique({
        where: { id: originalHearing.id },
      });
      expect(oldHearingRefetched).not.toBeNull();
      expect(oldHearingRefetched?.status).toBe(EventStatus.POSTPONED);
      expect(oldHearingRefetched?.description).toContain(reason);

      // Verify replacement event points to old hearing via replacesEventId
      expect(replacement.status).toBe(EventStatus.SCHEDULED);
      expect(replacement.replacesEventId).toBe(originalHearing.id);
      expect(replacement.startsAt.getTime()).toBe(newDate.getTime());
      expect(replacement.location).toBe("TPI Douala Salle 4");
    });
  });

  describe("4. Automated Reminders and In-App Notifications (CAL-04, ARCHITECTURE 11)", () => {
    it("processes due event reminders idempotently and delivers in-app notifications", async () => {
      const matter = await createClearedMatter("Dossier Notification Test");

      const now = new Date();
      // Event starting in 30 minutes
      const eventStartsAt = new Date(now.getTime() + 30 * 60 * 1000);

      const event = await createEvent(
        {
          type: EventType.HEARING,
          title: "Audience imminente - Délibéré sur incident",
          startsAt: eventStartsAt,
          matterId: matter.id,
          attendeeUserIds: [leadSession.user.id],
          reminderMinutes: [60], // Remind 60 minutes before (so already due!)
        },
        leadSession
      );
      createdEventIds.push(event.id);

      // Run reminder processing worker function
      const firstRun = await processEventReminders(now);
      expect(firstRun.processedCount).toBeGreaterThanOrEqual(1);

      // Verify notification was delivered to leadSession
      const { notifications, unreadCount } = await listNotifications(leadSession);
      const reminderNotif = notifications.find(
        (n) => n.type === "event.reminder" && (n.payload as any)?.eventId === event.id
      );

      expect(reminderNotif).toBeDefined();
      expect((reminderNotif?.payload as any)?.title).toContain("Audience imminente");
      createdNotificationIds.push(reminderNotif!.id);

      // Idempotency: Second immediate run must NOT re-send duplicate notifications
      const secondRun = await processEventReminders(now);
      expect(secondRun.processedCount).toBe(0);

      // Mark notification as read
      await markNotificationAsRead(reminderNotif!.id, leadSession);
      const afterRead = await listNotifications(leadSession);
      const readNotif = afterRead.notifications.find((n) => n.id === reminderNotif!.id);
      expect(readNotif?.readAt).not.toBeNull();
    });
  });
});
