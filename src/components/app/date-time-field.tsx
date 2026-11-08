"use client";

import * as React from "react";
import { Calendar, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatLegalDate } from "@/lib/formatters";

export { formatLegalDate };

export interface DateTimeFieldProps {
  id?: string;
  dateValue?: string;
  timeValue?: string;
  onDateChange?: (date: string) => void;
  onTimeChange?: (time: string) => void;
  includeTime?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  showTimezoneBadge?: boolean;
  locale?: "fr" | "en";
  className?: string;
}

export function DateTimeField({
  id,
  dateValue = "",
  timeValue = "09:00",
  onDateChange,
  onTimeChange,
  includeTime = true,
  disabled = false,
  hasError = false,
  showTimezoneBadge = true,
  locale = "fr",
  className,
}: DateTimeFieldProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative flex-1 min-w-[160px]">
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange?.(e.target.value)}
          disabled={disabled}
          hasError={hasError}
          className="pl-9 font-mono tabular-nums"
          aria-label={locale === "en" ? "Date" : "Date"}
        />
      </div>

      {includeTime && (
        <div className="relative w-32">
          <Clock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={id ? `${id}-time` : undefined}
            type="time"
            step={300}
            value={timeValue}
            onChange={(e) => onTimeChange?.(e.target.value)}
            disabled={disabled}
            hasError={hasError}
            className="pl-9 font-mono tabular-nums"
            aria-label={locale === "en" ? "Time (24h)" : "Heure (24h)"}
          />
        </div>
      )}

      {showTimezoneBadge && (
        <span
          title="Fuseau horaire : Africa/Douala (UTC+1)"
          className="inline-flex items-center rounded-md border border-border bg-surface-muted px-2 py-1.5 font-mono text-caption text-muted-foreground"
        >
          WAT (Douala)
        </span>
      )}
    </div>
  );
}
