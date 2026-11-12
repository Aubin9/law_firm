import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary/90 active:bg-primary/95",
        secondary:
          "border border-border bg-surface text-foreground shadow-card hover:bg-surface-muted active:bg-surface-muted/80",
        outline:
          "border border-border bg-surface text-foreground shadow-card hover:bg-surface-muted active:bg-surface-muted/80",
        ghost:
          "text-foreground hover:bg-surface-muted hover:text-foreground",
        destructive:
          "bg-danger text-primary-foreground shadow-card hover:bg-danger/90 active:bg-danger/95",
        outlineDanger:
          "border border-danger/40 bg-danger-soft text-danger-foreground hover:bg-danger/15",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] sm:min-h-[40px] px-4 py-2",
        sm: "min-h-[36px] px-3 py-1.5 text-caption",
        lg: "min-h-[48px] px-6 py-2.5 text-body",
        icon: "min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

