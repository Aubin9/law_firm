import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  formatMoney,
  MoneyCell,
  formatLegalDate,
  StatusChip,
  PriorityChip,
  ConfidentialityChip,
  ScanStatusChip,
  EmptyState,
  ErrorState,
  DeniedState,
} from "@/components/app";

describe("Design System & Shared Legal Components", () => {
  it("formats XAF money without decimals and with currency suffix", () => {
    const formattedFr = formatMoney(1500000, "XAF", "fr");
    expect(formattedFr).toContain("XAF");
    expect(formattedFr).toContain("500");

    const formattedEn = formatMoney(1500000, "XAF", "en");
    expect(formattedEn).toBe("1,500,000 XAF");

    expect(formatMoney(null)).toBe("-");
  });

  it("formats dates in Africa/Douala timezone by locale", () => {
    const iso = "2026-11-08T08:30:00Z";
    const enFormatted = formatLegalDate(iso, "en", true);
    expect(enFormatted).toContain("2026");
    // 08:30 UTC is 09:30 in Africa/Douala (UTC+1)
    expect(enFormatted).toContain("09:30");
  });

  it("renders StatusChip, PriorityChip and ConfidentialityChip with accessible text", () => {
    render(
      <div>
        <StatusChip label="En cours" tone="primary" />
        <PriorityChip priority="URGENT" locale="fr" />
        <ConfidentialityChip level="STRICT" locale="fr" />
        <ConfidentialityChip level="STANDARD" locale="fr" />
        <ScanStatusChip status="INFECTED" locale="fr" />
      </div>,
    );

    expect(screen.getByText("En cours")).toBeDefined();
    expect(screen.getByText("Urgente")).toBeDefined();
    expect(screen.getByText("Strict")).toBeDefined();
    // STANDARD is hidden by default when showStandard is false
    expect(screen.queryByText("Standard")).toBeNull();
    expect(screen.getByText("Infecté (Quarantaine)")).toBeDefined();
  });

  it("renders MoneyCell, EmptyState, ErrorState, and DeniedState accurately", () => {
    render(
      <div>
        <MoneyCell amount={250000} locale="en" />
        <EmptyState
          title="Aucun dossier"
          description="Créez votre premier dossier."
        />
        <ErrorState referenceCode="ERR-TEST-01" locale="fr" />
        <DeniedState locale="en" />
      </div>,
    );

    expect(screen.getByText("250,000 XAF")).toBeDefined();
    expect(screen.getByText("Aucun dossier")).toBeDefined();
    expect(screen.getByText("ERR-TEST-01")).toBeDefined();
    expect(
      screen.getByText("You do not have access to this item"),
    ).toBeDefined();
  });
});
