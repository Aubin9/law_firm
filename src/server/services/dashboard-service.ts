import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import {
  ConflictResult,
  EventStatus,
  EventType,
  MatterStatus,
  TaskStatus,
} from "@prisma/client";

export interface DashboardData {
  user: {
    id: string;
    name: string;
    roleKey: string;
    roleName: string;
  };
  attention: {
    overdueTasksCount: number;
    itemsToValidateCount: number;
    deadlinesNext7DaysCount: number;
    hearingsTodayCount: number;
  };
  roleData: {
    // Lawyer & Lead cards
    myNextHearings?: {
      id: string;
      title: string;
      startsAt: string;
      location: string | null;
      matterReference: string | null;
    }[];
    myTasks?: {
      id: string;
      title: string;
      priority: string;
      status: string;
      dueAt: string | null;
      matterReference: string | null;
    }[];
    documentsToValidate?: {
      id: string;
      title: string;
      matterReference: string | null;
      updatedAt: string;
    }[];
    myRecentMatters?: {
      id: string;
      reference: string;
      title: string;
      status: string;
      clientName: string | null;
    }[];

    // Secretariat cards
    newInquiries?: {
      id: string;
      subject: string;
      partyName: string | null;
      channel: string;
      createdAt: string;
    }[];
    appointmentsToday?: {
      id: string;
      title: string;
      startsAt: string;
      partyName: string | null;
    }[];

    // Partner firm-wide indicators
    firmMetrics?: {
      activeMattersCount: number;
      upcomingHearingsCount: number;
      overdueTasksCount: number;
      pendingConflictChecksCount: number;
    };
    lawyerWorkload?: {
      lawyerId: string;
      lawyerName: string;
      activeMattersCount: number;
      pendingTasksCount: number;
    }[];
  };
}

/**
 * Computes dashboard data customized by role (DESIGN.md 8.2).
 */
export async function getDashboardData(session: AppSession): Promise<DashboardData> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const next7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const matterFilter = await accessibleMatterFilter(session);
  const isPartner = session.user.roleKey === "PARTNER";
  const isLead = session.user.roleKey === "LEAD_LAWYER";
  const isAssociate = session.user.roleKey === "ASSOCIATE_LAWYER";
  const isSecretary = session.user.roleKey === "SECRETARY";
  const isAccountant = session.user.roleKey === "ACCOUNTANT";

  // 1. "Needs your attention" urgent strip counters
  const [
    overdueTasksCount,
    pendingTasksToValidateCount,
    unvalidatedDeadlinesCount,
    deadlinesNext7DaysCount,
    hearingsTodayCount,
  ] = await Promise.all([
    // Overdue tasks
    db.task.count({
      where: {
        dueAt: { lt: now },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        OR: [{ matterId: null }, { matter: matterFilter }],
        ...(isAssociate ? { assigneeId: session.user.id } : {}),
      },
    }),

    // Tasks requiring validation
    db.task.count({
      where: {
        requiresValidation: true,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        OR: [{ matterId: null }, { matter: matterFilter }],
      },
    }),

    // Procedural deadlines requiring lawyer validation
    db.event.count({
      where: {
        type: EventType.PROCEDURAL_DEADLINE,
        deadlineValidatedById: null,
        status: EventStatus.SCHEDULED,
        OR: [{ matterId: null }, { matter: matterFilter }],
      },
    }),

    // Deadlines in next 7 days
    db.event.count({
      where: {
        type: { in: [EventType.PROCEDURAL_DEADLINE, EventType.INTERNAL_DEADLINE] },
        startsAt: { gte: now, lte: next7Days },
        status: EventStatus.SCHEDULED,
        OR: [{ matterId: null }, { matter: matterFilter }],
      },
    }),

    // Hearings today
    db.event.count({
      where: {
        type: EventType.HEARING,
        startsAt: { gte: startOfToday, lte: endOfToday },
        status: EventStatus.SCHEDULED,
        OR: [{ matterId: null }, { matter: matterFilter }],
      },
    }),
  ]);

  const itemsToValidateCount = pendingTasksToValidateCount + unvalidatedDeadlinesCount;

  // 2. Role-specific card data
  const roleData: DashboardData["roleData"] = {};

  if (isPartner || isLead || isAssociate) {
    // Lawyer & Partner Views
    const [nextHearings, myTasks, recentMatters] = await Promise.all([
      db.event.findMany({
        where: {
          type: EventType.HEARING,
          startsAt: { gte: now },
          status: EventStatus.SCHEDULED,
          OR: [{ matterId: null }, { matter: matterFilter }],
        },
        include: {
          matter: { select: { reference: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),

      db.task.findMany({
        where: {
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          OR: [{ matterId: null }, { matter: matterFilter }],
          ...(isAssociate ? { assigneeId: session.user.id } : {}),
        },
        include: {
          matter: { select: { reference: true } },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
        take: 5,
      }),

      db.matter.findMany({
        where: {
          AND: [
            matterFilter,
            { deletedAt: null },
            ...(isAssociate || isLead
              ? [{ members: { some: { userId: session.user.id } } }]
              : []),
          ],
        },
        include: {
          parties: {
            where: { role: "CLIENT" },
            include: { party: { select: { displayName: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    roleData.myNextHearings = nextHearings.map((h) => ({
      id: h.id,
      title: h.title,
      startsAt: h.startsAt.toISOString(),
      location: h.location,
      matterReference: h.matter?.reference || null,
    }));

    roleData.myTasks = myTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      matterReference: t.matter?.reference || null,
    }));

    roleData.myRecentMatters = recentMatters.map((m) => ({
      id: m.id,
      reference: m.reference,
      title: m.title,
      status: m.status,
      clientName: m.parties[0]?.party?.displayName || null,
    }));
  }

  if (isPartner) {
    // Managing Partner Firm-wide Indicators
    const [activeMattersCount, upcomingHearingsCount, pendingConflictChecksCount, lawyers] =
      await Promise.all([
        db.matter.count({ where: { deletedAt: null, status: MatterStatus.OPEN } }),
        db.event.count({
          where: { type: EventType.HEARING, startsAt: { gte: now }, status: EventStatus.SCHEDULED },
        }),
        db.conflictCheck.count({
          where: { result: ConflictResult.POTENTIAL_CONFLICT },
        }),
        db.user.findMany({
          where: {
            role: { key: { in: ["LEAD_LAWYER", "ASSOCIATE_LAWYER"] } },
            status: "ACTIVE",
          },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                matterAccess: true,
                assignedTasks: {
                  where: { status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] } },
                },
              },
            },
          },
          take: 6,
        }),
      ]);

    roleData.firmMetrics = {
      activeMattersCount,
      upcomingHearingsCount,
      overdueTasksCount,
      pendingConflictChecksCount,
    };

    roleData.lawyerWorkload = lawyers.map((l) => ({
      lawyerId: l.id,
      lawyerName: l.name,
      activeMattersCount: l._count.matterAccess,
      pendingTasksCount: l._count.assignedTasks,
    }));
  }

  if (isSecretary) {
    // Secretariat Cards
    const [newInquiries, appointments] = await Promise.all([
      db.inquiry.findMany({
        where: { workflowStep: { key: { in: ["NEW", "TO_CONTACT"] } } },
        include: { party: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.event.findMany({
        where: {
          type: { in: [EventType.APPOINTMENT, EventType.CONSULTATION, EventType.MEETING] },
          startsAt: { gte: startOfToday, lte: endOfToday },
          status: EventStatus.SCHEDULED,
        },
        include: { party: { select: { displayName: true } } },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
    ]);

    roleData.newInquiries = newInquiries.map((inq) => ({
      id: inq.id,
      subject: inq.subject,
      partyName: inq.party?.displayName || null,
      channel: inq.channel,
      createdAt: inq.createdAt.toISOString(),
    }));

    roleData.appointmentsToday = appointments.map((apt) => ({
      id: apt.id,
      title: apt.title,
      startsAt: apt.startsAt.toISOString(),
      partyName: apt.party?.displayName || null,
    }));
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      roleKey: session.user.roleKey,
      roleName: session.user.roleKey,
    },
    attention: {
      overdueTasksCount,
      itemsToValidateCount,
      deadlinesNext7DaysCount,
      hearingsTodayCount,
    },
    roleData,
  };
}
