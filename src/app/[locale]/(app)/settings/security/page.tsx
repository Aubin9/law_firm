"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Laptop, Smartphone, Globe, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";

export default function SecuritySettingsPage() {
  const t = useTranslations("auth.security");
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [activeSessions, setActiveSessions] = useState([
    {
      id: "sess_current",
      device: "Edge 122 on Windows 11 (Poste Principal)",
      ipAddress: "192.168.1.45 (LAN Cabinet)",
      lastActive: locale === "fr" ? "Actif maintenant" : "Active now",
      isCurrent: true,
      icon: "laptop",
    },
    {
      id: "sess_mobile",
      device: "Mobile Safari on iPhone 15 Pro",
      ipAddress: "10.8.0.12 (VPN WireGuard)",
      lastActive: locale === "fr" ? "Il y a 2 heures" : "2 hours ago",
      isCurrent: false,
      icon: "mobile",
    },
  ]);

  const [message, setMessage] = useState<string | null>(null);

  const handleRevoke = (id: string) => {
    setActiveSessions((prev) => prev.filter((s) => s.id !== id));
    setMessage(t("revokeSuccess"));
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

        {message && (
          <div className="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2.5 text-xs text-green-900 font-medium">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {message}
          </div>
        )}

        {/* 2FA Configuration Status Card */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary">
                  {t("twoFactorStatus")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  {locale === "fr"
                    ? "La double authentification (TOTP) protège l'accès à vos dossiers confidentiels conformément au secret professionnel et à la loi n° 2024/017."
                    : "Two-Factor Authentication (TOTP) protects your confidential client files in compliance with legal privilege and Cameroon Law No. 2024/017."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold">
                    {t("twoFactorEnabled")}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    (Google Authenticator / FreeOTP)
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/${locale}/2fa/setup`}
              className="text-xs border-[#E5E0D8] text-primary"
            >
              {locale === "fr" ? "Reconfigurer" : "Reconfigure"}
            </Button>
          </div>
        </div>

        {/* Active Sessions List */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                {t("activeSessions")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === "fr"
                  ? "Liste des terminaux autorisés connectés à votre compte."
                  : "List of authorized devices currently signed in to your account."}
              </p>
            </div>
            {activeSessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveSessions((prev) => prev.filter((s) => s.isCurrent));
                  setMessage(locale === "fr" ? "Toutes les autres sessions ont été révoquées." : "All other sessions revoked.");
                }}
                className="text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                {locale === "fr" ? "Déconnecter les autres appareils" : "Revoke other sessions"}
              </Button>
            )}
          </div>

          <div className="divide-y divide-[#F0EBE1]">
            {activeSessions.map((session) => (
              <div key={session.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
                    {session.icon === "laptop" ? (
                      <Laptop className="w-4 h-4 text-primary" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">
                        {session.device}
                      </span>
                      {session.isCurrent && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                          {t("currentSession")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>{session.ipAddress}</span>
                      <span>•</span>
                      <span>{session.lastActive}</span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(session.id)}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {t("revoke")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
