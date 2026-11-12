import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { EventStatus, TaskStatus } from "@prisma/client";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  payload: Record<string, any>;
}

/**
 * Creates an in-app notification.
 */
export async function createNotification(input: CreateNotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: input.payload,
    },
  });
}

/**
 * Lists notifications for the active user session.
 */
export async function listNotifications(session: AppSession) {
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);

  return { notifications, unreadCount };
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  session: AppSession
) {
  return db.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      readAt: new Date(),
    },
  });
}

/**
 * Marks all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(session: AppSession) {
  return db.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

/**
 * Processes pending event reminders (CAL-04, ARCHITECTURE 11).
 * Finds scheduled events where `startsAt - remindBeforeMinutes <= NOW`
 * and sends in-app notifications.
 * Idempotent: sets `sentAt = now()` so reminders are sent once only!
 */
export async function processEventReminders(targetNow: Date = new Date()) {
  // Fetch pending reminders
  const pendingReminders = await db.eventReminder.findMany({
    where: {
      sentAt: null,
      event: {
        status: EventStatus.SCHEDULED,
      },
    },
    include: {
      event: {
        include: {
          matter: { select: { id: true, reference: true, title: true } },
        },
      },
    },
  });

  let processedCount = 0;

  for (const reminder of pendingReminders) {
    const triggerTime = new Date(
      reminder.event.startsAt.getTime() - reminder.remindBeforeMinutes * 60 * 1000
    );

    if (triggerTime <= targetNow) {
      await db.$transaction(async (tx) => {
        // Mark as sent
        await tx.eventReminder.update({
          where: { id: reminder.id },
          data: { sentAt: targetNow },
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: reminder.userId,
            type: "event.reminder",
            payload: {
              eventId: reminder.eventId,
              title: reminder.event.title,
              eventType: reminder.event.type,
              startsAt: reminder.event.startsAt.toISOString(),
              location: reminder.event.location,
              matterReference: reminder.event.matter?.reference || null,
              matterTitle: reminder.event.matter?.title || null,
              remindBeforeMinutes: reminder.remindBeforeMinutes,
            },
          },
        });
      });

      processedCount++;
    }
  }

  return { processedCount };
}

/**
 * Scans for overdue tasks and sends notifications.
 */
export async function processOverdueTasks(targetNow: Date = new Date()) {
  const overdueTasks = await db.task.findMany({
    where: {
      dueAt: { lt: targetNow },
      status: {
        notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
      },
      assigneeId: { not: null },
    },
    include: {
      matter: { select: { id: true, reference: true, title: true } },
    },
    take: 50,
  });

  let notifiedCount = 0;

  for (const task of overdueTasks) {
    if (!task.assigneeId) continue;

    // Check if an unread notification already exists for this task to avoid spamming
    const existingNotif = await db.notification.findFirst({
      where: {
        userId: task.assigneeId,
        type: "task.overdue",
        payload: {
          path: ["taskId"],
          equals: task.id,
        },
        readAt: null,
      },
    });

    if (!existingNotif) {
      await db.notification.create({
        data: {
          userId: task.assigneeId,
          type: "task.overdue",
          payload: {
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            dueAt: task.dueAt?.toISOString(),
            matterReference: task.matter?.reference || null,
          },
        },
      });
      notifiedCount++;
    }
  }

  return { notifiedCount };
}

