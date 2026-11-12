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
} from "lucide-react";
import {
  getSystemOverviewAction,
  reportIncidentAction,
  resolveIncidentAction,
} from "@/server/actions/system-actions";
import { runRestoreTestSimulationAction } from "@/server/actions/backup-actions";
import { IncidentSeverity } from "@prisma/client";

interface SystemClientProps {
  initialOverview: any;
  currentUserRole: string;
  currentUserId: string;
}

export function SystemClient({
  initialOverview,
  currentUserRole,
}: SystemClientProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        const data = await getSystemOverviewAction();
        setOverview(data);
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur d'actualisation du système.");
      }
    });
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
    </div>
  );
}

