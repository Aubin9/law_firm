import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { accessibleMatterFilter } from "@/server/auth/matter-access";

export interface AutocompleteItem {
  id: string;
  label: string;
  subLabel?: string;
  meta?: Record<string, any>;
}

/**
 * Fast, permission-safe autocomplete for parties (clients, opposing parties, bailiffs, etc.).
 */
export async function autocompleteParties(
  session: AppSession,
  query: string,
  limit: number = 10
): Promise<AutocompleteItem[]> {
  if (!session || !session.user) return [];

  const trimmed = query?.trim();
  const parties = await db.party.findMany({
    where: {
      deletedAt: null,
      ...(trimmed
        ? {
            OR: [
              { displayName: { contains: trimmed, mode: "insensitive" } },
              { companyName: { contains: trimmed, mode: "insensitive" } },
              { firstName: { contains: trimmed, mode: "insensitive" } },
              { lastName: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
              { phone: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      type: true,
      clientStatus: true,
      email: true,
      city: true,
    },
  });

  return parties.map((p) => ({
    id: p.id,
    label: p.displayName,
    subLabel: [p.clientStatus, p.city, p.email].filter(Boolean).join(" • "),
    meta: { type: p.type, clientStatus: p.clientStatus },
  }));
}

/**
 * Autocomplete for matters, strictly filtered by accessibleMatterFilter (MAT-01, MAT-02).
 * Hidden STRICT matters never leak to unauthorized lawyers.
 */
export async function autocompleteMatters(
  session: AppSession,
  query: string,
  limit: number = 10
): Promise<AutocompleteItem[]> {
  if (!session || !session.user) return [];

  const trimmed = query?.trim();
  const filter = accessibleMatterFilter(session);

  const matters = await db.matter.findMany({
    where: {
      AND: [
        filter,
        { deletedAt: null },
        trimmed
          ? {
              OR: [
                { reference: { contains: trimmed, mode: "insensitive" } },
                { title: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      confidentiality: true,
    },
  });

  return matters.map((m) => ({
    id: m.id,
    label: `${m.reference} - ${m.title}`,
    subLabel: `Statut: ${m.status} • Confidentialité: ${m.confidentiality}`,
    meta: { reference: m.reference, status: m.status },
  }));
}

/**
 * Autocomplete for users (lawyers, partners, assistants, accountants).
 */
export async function autocompleteUsers(
  session: AppSession,
  query: string,
  limit: number = 10
): Promise<AutocompleteItem[]> {
  if (!session || !session.user) return [];

  const trimmed = query?.trim();
  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: {
        select: {
          nameFr: true,
          nameEn: true,
          key: true,
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    label: u.name,
    subLabel: `${u.role.nameFr} • ${u.email}`,
    meta: { roleKey: u.role.key },
  }));
}

