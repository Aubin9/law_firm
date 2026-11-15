import { NextRequest, NextResponse } from "next/server";
import { generateIcsFeed } from "@/server/services/calendar-sync-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    if (!token) {
      return new NextResponse("Token de calendrier manquant.", { status: 400 });
    }

    const host = req.headers.get("host") || "localhost:3001";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    const icsContent = await generateIcsFeed(token, baseUrl);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="agenda-cabinet.ics"',
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err: any) {
    const status = err?.name === "ForbiddenError" ? 403 : 500;
    return new NextResponse(err?.message || "Erreur de génération du flux d'agenda.", {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

