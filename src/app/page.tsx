import { Scale, Sparkles, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="max-w-lg rounded-dialog border border-border bg-surface p-8 shadow-popover">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card border border-accent/50">
          <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
        </div>

        <h1 className="mt-4 font-serif text-h1 font-semibold text-primary">
          Cabinet d&apos;Avocats
        </h1>
        <p className="mt-2 text-body-sm text-muted-foreground">
          Plateforme interne de gestion de cabinet juridique · Douala, Cameroun
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" asChild>
            <a href="/fr/dashboard">
              <span>Espace de travail</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>

          <Button variant="secondary" asChild>
            <a href="/fr/login">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>Connexion</span>
            </a>
          </Button>

          <Button variant="secondary" asChild>
            <a href="/fr/dev/components">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Galerie UI (/dev/components)</span>
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
