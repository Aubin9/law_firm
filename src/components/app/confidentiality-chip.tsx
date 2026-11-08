import * as React from "react";
import { Lock, Shield, ShieldAlert } from "lucide-react";
import { StatusChip } from "./status-chip";

export type ConfidentialityLevel = "STANDARD" | "RESTRICTED" | "STRICT";

export interface ConfidentialityChipProps {
  level: ConfidentialityLevel;
  showStandard?: boolean;
  locale?: "fr" | "en";
  className?: string;
}

export function ConfidentialityChip({
  level,
  showStandard = false,
  locale = "fr",
  className,
}: ConfidentialityChipProps) {
  if (level === "STANDARD" && !showStandard) {
    return null;
  }

  if (level === "STANDARD") {
    return (
      <StatusChip
        label={locale === "en" ? "Standard" : "Standard"}
        tone="neutral"
        showDot={false}
        icon={<Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
        className={className}
      />
    );
  }

  if (level === "RESTRICTED") {
    return (
      <StatusChip
        label={locale === "en" ? "Restricted" : "Restreint"}
        tone="warning"
        showDot={false}
        icon={<Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        className={className}
      />
    );
  }

  return (
    <StatusChip
      label={locale === "en" ? "Strict" : "Strict"}
      tone="danger"
      showDot={false}
      icon={<ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      className={className}
    />
  );
}

