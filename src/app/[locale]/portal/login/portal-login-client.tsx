"use client";

import React, { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, KeyRound, Mail, AlertTriangle } from "lucide-react";

export function PortalLoginClient({ portalEnabled }: { portalEnabled: boolean }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params?.locale === "en" ? "en" : "fr";

  const initialToken = searchParams.get("token") || "";
  const [mode, setMode] = useState<"login" | "activate">(initialToken ? "activate" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!portalEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-serif font-bold text-foreground">
            {locale === "fr" ? "Portail Client Hors Ligne" : "Client Portal Offline"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "fr"
              ? "L'accès public au portail client est actuellement désactivé par l'administration du cabinet."
              : "Public client portal access is currently disabled by the firm administration."}
          </p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de connexion.");
      } else {
        router.push(`/${locale}/portal`);
        router.refresh();
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/portal/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec d'activation.");
      } else {
        setSuccessMsg(
          locale === "fr"
            ? "Compte activé avec succès ! Vous pouvez maintenant vous connecter."
            : "Account activated! You can now sign in."
        );
        setMode("login");
        setEmail(data.email || "");
        setPassword("");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {locale === "fr" ? "Espace Client Sécurisé" : "Secure Client Portal"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "fr"
              ? "Accès chiffré et cloisonné à vos dossiers partagés (Loi n° 2024/017)"
              : "Encrypted access to your shared matters"}
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`py-2 rounded-md transition ${
              mode === "login" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            {locale === "fr" ? "Connexion" : "Sign In"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("activate");
              setError(null);
            }}
            className={`py-2 rounded-md transition ${
              mode === "activate" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            {locale === "fr" ? "Activer mon invitation" : "Activate Invitation"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            {successMsg}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {locale === "fr" ? "Adresse e-mail" : "Email address"}
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                  placeholder="client@exemple.cm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {locale === "fr" ? "Mot de passe" : "Password"}
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading
                ? locale === "fr"
                  ? "Vérification..."
                  : "Signing in..."
                : locale === "fr"
                ? "Accéder à mes dossiers"
                : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {locale === "fr" ? "Jeton d'invitation" : "Invitation Token"}
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-mono"
                placeholder="Collez le jeton reçu du cabinet"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {locale === "fr" ? "Nouveau mot de passe (min. 10 caractères)" : "New Password (min 10 chars)"}
              </label>
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading
                ? locale === "fr"
                  ? "Activation..."
                  : "Activating..."
                : locale === "fr"
                ? "Activer mon accès"
                : "Activate Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

