"use server";

import { getServerSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/errors";
import {
  requestAccessGrant,
  approveAccessGrant,
  revokeAccessGrant,
  listAccessGrants,
  getActiveGrantsForUser,
  RequestGrantInput,
  ApproveGrantInput,
  RevokeGrantInput,
  ListGrantsFilter,
} from "@/server/services/access-grant-service";

export async function requestAccessGrantAction(input: RequestGrantInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await requestAccessGrant(session, input);
}

export async function approveAccessGrantAction(input: ApproveGrantInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await approveAccessGrant(session, input);
}

export async function revokeAccessGrantAction(input: RevokeGrantInput) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await revokeAccessGrant(session, input);
}

export async function listAccessGrantsAction(filters: ListGrantsFilter = {}) {
  const session = await getServerSession();
  if (!session) throw new ForbiddenError("Authentification requise.");
  return await listAccessGrants(session, filters);
}

export async function getActiveGrantsForUserAction() {
  const session = await getServerSession();
  if (!session) return [];
  return await getActiveGrantsForUser(session);
}

