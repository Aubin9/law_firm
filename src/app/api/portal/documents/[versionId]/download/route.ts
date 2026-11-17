import { NextRequest, NextResponse } from "next/server";
import {
  checkPortalRateLimit,
  downloadClientDocument,
  getPortalSession,
  PORTAL_COOKIE_NAME,
} from "@/server/portal";

export async function GET(
  req: NextRequest,
  { params }: { params: { versionId: string } }
) {
  const rawToken = req.cookies.get(PORTAL_COOKIE_NAME)?.value;
  const portalSession = await getPortalSession(rawToken);
  if (!portalSession) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const rl = checkPortalRateLimit(`portal:download:${portalSession.accountId}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Limite de téléchargements atteinte. Patientez un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const result = await downloadClientDocument(portalSession, params.versionId, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        "Content-Length": String(result.buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Accès refusé." },
      { status: err.statusCode || 403 }
    );
  }
}

