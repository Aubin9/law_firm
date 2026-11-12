"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/auth/auth-actions";
import { signIn } from "@/lib/auth-client";
import { ShieldAlert, Scale, Lock, Mail, AlertCircle, Info } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMessage(null);
    setShowContactAdmin(false);

    try {
      // 1. Check credentials, lockout, and status via Server Action with Audit Logging
      const result = await loginAction(email, password, locale);

      if (!result.success) {
        setErrorMessage(result.error || t("invalidCredentials"));
        if (result.lockedOut && result.lockoutRemainingMinutes) {
          setLockoutMinutes(result.lockoutRemainingMinutes);
        }
        setIsLoading(false);
        return;
      }

      // 2. Establish Session with Better Auth
      const { error: clientError } = await signIn.email({
        email,
        password,
      });

      if (clientError) {
        setErrorMessage(clientError.message || t("invalidCredentials"));
        setIsLoading(false);
        return;
      }

      // 3. Navigate to target (dashboard or 2FA)
      if (result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        router.push(`/${locale}/dashboard`);
      }
    } catch (err: any) {
      setErrorMessage(t("invalidCredentials"));
      setIsLoading(false);
    }
  };

  const otherLocale = locale === "fr" ? "en" : "fr";
  const otherLocaleLabel = locale === "fr" ? "English (EN)" : "Français (FR)";

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-primary flex flex-col justify-center items-center p-4">
      {/* 420px Centred Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-[#E5E0D8] rounded-xl shadow-sm p-8">
        {/* Header with Scale & Firm Title in Source Serif 4 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 text-primary mb-4 border border-[#E5E0D8]">
            <Scale className="w-6 h-6 text-gold" />
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-primary">
            {locale === "fr" ? "Cabinet d'Avocats" : "Law Practice Platform"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">
            {t("subtitle")}
          </p>
        </div>

        {/* Lockout Warning State */}
        {lockoutMinutes && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-900 text-xs">
            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("lockoutWarning")}</p>
              <p className="mt-0.5 text-red-800">
                {locale === "fr"
                  ? `Veuillez patienter ${lockoutMinutes} minute(s) avant de réessayer.`
                  : `Please wait ${lockoutMinutes} minute(s) before trying again.`}
              </p>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && !lockoutMinutes && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-amber-900 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs font-semibold text-primary">
              {t("emailLabel")}
            </Label>
            <div className="relative mt-1">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="avocat@cabinet-avocats.cm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || !!lockoutMinutes}
                className="pl-9 text-sm border-[#E5E0D8] focus-visible:ring-primary"
              />
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-primary">
                {t("passwordLabel")}
              </Label>
              <button
                type="button"
                onClick={() => setShowContactAdmin(!showContactAdmin)}
                className="text-xs text-gold hover:underline font-medium"
              >
                {t("forgotPassword")}
              </button>
            </div>
            <div className="relative mt-1">
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || !!lockoutMinutes}
                className="pl-9 text-sm border-[#E5E0D8] focus-visible:ring-primary"
              />
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Admin Managed Password Reset Notice */}
          {showContactAdmin && (
            <div className="p-3 bg-muted/60 border border-border rounded-lg text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p>{t("contactAdmin")}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !!lockoutMinutes}
            className="w-full bg-primary hover:bg-primary/95 text-white font-medium py-2 rounded-lg transition-colors mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {tCommon("actions.save")}...
              </span>
            ) : (
              t("submitButton")
            )}
          </Button>
        </form>

        {/* Professional secrecy footer notice */}
        <div className="mt-6 pt-4 border-t border-[#F0EBE1] text-center">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {locale === "fr"
              ? "Système soumis au secret professionnel d'avocat et à la loi camerounaise n° 2024/017 relative à la protection des données."
              : "System subject to legal professional privilege and Cameroon Law No. 2024/017 on personal data protection."}
          </p>
        </div>
      </div>

      {/* Language Switcher at Bottom */}
      <div className="mt-6 text-center">
        <Link
          href={`/${otherLocale}/login`}
          className="text-xs text-muted-foreground hover:text-primary transition-colors underline font-medium"
        >
          {otherLocaleLabel}
        </Link>
      </div>
    </div>
  );
}
