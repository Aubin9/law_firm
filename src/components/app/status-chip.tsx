import * as React from "react";
import {
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone =
  "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent";

const toneClasses: Record<StatusTone, { container: string; dot: string }> = {
  neutral: {
    container: "border-border bg-surface-muted text-foreground",
    dot: "bg-muted-foreground",
  },
  primary: {
    container: "border-primary/25 bg-primary-soft text-primary",
    dot: "bg-primary",
  },
  success: {
    container: "border-success/25 bg-success-soft text-success-foreground",
    dot: "bg-success",
  },
  warning: {
    container: "border-warning/25 bg-warning-soft text-warning-foreground",
    dot: "bg-warning",
  },
  danger: {
    container: "border-danger/25 bg-danger-soft text-danger-foreground",
    dot: "bg-danger",
  },
  info: {
    container: "border-info/25 bg-info-soft text-info-foreground",
    dot: "bg-info",
  },
  accent: {
    container: "border-accent/35 bg-accent-soft text-foreground",
    dot: "bg-accent",
  },
};

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
  icon?: React.ReactNode;
}

export function StatusChip({
  label,
  tone = "neutral",
  showDot = true,
  icon,
  className,
  ...props
}: StatusChipProps) {
  const styles = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-0.5 text-caption font-medium whitespace-nowrap",
        styles.container,
        className,
      )}
      {...props}
    >
      {icon ? (
        icon
      ) : showDot ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-chip shrink-0", styles.dot)}
          aria-hidden="true"
        />
      ) : null}
      <span>{label}</span>
    </span>
  );
}

export interface OverdueChipProps {
  days: number;
  locale?: "fr" | "en";
  className?: string;
}

export function OverdueChip({
  days,
  locale = "fr",
  className,
}: OverdueChipProps) {
  const label =
    locale === "en"
      ? `Overdue by ${days} day${days > 1 ? "s" : ""}`
      : `En retard de ${days} j`;
  return (
    <StatusChip
      label={label}
      tone="danger"
      showDot={false}
      icon={<Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      className={className}
    />
  );
}

export type ScanStatusType = "CLEAN" | "PENDING" | "INFECTED" | "ERROR";

export interface ScanStatusChipProps {
  status: ScanStatusType;
  showWhenClean?: boolean;
  locale?: "fr" | "en";
  className?: string;
}

export function ScanStatusChip({
  status,
  showWhenClean = false,
  locale = "fr",
  className,
}: ScanStatusChipProps) {
  if (status === "CLEAN" && !showWhenClean) {
    return null;
  }

  if (status === "CLEAN") {
    return (
      <StatusChip
        label={locale === "en" ? "Scan clean" : "Fichier sain"}
        tone="success"
        showDot={false}
        icon={
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        }
        className={className}
      />
    );
  }

  if (status === "PENDING") {
    return (
      <StatusChip
        label={locale === "en" ? "Scanning..." : "Analyse en cours..."}
        tone="neutral"
        showDot={false}
        icon={
          <Loader2
            className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        }
        className={className}
      />
    );
  }

  return (
    <StatusChip
      label={
        status === "INFECTED"
          ? locale === "en"
            ? "Infected (Quarantined)"
            : "Infecté (Quarantaine)"
          : locale === "en"
            ? "Scan error"
            : "Erreur d'analyse"
      }
      tone="danger"
      showDot={false}
      icon={<ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      className={className}
    />
  );
}

export function AiSuggestionChip({
  locale = "fr",
  className,
}: {
  locale?: "fr" | "en";
  className?: string;
}) {
  return (
    <StatusChip
      label={
        locale === "en"
          ? "AI suggestion, to validate"
          : "Suggestion IA, à valider"
      }
      tone="info"
      showDot={false}
      icon={<Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      className={className}
    />
  );
}

export function ProceduralDeadlineChip({
  validatedBy,
  locale = "fr",
  className,
}: {
  validatedBy?: string | null;
  locale?: "fr" | "en";
  className?: string;
}) {
  const label = validatedBy
    ? locale === "en"
      ? `Validated by ${validatedBy}`
      : `Validée par ${validatedBy}`
    : locale === "en"
      ? "Procedural - To validate"
      : "Échéance procédurale - À valider";

  return (
    <StatusChip
      label={label}
      tone={validatedBy ? "accent" : "warning"}
      showDot={false}
      icon={
        <Flag className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
      }
      className={className}
    />
  );
}
