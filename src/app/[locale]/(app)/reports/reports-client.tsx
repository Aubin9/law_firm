"use client";

import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Briefcase,
  Users,
  CheckSquare,
  Calendar,
  AlertTriangle,
  Gavel,
  ShieldCheck,
  TrendingUp,
  Clock,
  PieChart,
} from "lucide-react";

interface HearingItem {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  location: string | null;
  matterReference: string | null;
  matterTitle: string | null;
}

interface LawyerWorkloadItem {
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  activeLeadMatters: number;
  activeMemberMatters: number;
  pendingTasks: number;
  overdueTasks: number;
  upcomingHearings: number;
  capacityLevel: "LOW" | "NORMAL" | "HIGH" | "OVERLOADED";
  score: number;
}

interface ReportsClientProps {
  totalMatters: number;
  categoryDistribution: Array<{ name: string; count: number }>;
  totalParties: number;
  companyParties: number;
  individualParties: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  upcomingHearings: HearingItem[];
  lawyerWorkloads?: LawyerWorkloadItem[];
  locale: "fr" | "en";
  currentUserRole: string;
}

export function ReportsClient({
  totalMatters,
  categoryDistribution,
  totalParties,
  companyParties,
  individualParties,
  totalTasks,
  doneTasks,
  overdueTasks,
  upcomingHearings,
  lawyerWorkloads = [],
  locale,
  currentUserRole,
}: ReportsClientProps) {
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Indicateurs & Pilotage du Cabinet" : "Firm Analytics & Metrics"}
        description={
          locale === "fr"
            ? "Tableau de bord de performance opérationnelle, répartition du portefeuille et suivi des audiences."
            : "Operational performance dashboard, practice breakdown, and critical hearing schedules."
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Dossiers Actifs" : "Active Matters"}
            </span>
            <div className="p-2 rounded-lg bg-navy/5 text-primary">
              <Briefcase className="h-4 w-4 text-gold" />
            </div>
          </div>
          <div className="text-2xl font-bold font-serif text-foreground">
            {totalMatters}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {locale === "fr" ? "Portefeuille global accessible" : "Total accessible cases"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Annuaire Parties" : "Client Directory"}
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-serif text-foreground">
            {totalParties}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {companyParties} {locale === "fr" ? "entreprises" : "companies"} · {individualParties} {locale === "fr" ? "personnes" : "individuals"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Taux d'Achèvement Tâches" : "Task Completion Rate"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-serif text-emerald-700 dark:text-emerald-400">
            {taskCompletionRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {doneTasks} / {totalTasks} {locale === "fr" ? "tâches finalisées" : "tasks completed"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Diligences en Retard" : "Overdue Tasks"}
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-serif text-rose-700 dark:text-rose-400">
            {overdueTasks}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {overdueTasks > 0
              ? (locale === "fr" ? "Attention requise" : "Action required")
              : (locale === "fr" ? "Toutes les tâches à jour" : "All tasks on schedule")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold font-serif text-base text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-gold" />
              {locale === "fr" ? "Répartition des Dossiers par Spécialité" : "Matters by Practice Area"}
            </h3>
            <span className="text-xs font-mono text-muted-foreground font-semibold">
              {categoryDistribution.reduce((s, c) => s + c.count, 0)} {locale === "fr" ? "dossiers" : "matters"}
            </span>
          </div>

          <div className="space-y-3">
            {categoryDistribution.map((cat) => {
              const total = Math.max(1, totalMatters);
              const pct = Math.round((cat.count / total) * 100);

              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{cat.name}</span>
                    <span className="font-mono text-muted-foreground font-semibold">
                      {cat.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {categoryDistribution.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Aucune donnée disponible" : "No data available"}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Court Hearings Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold font-serif text-base text-foreground flex items-center gap-2">
              <Gavel className="h-4 w-4 text-gold" />
              {locale === "fr" ? "Prochaines Audiences & Échéances" : "Upcoming Court Hearings"}
            </h3>
            <Link
              href={`/${locale}/calendar`}
              className="text-xs text-primary font-semibold hover:underline"
            >
              {locale === "fr" ? "Voir le calendrier →" : "View calendar →"}
            </Link>
          </div>

          <div className="space-y-3">
            {upcomingHearings.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-lg border border-border/80 bg-surface flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                    {h.title}
                    <Badge variant="outline" className="text-[10px] bg-muted/30">
                      {h.type}
                    </Badge>
                  </div>
                  {h.matterReference && (
                    <div className="text-[11px] font-mono text-primary font-semibold mt-0.5">
                      {h.matterReference} · {h.matterTitle}
                    </div>
                  )}
                  {h.location && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      📍 {h.location}
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs font-bold text-foreground">
                    {new Date(h.startsAt).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {new Date(h.startsAt).toLocaleTimeString(locale === "en" ? "en-US" : "fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}

            {upcomingHearings.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Aucune audience planifiée prochainement." : "No upcoming hearings scheduled."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Workload & Operational Capacity Section (LEG-10 / MOD-16) */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold font-serif text-base text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              {locale === "fr" ? "Charge de Travail & Capacité Opérationnelle de l'Équipe" : "Team Workload & Capacity"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "fr"
                ? "Suivi du volume de dossiers actifs, tâches en souffrance et audiences par avocat (LEG-10)."
                : "Active matters, pending deadlines and capacity index per lawyer."}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{locale === "fr" ? "Avocat / Juriste" : "Lawyer"}</th>
                <th className="px-4 py-3">{locale === "fr" ? "Rôle" : "Role"}</th>
                <th className="px-4 py-3 text-center">{locale === "fr" ? "Dossiers Lead" : "Lead Matters"}</th>
                <th className="px-4 py-3 text-center">{locale === "fr" ? "Dossiers Membre" : "Member"}</th>
                <th className="px-4 py-3 text-center">{locale === "fr" ? "Tâches en cours" : "Pending Tasks"}</th>
                <th className="px-4 py-3 text-center">{locale === "fr" ? "En retard" : "Overdue"}</th>
                <th className="px-4 py-3 text-center">{locale === "fr" ? "Audiences (14j)" : "Hearings"}</th>
                <th className="px-4 py-3 text-right">{locale === "fr" ? "Capacité" : "Capacity"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lawyerWorkloads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    {locale === "fr" ? "Aucune donnée de charge disponible." : "No workload data available."}
                  </td>
                </tr>
              ) : (
                lawyerWorkloads.map((w) => {
                  const capacityBadge = {
                    LOW: {
                      label: locale === "fr" ? "Disponible" : "Available",
                      className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                    },
                    NORMAL: {
                      label: locale === "fr" ? "Optimale" : "Optimal",
                      className: "bg-blue-500/10 text-blue-700 border-blue-500/30",
                    },
                    HIGH: {
                      label: locale === "fr" ? "Élevée" : "High",
                      className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
                    },
                    OVERLOADED: {
                      label: locale === "fr" ? "Surchargé" : "Overloaded",
                      className: "bg-rose-500/10 text-rose-700 border-rose-500/30 font-bold",
                    },
                  }[w.capacityLevel];

                  return (
                    <tr key={w.userId} className="hover:bg-muted/30 transition text-xs">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div>{w.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{w.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {w.roleKey}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                        {w.activeLeadMatters}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {w.activeMemberMatters}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-foreground">
                        {w.pendingTasks}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {w.overdueTasks > 0 ? (
                          <span className="text-destructive font-bold">{w.overdueTasks}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-foreground">
                        {w.upcomingHearings}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className={`text-[10px] ${capacityBadge.className}`}>
                          {capacityBadge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

