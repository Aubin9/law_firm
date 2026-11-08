import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Example unit test suite", () => {
  it("properly merges css class names using cn utility", () => {
    const result = cn("text-sm", "font-bold", { "text-primary": true });
    expect(result).toBe("text-sm font-bold text-primary");
  });

  it("ensures environment defaults are present", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});

