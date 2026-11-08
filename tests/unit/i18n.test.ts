import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  formatLegalDate,
  formatLegalTime,
  formatMoney,
  formatNumber,
} from "@/lib/formatters";

function getKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n and Formatters Specification", () => {
  it("formats dates in Africa/Douala timezone", () => {
    // 2026-11-08 08:30 UTC is 09:30 in Africa/Douala (UTC+1)
    const isoDate = "2026-11-08T08:30:00Z";
    const formattedFr = formatLegalDate(isoDate, "fr", true);
    const formattedEn = formatLegalDate(isoDate, "en", true);

    expect(formattedFr).toContain("2026");
    expect(formattedFr).toContain("09:30");
    expect(formattedEn).toContain("2026");
    expect(formattedEn).toContain("09:30");
  });

  it("formats XAF money with thousand separators and no decimals", () => {
    expect(formatMoney(1000000, "XAF", "fr")).toContain("1");
    expect(formatMoney(1000000, "XAF", "fr")).toContain("XAF");
    expect(formatMoney(1000000, "XAF", "en")).toBe("1,000,000 XAF");
    expect(formatMoney(0, "XAF", "fr")).toBe("0 XAF");
    expect(formatMoney(null, "XAF", "fr")).toBe("—");
  });

  it("verifies 100% key parity between French and English namespace catalogs", () => {
    const frDir = path.join(process.cwd(), "src", "messages", "fr");
    const enDir = path.join(process.cwd(), "src", "messages", "en");

    const frFiles = fs.readdirSync(frDir).filter((f) => f.endsWith(".json"));
    const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith(".json"));

    expect(frFiles.sort()).toEqual(enFiles.sort());

    for (const file of frFiles) {
      const frContent = JSON.parse(
        fs.readFileSync(path.join(frDir, file), "utf-8")
      );
      const enContent = JSON.parse(
        fs.readFileSync(path.join(enDir, file), "utf-8")
      );

      const frKeys = getKeys(frContent).sort();
      const enKeys = getKeys(enContent).sort();

      expect(frKeys, `Keys mismatch in namespace "${file}"`).toEqual(enKeys);
    }
  });
});

