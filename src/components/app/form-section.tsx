"use client";

import * as React from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  advancedChildren?: React.ReactNode;
  advancedLabel?: string;
  defaultAdvancedOpen?: boolean;
  locale?: "fr" | "en";
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  advancedChildren,
  advancedLabel,
  defaultAdvancedOpen = false,
  locale = "fr",
  className,
}: FormSectionProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(defaultAdvancedOpen);
  const defaultMoreLabel =
    locale === "en" ? "More details" : "Plus de détails";

  return (
    <section
      className={cn(
        "max-w-[720px] rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-card space-y-5",
        className
      )}
    >
      <div className="border-b border-border pb-3">
        <h3 className="text-h3 font-semibold text-primary">{title}</h3>
        {description && (
          <p className="mt-1 text-body-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="space-y-4">{children}</div>

      {advancedChildren && (
        <div className="pt-2 border-t border-border/70">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-1.5 py-1.5 text-body-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{advancedLabel ?? defaultMoreLabel}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 border-l-2 border-accent/50 pl-4">
              {advancedChildren}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  locale?: "fr" | "en";
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required = false,
  helpText,
  error,
  locale = "fr",
  children,
  className,
}: FormFieldProps) {
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={id}
        required={required}
        requiredLabel={locale === "en" ? "required" : "obligatoire"}
      >
        {label}
      </Label>

      {children}

      {helpText && !error && (
        <p id={helpId} className="text-caption text-muted-foreground">
          {helpText}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-caption font-medium text-danger"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function FormStickyFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 flex max-w-[720px] items-center justify-end gap-3 rounded-b-lg border-t border-border bg-surface/95 px-5 py-3.5 backdrop-blur-sm shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

