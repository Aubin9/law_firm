import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  requiredLabel?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, requiredLabel = "obligatoire", ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-body-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && (
        <>
          <span className="ml-1 text-danger font-semibold" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> ({requiredLabel})</span>
        </>
      )}
    </label>
  )
);
Label.displayName = "Label";

export { Label };

