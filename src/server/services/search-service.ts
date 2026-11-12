import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { hasRolePermission, RoleKey } from "@/server/auth/permission-matrix";

export interface GlobalSearchResult {
  matters: {
    id: string;
    reference: string;
    title: string;
    category?: string | null;
  }[];
  parties: {
    id: string;
    displayName: string;
    type: string;
    clientStatus: string;
  }[];
  documents: {
    id: string;
    title: string;
    matterId?: string | null;
    matterReference?: string | null;
    category?: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    matterId?: string | null;
    matterReference?: string | null;
  }[];
}

/**
 * Executes a global search across Matters, Parties, Documents, and Tasks.
 * Strictly adheres to `accessibleMatterFilter` and role permissions (ARCHITECTURE 12, NF-02).
 * Hidden matters, documents, or tasks are NEVER returned.
 */
export async function globalSearch(
  query: string,
  session: AppSession
): Promise<GlobalSearchResult> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return { matters: [], parties: [], documents: [], tasks: [] };
  }

  const matterFilter = await accessibleMatterFilter(session);
  const roleKey = session.user.roleKey as RoleKey;
  const canViewParties = hasRolePermission(roleKey, "party.view");
  const canViewDocuments = hasRolePermission(roleKey, "document.view");
  const canViewTasks = hasRolePermission(roleKey, "task.view");

  // Run searches in parallel
  const [matters, parties, documents, tasks] = await Promise.all([
    // 1. Matters Search (reference or title)
    db.matter.findMany({
      where: {
        AND: [
          matterFilter,
          {
            OR: [
              { reference: { contains: cleanQuery, mode: "insensitive" } },
              { title: { contains: cleanQuery, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        reference: true,
        title: true,
        category: { select: { nameFr: true, nameEn: true } },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),

    // 2. Parties Search (displayName, companyName, email, phone)
    canViewParties
      ? db.party.findMany({
          where: {
            deletedAt: null,
            OR: [
              { displayName: { contains: cleanQuery, mode: "insensitive" } },
              { companyName: { contains: cleanQuery, mode: "insensitive" } },
              { email: { contains: cleanQuery, mode: "insensitive" } },
              { phone: { contains: cleanQuery, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            displayName: true,
            type: true,
            clientStatus: true,
          },
          take: 6,
          orderBy: { displayName: "asc" },
        })
      : Promise.resolve([]),

    // 3. Documents Search (title, linked only to accessible matters)
    canViewDocuments
      ? db.document.findMany({
          where: {
            deletedAt: null,
            title: { contains: cleanQuery, mode: "insensitive" },
            // Security gate: Document must belong to an accessible matter
            matter: matterFilter,
          },
          select: {
            id: true,
            title: true,
            matterId: true,
            matter: { select: { reference: true } },
            category: { select: { nameFr: true, nameEn: true } },
          },
          take: 6,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),

    // 4. Tasks Search (title, linked only to accessible matters or general tasks)
    canViewTasks
      ? db.task.findMany({
          where: {
            title: { contains: cleanQuery, mode: "insensitive" },
            OR: [
              { matterId: null },
              { matter: matterFilter },
            ],
          },
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            matterId: true,
            matter: { select: { reference: true } },
          },
          take: 6,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    matters: matters.map((m) => ({
      id: m.id,
      reference: m.reference,
      title: m.title,
      category: m.category?.nameFr || m.category?.nameEn || null,
    })),
    parties: parties.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      type: p.type,
      clientStatus: p.clientStatus,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      matterId: d.matterId,
      matterReference: d.matter?.reference || null,
      category: d.category?.nameFr || d.category?.nameEn || null,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      matterId: t.matterId,
      matterReference: t.matter?.reference || null,
    })),
  };
}
