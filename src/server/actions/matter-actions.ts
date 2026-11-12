"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createMatter,
  updateMatter,
  softDeleteMatter,
  restoreMatter,
  setMatterMember,
  removeMatterMember,
  partnerSelfJoinStrict,
  CreateMatterInput,
  UpdateMatterInput,
} from "@/server/services/matter-service";
import {
  Confidentiality,
  Priority,
  MatterAccessLevel,
  MatterPartyRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createMatterSchema = z.object({
  clientId: z.string().min(1, "Le client est obligatoire"),
  title: z.string().min(3, "L'intitulé du dossier doit comporter au moins 3 caractères"),
  categoryId: z.string().min(1, "La catégorie est obligatoire"),
  leadLawyerId: z.string().min(1, "L'avocat responsable est obligatoire"),
  priority: z.nativeEnum(Priority).default("NORMAL"),
  confidentiality: z.nativeEnum(Confidentiality).default("STANDARD"),
  additionalMemberUserIds: z
    .array(
      z.object({
        userId: z.string(),
        level: z.nativeEnum(MatterAccessLevel),
      })
    )
    .optional(),
  opposingParties: z
    .array(
      z.object({
        partyId: z.string(),
        role: z.nativeEnum(MatterPartyRole),
      })
    )
    .optional(),
  initialMissionTitle: z.string().optional(),
  inquiryId: z.string().optional().nullable(),
});

const updateMatterSchema = z.object({
  title: z.string().min(3).optional(),
  categoryId: z.string().optional(),
  leadLawyerId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  confidentiality: z.nativeEnum(Confidentiality).optional(),
});

export async function createMatterAction(rawData: z.infer<typeof createMatterSchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = createMatterSchema.parse(rawData);
  const matter = await createMatter(parsed, session);

  revalidatePath("/[locale]/matters", "page");
  if (parsed.inquiryId) {
    revalidatePath("/[locale]/inquiries", "page");
  }
  return { success: true, matter };
}

export async function updateMatterAction(id: string, rawData: z.infer<typeof updateMatterSchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = updateMatterSchema.parse(rawData);
  const matter = await updateMatter(id, parsed, session);

  revalidatePath("/[locale]/matters", "page");
  revalidatePath(`/[locale]/matters/${id}`, "page");
  return { success: true, matter };
}

export async function softDeleteMatterAction(id: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const matter = await softDeleteMatter(id, session);

  revalidatePath("/[locale]/matters", "page");
  return { success: true, matter };
}

export async function setMatterMemberAction(
  matterId: string,
  userId: string,
  level: MatterAccessLevel
) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const member = await setMatterMember(matterId, userId, level, session);

  revalidatePath(`/[locale]/matters/${matterId}`, "page");
  return { success: true, member };
}

export async function removeMatterMemberAction(matterId: string, userId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const result = await removeMatterMember(matterId, userId, session);

  revalidatePath(`/[locale]/matters/${matterId}`, "page");
  return result;
}

export async function partnerSelfJoinStrictAction(matterId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const member = await partnerSelfJoinStrict(matterId, session);

  revalidatePath(`/[locale]/matters/${matterId}`, "page");
  return { success: true, member };
}

