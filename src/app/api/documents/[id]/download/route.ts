import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { getDocumentVersionFileForDownload } from "@/server/services/document-service";
import { Readable } from "stream";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Authorized Document Version Download Route Handler (DOC-05).
 * Validates authentication, matter access, clean antivirus scan status,
 * logs the access in AuditLog, and streams the file securely.
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession();
  if (!session) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const { id } = await params;

  try {
    const { stream, fileName, mimeType, sizeBytes } =
      await getDocumentVersionFileForDownload(id, session);

    // Convert NodeJS ReadableStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    // Content-Disposition header with encoded filename
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Length": String(sizeBytes),
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    const status = error.statusCode || error.status || 403;
    return new NextResponse(error.message || "Accès refusé", { status });
  }
}

