import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderTab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  reference?: string;
  backHref?: string;
  backLabel?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: PageHeaderTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  useSerifTitle?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  reference,
  backHref,
  backLabel = "Retour",
  badges,
  actions,
  tabs,
  activeTab,
  onTabChange,
  useSerifTitle = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-border bg-surface px-4 pt-5 pb-4 sm:px-6",
        tabs && tabs.length > 0 && "pb-0",
        className
      )}
    >
      {backHref && (
        <div className="mb-2">
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{backLabel}</span>
          </a>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {reference && (
              <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                {reference}
              </span>
            )}
            <h1
              className={cn(
                "text-h2 font-semibold tracking-tight text-primary break-words",
                useSerifTitle && "font-serif"
              )}
            >
              {title}
            </h1>
            {badges && (
              <div className="flex flex-wrap items-center gap-2">{badges}</div>
            )}
          </div>
          {description && (
            <p className="max-w-3xl text-body-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <nav
          aria-label="Sections"
          className="mt-5 -mb-px flex space-x-6 overflow-x-auto no-scrollbar"
        >
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange?.(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group inline-flex items-center gap-2 border-b-2 py-3 text-body-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-accent text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={cn(
                      "rounded-chip px-2 py-0.5 text-caption tabular-nums",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "bg-surface-muted text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

