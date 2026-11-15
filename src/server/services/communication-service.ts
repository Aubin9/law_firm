import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  CommunicationChannel,
  CommunicationDirection,
  Confidentiality,
} from "@prisma/client";

export interface CreateCommunicationInput {
  matterId?: string | null;
  partyId?: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string | null;
  body?: string | null;
  occurredAt?: Date | null;
  confidentiality?: Confidentiality;
  documentId?: string | null;
}

/**
 * Creates and logs a communication (LEG-09 / MOD-12).
 */
export async function createCommunication(
  input: CreateCommunicationInput,
  session: AppSession
) {
  await authorize(session, "communication.create");

  if (input.matterId) {
    await assertMatterAccess(session, input.matterId, "EDIT", "general");
  }

  if (!input.body?.trim() && !input.subject?.trim()) {
    throw new Error("Un objet ou un contenu de communication est obligatoire.");
  }

  const communication = await db.communication.create({
    data: {
      matterId: input.matterId || null,
      partyId: input.partyId || null,
      channel: input.channel,
      direction: input.direction,
      subject: input.subject?.trim() || null,
      body: input.body?.trim() || null,
      occurredAt: input.occurredAt || new Date(),
      confidentiality: input.confidentiality || "STANDARD",
      documentId: input.documentId || null,
      authorId: session.user.id,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      party: { select: { id: true, displayName: true } },
      matter: { select: { id: true, reference: true, title: true } },
      document: { select: { id: true, title: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "communication.create",
    entityType: "Communication",
    entityId: communication.id,
    matterId: input.matterId || undefined,
    metadata: {
      channel: input.channel,
      direction: input.direction,
      subject: input.subject,
    },
  });

  return communication;
}

/**
 * Lists communications for a matter in reverse chronological order.
 */
export async function listCommunicationsForMatter(
  matterId: string,
  session: AppSession
) {
  await authorize(session, "communication.view");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return await db.communication.findMany({
    where: { matterId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      party: { select: { id: true, displayName: true } },
      document: { select: { id: true, title: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

