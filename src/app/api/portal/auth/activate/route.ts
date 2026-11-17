import { NextRequest, NextResponse } from "next/server";
import { activatePortalAccount, checkPortalRateLimit } from "@/server/portal";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rl = checkPortalRateLimit(`portal:activate:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives d'activation. Réessayez dans une heure." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const token = String(body?.token || "");
    const password = String(body?.password || "");

    const result = await activatePortalAccount(token, password);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Échec d'activation du compte." },
      { status: err.statusCode || 400 }
    );
  }
}

