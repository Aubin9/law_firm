import { redirect } from "next/navigation";
import {
  getPortalSessionFromCookies,
  isPortalEnabled,
  listClientMatters,
} from "@/server/portal";
import { PortalClient } from "./portal-client";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale === "en" ? "en" : "fr";
  const enabled = await isPortalEnabled();
  if (!enabled) {
    redirect(`/${locale}/portal/login`);
  }

  const portalSession = await getPortalSessionFromCookies();
  if (!portalSession) {
    redirect(`/${locale}/portal/login`);
  }

  const matters = await listClientMatters(portalSession);

  return (
    <PortalClient
      locale={locale}
      clientName={portalSession.partyName}
      clientEmail={portalSession.email}
      initialMatters={matters}
    />
  );
}

