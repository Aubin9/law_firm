import React from "react";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { getMatterById } from "@/server/services/matter-service";
import { db } from "@/server/db";
import { MatterDetailClient } from "./matter-detail-client";

interface PageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default async function MatterDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  let matter;
  try {
    matter = await getMatterById(id, session);
  } catch (error: any) {
    if (error?.status === 403 || error?.statusCode === 403 || error?.code === "FORBIDDEN") {
      notFound();
    }
    throw error;
  }

  if (!matter) {
    notFound();
  }

  // Fetch active users for member assignment drawer
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      role: {
        select: {
          nameFr: true,
          nameEn: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const allUsers = users.map((u) => ({
    id: u.id,
    name: u.name || "Utilisateur sans nom",
    roleName: locale === "en" ? u.role.nameEn : u.role.nameFr,
  }));

  // Fetch document categories for upload drawer
  const docCategories = await db.documentCategory.findMany({
    select: { id: true, key: true, nameFr: true, nameEn: true },
    orderBy: { nameFr: "asc" },
  });

  return (
    <MatterDetailClient
      matter={matter}
      allUsers={allUsers}
      docCategories={docCategories}
      currentUserId={session.user.id}
      currentUserRole={session.user.roleKey}
    />
  );
}
