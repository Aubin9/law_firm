import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import {
  listLegalTexts,
  seedCanonicalLegalLibrary,
} from "@/server/services/library-service";
import { listMatters } from "@/server/services/matter-service";
import { LibraryClient } from "./library-client";

export default async function LibraryPage({
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

  // Check if library has texts; if empty, seed canonical texts
  let texts = await listLegalTexts();
  if (texts.length === 0) {
    await seedCanonicalLegalLibrary(session);
    texts = await listLegalTexts();
  }

  // Active matters for "Insert to Matter" action
  const mattersResult = await listMatters({ page: 1, pageSize: 50 }, session).catch(() => ({
    matters: [],
    total: 0,
  }));

  return (
    <LibraryClient
      locale={locale}
      initialTexts={texts as any}
      matters={mattersResult.matters as any}
    />
  );
}
