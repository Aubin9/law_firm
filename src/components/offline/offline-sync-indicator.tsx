"use client";

import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  pullOfflineSnapshotAction,
  pushOfflineMutationsAction,
} from "@/server/actions/sync-actions";
import {
  checkDeviceRevokedAction,
} from "@/server/actions/device-actions";
import {
  vaultSet,
  vaultGet,
  clearOfflineVault,
} from "@/lib/offline/encrypted-vault";

export function OfflineSyncIndicator({ locale }: { locale: "fr" | "en" }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [conflictItem, setConflictItem] = useState<any | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const getVaultSecret = () => {
    let secret = localStorage.getItem("cabinet_vault_secret");
    if (!secret) {
      secret = "vault_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("cabinet_vault_secret", secret);
    }
    return secret;
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    const savedLastSync = localStorage.getItem("lawfirm_offline_synced_at");
    if (savedLastSync) {
      setLastSynced(new Date(savedLastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    // Check device revocation
    const devId = localStorage.getItem("cabinet_device_id");
    if (devId) {
      checkDeviceRevokedAction(devId).then((res) => {
        if (res.success && res.revoked) {
          clearOfflineVault().then(() => {
            window.location.href = `/${locale}/login?revoked=1`;
          });
        }
      });
    }

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, [locale]);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const secret = getVaultSecret();

      // 1. Check if there are queued mutations to push
      const queuedMutations = (await vaultGet<any[]>("mutation_queue", secret)) || [];
      if (queuedMutations.length > 0) {
        const pushRes = await pushOfflineMutationsAction(queuedMutations);
        if (pushRes.success) {
          const conflicts = pushRes.results.filter((r) => r.status === "CONFLICT");
          if (conflicts.length > 0) {
            setConflictItem(conflicts[0]);
            setIsSyncing(false);
            return;
          }
          // Clear queue if all merged
          await vaultSet("mutation_queue", [], secret);
        }
      }

      // 2. Pull fresh snapshot of assigned matters & upcoming hearings
      const pullRes = await pullOfflineSnapshotAction();
      if (pullRes.success && pullRes.snapshot) {
        await vaultSet("offline_snapshot", pullRes.snapshot, secret);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        localStorage.setItem("lawfirm_offline_synced_at", new Date().toISOString());
        setLastSynced(timeStr);
        setSyncStatusMsg(locale === "fr" ? "Coffre synchronisé" : "Vault synced");
        setTimeout(() => setSyncStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error("[OfflineSync] Error during sync:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResolveConflict = async (resolution: "OVERWRITE" | "DISCARD") => {
    if (!conflictItem) return;
    const secret = getVaultSecret();
    const queuedMutations = (await vaultGet<any[]>("mutation_queue", secret)) || [];

    if (resolution === "OVERWRITE") {
      // Re-push with forceOverwrite: true
      const targetMut = queuedMutations.find((m) => m.id === conflictItem.id);
      if (targetMut) {
        targetMut.forceOverwrite = true;
        await pushOfflineMutationsAction([targetMut]);
      }
    }

    // Remove from queue
    const remaining = queuedMutations.filter((m) => m.id !== conflictItem.id);
    await vaultSet("mutation_queue", remaining, secret);
    setConflictItem(null);
    handleSync();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>{locale === "fr" ? "En ligne" : "Online"}</span>
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <WifiOff className="w-3 h-3 text-amber-600" />
            <span>{locale === "fr" ? "Hors-ligne chiffré" : "Encrypted Offline"}</span>
          </Badge>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={!isOnline || isSyncing}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          title={
            lastSynced
              ? locale === "fr"
                ? `Dernière synchronisation à ${lastSynced}`
                : `Last synced at ${lastSynced}`
              : locale === "fr"
              ? "Synchroniser le coffre"
              : "Sync offline vault"
          }
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
          {syncStatusMsg ? (
            <span className="ml-1 text-[11px] text-emerald-600 font-medium">{syncStatusMsg}</span>
          ) : lastSynced ? (
            <span className="ml-1 hidden md:inline text-[11px]">{lastSynced}</span>
          ) : null}
        </Button>
      </div>

      {/* CONFLICT RESOLUTION MODAL (409 Conflict) */}
      {conflictItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl space-y-4 dark:bg-card border border-border">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">
                  {locale === "fr"
                    ? "Conflit de synchronisation détecté (409 Conflict)"
                    : "Synchronization Conflict Detected (409 Conflict)"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === "fr"
                    ? "Cette tâche a été modifiée sur le serveur pendant que vous travailliez hors-ligne. Aucun écrasement silencieux n'est autorisé."
                    : "This item was modified on the server while you were working offline. Silent overwrites are forbidden."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-lg border border-border">
              {/* Server version */}
              <div className="space-y-1 border-r border-border pr-2">
                <span className="font-semibold text-primary block">
                  {locale === "fr" ? "Version actuelle (Serveur) :" : "Current Version (Server):"}
                </span>
                <p className="text-foreground font-medium">{conflictItem.serverData?.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  Statut : {conflictItem.serverData?.status}
                </Badge>
              </div>

              {/* Client offline version */}
              <div className="space-y-1 pl-2">
                <span className="font-semibold text-amber-700 block">
                  {locale === "fr" ? "Votre version locale (Hors-ligne) :" : "Your Local Version (Offline):"}
                </span>
                <p className="text-foreground font-medium">{conflictItem.clientData?.title || conflictItem.serverData?.title}</p>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                  Statut : {conflictItem.clientData?.status || "Inchangé"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResolveConflict("DISCARD")}
                className="text-xs text-muted-foreground"
              >
                {locale === "fr" ? "Garder la version serveur (abandonner la mienne)" : "Keep server version (discard mine)"}
              </Button>
              <Button
                size="sm"
                onClick={() => handleResolveConflict("OVERWRITE")}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {locale === "fr" ? "Écraser la version serveur avec la mienne" : "Overwrite server with mine"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
