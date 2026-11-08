import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-0.5 text-caption font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-muted text-foreground",
        primary: "border-primary/20 bg-primary-soft text-primary",
        accent: "border-accent/30 bg-accent-soft text-foreground",
        success: "border-success/25 bg-success-soft text-success-foreground",
        warning: "border-warning/25 bg-warning-soft text-warning-foreground",
        danger: "border-danger/25 bg-danger-soft text-danger-foreground",
        info: "border-info/25 bg-info-soft text-info-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

