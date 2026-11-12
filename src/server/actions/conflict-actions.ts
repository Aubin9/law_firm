"use server";

import { getServerSession } from "@/server/auth/session";
import {
  searchConflicts,
  recordConflictCheck,
  mandatoryConflictResolved,
  listConflictChecks,
} from "@/server/services/conflict-service";
import { ConflictResult } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const recordConflictSchema = z.object({
  queryText: z.string().min(1, "La requête de recherche est obligatoire"),
  partyId: z.string().optional().nullable(),
  matterId: z.string().optional().nullable(),
  result: z.nativeEnum(ConflictResult),
  matches: z.any().optional(),
  decisionNote: z.string().optional().nullable(),
});

export async function searchConflictsAction(query: string, excludePartyId?: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await searchConflicts({ query, excludePartyId }, session);
}

export async function recordConflictCheckAction(rawData: z.infer<typeof recordConflictSchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = recordConflictSchema.parse(rawData);

  const check = await recordConflictCheck(
    {
      queryText: parsed.queryText,
      partyId: parsed.partyId,
      matterId: parsed.matterId,
      result: parsed.result,
      matches: parsed.matches,
      decisionNote: parsed.decisionNote,
    },
    session
  );

  revalidatePath("/[locale]/conflicts", "page");
  if (parsed.partyId) {
    revalidatePath(`/[locale]/parties/${parsed.partyId}`, "page");
  }

  return { success: true, check };
}

export async function checkMandatoryConflictAction(target: { partyId?: string; inquiryId?: string }) {
  return await mandatoryConflictResolved(target);
}

export async function listConflictChecksAction(params: { page?: number; pageSize?: number; partyId?: string }) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await listConflictChecks(params, session);
}

