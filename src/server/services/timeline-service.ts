import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { assertMatterAccess } from "@/server/auth/matter-access";

export interface TimelineEntry {
  id: string;
  type: "STATUS_CHANGE" | "DOCUMENT" | "EVENT" | "NOTE" | "TASK";
  title: string;
  description?: string | null;
  timestamp: string;
  authorName?: string;
  metadata?: Record<string, any>;
}

/**
 * Compiles a consolidated, chronological timeline for a matter (UX-10, DESIGN.md 4.7).
 * Strictly requires matter VIEW access.
 */
export async function getMatterTimeline(
  session: AppSession,
  matterId: string,
  typeFilter?: string
): Promise<TimelineEntry[]> {
  await assertMatterAccess(session, matterId, "VIEW");

  const [statusChanges, documents, events, notes, tasks] = await Promise.all([
    // 1. Status changes
    db.statusChange.findMany({
      where: { entityType: "MATTER", entityId: matterId },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { name: true } } },
    }),
    // 2. Documents created
    db.document.findMany({
      where: { matterId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { uploadedBy: { select: { name: true } } },
        },
      },
    }),
    // 3. Events (hearings, deadlines)
    db.event.findMany({
      where: { matterId },
      orderBy: { startsAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    // 4. Notes
    db.note.findMany({
      where: { matterId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    }),
    // 5. Tasks
    db.task.findMany({
      where: { matterId },
      orderBy: { createdAt: "desc" },
      include: { assignee: { select: { name: true } } },
    }),
  ]);

  const entries: TimelineEntry[] = [];

  for (const sc of statusChanges) {
    entries.push({
      id: `sc_${sc.id}`,
      type: "STATUS_CHANGE",
      title: `Étape de procédure : ${sc.toStepKey}`,
      description: sc.comment || (sc.fromStepKey ? `Transition depuis ${sc.fromStepKey}` : "Création du dossier"),
      timestamp: sc.createdAt.toISOString(),
      authorName: sc.changedBy?.name || "Système",
      metadata: { from: sc.fromStepKey, to: sc.toStepKey },
    });
  }

  for (const doc of documents) {
    const latestVersion = doc.versions[0];
    entries.push({
      id: `doc_${doc.id}`,
      type: "DOCUMENT",
      title: `Document ajouté : ${doc.title}`,
      description: latestVersion ? `Fichier ${latestVersion.fileName} (v${latestVersion.versionNumber})` : null,
      timestamp: doc.createdAt.toISOString(),
      authorName: latestVersion?.uploadedBy?.name || "Collaborateur",
      metadata: { documentId: doc.id, confidentiality: doc.confidentiality },
    });
  }

  for (const ev of events) {
    entries.push({
      id: `ev_${ev.id}`,
      type: "EVENT",
      title: `${ev.type === "HEARING" ? "Audience" : "Événement"} : ${ev.title}`,
      description: ev.location ? `Lieu : ${ev.location}` : ev.description,
      timestamp: ev.startsAt.toISOString(),
      authorName: ev.createdBy?.name || "Avocat",
      metadata: { eventType: ev.type, status: ev.status },
    });
  }

  for (const n of notes) {
    entries.push({
      id: `note_${n.id}`,
      type: "NOTE",
      title: "Note interne",
      description: n.body.slice(0, 150) + (n.body.length > 150 ? "..." : ""),
      timestamp: n.createdAt.toISOString(),
      authorName: n.author?.name || "Auteur",
      metadata: { noteId: n.id, shareable: n.shareable },
    });
  }

  for (const t of tasks) {
    entries.push({
      id: `task_${t.id}`,
      type: "TASK",
      title: `Tâche créée : ${t.title}`,
      description: `Priorité: ${t.priority} • Statut: ${t.status}`,
      timestamp: t.createdAt.toISOString(),
      authorName: t.assignee?.name || "Non assigné",
      metadata: { taskId: t.id, status: t.status },
    });
  }

  // Sort descending by timestamp
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (typeFilter && typeFilter !== "ALL") {
    return entries.filter((e) => e.type === typeFilter);
  }

  return entries;
}
