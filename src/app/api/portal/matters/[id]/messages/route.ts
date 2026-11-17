import { NextRequest, NextResponse } from "next/server";
import {
  checkPortalRateLimit,
  getPortalSession,
  PORTAL_COOKIE_NAME,
  sendClientPortalMessage,
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

  const rl = checkPortalRateLimit(`portal:msg:${portalSession.accountId}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de messages envoyés. Patientez une minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const subject = String(body?.subject || "Message client");
    const messageBody = String(body?.body || "");

    const comm = await sendClientPortalMessage(portalSession, params.id, {
      subject,
      body: messageBody,
    });

    return NextResponse.json({ success: true, id: comm.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Échec d'envoi du message." },
      { status: err.statusCode || 400 }
    );
  }
}

