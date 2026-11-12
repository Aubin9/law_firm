import React from "react";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { getPartyById } from "@/server/services/party-service";
import { PartyDetailClient } from "./party-detail-client";

export default async function PartyDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const session = await getServerSession();
  const locale = params.locale === "en" ? "en" : "fr";

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const party = await getPartyById(params.id, session);
  if (!party) {
    notFound();
  }

  return (
    <PartyDetailClient
      party={party}
      currentUserRole={session.user.roleKey}
    />
  );
}
