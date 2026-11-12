import React from "react";
import { getServerSession } from "@/server/auth/session";
import { listConflictChecks } from "@/server/services/conflict-service";
import { ConflictsClient } from "./conflicts-client";
import { redirect } from "next/navigation";

export default async function ConflictsPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const result = await listConflictChecks({ page: 1, pageSize: 20 }, session);

  return (
    <ConflictsClient
      initialChecks={result.checks as any}
      currentUserRole={session.user.roleKey}
    />
  );
}

