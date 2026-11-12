import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { listAllDocuments } from "@/server/services/document-service";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage({
  params,
}: {
  params: { locale: string } | Promise<{ locale: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const locale = (resolvedParams?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const session = await getServerSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [rawDocs, categories, matters] = await Promise.all([
    listAllDocuments({}, session),
    db.documentCategory.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, key: true, nameFr: true, nameEn: true },
    }),
    db.matter.findMany({
      where: accessibleMatterFilter(session),
      select: { id: true, reference: true, title: true },
      orderBy: { reference: "asc" },
      take: 100,
    }),
  ]);

  const serializedDocs = rawDocs.map((doc) => {
    const latestVersion = doc.versions[0] || null;
    return {
      id: doc.id,
      title: doc.title,
      confidentiality: doc.confidentiality,
      categoryId: doc.categoryId,
      categoryName:
        locale === "en" ? doc.category?.nameEn || "General" : doc.category?.nameFr || "Général",
      matterId: doc.matterId,
      matterReference: doc.matter.reference,
      matterTitle: doc.matter.title,
      versionCount: doc._count.versions,
      latestVersionNumber: latestVersion?.versionNumber || 1,
      latestVersionId: latestVersion?.id || null,
      fileName: latestVersion?.fileName || "document.pdf",
      mimeType: latestVersion?.mimeType || "application/pdf",
      sizeBytes: latestVersion?.sizeBytes || 0,
      scanStatus: latestVersion?.scanStatus || "PENDING",
      status: latestVersion?.status || "DRAFT",
      uploadedBy: latestVersion?.uploadedBy?.name || "Cabinet",
      updatedAt: doc.updatedAt.toISOString(),
    };
  });

  return (
    <DocumentsClient
      documents={serializedDocs}
      categories={categories}
      matters={matters}
      locale={locale}
      currentUserRole={session.user.roleKey}
    />
  );
}

