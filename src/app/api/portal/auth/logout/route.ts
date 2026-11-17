import { NextRequest, NextResponse } from "next/server";
import { logoutPortalSession, PORTAL_COOKIE_NAME } from "@/server/portal";

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(PORTAL_COOKIE_NAME)?.value;
  await logoutPortalSession(rawToken);

  const res = NextResponse.json({ success: true });
  res.cookies.delete(PORTAL_COOKIE_NAME);
  return res;
}

