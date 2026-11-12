"use server";

import { getServerSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  recordBackupRun,
  getBackupOverview,
  runRestoreTestSimulation,
  RecordBackupInput,
} from "@/server/services/backup-service";

export async function getBackupOverviewAction() {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await getBackupOverview(session);
}

export async function recordBackupRunAction(input: RecordBackupInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await recordBackupRun(session, input);
}

export async function runRestoreTestSimulationAction() {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await runRestoreTestSimulation(session);
}

