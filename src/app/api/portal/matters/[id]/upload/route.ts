import { NextRequest, NextResponse } from "next/server";
import {
  checkPortalRateLimit,
  getPortalSession,
  PORTAL_COOKIE_NAME,
  uploadClientDocument,
} from "@/server/portal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rawToken = req.cookies.get(PORTAL_COOKIE_NAME)?.value;
  const portalSession = await getPortalSession(rawToken);
  if (!portalSession) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const rl = checkPortalRateLimit(`portal:upload:${portalSession.accountId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Quota de dépôts horaires atteint." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = String(formData.get("title") || file?.name || "Pièce client");

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = await uploadClientDocument(portalSession, params.id, {
      title,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    return NextResponse.json({ success: true, ...res });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erreur lors du dépôt." },
      { status: err.statusCode || 400 }
    );
  }
}

