import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/server/db";

describe("Health check endpoint (/api/health)", () => {
  it("returns status ok and 200 when database query succeeds", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data.timestamp).toBeDefined();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns status error and 503 without leaking error details when database fails", async () => {
    vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(new Error("FATAL: database connection refused password=secret"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.database).toBe("disconnected");
    expect(data.timestamp).toBeDefined();
    // Verify no sensitive information or error message is exposed
    expect(JSON.stringify(data)).not.toContain("password");
    expect(JSON.stringify(data)).not.toContain("secret");
    expect(JSON.stringify(data)).not.toContain("FATAL");
  });
});

