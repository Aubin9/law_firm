import { isPortalEnabled } from "@/server/portal";
import { PortalLoginClient } from "./portal-login-client";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const enabled = await isPortalEnabled();
  return <PortalLoginClient portalEnabled={enabled} />;
}

