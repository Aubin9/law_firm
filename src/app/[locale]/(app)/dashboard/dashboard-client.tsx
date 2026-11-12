"use client";

import React from "react";
import Link from "next/link";
import {
  Gavel,
  Clock,
  CheckSquare,
  Briefcase,
  Plus,
  Calendar,
  AlertTriangle,
  User,
  Users,
  ShieldAlert,
  Scale,
  CalendarDays,
  FileText,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardData } from "@/server/services/dashboard-service";

interface DashboardClientProps {
  data: DashboardData;
  locale: "fr" | "en";
}

export function DashboardClient({ data, locale }: DashboardClientProps) {
  const { user, attention, roleData } = data;

  const todayStr = new Date().toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isPartner = user.roleKey === "PARTNER";
  const isLead = user.roleKey === "LEAD_LAWYER";
  const isAssociate = user.roleKey === "ASSOCIATE_LAWYER";
  const isSecretary = user.roleKey === "SECRETARY";
  const isAccountant = user.roleKey === "ACCOUNTANT";

  return (
    <div className="space-y-6">
      {/* Page Header Strip (DESIGN.md 8.2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#1F2A44]">
            {locale === "en" ? `Good morning, ${user.name}` : `Bonjour, ${user.name}`}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 capitalize">
            {todayStr} · {user.roleKey} · Africa/Douala
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href={`/${locale}/calendar`}>
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-[#B08D57]" />
              {locale === "en" ? "Calendar" : "Calendrier"}
            </Link>
          </Button>

          <Button asChild size="sm" className="bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-white text-xs">
            <Link href={`/${locale}/matters`}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {locale === "en" ? "Open Matter" : "Ouvrir un dossier"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Needs Your Attention Strip (DESIGN.md 8.2) */}
      <section aria-labelledby="attention-heading">
        <h2
          id="attention-heading"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          {locale === "en" ? "Needs your attention now" : "Requiert votre attention immédiate"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overdue tasks */}
          <Link
            href={`/${locale}/matters`}
            className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs hover:border-rose-400 hover:shadow-sm transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-900">
                {locale === "en" ? "Overdue Tasks" : "Tâches en retard"}
              </span>
              <Clock className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-rose-700 tabular-nums">
              {attention.overdueTasksCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {attention.overdueTasksCount === 0
                ? (locale === "en" ? "No overdue tasks" : "Aucun retard enregistré")
                : (locale === "en" ? "Action required" : "Diligence requise")}
            </p>
          </Link>

          {/* Items to validate */}
          <Link
            href={`/${locale}/matters`}
            className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">
                {locale === "en" ? "Items to Validate" : "Éléments à valider"}
              </span>
              <CheckSquare className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-amber-800 tabular-nums">
              {attention.itemsToValidateCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Tasks & Procedural deadlines" : "Tâches et délais procéduraux"}
            </p>
          </Link>

          {/* Deadlines next 7 days */}
          <Link
            href={`/${locale}/calendar`}
            className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900">
                {locale === "en" ? "Deadlines (Next 7 Days)" : "Échéances (7 prochains jours)"}
              </span>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-blue-800 tabular-nums">
              {attention.deadlinesNext7DaysCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Upcoming legal deadlines" : "Délais légaux imminents"}
            </p>
          </Link>

          {/* Hearings today */}
          <Link
            href={`/${locale}/calendar`}
            className="rounded-xl border border-[#1F2A44]/20 bg-slate-50 p-4 shadow-xs hover:border-[#1F2A44]/40 hover:shadow-sm transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F2A44]">
                {locale === "en" ? "Hearings Today" : "Audiences aujourd'hui"}
              </span>
              <Gavel className="h-4 w-4 text-[#B08D57]" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-[#1F2A44] tabular-nums">
              {attention.hearingsTodayCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Scheduled in courts" : "Programmées en juridiction"}
            </p>
          </Link>
        </div>
      </section>

      {/* Role-Specific Cards Grid (DESIGN.md 8.2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Hearings & Tasks / Firm Metrics */}
        <div className="space-y-6 lg:col-span-2">
          {/* Managing Partner Indicators */}
          {isPartner && roleData.firmMetrics && (
            <div className="rounded-xl border bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm font-serif text-[#1F2A44] flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[#B08D57]" />
                  {locale === "en" ? "Firm-Wide Overview (Partner)" : "Pilotage consolidé du cabinet (Associé)"}
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-muted/20 rounded-lg border">
                  <span className="text-xs text-muted-foreground block">
                    {locale === "en" ? "Active Matters" : "Dossiers actifs"}
                  </span>
                  <span className="font-mono text-2xl font-bold text-[#1F2A44]">
                    {roleData.firmMetrics.activeMattersCount}
                  </span>
                </div>

                <div className="p-3 bg-muted/20 rounded-lg border">
                  <span className="text-xs text-muted-foreground block">
                    {locale === "en" ? "Upcoming Hearings" : "Audiences à venir"}
                  </span>
                  <span className="font-mono text-2xl font-bold text-[#B08D57]">
                    {roleData.firmMetrics.upcomingHearingsCount}
                  </span>
                </div>

                <div className="p-3 bg-muted/20 rounded-lg border">
                  <span className="text-xs text-muted-foreground block">
                    {locale === "en" ? "Overdue Tasks" : "Tâches en retard"}
                  </span>
                  <span className="font-mono text-2xl font-bold text-rose-600">
                    {roleData.firmMetrics.overdueTasksCount}
                  </span>
                </div>

                <div className="p-3 bg-muted/20 rounded-lg border">
                  <span className="text-xs text-muted-foreground block">
                    {locale === "en" ? "Pending Conflicts" : "Conflits en attente"}
                  </span>
                  <span className="font-mono text-2xl font-bold text-amber-700">
                    {roleData.firmMetrics.pendingConflictChecksCount}
                  </span>
                </div>
              </div>

              {/* Workload per lawyer table */}
              {roleData.lawyerWorkload && roleData.lawyerWorkload.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {locale === "en" ? "Lawyer Workload Distribution" : "Répartition de la charge par collaborateur"}
                  </h4>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 font-medium text-muted-foreground border-b">
                        <tr>
                          <th className="px-3 py-2">{locale === "en" ? "Lawyer" : "Avocat / Collaborateur"}</th>
                          <th className="px-3 py-2 text-center">{locale === "en" ? "Assigned Matters" : "Dossiers suivis"}</th>
                          <th className="px-3 py-2 text-center">{locale === "en" ? "Pending Tasks" : "Tâches actives"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {roleData.lawyerWorkload.map((lw) => (
                          <tr key={lw.lawyerId} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium text-slate-800 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {lw.lawyerName}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-semibold text-[#1F2A44]">
                              {lw.activeMattersCount}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700">
                              {lw.pendingTasksCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next Hearings Card (Lawyer / Lead / Partner) */}
          {(isPartner || isLead || isAssociate) && (
            <div className="rounded-xl border bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm font-serif text-[#1F2A44] flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-[#B08D57]" />
                  {locale === "en" ? "My Upcoming Hearings" : "Mes prochaines audiences"}
                </h3>
                <Link
                  href={`/${locale}/calendar`}
                  className="text-xs text-[#B08D57] hover:underline font-medium flex items-center gap-1"
                >
                  {locale === "en" ? "View calendar →" : "Voir l'agenda →"}
                </Link>
              </div>

              {(!roleData.myNextHearings || roleData.myNextHearings.length === 0) ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  {locale === "en" ? "No upcoming hearings scheduled." : "Aucune audience programmée prochainement."}
                </div>
              ) : (
                <div className="space-y-2">
                  {roleData.myNextHearings.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg border bg-stone-50/50 hover:bg-stone-50 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{h.title}</span>
                          {h.matterReference && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {h.matterReference}
                            </Badge>
                          )}
                        </div>
                        {h.location && (
                          <span className="text-muted-foreground block text-[11px]">
                            {h.location}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 font-mono text-[11px] font-semibold text-[#1F2A44]">
                        {new Date(h.startsAt).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Priority Tasks Card */}
          {(isPartner || isLead || isAssociate) && (
            <div className="rounded-xl border bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm font-serif text-[#1F2A44] flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-600" />
                  {locale === "en" ? "My Priority Tasks" : "Mes tâches prioritaires"}
                </h3>
              </div>

              {(!roleData.myTasks || roleData.myTasks.length === 0) ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  {locale === "en" ? "No active tasks assigned." : "Aucune tâche active assignée."}
                </div>
              ) : (
                <div className="space-y-2">
                  {roleData.myTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg border bg-white flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-800">{t.title}</span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {t.matterReference && (
                            <span className="font-mono text-primary font-medium">
                              {t.matterReference}
                            </span>
                          )}
                          {t.dueAt && (
                            <span>
                              Échéance : {new Date(t.dueAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {t.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secretariat Section: New Inquiries & Today's Appointments */}
          {isSecretary && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-white p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-sm font-serif text-[#1F2A44] flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {locale === "en" ? "New Inquiries to Qualify" : "Demandes et prospects à qualifier"}
                </h3>
                {(!roleData.newInquiries || roleData.newInquiries.length === 0) ? (
                  <p className="text-xs text-muted-foreground">
                    {locale === "en" ? "No pending inquiries." : "Aucune nouvelle demande en attente."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {roleData.newInquiries.map((inq) => (
                      <div key={inq.id} className="p-3 rounded-lg border text-xs flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-900 block">{inq.subject}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {inq.partyName || "Prospect anonyme"} ({inq.channel})
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {inq.channel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Recent Matters & Quick Shortcuts */}
        <div className="space-y-6">
          {/* Recent Matters */}
          <div className="rounded-xl border bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm font-serif text-[#1F2A44] flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#1F2A44]" />
                {locale === "en" ? "Recent Matters" : "Dossiers récents"}
              </h3>
              <Link
                href={`/${locale}/matters`}
                className="text-xs text-[#B08D57] hover:underline font-medium"
              >
                {locale === "en" ? "View all →" : "Voir tout →"}
              </Link>
            </div>

            {(!roleData.myRecentMatters || roleData.myRecentMatters.length === 0) ? (
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "No recent matters." : "Aucun dossier récent."}
              </p>
            ) : (
              <div className="space-y-2">
                {roleData.myRecentMatters.map((m) => (
                  <Link
                    key={m.id}
                    href={`/${locale}/matters/${m.id}`}
                    className="p-3 rounded-lg border bg-surface-muted/20 hover:bg-surface-muted/60 transition-colors block text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary">
                        {m.reference}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {m.status}
                      </Badge>
                    </div>
                    <span className="font-semibold text-slate-800 block mt-1 truncate">
                      {m.title}
                    </span>
                    {m.clientName && (
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {m.clientName}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Cameroon Practice Reminders Card */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 text-xs space-y-2">
            <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-amber-700" />
              Cabinet d&apos;Avocats au Cameroun
            </h4>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Plateforme hébergée en réseau interne conforme à la loi n° 2024/017 relative à la protection des données personnelles.
              Tous les délais de procédure légaux (OHADA, CPCC) requièrent validation formelle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

