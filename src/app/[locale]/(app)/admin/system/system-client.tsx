"use client";

import React, { useState, useTransition } from "react";
import {
  Activity,
  Database,
  HardDrive,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Cpu,
  RefreshCw,
  Plus,
  Radio,
  FileCheck,
  RotateCcw,
  Cloud,
  CloudOff,
  UploadCloud,
  ShieldAlert,
  ShieldCheck,
  Play,
  Check,
  X,
} from "lucide-react";
import {
  getSystemOverviewAction,
  reportIncidentAction,
  resolveIncidentAction,
} from "@/server/actions/system-actions";
import { runRestoreTestSimulationAction } from "@/server/actions/backup-actions";
import {
  toggleDriveSyncFlagAction,
  grantDriveApprovalAction,
  revokeDriveApprovalAction,
  executeDriveSyncAction,
  runDriveRestoreTestAction,
  getDriveSyncOverviewAction,
} from "@/server/actions/drive-sync-actions";
import { IncidentSeverity } from "@prisma/client";

interface SystemClientProps {
  initialOverview: any;
  initialDriveOverview: any;
  currentUserRole: string;
  currentUserId: string;
}

export function SystemClient({
  initialOverview,
  initialDriveOverview,
  currentUserRole,
}: SystemClientProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [driveOverview, setDriveOverview] = useState(initialDriveOverview);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Drive sync states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [legalReviewNote, setLegalReviewNote] = useState("");
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isTestingDriveRestore, setIsTestingDriveRestore] = useState(false);

  // Report incident modal state
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>("LOW");
  const [incidentDesc, setIncidentDesc] = useState("");

  // Resolve incident modal state
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [actionsTaken, setActionsTaken] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRunRestoreTest = async () => {
    setIsRestoring(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await runRestoreTestSimulationAction();
      setSuccessMsg(`Test de restauration (REC-11) exécuté avec succès en ${res.restoreSeconds}s. Vérifié : ${res.verifiedRows.users} utilisateurs, ${res.verifiedRows.matters} dossiers.`);
      refreshOverview();
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de l'exécution du test de restauration.");
    } finally {
      setIsRestoring(false);
    }
  };

  const refreshOverview = () => {
    startTransition(async () => {
      try {
        const [data, driveData] = await Promise.all([
          getSystemOverviewAction(),
          getDriveSyncOverviewAction(),
        ]);
        setOverview(data);
        if (driveData.success && driveData.data) {
          setDriveOverview(driveData.data);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur d'actualisation du système.");
      }
    });
  };

  const handleToggleDriveFlag = async (enabled: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await toggleDriveSyncFlagAction(enabled);
      if (res.success) {
        setSuccessMsg(
          enabled
            ? "Synchronisation Drive activée avec succès."
            : "Synchronisation Drive désactivée (Air-gap étanche rétabli)."
        );
        refreshOverview();
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  const handleGrantDriveApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalReviewNote.trim()) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await grantDriveApprovalAction(legalReviewNote);
      if (res.success) {
        setShowApprovalModal(false);
        setLegalReviewNote("");
        setSuccessMsg("Autorisation formelle de transfert externe Google Drive accordée sous la loi n° 2024/017.");
        refreshOverview();
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  const handleRevokeDriveApproval = async (approvalId: string) => {
    if (!confirm("Attention : Êtes-vous sûr de vouloir révoquer l'autorisation Google Drive ? Cela coupera immédiatement toute synchronisation déportée.")) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await revokeDriveApprovalAction(approvalId);
      if (res.success) {
        setSuccessMsg("Autorisation Google Drive révoquée d'urgence. Le drapeau a été désactivé.");
        refreshOverview();
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  const handleExecuteDriveSync = async () => {
    setIsSyncingDrive(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await executeDriveSyncAction();
      if (res.success) {
        setSuccessMsg(
          `Synchronisation chiffrée vers Google Drive terminée avec succès (${res.run?.status ?? "OK"}). Emplacement : ${res.run?.location}`
        );
        refreshOverview();
      } else {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de la synchronisation déportée Drive.");
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleRunDriveRestoreTest = async () => {
    setIsTestingDriveRestore(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await runDriveRestoreTestAction();
      if (res.success) {
        setSuccessMsg(
          `Test de restauration depuis Google Drive réussi en ${res.restoreSeconds}s. Intégrité vérifiée sans altération locale.`
        );
        refreshOverview();
      } else {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec du test de restauration Drive.");
    } finally {
      setIsTestingDriveRestore(false);
    }
  };

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        await reportIncidentAction({
          title: incidentTitle,
          severity: incidentSeverity,
          description: incidentDesc,
        });
        setShowIncidentModal(false);
        setIncidentTitle("");
        setIncidentDesc("");
        setSuccessMsg("Incident consigné au registre avec succès.");
        refreshOverview();
      } catch (err: any) {
        setErrorMsg(err?.message || "Échec de l'enregistrement de l'incident.");
      }
    });
  };

  const handleResolveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingIncidentId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        await resolveIncidentAction({
          incidentId: resolvingIncidentId,
          actionsTaken,
        });
        setResolvingIncidentId(null);
        setActionsTaken("");
        setSuccessMsg("Incident résolu et clôturé avec succès.");
        refreshOverview();
      } catch (err: any) {
        setErrorMsg(err?.message || "Échec de la clôture de l'incident.");
      }
    });
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}j ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytesStr: string | null) => {
    if (!bytesStr) return "—";
    const bytes = Number(bytesStr);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const { health, backupRuns, incidents, featureFlags } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-navy/5 text-navy dark:bg-navy/20 dark:text-gold">
            <Activity className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-navy dark:text-slate-100">
              Supervision Système & Sécurité
            </h1>
            <p className="text-sm text-muted-foreground">
              État opérationnel, sauvegardes, registre d'incidents et souveraineté locale.
            </p>
          </div>
        </div>

        <button
          onClick={refreshOverview}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Actualiser l'état
        </button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Health & Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Database Health */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Base de données</span>
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-600">
              {health.database.status === "HEALTHY" ? "En ligne" : "Dégradé"}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              ({health.database.latencyMs} ms)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            PostgreSQL local (localhost:5432/lawfirm_db)
          </p>
        </div>

        {/* Local Sovereign Mode */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Souveraineté</span>
            <Shield className="h-4 w-4 text-gold" />
          </div>
          <div className="text-xl font-bold text-navy dark:text-slate-100">
            {health.compliance.mode}
          </div>
          <p className="text-xs text-muted-foreground truncate" title={health.compliance.regulation}>
            Loi Camerounaise n° 2024/017
          </p>
        </div>

        {/* Runtime & Memory */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Ressources Node</span>
            <Cpu className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono">
            {health.runtime.heapUsedMb} MB / {health.runtime.heapTotalMb} MB
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Node {health.runtime.nodeVersion} — RSS {health.runtime.rssMb} MB
          </p>
        </div>

        {/* Uptime */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Disponibilité</span>
            <Radio className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold font-mono">
            {formatUptime(health.runtime.uptimeSeconds)}
          </div>
          <p className="text-xs text-muted-foreground">
            {health.compliance.telemetry}
          </p>
        </div>
      </div>

      {/* Feature Flags / Air-gap status */}
      <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gold" />
            <h2 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
              Politique d'étanchéité & Intégrations Externes (Air-gap)
            </h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
            100% Étanchéité Active
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Conformément aux exigences de secret professionnel et à la loi camerounaise n° 2024/017,
          toute sortie réseau externe non approuvée par les associés est strictement désactivée par défaut.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {featureFlags.map((flag: any) => (
            <div
              key={flag.key}
              className="p-3.5 rounded-lg border border-border bg-background flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{flag.key}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {flag.enabled ? "ACTIVÉ" : "DÉSACTIVÉ"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {flag.description}
                </p>
              </div>
              <div className="text-[11px] text-muted-foreground italic">
                {flag.enabled ? "Approuvé" : "Verrouillé par politique"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 25: Google Drive Backup Sync Integration (Approved Exception) */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${driveOverview?.preconditions?.flagEnabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
              {driveOverview?.preconditions?.flagEnabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif font-bold text-navy dark:text-slate-100 text-base">
                  Sauvegarde Déportée Google Drive (Exception Chiffrée Approuvée)
                </h3>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${driveOverview?.preconditions?.flagEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {driveOverview?.preconditions?.flagEnabled ? "ACTIF" : "DÉSACTIVÉ"}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${driveOverview?.preconditions?.approvalActive ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                  {driveOverview?.preconditions?.approvalActive ? "APPROBATION LÉGALE ACTIVE" : "NON APPROUVÉ"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Architecture souveraine : dépôt exclusif d'archives préalablement chiffrées (Restic / GPG) vers Drive sans réplication de suppressions (ARCHITECTURE.md §9, Loi n° 2024/017).
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {currentUserRole === "PARTNER" && (
              <>
                {!driveOverview?.preconditions?.approvalActive ? (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Accorder autorisation (Loi 2024/017)
                  </button>
                ) : (
                  <button
                    onClick={() => driveOverview.preconditions.approvalId && handleRevokeDriveApproval(driveOverview.preconditions.approvalId)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 transition"
                    title="Coupe immédiatement la synchronisation et désactive le drapeau"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Révoquer l'autorisation (Killswitch)
                  </button>
                )}
              </>
            )}

            {(currentUserRole === "PARTNER" || currentUserRole === "TECHNICAL_ADMIN") && (
              <>
                {driveOverview?.preconditions?.flagEnabled ? (
                  <button
                    onClick={() => handleToggleDriveFlag(false)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
                  >
                    <CloudOff className="h-3.5 w-3.5" />
                    Couper le flux (Off switch)
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleDriveFlag(true)}
                    disabled={isPending || !driveOverview?.preconditions?.approvalActive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Activer la synchronisation
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Card Body & Overview */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Legal Status */}
            <div className="p-3.5 rounded-lg border border-border bg-background space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-navy" />
                Cadre Juridique & Approbation
              </span>
              {driveOverview?.preconditions?.approvalActive ? (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-700 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Autorisé par {driveOverview.preconditions.approvedBy ?? "un Associé"}
                  </p>
                  <p className="text-muted-foreground">
                    Le {new Date(driveOverview.preconditions.approvedAt).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-[11px] text-muted-foreground italic line-clamp-2" title={driveOverview.preconditions.legalReviewNote}>
                    Note : {driveOverview.preconditions.legalReviewNote}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Aucune autorisation active
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Loi n° 2024/017 : Un associé doit obligatoirement émettre une note juridique formelle avant toute sortie externe.
                  </p>
                </div>
              )}
            </div>

            {/* Last Sync Run */}
            <div className="p-3.5 rounded-lg border border-border bg-background space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
                Dernière Synchronisation
              </span>
              {driveOverview?.lastSync ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${driveOverview.lastSync.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {driveOverview.lastSync.status}
                    </span>
                    <span className="font-mono">{formatBytes(driveOverview.lastSync.sizeBytes)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {new Date(driveOverview.lastSync.startedAt).toLocaleString("fr-FR")}
                  </p>
                  {driveOverview.lastSync.errorDetails && (
                    <p className="text-rose-600 text-[11px] truncate" title={driveOverview.lastSync.errorDetails}>
                      Erreur : {driveOverview.lastSync.errorDetails}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune synchronisation déportée enregistrée.</p>
              )}
            </div>

            {/* Restore Test Status */}
            <div className="p-3.5 rounded-lg border border-border bg-background space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
                Test de Restauration Drive
              </span>
              {driveOverview?.lastRestoreTest ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                      RTO {driveOverview.lastRestoreTest.restoreSeconds}s
                    </span>
                    <span className="text-emerald-700 font-semibold">Vérifié</span>
                  </div>
                  <p className="text-muted-foreground">
                    {new Date(driveOverview.lastRestoreTest.startedAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun test de restauration déporté effectué.</p>
              )}
            </div>
          </div>

          {/* Action trigger bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Règle REC-18 : En cas d'échec ou d'interruption réseau, la relance est idempotente sans créer de doublons.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunDriveRestoreTest}
                disabled={isPending || isTestingDriveRestore || !driveOverview?.preconditions?.flagEnabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isTestingDriveRestore ? "animate-spin" : ""}`} />
                {isTestingDriveRestore ? "Test en cours..." : "Tester la restauration Drive"}
              </button>
              <button
                onClick={handleExecuteDriveSync}
                disabled={isPending || isSyncingDrive || !driveOverview?.preconditions?.flagEnabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition shadow-xs disabled:opacity-50"
              >
                <UploadCloud className={`h-3.5 w-3.5 ${isSyncingDrive ? "animate-spin" : ""}`} />
                {isSyncingDrive ? "Synchronisation en cours..." : "Lancer la synchronisation déportée"}
              </button>
            </div>
          </div>

          {/* Recent Sync Runs Table */}
          {driveOverview?.recentSyncRuns && driveOverview.recentSyncRuns.length > 0 && (
            <div className="mt-3 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
                Historique des transferts déportés (REC-18)
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/20 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Taille</th>
                    <th className="px-3 py-2">Emplacement</th>
                    <th className="px-3 py-2">Détails / Erreurs</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {driveOverview.recentSyncRuns.map((r: any) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{formatBytes(r.sizeBytes)}</td>
                      <td className="px-3 py-2 truncate max-w-xs text-muted-foreground">{r.location ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{r.errorDetails ?? "Archive chiffrée vérifiée"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {r.status === "FAILED" && (
                          <button
                            onClick={handleExecuteDriveSync}
                            disabled={isPending || isSyncingDrive}
                            className="text-[11px] text-blue-600 hover:underline font-medium"
                          >
                            Relancer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Backups Register */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-gold" />
            <h3 className="font-serif font-bold text-navy dark:text-slate-100">
              Registre des Sauvegardes & Tests de Restauration
            </h3>
          </div>

          {(currentUserRole === "PARTNER" || currentUserRole === "TECHNICAL_ADMIN") && (
            <button
              onClick={handleRunRestoreTest}
              disabled={isPending || isRestoring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition shadow-xs disabled:opacity-60"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRestoring ? "animate-spin" : ""}`} />
              {isRestoring ? "Test en cours..." : "Tester la restauration (REC-11)"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Taille</th>
                <th className="px-4 py-3">Restauration testée</th>
                <th className="px-4 py-3">Emplacement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {backupRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune sauvegarde enregistrée dans le journal (voir scripts ops/backup.sh à l'étape 20).
                  </td>
                </tr>
              ) : (
                backupRuns.map((b: any) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {new Date(b.startedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-xs">
                      {b.kind}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {b.restoreSeconds ? `${b.restoreSeconds}s` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs">
                      {b.location ?? "Local encrypté"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Incidents Register */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-serif font-bold text-navy dark:text-slate-100">
              Registre des Incidents de Sécurité
            </h3>
          </div>

          <button
            onClick={() => setShowIncidentModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Déclarer un incident
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Gravité</th>
                <th className="px-4 py-3">Titre de l'incident</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Déclaré par</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun incident de sécurité enregistré.
                  </td>
                </tr>
              ) : (
                incidents.map((inc: any) => (
                  <tr key={inc.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {new Date(inc.detectedAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          inc.severity === "CRITICAL"
                            ? "bg-rose-100 text-rose-800"
                            : inc.severity === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy dark:text-slate-200">
                        {inc.title}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {inc.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          inc.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {inc.reportedBy?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {inc.status !== "CLOSED" && (
                        <button
                          onClick={() => setResolvingIncidentId(inc.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        >
                          Clore
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Incident Modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
              Déclaration d'un incident de sécurité
            </h3>
            <form onSubmit={handleReportIncident} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Titre de l'incident *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Détection de requêtes anormales sur le port 5432"
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Niveau de gravité *
                </label>
                <select
                  value={incidentSeverity}
                  onChange={(e) => setIncidentSeverity(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg"
                >
                  <option value="LOW">Faible (LOW)</option>
                  <option value="MEDIUM">Moyen (MEDIUM)</option>
                  <option value="HIGH">Élevé (HIGH)</option>
                  <option value="CRITICAL">Critique (CRITICAL)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Description & Circonstances *
                </label>
                <textarea
                  required
                  rows={4}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Détails techniques constatés, dates, hôtes affectés..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy/90"
                >
                  Consigner l'incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {resolvingIncidentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
              Clôture de l'incident
            </h3>
            <form onSubmit={handleResolveIncident} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Actions correctives & mesures prises *
                </label>
                <textarea
                  required
                  rows={4}
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  placeholder="Décrivez les mesures de confinement et de résolution appliquées..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setResolvingIncidentId(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Valider la clôture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drive Legal Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h3 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
                Autorisation de Transfert Externe (Google Drive)
              </h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Conformément à la Loi Camerounaise n° 2024/017 régissant la cybersécurité et la protection des données à caractère personnel, l'exportation de données chiffrées vers un hébergeur tiers exige une revue légale préalable et la validation expresse d'un associé.
            </p>

            <form onSubmit={handleGrantDriveApproval} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Note d'analyse de conformité juridique & motivation *
                </label>
                <textarea
                  required
                  rows={4}
                  value={legalReviewNote}
                  onChange={(e) => setLegalReviewNote(e.target.value)}
                  placeholder="Ex : Examen de conformité sous la Loi 2024/017 réalisé le 12/11/2026. Chiffrement Restic AES-256 de bout en bout avant transfert, clés conservées en local..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending || !legalReviewNote.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Valider et signer l'autorisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

