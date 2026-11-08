import { Scale, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale === "en" ? "en" : "fr";
  const otherLocale = locale === "fr" ? "en" : "fr";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px] rounded-dialog border border-border bg-surface p-6 sm:p-8 shadow-popover">
        {/* Firm Emblem & Title (DESIGN.md 8.1) */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card border border-accent/50">
            <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-serif text-h2 font-semibold text-primary">
            Cabinet Mbarga & Associés
          </h1>
          <p className="mt-1 text-caption text-muted-foreground">
            {locale === "en"
              ? "Internal Legal Practice Management Platform"
              : "Plateforme interne de gestion de cabinet d'avocats"}
          </p>
        </div>

        <form
          action={`/${locale}/dashboard`}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="login-email"
              required
              requiredLabel={locale === "en" ? "required" : "obligatoire"}
            >
              {locale === "en"
                ? "Professional email address"
                : "Adresse email professionnelle"}
            </Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={
                locale === "en"
                  ? "j.mbarga@cabinet-mbarga.cm"
                  : "j.mbarga@cabinet-mbarga.cm"
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="login-password"
              required
              requiredLabel={locale === "en" ? "required" : "obligatoire"}
            >
              {locale === "en" ? "Password" : "Mot de passe"}
            </Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
            />
          </div>

          <div className="pt-1">
            <Button type="submit" variant="primary" className="w-full">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>{locale === "en" ? "Sign in" : "Se connecter"}</span>
            </Button>
          </div>
        </form>

        {/* Administrator Password Policy Notice (No self-service reset per DESIGN.md 8.1) */}
        <div className="mt-5 rounded-lg border border-border bg-surface-muted/60 px-3.5 py-2.5 text-center text-caption text-muted-foreground">
          {locale === "en"
            ? "Password forgotten or account locked? Contact your functional or technical administrator."
            : "Mot de passe oublié ou compte verrouillé ? Contactez votre administrateur fonctionnel ou technique."}
        </div>

        {/* Bottom bar: Secrecy notice & Language Switch */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            <span>
              {locale === "en"
                ? "LAN / VPN Restricted"
                : "Réseau interne sécurisé"}
            </span>
          </span>

          <a
            href={`/${otherLocale}/login`}
            className="font-mono font-semibold text-primary hover:underline"
          >
            {locale === "fr" ? "English (EN)" : "Français (FR)"}
          </a>
        </div>
      </div>
    </main>
  );
}
