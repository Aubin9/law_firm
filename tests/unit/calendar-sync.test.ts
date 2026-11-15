import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  getOrCreateUserCalendarToken,
  revokeUserCalendarToken,
  generateIcsFeed,
  toggleCalendarSyncFlag,
  checkCalendarSyncPreconditions,
} from "@/server/services/calendar-sync-service";
import { EventType, EventStatus, Confidentiality } from "@prisma/client";

describe("Calendar Synchronization (Step 26: INT-03, RFC 5545, NF-02)", () => {
  let partnerSession: AppSession;
  let lawyerSession: AppSession;
  let outsiderSession: AppSession;

  let standardMatter: any;
  let strictMatter: any;
  let standardEvent: any;
  let strictEvent: any;

  beforeAll(async () => {
    // 1. Fetch test users
    const [partnerUser, lawyerUser, accountantUser] = await Promise.all([
      db.user.findFirst({
        where: { role: { key: "PARTNER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "LEAD_LAWYER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" },
      }),
    ]);

    if (!partnerUser || !lawyerUser || !accountantUser) {
      throw new Error("Missing test users for calendar sync tests");
    }

    partnerSession = {
      user: {
        id: partnerUser.id,
        name: partnerUser.name,
        email: partnerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: partnerUser.roleId,
        roleKey: "PARTNER",
      },
      session: {
        id: "sess_calsync_partner",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_calsync_partner",
      },
    };

    lawyerSession = {
      user: {
        id: lawyerUser.id,
        name: lawyerUser.name,
        email: lawyerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: lawyerUser.roleId,
        roleKey: "LEAD_LAWYER",
      },
      session: {
        id: "sess_calsync_lawyer",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_calsync_lawyer",
      },
    };

    outsiderSession = {
      user: {
        id: accountantUser.id,
        name: accountantUser.name,
        email: accountantUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: accountantUser.roleId,
        roleKey: "ACCOUNTANT",
      },
      session: {
        id: "sess_calsync_outsider",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_calsync_outsider",
      },
    };

    // 2. Enable flag for test
    await toggleCalendarSyncFlag(partnerSession, true);

    const category = await db.matterCategory.findFirst();
    if (!category) {
      throw new Error("Missing matter category");
    }

    // 3. Create a standard matter and assign lawyer
    standardMatter = await db.matter.create({
      data: {
        reference: "DOS-2026-CAL-STD",
        title: "Litige Commercial Standard",
        confidentiality: Confidentiality.STANDARD,
        categoryId: category.id,
        leadLawyerId: lawyerUser.id,
        createdById: partnerUser.id,
        members: {
          create: [{ userId: lawyerUser.id, level: "MANAGE" }],
        },
      },
    });

    // 4. Create a STRICT confidential matter (lawyer is member, outsider is not)
    strictMatter = await db.matter.create({
      data: {
        reference: "DOS-2026-CAL-STR",
        title: "Opération Fusion Confidentielle Groupe X",
        confidentiality: Confidentiality.STRICT,
        categoryId: category.id,
        leadLawyerId: lawyerUser.id,
        createdById: partnerUser.id,
        members: {
          create: [{ userId: lawyerUser.id, level: "MANAGE" }],
        },
      },
    });

    // 5. Create calendar events
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 3600 * 1000);

    standardEvent = await db.event.create({
      data: {
        type: EventType.HEARING,
        status: EventStatus.SCHEDULED,
        title: "Audience de Mise en État Chambre Commerciale",
        startsAt: tomorrow,
        endsAt: new Date(tomorrow.getTime() + 2 * 3600 * 1000),
        location: "Tribunal de Grande Instance de Douala",
        description: "Plaidoirie sur exception d'incompétence",
        matterId: standardMatter.id,
        createdById: lawyerUser.id,
      },
    });

    strictEvent = await db.event.create({
      data: {
        type: EventType.HEARING,
        status: EventStatus.SCHEDULED,
        title: "Audience d'Homologation Secrète Chambre du Conseil",
        startsAt: dayAfter,
        endsAt: new Date(dayAfter.getTime() + 3 * 3600 * 1000),
        location: "Palais de Justice — Cabinet du Président",
        description: "Examen des accords d'actionnaires confidentiels",
        matterId: strictMatter.id,
        createdById: lawyerUser.id,
      },
    });
  });

  afterAll(async () => {
    // Reset flag to false (Air-gap étanche)
    await toggleCalendarSyncFlag(partnerSession, false);

    // Clean up events and matters
    if (standardEvent) {
      await db.event.delete({ where: { id: standardEvent.id } });
    }
    if (strictEvent) {
      await db.event.delete({ where: { id: strictEvent.id } });
    }

    if (standardMatter) {
      await db.matterMember.deleteMany({ where: { matterId: standardMatter.id } });
      await db.matter.delete({ where: { id: standardMatter.id } });
    }
    if (strictMatter) {
      await db.matterMember.deleteMany({ where: { matterId: strictMatter.id } });
      await db.matter.delete({ where: { id: strictMatter.id } });
    }

    // Clean verification tokens
    await db.verification.deleteMany({
      where: { identifier: { startsWith: "cal_feed_" } },
    });
  });

  it("1. generates and retrieves a secure, signed HMAC feed token for the user", async () => {
    const token = await getOrCreateUserCalendarToken(lawyerSession);
    expect(token).toBeDefined();

    const parts = token.split(".");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(lawyerSession.user.id);
  });

  it("2. generates a valid RFC 5545 iCalendar payload with VCALENDAR and VEVENT", async () => {
    const token = await getOrCreateUserCalendarToken(lawyerSession);
    const ics = await generateIcsFeed(token, "http://localhost:3001");

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//LawFirm Platform//Cabinet Avocats Cameroun//FR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("END:VCALENDAR");

    // Standard event details present
    expect(ics).toContain(standardMatter.reference);
    expect(ics).toContain("Audience de Mise en État Chambre Commerciale");
    expect(ics).toContain("Tribunal de Grande Instance de Douala");
  });

  it("3. masks sensitive details of STRICT confidential matters to protect professional secrecy", async () => {
    const token = await getOrCreateUserCalendarToken(lawyerSession);
    const ics = await generateIcsFeed(token, "http://localhost:3001");

    // Must NOT leak secret details to external calendar
    expect(ics).not.toContain("Opération Fusion Confidentielle Groupe X");
    expect(ics).not.toContain("Examen des accords d'actionnaires confidentiels");

    // Must show masked placeholder instead
    expect(ics).toContain("[Audience Confidentielle] Dossier Réservé");
    expect(ics).toContain("Événement confidentiel soumis au secret professionnel absolu");
  });

  it("4. immediately invalidates feed access when token is revoked (emergency killswitch)", async () => {
    const token = await getOrCreateUserCalendarToken(lawyerSession);

    // Revoke token
    await revokeUserCalendarToken(lawyerSession);

    // Attempting to fetch feed with old token must be rejected
    await expect(generateIcsFeed(token, "http://localhost:3001")).rejects.toThrow(
      /Ce jeton d'accès a été révoqué ou a expiré/
    );
  });

  it("5. blocks feed generation when feature flag calendar.sync.enabled is off", async () => {
    // Generate fresh token
    const token = await getOrCreateUserCalendarToken(lawyerSession);

    // Disable flag
    await toggleCalendarSyncFlag(partnerSession, false);

    await expect(generateIcsFeed(token, "http://localhost:3001")).rejects.toThrow(
      /désactivée par la politique du cabinet/
    );

    // Re-enable for cleanup
    await toggleCalendarSyncFlag(partnerSession, true);
  });
});

