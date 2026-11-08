"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName?: string;
  consequence: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireKeyword?: string;
  keywordPrompt?: string;
  loading?: boolean;
  onConfirm: () => void;
  locale?: "fr" | "en";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  consequence,
  confirmLabel,
  cancelLabel,
  destructive = false,
  requireKeyword,
  keywordPrompt,
  loading = false,
  onConfirm,
  locale = "fr",
}: ConfirmDialogProps) {
  const [typedKeyword, setTypedKeyword] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setTypedKeyword("");
    }
  }, [open]);

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

  const isConfirmDisabled =
    loading ||
    (Boolean(requireKeyword) && typedKeyword.trim() !== requireKeyword);

  const defaultCancel = locale === "en" ? "Cancel" : "Annuler";
  const defaultConfirm = locale === "en" ? "Confirm" : "Confirmer";
  const defaultKeywordPrompt =
    locale === "en"
      ? `To confirm this irreversible operation, type "${requireKeyword}" below:`
      : `Pour confirmer cette action irréversible, saisissez « ${requireKeyword} » ci-dessous :`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className="fixed inset-0 bg-foreground/40 backdrop-blur-[1px] transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-dialog border border-border bg-surface p-6 shadow-popover animate-in fade-in-0 zoom-in-95">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {destructive && (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger border border-danger/25"
                aria-hidden="true"
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-h3 font-semibold text-foreground"
              >
                {title}
              </h2>
              {itemName && (
                <p className="mt-1 inline-block rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-medium text-primary border border-border">
                  {itemName}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={locale === "en" ? "Close dialog" : "Fermer la boîte de dialogue"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p
          id="confirm-dialog-desc"
          className={cn(
            "mt-3 text-body-sm text-muted-foreground",
            destructive && "pl-0 sm:pl-13"
          )}
        >
          {consequence}
        </p>

        {requireKeyword && (
          <div className="mt-4 space-y-2 rounded-lg border border-danger/25 bg-danger-soft/40 p-3">
            <Label htmlFor="confirm-keyword-input" className="text-caption">
              {keywordPrompt ?? defaultKeywordPrompt}
            </Label>
            <Input
              id="confirm-keyword-input"
              value={typedKeyword}
              onChange={(e) => setTypedKeyword(e.target.value)}
              placeholder={requireKeyword}
              autoComplete="off"
              className="font-mono"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel ?? defaultCancel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "primary"}
            disabled={isConfirmDisabled}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? defaultConfirm}
          </Button>
        </div>
      </div>
    </div>
  );
}

