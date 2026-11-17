import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { buildGlobalReversibilityExport } from "@/server/services/reversibility-export-service";
import { ForbiddenError } from "@/server/auth/errors";

export async function GET(_request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const archive = await buildGlobalReversibilityExport(session);

    return new Response(new Uint8Array(archive.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        "Content-Length": String(archive.sizeBytes),
        "X-Archive-SHA256": archive.sha256,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Erreur lors de l'export global de réversibilité" },
      { status: 500 }
    );
  }
}

