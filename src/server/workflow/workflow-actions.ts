"use server";

import { getServerSession } from "@/server/auth/session";
import {
  transition,
  getAvailableTransitions,
  getWorkflowForEntity,
  TransitionInput,
} from "@/server/workflow/workflow-engine";
import { WorkflowEntity } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function executeTransitionAction(
  entityType: WorkflowEntity,
  entityId: string,
  toStepKey: string,
  input: TransitionInput = {}
) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  const result = await transition(entityType, entityId, toStepKey, input, session);
  revalidatePath("/[locale]/tasks");
  revalidatePath("/[locale]/matters");
  revalidatePath("/[locale]/inquiries");
  return result;
}

export async function getEntityTransitionsAction(
  entityType: WorkflowEntity,
  entityId: string
) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await getAvailableTransitions(entityType, entityId, session);
}

export async function getWorkflowDefinitionAction(entityType: WorkflowEntity) {
  const session = await getServerSession();
  if (!session) throw new Error("Non authentifié");

  return await getWorkflowForEntity(entityType);
}

