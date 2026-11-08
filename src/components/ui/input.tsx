import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[44px] sm:min-h-[40px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-foreground shadow-card transition-colors file:border-0 file:bg-transparent file:text-body-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
          hasError && "border-danger focus-visible:ring-danger",
          className
        )}
        ref={ref}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

