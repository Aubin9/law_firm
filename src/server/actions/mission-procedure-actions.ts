"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createMission,
  updateMission,
  createProcedure,
  updateProcedure,
  CreateMissionInput,
  UpdateMissionInput,
  CreateProcedureInput,
  UpdateProcedureInput,
} from "@/server/services/mission-procedure-service";
import {
  MissionType,
  MissionStatus,
  ProcedureKind,
  ProcedureStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createMissionSchema = z.object({
  matterId: z.string().min(1, "L'identifiant du dossier est requis"),
  type: z.nativeEnum(MissionType),
  title: z.string().min(2, "L'intitulé de la mission doit comporter au moins 2 caractères"),
  scope: z.string().optional(),
  deliverables: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.nativeEnum(MissionStatus).optional(),
});

const updateMissionSchema = z.object({
  type: z.nativeEnum(MissionType).optional(),
  title: z.string().min(2).optional(),
  scope: z.string().optional(),
  deliverables: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  status: z.nativeEnum(MissionStatus).optional(),
  workflowStepId: z.string().nullable().optional(),
});

const createProcedureSchema = z.object({
  matterId: z.string().min(1, "L'identifiant du dossier est requis"),
  missionId: z.string().nullable().optional(),
  kind: z.nativeEnum(ProcedureKind),
  parentProcedureId: z.string().nullable().optional(),
  jurisdiction: z.string().optional(),
  reference: z.string().optional(),
  status: z.nativeEnum(ProcedureStatus).optional(),
});

const updateProcedureSchema = z.object({
  missionId: z.string().nullable().optional(),
  kind: z.nativeEnum(ProcedureKind).optional(),
  parentProcedureId: z.string().nullable().optional(),
  jurisdiction: z.string().optional(),
  reference: z.string().optional(),
  status: z.nativeEnum(ProcedureStatus).optional(),
  workflowStepId: z.string().nullable().optional(),
});

export async function createMissionAction(rawData: z.infer<typeof createMissionSchema>) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = createMissionSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const mission = await createMission(parsed.data, session);
    revalidatePath(`/matters/${parsed.data.matterId}`);
    return { success: true, mission };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erreur lors de la création de la mission",
    };
  }
}

export async function updateMissionAction(
  id: string,
  matterId: string,
  rawData: z.infer<typeof updateMissionSchema>
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = updateMissionSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const mission = await updateMission(id, parsed.data, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true, mission };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erreur lors de la mise à jour de la mission",
    };
  }
}

export async function createProcedureAction(rawData: z.infer<typeof createProcedureSchema>) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = createProcedureSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const procedure = await createProcedure(parsed.data, session);
    revalidatePath(`/matters/${parsed.data.matterId}`);
    return { success: true, procedure };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erreur lors de la création de la procédure",
    };
  }
}

export async function updateProcedureAction(
  id: string,
  matterId: string,
  rawData: z.infer<typeof updateProcedureSchema>
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = updateProcedureSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const procedure = await updateProcedure(id, parsed.data, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true, procedure };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erreur lors de la mise à jour de la procédure",
    };
  }
}

