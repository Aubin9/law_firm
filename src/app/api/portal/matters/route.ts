import { NextRequest, NextResponse } from "next/server";
import { getPortalSession, listClientMatters, PORTAL_COOKIE_NAME } from "@/server/portal";

export async function GET(req: NextRequest) {
  const rawToken = req.cookies.get(PORTAL_COOKIE_NAME)?.value;
  const portalSession = await getPortalSession(rawToken);
  if (!portalSession) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const matters = await listClientMatters(portalSession);
    return NextResponse.json({ matters });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erreur serveur." },
      { status: err.statusCode || 403 }
    );
  }
}

