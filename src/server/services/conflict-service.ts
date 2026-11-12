import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import {
  normalizeString,
  calculateTrigramSimilarity,
} from "@/server/services/party-service";
import { ConflictResult, Prisma } from "@prisma/client";

export interface ConflictMatch {
  type: "PARTY" | "MATTER_PARTY" | "MATTER";
  id: string;
  displayName: string;
  matchScore: number; // 0 to 1
  matchedReasons: string[];
  roleInMatter?: string; // e.g. "OPPOSING_PARTY", "CLIENT", "COUNSEL"
  matterId?: string;
  matterReference?: string;
  matterTitle?: string;
  confidentiality?: string;
  isAdverse?: boolean;
}

export interface SearchConflictsParams {
  query: string;
  excludePartyId?: string;
  excludeMatterId?: string;
}

/**
 * Searches across parties, opposing parties, and matters for potential conflicts.
 * Evaluates trigram similarity, diacritic tolerance, and role in other matters.
 * Requires: conflict.run
 */
export async function searchConflicts(
  params: SearchConflictsParams,
  session: AppSession
): Promise<ConflictMatch[]> {
  await authorize(session, "conflict.run");

  const queryText = params.query?.trim();
  if (!queryText) return [];

  const normalizedQuery = normalizeString(queryText);
  const words = normalizedQuery.split(" ").filter((w) => w.length >= 2);

  // 1. Fetch parties with their matter involvements
  const parties = await db.party.findMany({
    where: {
      ...(params.excludePartyId ? { id: { not: params.excludePartyId } } : {}),
    },
    include: {
      matterParties: {
        include: {
          matter: {
            select: {
              id: true,
              reference: true,
              title: true,
              confidentiality: true,
              workflowStep: {
                select: {
                  id: true,
                  nameFr: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const matches: ConflictMatch[] = [];

  for (const party of parties) {
    const reasons: string[] = [];
    let score = 0;

    // Check similarity on party displayName
    const simName = calculateTrigramSimilarity(normalizedQuery, party.displayName);
    if (simName >= 0.3) {
      reasons.push(`Nom similaire (${Math.round(simName * 100)}%)`);
      score = Math.max(score, simName);
    }

    // Check subword / variant matches
    const normParty = normalizeString(party.displayName);
    if (normParty.includes(normalizedQuery) || normalizedQuery.includes(normParty)) {
      reasons.push("Inclusion du nom");
      score = Math.max(score, 0.85);
    } else {
      for (const w of words) {
        if (w.length >= 4 && normParty.includes(w)) {
          reasons.push(`Mot clé « ${w} »`);
          score = Math.max(score, 0.5);
        }
      }
    }

    // Check company identifiers
    if (party.registrationNumber && normalizedQuery.includes(normalizeString(party.registrationNumber))) {
      reasons.push("Numéro RCCM identique");
      score = 1.0;
    }
    if (party.taxId && normalizedQuery.includes(normalizeString(party.taxId))) {
      reasons.push("Numéro NIU identique");
      score = 1.0;
    }

    if (score >= 0.3) {
      // If party is involved in matters, record each matter relationship
      if (party.matterParties.length > 0) {
        for (const mp of party.matterParties) {
          const isOpposing = mp.role.toUpperCase().includes("ADVERSE") || mp.role.toUpperCase().includes("OPPOSING");
          matches.push({
            type: "MATTER_PARTY",
            id: `${party.id}_${mp.id}`,
            displayName: party.displayName,
            matchScore: isOpposing ? Math.min(1.0, score + 0.1) : score,
            matchedReasons: [...reasons, `Rôle dans le dossier : ${mp.role}`],
            roleInMatter: mp.role,
            matterId: mp.matter.id,
            matterReference: mp.matter.reference,
            matterTitle: mp.matter.title,
            confidentiality: mp.matter.confidentiality,
            isAdverse: isOpposing,
          });
        }
      } else {
        matches.push({
          type: "PARTY",
          id: party.id,
          displayName: party.displayName,
          matchScore: score,
          matchedReasons: reasons,
          roleInMatter: party.clientStatus === "CLIENT" ? "Client actif" : "Fiche tiers / prospect",
          isAdverse: false,
        });
      }
    }
  }

  // 2. Search direct matter titles and references
  const matters = await db.matter.findMany({
    where: {
      ...(params.excludeMatterId ? { id: { not: params.excludeMatterId } } : {}),
      OR: [
        { title: { contains: queryText, mode: "insensitive" } },
        { reference: { contains: queryText, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      reference: true,
      title: true,
      confidentiality: true,
    },
    take: 10,
  });

  for (const m of matters) {
    const sim = calculateTrigramSimilarity(normalizedQuery, m.title);
    matches.push({
      type: "MATTER",
      id: m.id,
      displayName: m.title,
      matchScore: Math.max(sim, 0.75),
      matchedReasons: ["Correspondance sur l'intitulé ou référence du dossier"],
      matterId: m.id,
      matterReference: m.reference,
      matterTitle: m.title,
      confidentiality: m.confidentiality,
    });
  }

  // Sort by highest risk score descending
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

export interface RecordConflictCheckInput {
  queryText: string;
  partyId?: string | null;
  matterId?: string | null;
  result: ConflictResult;
  matches?: any;
  decisionNote?: string | null;
}

/**
 * Records a formal conflict check decision.
 * If result is WAIVED:
 *   - Only PARTNER role with conflict.waive permission can execute (BR-03)
 *   - A non-empty decisionNote is mandatory.
 * Otherwise:
 *   - Requires conflict.resolve
 */
export async function recordConflictCheck(
  input: RecordConflictCheckInput,
  session: AppSession
) {
  if (input.result === "WAIVED") {
    await authorize(session, "conflict.waive");

    if (!input.decisionNote || !input.decisionNote.trim()) {
      throw new Error(
        "Une justification détaillée est obligatoire pour déroger à un conflit d'intérêts (BR-03)."
      );
    }
  } else {
    await authorize(session, "conflict.resolve");
  }

  const check = await db.conflictCheck.create({
    data: {
      queryText: input.queryText.trim(),
      partyId: input.partyId || null,
      matterId: input.matterId || null,
      performedById: session.user.id,
      result: input.result,
      matches: input.matches ?? Prisma.JsonNull,
      decisionNote: input.decisionNote?.trim() || null,
    },
    include: {
      performedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: input.result === "WAIVED" ? "conflict.waived" : "conflict.resolved",
    entityType: "ConflictCheck",
    entityId: check.id,
    matterId: input.matterId || null,
    metadata: {
      queryText: check.queryText,
      partyId: check.partyId,
      result: check.result,
      decisionNote: check.decisionNote,
    },
  });

  return check;
}

export interface MandatoryConflictResolutionStatus {
  resolved: boolean;
  latestCheck?: {
    id: string;
    result: ConflictResult;
    decisionNote: string | null;
    createdAt: Date;
    performedBy: {
      id: string;
      name: string;
    };
  } | null;
  reason?: string;
}

/**
 * Gatekeeper guard function: mandatoryConflictResolved(partyId or inquiryId)
 * Used by inquiry acceptance and matter opening (BR-03, CON-04).
 * Returns { resolved: true } if a valid check (NONE_FOUND, CLEARED, or WAIVED) exists.
 * Returns { resolved: false, reason } otherwise.
 */
export async function mandatoryConflictResolved(target: {
  partyId?: string;
  inquiryId?: string;
}): Promise<MandatoryConflictResolutionStatus> {
  let partyId = target.partyId;

  if (!partyId && target.inquiryId) {
    const inquiry = await db.inquiry.findUnique({
      where: { id: target.inquiryId },
      select: { partyId: true },
    });
    partyId = inquiry?.partyId;
  }

  if (!partyId) {
    return {
      resolved: false,
      reason: "Partie introuvable pour la vérification du conflit d'intérêts.",
    };
  }

  // Find the most recent conflict check for this party
  const latestCheck = await db.conflictCheck.findFirst({
    where: { partyId },
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!latestCheck) {
    return {
      resolved: false,
      reason: "Aucune vérification de conflit d'intérêts n'a été enregistrée pour ce client.",
    };
  }

  if (
    latestCheck.result === "NONE_FOUND" ||
    latestCheck.result === "CLEARED" ||
    latestCheck.result === "WAIVED"
  ) {
    return {
      resolved: true,
      latestCheck,
    };
  }

  if (latestCheck.result === "POTENTIAL_CONFLICT") {
    return {
      resolved: false,
      latestCheck,
      reason: "Un conflit d'intérêts potentiel est enregistré. Il doit être formellement levé ou dérogé par un associé avant toute acceptation.",
    };
  }

  return {
    resolved: false,
    latestCheck,
    reason: "Un conflit d'intérêts avéré est enregistré. L'ouverture ou l'acceptation est bloquée sans dérogation formelle d'un associé.",
  };
}

/**
 * Lists past conflict checks with pagination and party information.
 * Requires: conflict.view
 */
export async function listConflictChecks(
  params: { page?: number; pageSize?: number; partyId?: string },
  session: AppSession
) {
  await authorize(session, "conflict.view");

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ConflictCheckWhereInput = {
    ...(params.partyId ? { partyId: params.partyId } : {}),
  };

  const [total, checks] = await Promise.all([
    db.conflictCheck.count({ where }),
    db.conflictCheck.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        party: {
          select: {
            id: true,
            displayName: true,
            type: true,
            clientStatus: true,
          },
        },
      },
    }),
  ]);

  return {
    checks,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

