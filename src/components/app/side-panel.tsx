"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  reference?: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "default" | "lg";
  locale?: "fr" | "en";
}

export function SidePanel({
  open,
  onOpenChange,
  title,
  subtitle,
  reference,
  badges,
  children,
  footer,
  size = "default",
  locale = "fr",
}: SidePanelProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="side-panel-title"
    >
      <div
        className="fixed inset-0 bg-foreground/35 backdrop-blur-[1px] transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "relative z-10 flex h-full w-full flex-col border-l border-border bg-surface shadow-popover transition-transform",
          size === "default" ? "max-w-lg" : "max-w-2xl"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {reference && (
                <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                  {reference}
                </span>
              )}
              {badges}
            </div>
            <h2
              id="side-panel-title"
              className="text-h3 font-semibold text-primary break-words"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-caption text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={locale === "en" ? "Close panel" : "Fermer le panneau"}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {/* Sticky Footer */}
        {footer && (
          <div className="border-t border-border bg-surface-muted/50 px-5 py-3.5">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}

