"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheck,
  Download,
  Filter,
  Search,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  listAuditLogsAction,
  exportAuditLogsAction,
} from "@/server/actions/audit-actions";

interface AuditClientProps {
  initialLogs: {
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentUserRole: string;
  currentUserId: string;
}

export function AuditClient({
  initialLogs,
  currentUserRole,
}: AuditClientProps) {
  const [logs, setLogs] = useState(initialLogs.items);
  const [total, setTotal] = useState(initialLogs.total);
  const [page, setPage] = useState(initialLogs.page);
  const [totalPages, setTotalPages] = useState(initialLogs.totalPages);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Details drawer state
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Transitions & loading
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPartner = currentUserRole === "PARTNER";

  const fetchLogs = (targetPage = 1) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await listAuditLogsAction({
          page: targetPage,
          pageSize: 25,
          action: actionFilter.trim() || undefined,
          entityType: entityTypeFilter || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        });
        setLogs(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors du chargement des logs.");
      }
    });
  };

  const handleExportCsv = async () => {
    if (!isPartner) return;
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const res = await exportAuditLogsAction({
        action: actionFilter.trim() || undefined,
        entityType: entityTypeFilter || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });

      // Browser download trigger
      const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de l'exportation du journal.");
    } finally {
      setIsExporting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("denied") || action.includes("failed") || action.includes("lockout")) {
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    }
    if (action.includes("export") || action.includes("accessgrant") || action.includes("delete")) {
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    }
    if (action.includes("create") || action.includes("approved")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    }
    return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-navy/5 text-navy dark:bg-navy/20 dark:text-gold">
              <ShieldCheck className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-navy dark:text-slate-100">
                Journal d'audit & Traçabilité
              </h1>
              <p className="text-sm text-muted-foreground">
                Traçabilité immuable des accès et opérations sensibles (Loi n° 2024/017 & AUD-01).
              </p>
            </div>
          </div>
        </div>

        {isPartner && (
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy/90 transition shadow-sm disabled:opacity-60"
          >
            {isExporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-gold" />
            )}
            Exporter CSV (Audité)
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer par action (ex: auth, view, export)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="">Tous les types d'entité</option>
              <option value="matter">Dossier (matter)</option>
              <option value="document">Document</option>
              <option value="party">Partie / Client</option>
              <option value="user">Utilisateur</option>
              <option value="permission">Permission</option>
              <option value="admin_access_grant">Accès Exceptionnel</option>
              <option value="incident">Incident</option>
              <option value="audit_log">Export Audit</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Date de début"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Date de fin"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              onClick={() => fetchLogs(1)}
              disabled={isPending}
              className="px-3 py-2 rounded-lg bg-navy/10 text-navy hover:bg-navy/20 dark:bg-slate-800 dark:text-slate-200 transition font-medium text-sm flex items-center justify-center shrink-0"
              title="Filtrer"
            >
              {isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Filter className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date (UTC)</th>
                <th className="px-4 py-3">Acteur</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entité</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Adresse IP</th>
                <th className="px-4 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune entrée d'audit trouvée.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/30 transition cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("fr-FR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-navy dark:text-slate-200">
                        {log.actor?.name ?? "Système"}
                      </div>
                      {log.actor?.role && (
                        <div className="text-xs text-muted-foreground">
                          {log.actor.role.nameFr ?? log.actor.role.key}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${getActionBadgeColor(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-muted-foreground">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <div className="text-xs font-mono text-slate-500 truncate max-w-[120px]">
                          {log.entityId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {log.matterId ? (
                        <span className="text-gold font-medium">
                          {log.matterId.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {log.ip ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
                        title="Voir le détail"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Total : {total} entrée(s) — Page {page} sur {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1 || isPending}
                className="px-3 py-1 rounded border border-border bg-card text-foreground disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= totalPages || isPending}
                className="px-3 py-1 rounded border border-border bg-card text-foreground disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Side Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-lg bg-card border-l border-border h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-gold" />
                  <h3 className="font-serif font-bold text-lg text-navy dark:text-slate-100">
                    Détail de l'événement d'audit
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Action
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-1 rounded text-xs font-mono font-medium border ${getActionBadgeColor(
                        selectedLog.action,
                      )}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground">
                      Horodatage
                    </label>
                    <p className="mt-1 font-mono text-xs">
                      {new Date(selectedLog.createdAt).toISOString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground">
                      Adresse IP
                    </label>
                    <p className="mt-1 font-mono text-xs">
                      {selectedLog.ip ?? "Non renseignée"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Acteur
                  </label>
                  <p className="mt-1 font-medium text-navy dark:text-slate-200">
                    {selectedLog.actor?.name ?? "Système / Automatique"}
                  </p>
                  {selectedLog.actor?.email && (
                    <p className="text-xs text-muted-foreground">
                      {selectedLog.actor.email} ({selectedLog.actor.role?.nameFr})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground">
                      Type Entité
                    </label>
                    <p className="mt-1 font-medium">{selectedLog.entityType}</p>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground">
                      ID Entité
                    </label>
                    <p className="mt-1 font-mono text-xs truncate">
                      {selectedLog.entityId ?? "—"}
                    </p>
                  </div>
                </div>

                {selectedLog.matterId && (
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground">
                      Identifiant Dossier
                    </label>
                    <p className="mt-1 font-mono text-xs text-gold">
                      {selectedLog.matterId}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Agent Utilisateur (User-Agent)
                  </label>
                  <p className="mt-1 font-mono text-xs bg-muted/40 p-2 rounded border border-border break-all">
                    {selectedLog.userAgent ?? "Non capturé"}
                  </p>
                </div>

                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Métadonnées structurées (JSON)
                  </label>
                  <pre className="mt-1 p-3 bg-muted/60 text-foreground font-mono text-xs rounded-lg border border-border overflow-x-auto max-h-60">
                    {selectedLog.metadata
                      ? JSON.stringify(selectedLog.metadata, null, 2)
                      : "Aucune métadonnée additionnelle."}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-muted text-foreground hover:bg-muted/80"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

