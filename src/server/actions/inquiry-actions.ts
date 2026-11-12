"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createInquiry,
  decideInquiry,
  convertInquiryToClient,
  listInquiries,
  getInquiryById,
} from "@/server/services/inquiry-service";
import { InquiryChannel, DecisionOutcome, PartyType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createInquirySchema = z.object({
  partyId: z.string().optional().nullable(),
  newParty: z
    .object({
      type: z.nativeEnum(PartyType),
      displayName: z.string().optional(),
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
      companyName: z.string().optional().nullable(),
      email: z.string().email("Format d'email invalide").optional().or(z.literal("")).nullable(),
      phone: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
    })
    .optional(),
  channel: z.nativeEnum(InquiryChannel),
  subject: z.string().min(2, "L'objet de la demande est obligatoire"),
  description: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

const decideInquirySchema = z.object({
  inquiryId: z.string().min(1),
  outcome: z.nativeEnum(DecisionOutcome),
  reason: z.string().min(1, "Le motif de la décision est obligatoire"),
});

export async function createInquiryAction(rawData: z.infer<typeof createInquirySchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = createInquirySchema.parse(rawData);

  const inquiry = await createInquiry(
    {
      partyId: parsed.partyId,
      newParty: parsed.newParty
        ? {
            ...parsed.newParty,
            email: parsed.newParty.email || null,
          }
        : undefined,
      channel: parsed.channel,
      subject: parsed.subject,
      description: parsed.description,
      origin: parsed.origin,
      assignedToId: parsed.assignedToId,
    },
    session
  );

  revalidatePath("/[locale]/inquiries", "page");
  return { success: true, inquiry };
}

export async function decideInquiryAction(rawData: z.infer<typeof decideInquirySchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = decideInquirySchema.parse(rawData);

  const decision = await decideInquiry(parsed, session);

  revalidatePath("/[locale]/inquiries", "page");
  return { success: true, decision };
}

export async function convertInquiryAction(inquiryId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const inquiry = await convertInquiryToClient(inquiryId, session);

  revalidatePath("/[locale]/inquiries", "page");
  revalidatePath(`/[locale]/parties/${inquiry.partyId}`, "page");
  return { success: true, inquiry };
}

export async function getInquiryDetailsAction(inquiryId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await getInquiryById(inquiryId, session);
}

