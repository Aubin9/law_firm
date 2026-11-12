"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createParty,
  updateParty,
  softDeleteParty,
  restoreParty,
  checkPartyDuplicates,
  addPartyContact,
  updatePartyContact,
  deletePartyContact,
  listParties,
  getPartyById,
  searchPartiesForCombobox,
  CreatePartyInput,
  UpdatePartyInput,
  PartyContactInput,
} from "@/server/services/party-service";
import { PartyType, ClientStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createPartySchema = z.object({
  type: z.nativeEnum(PartyType),
  clientStatus: z.nativeEnum(ClientStatus).optional().default("NONE"),
  displayName: z.string().optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().default("CM"),
});

const updatePartySchema = createPartySchema.partial();

const contactSchema = z.object({
  name: z.string().min(1, "Le nom du contact est obligatoire"),
  title: z.string().optional().nullable(),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  isRepresentative: z.boolean().default(false),
});

export async function checkPartyDuplicatesAction(input: {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  excludePartyId?: string;
}) {
  return await checkPartyDuplicates(input);
}

export async function createPartyAction(rawData: z.infer<typeof createPartySchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = createPartySchema.parse(rawData);

  // Validate company specific fields if company
  if (parsed.type === "COMPANY" && !parsed.companyName && !parsed.displayName) {
    throw new Error("La raison sociale de l'entreprise est obligatoire");
  }

  // Validate individual specific fields if individual
  if (parsed.type === "INDIVIDUAL" && !parsed.lastName && !parsed.displayName) {
    throw new Error("Le nom de famille est obligatoire pour une personne physique");
  }

  const party = await createParty(
    {
      ...parsed,
      email: parsed.email || null,
    },
    session
  );

  revalidatePath("/[locale]/parties", "page");
  return { success: true, party };
}

export async function updatePartyAction(id: string, rawData: z.infer<typeof updatePartySchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = updatePartySchema.parse(rawData);

  const party = await updateParty(
    id,
    {
      ...parsed,
      email: parsed.email || null,
    },
    session
  );

  revalidatePath("/[locale]/parties", "page");
  revalidatePath(`/[locale]/parties/${id}`, "page");
  return { success: true, party };
}

export async function softDeletePartyAction(id: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const party = await softDeleteParty(id, session);
  revalidatePath("/[locale]/parties", "page");
  revalidatePath(`/[locale]/parties/${id}`, "page");
  return { success: true, party };
}

export async function restorePartyAction(id: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const party = await restoreParty(id, session);
  revalidatePath("/[locale]/parties", "page");
  revalidatePath(`/[locale]/parties/${id}`, "page");
  return { success: true, party };
}

export async function addPartyContactAction(partyId: string, rawData: z.infer<typeof contactSchema>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const parsed = contactSchema.parse(rawData);
  const contact = await addPartyContact(
    partyId,
    {
      ...parsed,
      email: parsed.email || null,
    },
    session
  );

  revalidatePath(`/[locale]/parties/${partyId}`, "page");
  return { success: true, contact };
}

export async function updatePartyContactAction(contactId: string, partyId: string, rawData: Partial<z.infer<typeof contactSchema>>) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const contact = await updatePartyContact(contactId, rawData, session);

  revalidatePath(`/[locale]/parties/${partyId}`, "page");
  return { success: true, contact };
}

export async function deletePartyContactAction(contactId: string, partyId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const contact = await deletePartyContact(contactId, session);

  revalidatePath(`/[locale]/parties/${partyId}`, "page");
  return { success: true, contact };
}

export async function searchPartiesAction(query: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await searchPartiesForCombobox(query, session);
}

