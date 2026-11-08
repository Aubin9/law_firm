import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Perform minimal non-sensitive query to verify connection pool
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        timestamp,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch {
    // Never leak error details, connection URLs, or stack traces
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}

