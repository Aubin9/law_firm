import * as React from "react";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DeniedStateProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  locale?: "fr" | "en";
  className?: string;
}

export function DeniedState({
  title,
  description,
  backHref = "/fr/dashboard",
  backLabel,
  locale = "fr",
  className,
}: DeniedStateProps) {
  const defaultTitle =
    locale === "en"
      ? "You do not have access to this item"
      : "Vous n'avez pas accès à cet élément";
  const defaultDesc =
    locale === "en"
      ? "Access to this resource is restricted by role or matter confidentiality rules. If you require access, please contact the responsible lead lawyer or a partner."
      : "L'accès à cette ressource est restreint par votre rôle ou par les règles de confidentialité du dossier. Si vous avez besoin d'y accéder, veuillez solliciter l'avocat responsable ou un associé.";
  const defaultBack =
    locale === "en" ? "Return to dashboard" : "Retour au tableau de bord";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-card",
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning border border-warning/25"
        aria-hidden="true"
      >
        <ShieldOff className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-body font-semibold text-foreground">
        {title ?? defaultTitle}
      </h3>
      <p className="mt-1.5 max-w-md text-body-sm text-muted-foreground">
        {description ?? defaultDesc}
      </p>
      {backHref && (
        <div className="mt-5">
          <Button variant="secondary" asChild>
            <a href={backHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{backLabel ?? defaultBack}</span>
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

