"use client";

import {
  Gavel,
  Clock,
  FileCheck2,
  Briefcase,
  Sparkles,
  Plus,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AppShell,
  PageHeader,
  StatusChip,
  PriorityChip,
  ConfidentialityChip,
  ProceduralDeadlineChip,
  OverdueChip,
} from "@/components/app";
import { formatLegalDate } from "@/lib/formatters";

export default function DashboardPage({
  params,
}: {
  params?: { locale?: string };
}) {
  const locale = params?.locale === "en" ? "en" : "fr";
  const todayFormatted = formatLegalDate(new Date(), locale);

  return (
    <AppShell
      locale={locale}
      breadcrumbs={[
        {
          label: locale === "en" ? "Dashboard" : "Tableau de bord",
        },
      ]}
    >
      <PageHeader
        title={
          locale === "en"
            ? "Good morning, Me Jean-Paul Mbarga"
            : "Bonjour, Me Jean-Paul Mbarga"
        }
        description={
          locale === "en"
            ? `${todayFormatted} · Managing Partner Overview · Africa/Douala`
            : `${todayFormatted} · Vue Associé Gérant · Fuseau Africa/Douala`
        }
        useSerifTitle
        actions={
          <>
            <Button variant="secondary" asChild>
              <a href={`/${locale}/dev/components`}>
                <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                <span>
                  {locale === "en"
                    ? "Component Gallery (/dev)"
                    : "Galerie Composants (/dev)"}
                </span>
              </a>
            </Button>
            <Button variant="primary" asChild>
              <a href={`/${locale}/matters`}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en" ? "Open Matter" : "Ouvrir un dossier"}
                </span>
              </a>
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-[1280px] space-y-6 p-4 sm:p-6">
        {/* Needs Your Attention Strip (DESIGN.md 8.2) */}
        <section aria-labelledby="attention-heading">
          <h2
            id="attention-heading"
            className="mb-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {locale === "en"
              ? "Needs your attention now"
              : "Requiert votre attention immédiate"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-danger/30 bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-medium text-muted-foreground">
                  {locale === "en" ? "Overdue Tasks" : "Tâches en retard"}
                </span>
                <Clock className="h-4 w-4 text-danger" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-h2 font-semibold text-danger tabular-nums">
                2
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {locale === "en"
                  ? "1 requires partner validation"
                  : "Dont 1 soumise à validation"}
              </p>
            </div>

            <div className="rounded-lg border border-warning/35 bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-medium text-muted-foreground">
                  {locale === "en"
                    ? "Pending Validations"
                    : "Validations en attente"}
                </span>
                <FileCheck2
                  className="h-4 w-4 text-warning"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 font-mono text-h2 font-semibold text-warning tabular-nums">
                3
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {locale === "en"
                  ? "2 documents · 1 procedural deadline"
                  : "2 actes · 1 échéance procédurale"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-medium text-muted-foreground">
                  {locale === "en"
                    ? "Hearings (Next 7 Days)"
                    : "Audiences (7 prochains jours)"}
                </span>
                <Gavel className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-h2 font-semibold text-primary tabular-nums">
                4
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {locale === "en"
                  ? "TGI Douala-Bonanjo & Cour d'Appel"
                  : "TGI Douala-Bonanjo & Cour d'Appel"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-medium text-muted-foreground">
                  {locale === "en" ? "Active Firm Matters" : "Dossiers actifs"}
                </span>
                <Briefcase className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-h2 font-semibold text-foreground tabular-nums">
                28
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {locale === "en"
                  ? "4 Restricted · 2 Strict confidentiality"
                  : "4 Restreints · 2 Stricts"}
              </p>
            </div>
          </div>
        </section>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Hearings */}
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <h3 className="text-h3 font-semibold text-primary">
                  {locale === "en"
                    ? "Upcoming Hearings & Deadlines"
                    : "Prochaines audiences & Échéances"}
                </h3>
              </div>
              <StatusChip label="Semaine 46" tone="primary" />
            </div>

            <div className="divide-y divide-border">
              <div className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                    DOS-2026-0014
                  </span>
                  <ProceduralDeadlineChip
                    validatedBy="Me Mbarga"
                    locale={locale}
                  />
                </div>
                <p className="text-body-sm font-semibold text-foreground">
                  Audience de mise en état - SABC c/ Afriland First Bank
                </p>
                <p className="font-mono text-caption text-muted-foreground">
                  10 nov. 2026 · 08:30 · TGI du Wouri (Chambre commerciale)
                </p>
              </div>

              <div className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                    DOS-2026-0022
                  </span>
                  <ProceduralDeadlineChip validatedBy={null} locale={locale} />
                </div>
                <p className="text-body-sm font-semibold text-foreground">
                  Dépôt du mémoire en défense CCJA - Groupe Fokou SA
                </p>
                <p className="font-mono text-caption text-muted-foreground">
                  12 nov. 2026 · 15:00 · Greffe CCJA
                </p>
              </div>
            </div>
          </div>

          {/* Pending Validations & Tasks */}
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2
                  className="h-4 w-4 text-accent"
                  aria-hidden="true"
                />
                <h3 className="text-h3 font-semibold text-primary">
                  {locale === "en"
                    ? "Tasks & Validations Queue"
                    : "Tâches & Validations prioritaires"}
                </h3>
              </div>
              <OverdueChip days={2} locale={locale} />
            </div>

            <div className="divide-y divide-border">
              <div className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PriorityChip priority="URGENT" locale={locale} />
                  <ConfidentialityChip level="STRICT" locale={locale} />
                </div>
                <p className="text-body-sm font-semibold text-foreground">
                  Valider le protocole transactionnel v2 avant transmission
                  client
                </p>
                <p className="text-caption text-muted-foreground">
                  DOS-2026-0022 · Préparé par Me Nadine Ekani
                </p>
              </div>

              <div className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PriorityChip priority="HIGH" locale={locale} />
                  <StatusChip label="À valider" tone="warning" />
                </div>
                <p className="text-body-sm font-semibold text-foreground">
                  Statuer sur la vérification de conflit d&apos;intérêts
                  (INQ-2026-0044)
                </p>
                <p className="text-caption text-muted-foreground">
                  Prospect : Société Camerounaise de Dépôts Pétroliers (SCDP)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
