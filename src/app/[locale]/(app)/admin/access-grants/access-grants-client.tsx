"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  KeyRound,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  ShieldAlert,
  RefreshCw,
  UserCheck,
  FileText,
} from "lucide-react";
import {
  requestAccessGrantAction,
  approveAccessGrantAction,
  revokeAccessGrantAction,
  listAccessGrantsAction,
} from "@/server/actions/access-grant-actions";

interface AccessGrantsClientProps {
  initialGrants: any[];
  matters: { id: string; reference: string; title: string }[];
  currentUserRole: string;
  currentUserId: string;
}

export function AccessGrantsClient({
  initialGrants,
  matters,
  currentUserRole,
  currentUserId,
}: AccessGrantsClientProps) {
  const [grants, setGrants] = useState(initialGrants);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval duration state (map grantId -> durationMinutes)
  const [approvalDurations, setApprovalDurations] = useState<Record<string, number>>({});

  const isPartner = currentUserRole === "PARTNER";
  const isTadmin = currentUserRole === "TECHNICAL_ADMIN";

  // Countdown timer refresh every second for active grants
  useEffect(() => {
    const timer = setInterval(() => {
      setGrants((prevGrants) =>
        prevGrants.map((g) => {
          if (g.computedStatus === "ACTIVE" && g.expiresAt) {
            const rem = Math.max(
              0,
              Math.floor((new Date(g.expiresAt).getTime() - Date.now()) / 1000),
            );
            return {
              ...g,
              remainingSeconds: rem,
              computedStatus: rem <= 0 ? "EXPIRED" : "ACTIVE",
            };
          }
          return g;
        }),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const refreshGrants = () => {
    startTransition(async () => {
      try {
        const updated = await listAccessGrantsAction({
          status: filterStatus as any,
        });
        setGrants(updated);
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur de chargement des accès.");
      }
    });
  };

  const handleRequestGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId || !requestReason.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await requestAccessGrantAction({
        matterId: selectedMatterId,
        reason: requestReason.trim(),
      });
      setShowRequestModal(false);
      setRequestReason("");
      setSelectedMatterId("");
      setSuccessMsg("Demande d'accès exceptionnel transmise aux associés avec succès.");
      refreshGrants();
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de la soumission de la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (grantId: string) => {
    const duration = approvalDurations[grantId] || 30;
    startTransition(async () => {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        await approveAccessGrantAction({
          grantId,
          durationMinutes: duration,
        });
        setSuccessMsg(`Accès exceptionnel accordé pour ${duration} minutes.`);
        refreshGrants();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de l'approbation.");
      }
    });
  };

  const handleRevoke = async (grantId: string) => {
    if (!confirm("Êtes-vous certain de vouloir révoquer cet accès immédiatement ?")) {
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        await revokeAccessGrantAction({
          grantId,
          reason: "Révocation anticipée manuelle",
        });
        setSuccessMsg("Accès exceptionnel révoqué avec succès.");
        refreshGrants();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de la révocation.");
      }
    });
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const activeGrants = grants.filter((g) => g.computedStatus === "ACTIVE");
  const pendingGrants = grants.filter((g) => g.computedStatus === "PENDING");
  const pastGrants = grants.filter(
    (g) => g.computedStatus === "EXPIRED" || g.computedStatus === "REVOKED",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-navy/5 text-navy dark:bg-navy/20 dark:text-gold">
            <KeyRound className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-navy dark:text-slate-100">
              Accès Exceptionnels d'Administration
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestion stricte des autorisations temporaires accordées aux administrateurs (SPECIFICATIONS ADM).
            </p>
          </div>
        </div>

        {isTadmin && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition shadow-sm"
          >
            <Plus className="h-4 w-4 text-gold" />
            Demander un accès exceptionnel
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Grants Banner */}
      {activeGrants.length > 0 && (
        <div className="p-5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
            <Clock className="h-5 w-5 animate-pulse text-amber-600" />
            <span>ACCÈS EXCEPTIONNEL ACTIF EN COURS (COMPTE À REBOURS EN TEMPS RÉEL)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeGrants.map((ag) => (
              <div
                key={ag.id}
                className="p-4 rounded-lg bg-card border border-amber-300 dark:border-amber-800 shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-navy dark:text-slate-100">
                      {ag.matter?.reference}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-semibold">
                      {formatCountdown(ag.remainingSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Administrateur : {ag.admin?.name} — Approuvé par : {ag.approvedBy?.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5">
                    "{ag.reason}"
                  </p>
                </div>

                <button
                  onClick={() => handleRevoke(ag.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
                >
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Approval Requests (Partners view) */}
      {pendingGrants.length > 0 && (
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy dark:text-slate-100 font-serif font-bold text-lg">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h2>Demandes en attente d'approbation d'un Associé</h2>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
              {pendingGrants.length} en attente
            </span>
          </div>

          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {pendingGrants.map((pg) => (
              <div key={pg.id} className="p-4 bg-background flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy dark:text-slate-200">
                      {pg.matter?.reference}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — {pg.matter?.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-medium text-muted-foreground">Demandeur :</span>{" "}
                    {pg.admin?.name} ({pg.admin?.email})
                  </p>
                  <p className="text-xs bg-muted/40 p-2 rounded border border-border italic text-slate-600 dark:text-slate-400">
                    Motif : "{pg.reason}"
                  </p>
                </div>

                {isPartner ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={approvalDurations[pg.id] || 30}
                      onChange={(e) =>
                        setApprovalDurations((prev) => ({
                          ...prev,
                          [pg.id]: Number(e.target.value),
                        }))
                      }
                      className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 heure</option>
                      <option value={120}>2 heures</option>
                    </select>

                    <button
                      onClick={() => handleApprove(pg.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approuver
                    </button>

                    <button
                      onClick={() => handleRevoke(pg.id)}
                      disabled={isPending}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                    >
                      Rejeter
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-amber-600 italic">
                    En attente de validation par un Associé
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Grants List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-serif font-bold text-navy dark:text-slate-100">
            Historique des accès exceptionnels
          </h3>
          <button
            onClick={refreshGrants}
            disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Administrateur</th>
                <th className="px-4 py-3">Validateur</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Validité</th>
                <th className="px-4 py-3">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune demande d'accès exceptionnel enregistrée.
                  </td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr key={g.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {new Date(g.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-navy dark:text-slate-200">
                      {g.matter?.reference}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {g.admin?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {g.approvedBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          g.computedStatus === "ACTIVE"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : g.computedStatus === "PENDING"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : g.computedStatus === "REVOKED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {g.computedStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-muted-foreground">
                      {g.expiresAt
                        ? new Date(g.expiresAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs">
                      {g.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-gold" />
                <h3 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
                  Demande d'accès exceptionnel
                </h3>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestGrant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Dossier cible concerné *
                </label>
                <select
                  required
                  value={selectedMatterId}
                  onChange={(e) => setSelectedMatterId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <option value="">Sélectionner un dossier...</option>
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.reference} — {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Justification impérative & détaillée *
                </label>
                <textarea
                  required
                  rows={4}
                  minLength={10}
                  placeholder="Expliquez la nécessité technique ou réglementaire de l'accès..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ce motif sera consigné de façon permanente dans le journal d'audit immuable.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition shadow-sm disabled:opacity-60"
                >
                  {isSubmitting ? "Envoi..." : "Soumettre aux Associés"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

