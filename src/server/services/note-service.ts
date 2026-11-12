import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";

export interface CreateNoteInput {
  matterId: string;
  eventId?: string | null;
  body: string;
  shareable?: boolean;
}

export interface UpdateNoteInput {
  body?: string;
  shareable?: boolean;
}

/**
 * Creates an internal note on a matter (TSK-03, DESIGN 8.10).
 * Internal notes stay strictly internal by default unless explicitly flagged shareable.
 */
export async function createNote(input: CreateNoteInput, session: AppSession) {
  await authorize(session, "note.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "note");

  const note = await db.note.create({
    data: {
      matterId: input.matterId,
      eventId: input.eventId || null,
      authorId: session.user.id,
      body: input.body.trim(),
      shareable: input.shareable ?? false,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "note.create",
    entityType: "Note",
    entityId: note.id,
    matterId: input.matterId,
    metadata: {
      shareable: note.shareable,
      bodyLength: note.body.length,
    },
  });

  return note;
}

/**
 * Updates a note.
 */
export async function updateNote(
  id: string,
  input: UpdateNoteInput,
  session: AppSession
) {
  const existing = await db.note.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ForbiddenError("Note introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Note",
      entityId: id,
    });
  }

  await assertMatterAccess(session, existing.matterId, "EDIT", "note");

  if (input.shareable !== undefined && input.shareable !== existing.shareable) {
    await authorize(session, "note.share");
  }

  const updated = await db.note.update({
    where: { id },
    data: {
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.shareable !== undefined ? { shareable: input.shareable } : {}),
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "note.edit",
    entityType: "Note",
    entityId: id,
    matterId: existing.matterId,
    metadata: {
      shareable: updated.shareable,
    },
  });

  return updated;
}

/**
 * Deletes a note. Only author, lead lawyer, or partner can delete.
 */
export async function deleteNote(id: string, session: AppSession) {
  const existing = await db.note.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ForbiddenError("Note introuvable.", {
      reason: "NOT_FOUND",
      entityType: "Note",
      entityId: id,
    });
  }

  await assertMatterAccess(session, existing.matterId, "EDIT", "note");

  await db.note.delete({
    where: { id },
  });

  await logAudit({
    actorId: session.user.id,
    action: "note.delete",
    entityType: "Note",
    entityId: id,
    matterId: existing.matterId,
  });

  return { success: true };
}

/**
 * Lists notes for a matter.
 */
export async function listNotesForMatter(matterId: string, session: AppSession) {
  await authorize(session, "note.view");
  await assertMatterAccess(session, matterId, "VIEW", "note");

  return await db.note.findMany({
    where: { matterId },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

