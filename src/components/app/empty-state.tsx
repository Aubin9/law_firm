import * as React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground border border-border"
        aria-hidden="true"
      >
        {icon ?? <FolderOpen className="h-5 w-5" />}
      </div>
      <h3 className="mt-4 text-body font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-body-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

