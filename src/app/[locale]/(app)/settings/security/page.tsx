"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Laptop,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  listMyDevicesAction,
  revokeDeviceAction,
  registerDeviceAction,
} from "@/server/actions/device-actions";

interface DeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  lastIp: string;
  lastSeenAt: string | Date;
  isTrusted: boolean;
  revokedAt: string | Date | null;
}

export default function SecuritySettingsPage() {
  const t = useTranslations("auth.security");
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load or generate stable deviceId for this browser/PWA
  useEffect(() => {
    let localId = localStorage.getItem("cabinet_device_id");
    if (!localId) {
      localId = "dev_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem("cabinet_device_id", localId);
    }
    setCurrentDeviceId(localId);

    // Detect friendly name
    const ua = navigator.userAgent;
    let name = "Navigateur Web";
    if (/iPhone|iPad|iPod/i.test(ua)) name = "iPhone / iPad (PWA)";
    else if (/Android/i.test(ua)) name = "Terminal Android (PWA)";
    else if (/Macintosh/i.test(ua)) name = "Mac (Bureau)";
    else if (/Windows/i.test(ua)) name = "Windows (Poste Cabinet)";
    else if (/Linux/i.test(ua)) name = "Linux Workstation";

    // Register / heartbeat current device
    registerDeviceAction({ deviceId: localId, deviceName: name }).then(() => {
      loadDevices();
    });
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    const res = await listMyDevicesAction();
    if (res.success && res.devices) {
      setDevices(res.devices as any);
    } else {
      setError(res.error || "Impossible de charger les appareils.");
    }
    setLoading(false);
  };

  const handleRevoke = (devId: string) => {
    if (!confirm(locale === "fr" ? "Voulez-vous vraiment révoquer cet appareil ? Il sera déconnecté immédiatement." : "Are you sure you want to revoke this device? It will be disconnected immediately.")) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await revokeDeviceAction(devId);
      if (res.success) {
        setMessage(locale === "fr" ? "Appareil révoqué avec succès." : "Device revoked successfully.");
        loadDevices();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setError(res.error || "Erreur lors de la révocation.");
      }
    });
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

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-900 font-medium">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          {error}
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
                  ? "La double authentification (TOTP) protège l'accès à vos dossiers confidentiels conformément au secret professionnel et à la loi camerounaise n° 2024/017."
                  : "Two-Factor Authentication (TOTP) protects confidential client files in compliance with legal privilege and Cameroon Law No. 2024/017."}
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
            onClick={() => (window.location.href = `/${locale}/2fa/setup`)}
            className="text-xs border-[#E5E0D8] text-primary"
          >
            {locale === "fr" ? "Reconfigurer" : "Reconfigure"}
          </Button>
        </div>
      </div>

      {/* Authorized Devices / PWA Management */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-primary">
              {locale === "fr" ? "Appareils mobiles & terminaux autorisés" : "Authorized Mobile & Desktop Devices"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "fr"
                ? "Contrôle souverain des smartphones de palais et ordinateurs connectés à votre compte."
                : "Sovereign control of courtroom smartphones and workstations connected to your account."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDevices}
            disabled={loading || isPending}
            className="text-xs border-[#E5E0D8]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {locale === "fr" ? "Actualiser" : "Refresh"}
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {locale === "fr" ? "Aucun appareil enregistré pour le moment." : "No devices registered yet."}
          </div>
        ) : (
          <div className="divide-y divide-[#F0EBE1]">
            {devices.map((device) => {
              const isCurrent = device.deviceId === currentDeviceId;
              const isRevoked = !!device.revokedAt;
              const isMobile = /mobile|iphone|android|ipad/i.test(device.deviceName + device.userAgent);

              return (
                <div key={device.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
                      {isMobile ? (
                        <Smartphone className="w-4 h-4 text-primary" />
                      ) : (
                        <Laptop className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">
                          {device.deviceName}
                        </span>
                        {isCurrent && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                            {locale === "fr" ? "Cet appareil" : "This device"}
                          </Badge>
                        )}
                        {isRevoked ? (
                          <Badge variant="danger" className="text-[10px] font-semibold">
                            {locale === "fr" ? "Révoqué" : "Revoked"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            {locale === "fr" ? "Actif & de confiance" : "Active & Trusted"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                        <span>IP : {device.lastIp}</span>
                        <span>•</span>
                        <span>
                          {locale === "fr" ? "Vu le " : "Last seen "}
                          {new Date(device.lastSeenAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(device.deviceId)}
                      disabled={isPending}
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {locale === "fr" ? "Révoquer" : "Revoke"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
