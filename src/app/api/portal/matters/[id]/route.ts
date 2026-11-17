import { NextRequest, NextResponse } from "next/server";
import { getClientMatterDetail, getPortalSession, PORTAL_COOKIE_NAME } from "@/server/portal";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rawToken = req.cookies.get(PORTAL_COOKIE_NAME)?.value;
  const portalSession = await getPortalSession(rawToken);
  if (!portalSession) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const detail = await getClientMatterDetail(portalSession, params.id);
    return NextResponse.json(detail);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Accès refusé." },
      { status: err.statusCode || 403 }
    );
  }
}

