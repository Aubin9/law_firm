import { NextRequest, NextResponse } from "next/server";
import {
  checkPortalRateLimit,
  loginPortalAccount,
  PORTAL_COOKIE_NAME,
} from "@/server/portal";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rl = checkPortalRateLimit(`portal:login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives de connexion. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "");
    const password = String(body?.password || "");

    const { rawSessionToken, expiresAt, context } = await loginPortalAccount(email, password, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        email: context.email,
        partyName: context.partyName,
      },
    });

    res.cookies.set(PORTAL_COOKIE_NAME, rawSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Échec d'authentification." },
      { status: err.statusCode || 403 }
    );
  }
}

