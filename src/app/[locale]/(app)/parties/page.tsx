import React from "react";
import { getServerSession } from "@/server/auth/session";
import { listParties } from "@/server/services/party-service";
import { PartiesClient } from "./parties-client";
import { redirect } from "next/navigation";

export default async function PartiesPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Retrieve initial non-archived + archived parties list for instant client searching
  const result = await listParties(
    {
      page: 1,
      pageSize: 100,
      includeDeleted: true,
    },
    session
  );

  return (
    <PartiesClient
      initialParties={result.parties as any}
      currentUserRole={session.user.roleKey}
    />
  );
}
