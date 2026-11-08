"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Briefcase,
  FileText,
  Gavel,
  Plus,
  Trash2,
  Eye,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AppShell,
  PageHeader,
  StatusChip,
  OverdueChip,
  ScanStatusChip,
  AiSuggestionChip,
  ProceduralDeadlineChip,
  PriorityChip,
  ConfidentialityChip,
  EmptyState,
  ErrorState,
  DeniedState,
  ConfirmDialog,
  SidePanel,
  EntityCombobox,
  DateTimeField,
  formatLegalDate,
  MoneyCell,
  FormSection,
  FormField,
  FormStickyFooter,
  DataTable,
  type PriorityLevel,
  type ConfidentialityLevel,
  type ComboboxOption,
} from "@/components/app";

interface SampleMatterRow {
  id: string;
  reference: string;
  title: string;
  client: string;
  category: string;
  leadLawyer: string;
  statusLabel: string;
  statusTone: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  priority: PriorityLevel;
  confidentiality: ConfidentialityLevel;
  nextDeadline: string;
  claimedAmount: number;
}

const SAMPLE_MATTERS: SampleMatterRow[] = [
  {
    id: "1",
    reference: "DOS-2026-0014",
    title: "Contentieux commercial & exécution - SABC c/ Afriland",
    client: "Société Anonyme des Brasseries du Cameroun (SABC)",
    category: "Contentieux commercial",
    leadLawyer: "Me Jean-Paul Mbarga",
    statusLabel: "En cours d'instance",
    statusTone: "primary",
    priority: "URGENT",
    confidentiality: "RESTRICTED",
    nextDeadline: "2026-11-12T08:30:00Z",
    claimedAmount: 48500000,
  },
  {
    id: "2",
    reference: "DOS-2026-0019",
    title: "Audit foncier & sécurisation bail emphytéotique Bonanjo",
    client: "Cimenteries du Cameroun (CIMENCAM)",
    category: "Immobilier & Foncier",
    leadLawyer: "Me Nadine Ekani",
    statusLabel: "Validation requise",
    statusTone: "warning",
    priority: "HIGH",
    confidentiality: "STANDARD",
    nextDeadline: "2026-11-18T14:00:00Z",
    claimedAmount: 15000000,
  },
  {
    id: "3",
    reference: "DOS-2026-0022",
    title: "Arbitrage CCJA OHADA - Rupture abusive de contrat",
    client: "Groupe Fokou SA",
    category: "Droit des sociétés / OHADA",
    leadLawyer: "Me Jean-Paul Mbarga",
    statusLabel: "Audience fixée",
    statusTone: "info",
    priority: "URGENT",
    confidentiality: "STRICT",
    nextDeadline: "2026-11-10T09:00:00Z",
    claimedAmount: 125000000,
  },
  {
    id: "4",
    reference: "DOS-2026-0025",
    title: "Convention collective & restructuration sociale",
    client: "Port Autonome de Douala (PAD)",
    category: "Droit social & Travail",
    leadLawyer: "Me Clarisse Ndongo",
    statusLabel: "Actif",
    statusTone: "success",
    priority: "NORMAL",
    confidentiality: "STANDARD",
    nextDeadline: "2026-11-25T10:00:00Z",
    claimedAmount: 9250000,
  },
];

const SAMPLE_PARTY_OPTIONS: ComboboxOption[] = [
  {
    id: "pty-1",
    code: "CLI-0012",
    label: "Société Anonyme des Brasseries du Cameroun (SABC)",
    sublabel: "RCCM: RC/DLA/1948/B/0124 · NIU: M01480000124A",
    badge: "Client",
  },
  {
    id: "pty-2",
    code: "CLI-0019",
    label: "Groupe Fokou SA",
    sublabel: "RCCM: RC/DLA/1994/B/1402 · Douala-Akwa",
    badge: "Client",
  },
  {
    id: "pty-3",
    code: "PRO-0041",
    label: "Cimenteries du Cameroun (CIMENCAM)",
    sublabel: "RCCM: RC/DLA/1963/B/0419 · Bonabéri",
    badge: "Prospect",
  },
  {
    id: "pty-4",
    code: "ADV-0008",
    label: "Me Samuel Etoundi (Avocat adverse)",
    sublabel: "Barreau du Cameroun · Yaoundé",
    badge: "Confrère",
  },
];

export function ComponentGalleryShowcase({
  locale = "fr",
}: {
  locale?: "fr" | "en";
}) {
  const [activeTab, setActiveTab] = React.useState("all");
  const [tableState, setTableState] = React.useState<
    "populated" | "loading" | "empty"
  >("populated");
  const [selectedParty, setSelectedParty] = React.useState<string>("pty-1");
  const [dateValue, setDateValue] = React.useState("2026-11-12");
  const [timeValue, setTimeValue] = React.useState("08:30");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [destructiveConfirmOpen, setDestructiveConfirmOpen] =
    React.useState(false);
  const [sidePanelOpen, setSidePanelOpen] = React.useState(false);
  const [selectedMatter, setSelectedMatter] = React.useState<SampleMatterRow>(
    SAMPLE_MATTERS[0],
  );

  const columns = React.useMemo<ColumnDef<SampleMatterRow>[]>(
    () => [
      {
        accessorKey: "reference",
        header: locale === "en" ? "Reference" : "Référence",
        cell: ({ row }) => (
          <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
            {row.original.reference}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: locale === "en" ? "Matter & Client" : "Intitulé & Client",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="font-medium text-foreground">{row.original.title}</p>
            <p className="text-caption text-muted-foreground">
              {row.original.client}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "statusLabel",
        header: locale === "en" ? "Status" : "Statut",
        cell: ({ row }) => (
          <StatusChip
            label={row.original.statusLabel}
            tone={row.original.statusTone}
          />
        ),
      },
      {
        accessorKey: "priority",
        header: locale === "en" ? "Priority" : "Priorité",
        cell: ({ row }) => (
          <PriorityChip priority={row.original.priority} locale={locale} />
        ),
      },
      {
        accessorKey: "confidentiality",
        header: locale === "en" ? "Confidentiality" : "Confidentialité",
        cell: ({ row }) => (
          <ConfidentialityChip
            level={row.original.confidentiality}
            showStandard
            locale={locale}
          />
        ),
      },
      {
        accessorKey: "nextDeadline",
        header: locale === "en" ? "Next Hearing" : "Prochaine échéance",
        cell: ({ row }) => (
          <span className="font-mono text-caption text-foreground whitespace-nowrap">
            {formatLegalDate(row.original.nextDeadline, locale, true)}
          </span>
        ),
      },
      {
        accessorKey: "claimedAmount",
        header: () => (
          <span className="block text-right">
            {locale === "en" ? "Stakes (XAF)" : "Enjeu financier (XAF)"}
          </span>
        ),
        cell: ({ row }) => (
          <MoneyCell amount={row.original.claimedAmount} locale={locale} />
        ),
      },
    ],
    [locale],
  );

  return (
    <AppShell
      locale={locale}
      breadcrumbs={[
        {
          label:
            locale === "en"
              ? "Design System & Component Gallery"
              : "Système de Design & Galerie de Composants",
        },
      ]}
    >
      <PageHeader
        reference="DESIGN-V1"
        title={
          locale === "en"
            ? "Design System & Shared Legal Components"
            : "Système de Design & Composants Juridiques"
        }
        description={
          locale === "en"
            ? "Interactive development specification verifying DESIGN.md tokens, contrast (>= 4.5:1), focus rings, responsive layouts (360px to 1280px), and state patterns."
            : "Catalogue interactif de développement validant les tokens DESIGN.md, le contraste (>= 4.5:1), la navigation clavier et le rendu responsive (360px à 1280px)."
        }
        useSerifTitle
        badges={
          <>
            <StatusChip
              label={
                locale === "en" ? "WCAG 2.1 AA Verified" : "WCAG 2.1 AA Vérifié"
              }
              tone="success"
            />
            <ConfidentialityChip level="RESTRICTED" locale={locale} />
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setSidePanelOpen(true)}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span>
                {locale === "en"
                  ? "Open Matter SidePanel"
                  : "Ouvrir le tiroir détail"}
              </span>
            </Button>
            <Button variant="primary" onClick={() => setConfirmOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>
                {locale === "en"
                  ? "Test ConfirmDialog"
                  : "Tester ConfirmDialog"}
              </span>
            </Button>
          </>
        }
        tabs={[
          {
            key: "all",
            label: locale === "en" ? "All Components" : "Tous les composants",
            count: 14,
          },
          {
            key: "states",
            label:
              locale === "en"
                ? "Empty / Error / Denied States"
                : "États Vide / Erreur / Accès refusé",
            count: 3,
          },
          {
            key: "forms",
            label:
              locale === "en"
                ? "Progressive Forms & Inputs"
                : "Formulaires progressifs & Saisie",
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="mx-auto max-w-[1280px] space-y-8 p-4 sm:p-6">
        {/* 1. Palette & Typography Tokens */}
        <section className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-h3 font-semibold text-primary">
                1.{" "}
                {locale === "en"
                  ? "Colour Tokens & Typography Scale"
                  : "Tokens de Couleur & Échelle Typographique"}
              </h2>
              <p className="text-caption text-muted-foreground">
                {locale === "en"
                  ? "All colours come strictly from CSS variables in globals.css. Self-hosted Inter, Source Serif 4, and JetBrains Mono."
                  : "Toutes les couleurs proviennent exclusivement des variables CSS. Polices auto-hébergées : Inter, Source Serif 4 et JetBrains Mono."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              {
                name: "Primary Navy",
                bg: "bg-primary text-primary-foreground",
                hex: "#1F2A44",
              },
              {
                name: "Muted Gold",
                bg: "bg-accent text-primary-foreground",
                hex: "#B08D57",
              },
              {
                name: "Warm Background",
                bg: "bg-background text-foreground border border-border",
                hex: "#F7F6F3",
              },
              {
                name: "Surface Card",
                bg: "bg-surface text-foreground border border-border",
                hex: "#FFFFFF",
              },
              {
                name: "Success",
                bg: "bg-success text-primary-foreground",
                hex: "#2E7D5B",
              },
              {
                name: "Warning",
                bg: "bg-warning text-primary-foreground",
                hex: "#B7791F",
              },
              {
                name: "Danger / Strict",
                bg: "bg-danger text-primary-foreground",
                hex: "#B3382C",
              },
              {
                name: "Info / AI",
                bg: "bg-info text-primary-foreground",
                hex: "#2B6CB0",
              },
            ].map((swatch) => (
              <div
                key={swatch.name}
                className="rounded-lg border border-border p-2 bg-surface space-y-1.5"
              >
                <div
                  className={`h-10 w-full rounded-md flex items-center justify-center font-mono text-caption ${swatch.bg}`}
                >
                  {swatch.hex}
                </div>
                <p className="text-caption font-medium text-foreground truncate">
                  {swatch.name}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Display - Source Serif 4
              </p>
              <p className="mt-1 font-serif text-h2 font-semibold text-primary">
                Cabinet Mbarga & Associés
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Interface - Inter (Tabular Figures)
              </p>
              <p className="mt-1 font-sans text-body font-medium text-foreground tabular-nums">
                Audience de plaidoirie · 148 500 000 XAF
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Monospace - JetBrains Mono
              </p>
              <p className="mt-1 font-mono text-body-sm font-semibold text-primary">
                DOS-2026-0014 · RC/DLA/1994/B/1402
              </p>
            </div>
          </div>
        </section>

        {/* 2. Chips & Metadata Badges (DESIGN.md 4.4) */}
        <section className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-h3 font-semibold text-primary">
              2.{" "}
              {locale === "en"
                ? "Status, Priority, Confidentiality & Domain Chips"
                : "Puces de Statut, Priorité, Confidentialité & Métadonnées"}
            </h2>
            <p className="text-caption text-muted-foreground">
              {locale === "en"
                ? "Status, priority, deadline and confidentiality are always readable by colour AND text or icon (never colour alone)."
                : "Statut, priorité, échéance et confidentialité sont toujours lisibles par la couleur ET le texte ou l'icône."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en"
                  ? "Workflow Status Chips"
                  : "Statuts de Workflow"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip label="Nouveau" tone="neutral" />
                <StatusChip label="En cours d'étude" tone="primary" />
                <StatusChip label="À valider" tone="warning" />
                <StatusChip label="Validé / Actif" tone="success" />
                <StatusChip label="Audience fixée" tone="info" />
                <StatusChip label="Convention signée" tone="accent" />
                <StatusChip label="Clôturé / Refusé" tone="danger" />
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en" ? "Priority Chips" : "Niveaux de Priorité"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityChip priority="LOW" locale={locale} />
                <PriorityChip priority="NORMAL" locale={locale} />
                <PriorityChip priority="HIGH" locale={locale} />
                <PriorityChip priority="URGENT" locale={locale} />
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en"
                  ? "Confidentiality Levels"
                  : "Niveaux de Confidentialité"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ConfidentialityChip
                  level="STANDARD"
                  showStandard
                  locale={locale}
                />
                <ConfidentialityChip level="RESTRICTED" locale={locale} />
                <ConfidentialityChip level="STRICT" locale={locale} />
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en"
                  ? "Legal & Security Signals (Overdue, ClamAV, AI, Deadlines)"
                  : "Signaux Métier & Sécurité (Retard, Antivirus ClamAV, IA, Délais)"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <OverdueChip days={4} locale={locale} />
                <ScanStatusChip status="PENDING" locale={locale} />
                <ScanStatusChip status="CLEAN" showWhenClean locale={locale} />
                <ScanStatusChip status="INFECTED" locale={locale} />
                <AiSuggestionChip locale={locale} />
                <ProceduralDeadlineChip validatedBy={null} locale={locale} />
                <ProceduralDeadlineChip
                  validatedBy="Me Mbarga"
                  locale={locale}
                />
              </div>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="pt-3 border-t border-border space-y-2.5">
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "en"
                ? "Action Buttons & States"
                : "Boutons d'Action & États"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en" ? "Open Matter" : "Ouvrir le dossier"}
                </span>
              </Button>
              <Button variant="secondary">
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en" ? "Upload Document" : "Déposer une pièce"}
                </span>
              </Button>
              <Button variant="ghost">
                <span>
                  {locale === "en" ? "Secondary Action" : "Action secondaire"}
                </span>
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDestructiveConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en"
                    ? "Destruction Request (Keyword)"
                    : "Demande de destruction (Mot-clé)"}
                </span>
              </Button>
              <Button variant="primary" loading>
                <span>
                  {locale === "en" ? "Saving..." : "Enregistrement..."}
                </span>
              </Button>
            </div>
          </div>
        </section>

        {/* 3. DataTable with Sorting, Column Menu, Density, Skeletons & Mobile Cards */}
        <section className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-h3 font-semibold text-primary">
                3.{" "}
                {locale === "en"
                  ? "DataTable (Sorting, Column Visibility, Skeletons, Mobile Cards)"
                  : "DataTable (Tri, Colonnes, Densité, Squelette & Cartes Mobiles)"}
              </h2>
              <p className="text-caption text-muted-foreground">
                {locale === "en"
                  ? "Click any row to open the SidePanel drawer. Resize to 360px to view stacked mobile cards."
                  : "Cliquez sur une ligne pour ouvrir le tiroir SidePanel. Réduisez à 360px pour voir les cartes empilées."}
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted p-1">
              {(["populated", "loading", "empty"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTableState(st)}
                  className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                    tableState === st
                      ? "bg-surface text-primary shadow-card font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st === "populated"
                    ? locale === "en"
                      ? "Populated"
                      : "Données"
                    : st === "loading"
                      ? locale === "en"
                        ? "Skeleton"
                        : "Chargement"
                      : locale === "en"
                        ? "Empty"
                        : "Vide"}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableState === "empty" ? [] : SAMPLE_MATTERS}
            loading={tableState === "loading"}
            locale={locale}
            onRowClick={(row) => {
              setSelectedMatter(row);
              setSidePanelOpen(true);
            }}
            emptyAction={
              <Button
                variant="primary"
                onClick={() => setTableState("populated")}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en"
                    ? "Restore sample matters"
                    : "Restaurer les dossiers exemples"}
                </span>
              </Button>
            }
            renderMobileCard={(row) => (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                    {row.reference}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <PriorityChip priority={row.priority} locale={locale} />
                    <ConfidentialityChip
                      level={row.confidentiality}
                      locale={locale}
                    />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{row.title}</p>
                  <p className="text-caption text-muted-foreground">
                    {row.client}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <StatusChip label={row.statusLabel} tone={row.statusTone} />
                  <MoneyCell
                    amount={row.claimedAmount}
                    locale={locale}
                    align="left"
                  />
                </div>
              </div>
            )}
          />
        </section>

        {/* 4. Progressive FormSection, EntityCombobox, DateTimeField & MoneyCell */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <FormSection
              title={
                locale === "en"
                  ? "4. Progressive FormSection, EntityCombobox & DateTimeField"
                  : "4. Formulaire Progressif, Combobox Parties & Date/Heure"
              }
              description={
                locale === "en"
                  ? "Single-column form (max 720px) with duplicate detection, Africa/Douala timezone, and progressive disclosure."
                  : "Formulaire mono-colonne (max 720px) avec détection de doublons en ligne, fuseau Africa/Douala et champs progressifs."
              }
              locale={locale}
              defaultAdvancedOpen
              advancedChildren={
                <>
                  <FormField
                    id="jurisdiction-input"
                    label={
                      locale === "en"
                        ? "Jurisdiction & Court Chamber"
                        : "Juridiction & Chambre saisie"
                    }
                    helpText={
                      locale === "en"
                        ? "Specify the court or OHADA arbitration center."
                        : "Précisez le tribunal compétent (ex. TGI Douala-Bonanjo, CCJA Abidjan)."
                    }
                    locale={locale}
                  >
                    <Input
                      id="jurisdiction-input"
                      defaultValue="Tribunal de Grande Instance du Wouri (Douala-Bonanjo) - Chambre Commerciale"
                    />
                  </FormField>

                  <FormField
                    id="notes-textarea"
                    label={
                      locale === "en"
                        ? "Internal Qualification Notes"
                        : "Notes internes de qualification"
                    }
                    locale={locale}
                  >
                    <Textarea
                      id="notes-textarea"
                      defaultValue="Vérification de conflit d'intérêts effectuée. Convention d'honoraires en attente de signature par la Direction Juridique."
                    />
                  </FormField>
                </>
              }
            >
              <FormField
                id="party-combobox"
                label={
                  locale === "en"
                    ? "Client or Party (Autocomplete + Duplicate Detection)"
                    : "Client ou Partie (Autocomplétion + Détection de doublon)"
                }
                required
                helpText={
                  locale === "en"
                    ? "Try typing 'SABC' or 'Fokou' in the selector search to trigger the inline duplicate warning."
                    : "Ouvrez le sélecteur et tapez « SABC » ou « Fokou » pour voir l'alerte de doublon intégrée."
                }
                locale={locale}
              >
                <EntityCombobox
                  id="party-combobox"
                  options={SAMPLE_PARTY_OPTIONS}
                  value={selectedParty}
                  onChange={(val) => setSelectedParty(val)}
                  onCreateNew={(q) =>
                    alert(
                      locale === "en"
                        ? `Opening drawer to create new party: "${q || "New Party"}"`
                        : `Ouverture du tiroir de création pour : « ${q || "Nouvelle partie"} »`,
                    )
                  }
                  locale={locale}
                />
              </FormField>

              <FormField
                id="hearing-datetime"
                label={
                  locale === "en"
                    ? "Procedural Hearing Date & Time (24h)"
                    : "Date et heure de l'audience (Format 24h)"
                }
                required
                helpText={
                  locale === "en"
                    ? `Formatted preview: ${formatLegalDate(`${dateValue}T${timeValue}:00`, locale, true)}`
                    : `Aperçu formaté : ${formatLegalDate(`${dateValue}T${timeValue}:00`, locale, true)}`
                }
                locale={locale}
              >
                <DateTimeField
                  id="hearing-datetime"
                  dateValue={dateValue}
                  timeValue={timeValue}
                  onDateChange={setDateValue}
                  onTimeChange={setTimeValue}
                  locale={locale}
                />
              </FormField>

              <FormField
                id="invalid-field-demo"
                label={
                  locale === "en"
                    ? "Procedural Deadline Source (Validation Error State)"
                    : "Source de l'échéance procédurale (Exemple d'état d'erreur)"
                }
                required
                error={
                  locale === "en"
                    ? "A procedural deadline requires an official source (ruling, bailiff notice, or registry record)."
                    : "Une échéance procédurale exige obligatoirement une source vérifiable (exploit d'huissier, plumitif, ordonnance)."
                }
                locale={locale}
              >
                <Input
                  id="invalid-field-demo"
                  hasError
                  defaultValue=""
                  placeholder={
                    locale === "en"
                      ? "e.g., Bailiff notice served on 04 Nov 2026"
                      : "ex. Exploit de Me Kamga signifié le 04 nov. 2026"
                  }
                />
              </FormField>
            </FormSection>

            <FormStickyFooter className="mt-2">
              <Button variant="secondary" type="button">
                {locale === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button variant="primary" type="button">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {locale === "en"
                    ? "Save Changes"
                    : "Enregistrer les modifications"}
                </span>
              </Button>
            </FormStickyFooter>
          </div>

          {/* Right Column: MoneyCell Ledger & Feedback States */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-4">
              <h3 className="text-h3 font-semibold text-primary">
                5.{" "}
                {locale === "en"
                  ? "MoneyCell (XAF Tabular Formatting)"
                  : "MoneyCell (Formatage Tabulaire XAF)"}
              </h3>
              <p className="text-caption text-muted-foreground">
                {locale === "en"
                  ? "Right-aligned tabular figures, no decimals for XAF, computed status."
                  : "Chiffres tabulaires alignés à droite, sans décimales pour le franc CFA (XAF)."}
              </p>

              <div className="divide-y divide-border rounded-lg border border-border">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-body-sm text-foreground">
                    {locale === "en"
                      ? "Invoiced Fee Agreement"
                      : "Convention d'honoraires facturée"}
                  </span>
                  <MoneyCell amount={12500000} locale={locale} align="left" />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-body-sm text-foreground">
                    {locale === "en"
                      ? "Validated Payments Received"
                      : "Règlements validés encaissés"}
                  </span>
                  <MoneyCell
                    amount={8000000}
                    tone="positive"
                    locale={locale}
                    align="left"
                  />
                </div>
                <div className="flex items-center justify-between bg-surface-muted/50 px-4 py-2.5">
                  <span className="text-body-sm font-semibold text-foreground">
                    {locale === "en"
                      ? "Computed Remaining Balance"
                      : "Solde restant dû (calculé)"}
                  </span>
                  <MoneyCell
                    amount={4500000}
                    tone="danger"
                    locale={locale}
                    align="left"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-h3 font-semibold text-primary">
                6.{" "}
                {locale === "en"
                  ? "Standard Feedback States"
                  : "États Standardisés (Vide, Erreur, Accès Refusé)"}
              </h3>
              <EmptyState
                title={
                  locale === "en"
                    ? "No procedural documents uploaded yet"
                    : "Aucune pièce procédurale déposée"
                }
                description={
                  locale === "en"
                    ? "Upload pleadings, court rulings, or client exhibits to start versioning."
                    : "Déposez les conclusions, exploits ou pièces justificatives pour activer le suivi de versions."
                }
                action={
                  <Button variant="secondary" size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {locale === "en"
                        ? "Upload first document"
                        : "Déposer un document"}
                    </span>
                  </Button>
                }
              />

              <ErrorState
                referenceCode="ERR-DB-2026-09"
                locale={locale}
                onRetry={() => alert("Retrying connection...")}
              />

              <DeniedState locale={locale} />
            </div>
          </div>
        </div>
      </div>

      {/* Standard Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          locale === "en"
            ? "Validate Document Version"
            : "Valider la version du document"
        }
        itemName="DOS-2026-0014 · Mémoire en défense v3.pdf"
        consequence={
          locale === "en"
            ? "Once validated, version v3 becomes immutable and cannot be edited or overwritten. Future changes will require uploading version v4."
            : "Une fois validée, la version v3 devient immuable (BR-06) et ne pourra plus être modifiée ni écrasée. Toute modification ultérieure créera une version v4."
        }
        confirmLabel={
          locale === "en" ? "Validate Version" : "Valider définitivement"
        }
        locale={locale}
        onConfirm={() => setConfirmOpen(false)}
      />

      {/* Destructive Keyword Confirmation Dialog */}
      <ConfirmDialog
        open={destructiveConfirmOpen}
        onOpenChange={setDestructiveConfirmOpen}
        destructive
        requireKeyword="DETRUIRE"
        title={
          locale === "en"
            ? "Execute Approved Destruction"
            : "Exécuter la destruction approuvée"
        }
        itemName="ARCH-2015-0102 · Dossier prescrit"
        consequence={
          locale === "en"
            ? "This operation permanently purges the physical file after retention expiry and records an immutable audit entry."
            : "Cette opération purge physiquement le fichier après expiration de la durée de conservation et inscrit une trace immuable au journal d'audit."
        }
        confirmLabel={
          locale === "en" ? "Permanently Destroy" : "Détruire définitivement"
        }
        locale={locale}
        onConfirm={() => setDestructiveConfirmOpen(false)}
      />

      {/* SidePanel Detail Drawer */}
      <SidePanel
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
        reference={selectedMatter.reference}
        title={selectedMatter.title}
        subtitle={selectedMatter.client}
        locale={locale}
        badges={
          <>
            <StatusChip
              label={selectedMatter.statusLabel}
              tone={selectedMatter.statusTone}
            />
            <PriorityChip priority={selectedMatter.priority} locale={locale} />
            <ConfidentialityChip
              level={selectedMatter.confidentiality}
              locale={locale}
            />
          </>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSidePanelOpen(false)}
            >
              {locale === "en" ? "Close" : "Fermer"}
            </Button>
            <Button variant="primary" size="sm" asChild>
              <a href={`/${locale}/matters`}>
                <span>
                  {locale === "en"
                    ? "Open Full Matter Workspace"
                    : "Ouvrir le dossier complet"}
                </span>
              </a>
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {selectedMatter.confidentiality !== "STANDARD" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft p-3 text-caption text-warning-foreground">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {locale === "en"
                    ? `Confidentiality: ${selectedMatter.confidentiality}`
                    : `Dossier à confidentialité ${selectedMatter.confidentiality}`}
                </p>
                <p className="mt-0.5">
                  {locale === "en"
                    ? "Every view, download and status change is recorded in the append-only audit log."
                    : "Chaque consultation, téléchargement et changement de statut est journalisé dans l'audit immuable."}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-muted/40 p-3.5 text-body-sm">
            <div>
              <p className="text-caption text-muted-foreground">
                {locale === "en" ? "Lead Lawyer" : "Avocat responsable"}
              </p>
              <p className="font-medium text-foreground">
                {selectedMatter.leadLawyer}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">
                {locale === "en" ? "Category" : "Catégorie"}
              </p>
              <p className="font-medium text-foreground">
                {selectedMatter.category}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">
                {locale === "en"
                  ? "Next Hearing / Deadline"
                  : "Prochaine audience"}
              </p>
              <p className="font-mono text-caption font-semibold text-primary">
                {formatLegalDate(selectedMatter.nextDeadline, locale, true)}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">
                {locale === "en" ? "Financial Stakes" : "Enjeu financier"}
              </p>
              <MoneyCell
                amount={selectedMatter.claimedAmount}
                locale={locale}
                align="left"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "en"
                ? "Recent Procedural Timeline"
                : "Chronologie procédurale récente"}
            </h4>
            <div className="space-y-3 border-l-2 border-border pl-4">
              <div>
                <div className="flex items-center gap-2">
                  <Gavel
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-caption text-muted-foreground">
                    06 nov. 2026 · 10:15
                  </span>
                </div>
                <p className="text-body-sm font-medium text-foreground">
                  Dépôt du mémoire en réplique validé par{" "}
                  {selectedMatter.leadLawyer}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="h-3.5 w-3.5 text-info"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-caption text-muted-foreground">
                    02 nov. 2026 · 16:40
                  </span>
                </div>
                <p className="text-body-sm font-medium text-foreground">
                  Vérification de conflit d&apos;intérêts confirmée sans réserve
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidePanel>
    </AppShell>
  );
}
