import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import { PartyType, ClientStatus, Prisma } from "@prisma/client";

/**
 * Normalizes text for comparison by removing diacritics/accents,
 * converting to lower-case, and stripping extraneous punctuation.
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Computes trigram similarity (Dice coefficient over 3-character shingles)
 * between two strings. Returns a float between 0.0 and 1.0.
 */
export function calculateTrigramSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // For very short strings, substring inclusion gives high confidence
  if (normA.length < 3 || normB.length < 3) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return 0.8;
    }
    return 0;
  }

  // Pad strings with spaces at start and end per standard trigram indexing
  const padA = `  ${normA} `;
  const padB = `  ${normB} `;

  const getTrigrams = (str: string): Set<string> => {
    const trigrams = new Set<string>();
    for (let i = 0; i < str.length - 2; i++) {
      trigrams.add(str.substring(i, i + 3));
    }
    return trigrams;
  };

  const setA = getTrigrams(padA);
  const setB = getTrigrams(padB);

  let intersectionCount = 0;
  for (const tri of setA) {
    if (setB.has(tri)) {
      intersectionCount++;
    }
  }

  const similarity = (2.0 * intersectionCount) / (setA.size + setB.size);
  return Math.round(similarity * 100) / 100;
}

export interface DuplicateMatch {
  partyId: string;
  displayName: string;
  type: PartyType;
  clientStatus: ClientStatus;
  reasons: string[];
  similarityScore: number;
}

export interface CheckDuplicatesInput {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  excludePartyId?: string;
}

/**
 * Checks for potential duplicate parties:
 * - Trigram similarity on displayName >= 0.35
 * - Exact match on non-empty email
 * - Exact match on non-empty phone (normalized)
 */
export async function checkPartyDuplicates(
  input: CheckDuplicatesInput
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const normalizedName = normalizeString(input.displayName);
  const normalizedPhone = input.phone ? input.phone.replace(/[\s\-\.\(\)]/g, "") : null;
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

  // Retrieve existing non-deleted parties
  const parties = await db.party.findMany({
    where: {
      deletedAt: null,
      ...(input.excludePartyId ? { id: { not: input.excludePartyId } } : {}),
    },
    select: {
      id: true,
      displayName: true,
      type: true,
      clientStatus: true,
      email: true,
      phone: true,
    },
  });

  for (const party of parties) {
    const reasons: string[] = [];
    let highestScore = 0;

    // Check exact email match
    if (normalizedEmail && party.email && party.email.trim().toLowerCase() === normalizedEmail) {
      reasons.push("same_email");
      highestScore = 1.0;
    }

    // Check exact phone match
    if (normalizedPhone && party.phone) {
      const partyPhoneNorm = party.phone.replace(/[\s\-\.\(\)]/g, "");
      if (partyPhoneNorm === normalizedPhone && normalizedPhone.length >= 6) {
        reasons.push("same_phone");
        highestScore = Math.max(highestScore, 0.95);
      }
    }

    // Check trigram similarity on name
    if (normalizedName) {
      const nameScore = calculateTrigramSimilarity(normalizedName, party.displayName);
      if (nameScore >= 0.35) {
        reasons.push(`name_similarity_${Math.round(nameScore * 100)}%`);
        highestScore = Math.max(highestScore, nameScore);
      }
    }

    if (reasons.length > 0) {
      matches.push({
        partyId: party.id,
        displayName: party.displayName,
        type: party.type,
        clientStatus: party.clientStatus,
        reasons,
        similarityScore: highestScore,
      });
    }
  }

  // Sort by highest similarity score descending
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

export interface ListPartiesParams {
  search?: string;
  type?: PartyType;
  clientStatus?: ClientStatus;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

/**
 * Lists parties with pagination, filters, and accent/case-insensitive search.
 * Requires: party.view
 */
export async function listParties(params: ListPartiesParams, session: AppSession) {
  await authorize(session, "party.view");

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.PartyWhereInput = {
    ...(params.includeDeleted ? {} : { deletedAt: null }),
    ...(params.type ? { type: params.type } : {}),
    ...(params.clientStatus ? { clientStatus: params.clientStatus } : {}),
  };

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    try {
      const searchPattern = `%${term}%`;
      const matches = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Party"
        WHERE unaccent("displayName") ILIKE unaccent(${searchPattern})
           OR ("companyName" IS NOT NULL AND unaccent("companyName") ILIKE unaccent(${searchPattern}))
           OR ("firstName" IS NOT NULL AND unaccent("firstName") ILIKE unaccent(${searchPattern}))
           OR ("lastName" IS NOT NULL AND unaccent("lastName") ILIKE unaccent(${searchPattern}))
           OR ("registrationNumber" IS NOT NULL AND "registrationNumber" ILIKE ${searchPattern})
           OR ("taxId" IS NOT NULL AND "taxId" ILIKE ${searchPattern})
           OR ("email" IS NOT NULL AND "email" ILIKE ${searchPattern})
           OR ("phone" IS NOT NULL AND "phone" ILIKE ${searchPattern})
      `;
      where.id = { in: matches.map((m) => m.id) };
    } catch {
      // Fallback if unaccent is not available
      where.OR = [
        { displayName: { contains: term, mode: "insensitive" } },
        { companyName: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { registrationNumber: { contains: term, mode: "insensitive" } },
        { taxId: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  const [total, parties] = await Promise.all([
    db.party.count({ where }),
    db.party.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { displayName: "asc" },
      include: {
        contacts: {
          take: 3,
          select: {
            id: true,
            name: true,
            title: true,
            email: true,
            phone: true,
            isRepresentative: true,
          },
        },
        _count: {
          select: {
            matterParties: true,
            inquiries: true,
            contacts: true,
          },
        },
      },
    }),
  ]);

  return {
    parties,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieves a single party by ID with all relations.
 * Requires: party.view
 */
export async function getPartyById(id: string, session: AppSession) {
  await authorize(session, "party.view");

  const party = await db.party.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ isRepresentative: "desc" }, { name: "asc" }],
      },
      matterParties: {
        include: {
          matter: {
            select: {
              id: true,
              reference: true,
              title: true,
              confidentiality: true,
              priority: true,
              workflowStep: {
                select: {
                  id: true,
                  nameFr: true,
                  nameEn: true,
                  key: true,
                  color: true,
                },
              },
              leadLawyer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      inquiries: {
        select: {
          id: true,
          subject: true,
          channel: true,
          receivedAt: true,
          workflowStep: {
            select: {
              id: true,
              nameFr: true,
              nameEn: true,
              key: true,
            },
          },
        },
        orderBy: { receivedAt: "desc" },
      },
      _count: {
        select: {
          matterParties: true,
          inquiries: true,
          contacts: true,
          events: true,
          communications: true,
          invoices: true,
        },
      },
    },
  });

  return party;
}

export interface CreatePartyInput {
  type: PartyType;
  clientStatus?: ClientStatus;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
}

/**
 * Creates a new party with automatic displayName computation if not explicitly given.
 * Requires: party.create
 */
export async function createParty(input: CreatePartyInput, session: AppSession) {
  await authorize(session, "party.create");

  // Determine standard displayName based on type
  let computedDisplayName = input.displayName?.trim() || "";
  if (!computedDisplayName) {
    if (input.type === "INDIVIDUAL") {
      computedDisplayName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || "Particulier sans nom";
    } else {
      computedDisplayName = input.companyName?.trim() || "Entreprise sans nom";
    }
  }

  const party = await db.party.create({
    data: {
      type: input.type,
      clientStatus: input.clientStatus || "NONE",
      displayName: computedDisplayName,
      firstName: input.type === "INDIVIDUAL" ? input.firstName?.trim() || null : null,
      lastName: input.type === "INDIVIDUAL" ? input.lastName?.trim() || null : null,
      companyName: input.type === "COMPANY" ? input.companyName?.trim() || null : null,
      registrationNumber: input.type === "COMPANY" ? input.registrationNumber?.trim() || null : null,
      taxId: input.taxId?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || "CM",
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "Party",
    entityId: party.id,
    metadata: {
      type: party.type,
      displayName: party.displayName,
      registrationNumber: party.registrationNumber,
      taxId: party.taxId,
    },
  });

  return party;
}

export interface UpdatePartyInput {
  type?: PartyType;
  clientStatus?: ClientStatus;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
}

/**
 * Updates party details.
 * Requires: party.edit
 */
export async function updateParty(id: string, input: UpdatePartyInput, session: AppSession) {
  await authorize(session, "party.edit");

  const existing = await db.party.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Partie non trouvée");
  }

  const type = input.type ?? existing.type;
  let displayName = input.displayName?.trim();

  if (!displayName) {
    if (type === "INDIVIDUAL") {
      const fName = input.firstName !== undefined ? input.firstName : existing.firstName;
      const lName = input.lastName !== undefined ? input.lastName : existing.lastName;
      displayName = [fName, lName].filter(Boolean).join(" ").trim() || existing.displayName;
    } else {
      const cName = input.companyName !== undefined ? input.companyName : existing.companyName;
      displayName = cName?.trim() || existing.displayName;
    }
  }

  const updated = await db.party.update({
    where: { id },
    data: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.clientStatus ? { clientStatus: input.clientStatus } : {}),
      displayName,
      ...(input.firstName !== undefined ? { firstName: input.firstName?.trim() || null } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName?.trim() || null } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName?.trim() || null } : {}),
      ...(input.registrationNumber !== undefined ? { registrationNumber: input.registrationNumber?.trim() || null } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
      ...(input.country ? { country: input.country } : {}),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "Party",
    entityId: id,
    metadata: {
      changedFields: Object.keys(input),
      displayName: updated.displayName,
    },
  });

  return updated;
}

/**
 * Logically deletes a party (PTY-05).
 * Requires: party.archive
 */
export async function softDeleteParty(id: string, session: AppSession) {
  await authorize(session, "party.archive");

  const existing = await db.party.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Partie non trouvée");
  }

  const party = await db.party.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    action: "delete",
    entityType: "Party",
    entityId: id,
    metadata: {
      softDelete: true,
      displayName: party.displayName,
    },
  });

  return party;
}

/**
 * Restores a logically deleted party.
 * Requires: party.archive
 */
export async function restoreParty(id: string, session: AppSession) {
  await authorize(session, "party.archive");

  const party = await db.party.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "Party",
    entityId: id,
    metadata: {
      restored: true,
      displayName: party.displayName,
    },
  });

  return party;
}

export interface PartyContactInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isRepresentative?: boolean;
}

/**
 * Adds a contact / legal representative to a party (PTY-02).
 * Requires: party.edit
 */
export async function addPartyContact(partyId: string, input: PartyContactInput, session: AppSession) {
  await authorize(session, "party.edit");

  const contact = await db.partyContact.create({
    data: {
      partyId,
      name: input.name.trim(),
      title: input.title?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      isRepresentative: Boolean(input.isRepresentative),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "PartyContact",
    entityId: contact.id,
    metadata: {
      partyId,
      name: contact.name,
      isRepresentative: contact.isRepresentative,
    },
  });

  return contact;
}

/**
 * Updates a party contact.
 * Requires: party.edit
 */
export async function updatePartyContact(
  contactId: string,
  input: Partial<PartyContactInput>,
  session: AppSession
) {
  await authorize(session, "party.edit");

  const contact = await db.partyContact.update({
    where: { id: contactId },
    data: {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.isRepresentative !== undefined ? { isRepresentative: input.isRepresentative } : {}),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "PartyContact",
    entityId: contactId,
    metadata: {
      name: contact.name,
      isRepresentative: contact.isRepresentative,
    },
  });

  return contact;
}

/**
 * Removes a party contact.
 * Requires: party.edit
 */
export async function deletePartyContact(contactId: string, session: AppSession) {
  await authorize(session, "party.edit");

  const contact = await db.partyContact.delete({
    where: { id: contactId },
  });

  await logAudit({
    actorId: session.user.id,
    action: "delete",
    entityType: "PartyContact",
    entityId: contactId,
    metadata: {
      name: contact.name,
      partyId: contact.partyId,
    },
  });

  return contact;
}

/**
 * Fast search for EntityCombobox and autocompletes (PTY-04).
 * Returns only non-deleted parties.
 * Requires: party.view
 */
export async function searchPartiesForCombobox(query: string, session: AppSession) {
  await authorize(session, "party.view");

  const term = query?.trim() || "";

  let matchingWhere: Prisma.PartyWhereInput = {
    deletedAt: null,
  };

  if (term) {
    try {
      const searchPattern = `%${term}%`;
      const matches = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Party"
        WHERE "deletedAt" IS NULL
          AND (
            unaccent("displayName") ILIKE unaccent(${searchPattern})
            OR ("companyName" IS NOT NULL AND unaccent("companyName") ILIKE unaccent(${searchPattern}))
            OR ("registrationNumber" IS NOT NULL AND "registrationNumber" ILIKE ${searchPattern})
            OR ("taxId" IS NOT NULL AND "taxId" ILIKE ${searchPattern})
            OR ("email" IS NOT NULL AND "email" ILIKE ${searchPattern})
            OR ("phone" IS NOT NULL AND "phone" ILIKE ${searchPattern})
          )
      `;
      matchingWhere.id = { in: matches.map((m) => m.id) };
    } catch {
      matchingWhere.OR = [
        { displayName: { contains: term, mode: "insensitive" } },
        { companyName: { contains: term, mode: "insensitive" } },
        { registrationNumber: { contains: term, mode: "insensitive" } },
        { taxId: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  const parties = await db.party.findMany({
    where: matchingWhere,
    take: 20,
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      type: true,
      clientStatus: true,
      registrationNumber: true,
      taxId: true,
      email: true,
      phone: true,
    },
  });

  return parties;
}
