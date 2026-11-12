"use server";

import { getServerSession } from "@/server/auth/session";
import {
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  revokeUserSessions,
  resetUserTwoFactor,
  deleteUser,
  CreateUserInput,
  UpdateUserInput,
} from "@/server/services/user-admin-service";
import { UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getUsersAction() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  return await listUsers(session);
}

export async function createUserAction(input: CreateUserInput) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await createUser(session, input);
  revalidatePath("/[locale]/admin/users");
  return result;
}

export async function updateUserAction(userId: string, input: UpdateUserInput) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await updateUser(session, userId, input);
  revalidatePath("/[locale]/admin/users");
  return result;
}

export async function setUserStatusAction(userId: string, status: UserStatus) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await setUserStatus(session, userId, status);
  revalidatePath("/[locale]/admin/users");
  return result;
}

export async function revokeUserSessionsAction(userId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await revokeUserSessions(session, userId);
  revalidatePath("/[locale]/admin/users");
  return result;
}

export async function resetUserTwoFactorAction(userId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await resetUserTwoFactor(session, userId);
  revalidatePath("/[locale]/admin/users");
  return result;
}

export async function deleteUserAction(userId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  const result = await deleteUser(session, userId);
  revalidatePath("/[locale]/admin/users");
  return result;
}

