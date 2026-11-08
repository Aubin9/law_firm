import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  referenceCode?: string;
  onRetry?: () => void;
  retryLabel?: string;
  locale?: "fr" | "en";
  className?: string;
}

export function ErrorState({
  title,
  description,
  referenceCode = "ERR-SYS-500",
  onRetry,
  retryLabel,
  locale = "fr",
  className,
}: ErrorStateProps) {
  const defaultTitle =
    locale === "en"
      ? "Unable to load this section"
      : "Impossible de charger cette section";
  const defaultDesc =
    locale === "en"
      ? "An unexpected error occurred while processing your request. Please try again or contact your system administrator."
      : "Une erreur inattendue est survenue lors du traitement de votre demande. Veuillez réessayer ou contacter votre administrateur système.";
  const defaultRetry = locale === "en" ? "Try again" : "Réessayer";
  const refPrefix = locale === "en" ? "Reference code:" : "Code de référence :";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-soft/50 px-6 py-10 text-center",
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger border border-danger/25"
        aria-hidden="true"
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-body font-semibold text-foreground">
        {title ?? defaultTitle}
      </h3>
      <p className="mt-1.5 max-w-md text-body-sm text-muted-foreground">
        {description ?? defaultDesc}
      </p>
      {referenceCode && (
        <p className="mt-3 rounded bg-surface px-2.5 py-1 font-mono text-caption text-muted-foreground border border-border">
          {refPrefix} <span className="font-semibold text-foreground">{referenceCode}</span>
        </p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="secondary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>{retryLabel ?? defaultRetry}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

