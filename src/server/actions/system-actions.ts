"use server";

import { getServerSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  getSystemOverview,
  reportIncident,
  resolveIncident,
  ReportIncidentInput,
  ResolveIncidentInput,
} from "@/server/services/system-service";

export async function getSystemOverviewAction() {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await getSystemOverview(session);
}

export async function reportIncidentAction(input: ReportIncidentInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await reportIncident(session, input);
}

export async function resolveIncidentAction(input: ResolveIncidentInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await resolveIncident(session, input);
}

