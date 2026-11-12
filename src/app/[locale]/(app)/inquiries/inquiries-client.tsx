"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SidePanel } from "@/components/app/side-panel";
import { EmptyState } from "@/components/app/empty-state";
import { KanbanBoard, KanbanColumn, KanbanItem } from "@/components/app/kanban-board";
import {
  Inbox,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Kanban as KanbanIcon,
  Table as TableIcon,
  Check,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  createInquiryAction,
  decideInquiryAction,
  convertInquiryAction,
  getInquiryDetailsAction,
} from "@/server/actions/inquiry-actions";
import { InquiryChannel, DecisionOutcome, PartyType } from "@prisma/client";

interface InquiriesClientProps {
  initialInquiries: any[];
  steps: any[];
  lawyers: { id: string; name: string }[];
  parties: { id: string; displayName: string; clientStatus: string }[];
  currentUserRole?: string;
}

export function InquiriesClient({
  initialInquiries,
  steps,
  lawyers,
  parties,
  currentUserRole,
}: InquiriesClientProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  const canDecide = currentUserRole === "PARTNER" || currentUserRole === "LEAD_LAWYER";

  // View state: Kanban or Table
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");

  // Create drawer state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isNewProspect, setIsNewProspect] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState(parties[0]?.id || "");
  const [newProspectType, setNewProspectType] = useState<PartyType>("COMPANY");
  const [newProspectName, setNewProspectName] = useState("");
  const [newProspectEmail, setNewProspectEmail] = useState("");
  const [newProspectPhone, setNewProspectPhone] = useState("");
  const [newProspectCity, setNewProspectCity] = useState("Douala");
  const [channel, setChannel] = useState<InquiryChannel>("PHONE");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [assignedToId, setAssignedToId] = useState(lawyers[0]?.id || "");
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail / Decision SidePanel state
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [inquiryDetails, setInquiryDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Decision modal in sidepanel
  const [decisionOutcome, setDecisionOutcome] = useState<DecisionOutcome>("ACCEPTED");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  // Open detail panel
  const handleOpenDetail = async (id: string) => {
    setSelectedInquiryId(id);
    setIsLoadingDetails(true);
    setDecisionError(null);
    setIsDeciding(false);
    try {
      const details = await getInquiryDetailsAction(id);
      setInquiryDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Submit create inquiry
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!subject.trim()) {
      setCreateError(locale === "fr" ? "L'objet de la demande est obligatoire." : "Subject is required.");
      return;
    }

    if (isNewProspect && !newProspectName.trim()) {
      setCreateError(locale === "fr" ? "Le nom du prospect est obligatoire." : "Prospect name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createInquiryAction({
          partyId: isNewProspect ? null : selectedPartyId || null,
          newParty: isNewProspect
            ? {
                type: newProspectType,
                displayName: newProspectName.trim(),
                companyName: newProspectType === "COMPANY" ? newProspectName.trim() : null,
                lastName: newProspectType === "INDIVIDUAL" ? newProspectName.trim() : null,
                email: newProspectEmail.trim() || null,
                phone: newProspectPhone.trim() || null,
                city: newProspectCity.trim() || "Douala",
              }
            : undefined,
          channel,
          subject: subject.trim(),
          description: description.trim() || null,
          origin: origin.trim() || null,
          assignedToId: assignedToId || null,
        });

        if (res.success && res.inquiry) {
          setIsCreateOpen(false);
          setSubject("");
          setDescription("");
          setOrigin("");
          setNewProspectName("");
          setNewProspectEmail("");
          setNewProspectPhone("");
          router.refresh();
          handleOpenDetail(res.inquiry.id);
        }
      } catch (err: any) {
        setCreateError(err.message || "Erreur de création");
      }
    });
  };

  // Handle formal accept / refuse decision
  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiryId) return;
    setDecisionError(null);

    if (!decisionReason.trim()) {
      setDecisionError(locale === "fr" ? "Le motif de la décision est obligatoire." : "Reason is required.");
      return;
    }

    startTransition(async () => {
      try {
        await decideInquiryAction({
          inquiryId: selectedInquiryId,
          outcome: decisionOutcome,
          reason: decisionReason.trim(),
        });

        setIsDeciding(false);
        setDecisionReason("");
        router.refresh();
        // Refresh details
        const refreshed = await getInquiryDetailsAction(selectedInquiryId);
        setInquiryDetails(refreshed);
      } catch (err: any) {
        setDecisionError(err.message || "Erreur lors de la décision");
      }
    });
  };

  // Handle conversion to client
  const handleConvert = async () => {
    if (!selectedInquiryId) return;
    setDecisionError(null);

    startTransition(async () => {
      try {
        await convertInquiryAction(selectedInquiryId);
        router.refresh();
        const refreshed = await getInquiryDetailsAction(selectedInquiryId);
        setInquiryDetails(refreshed);
      } catch (err: any) {
        setDecisionError(err.message || "Erreur de conversion");
      }
    });
  };

  // Build Kanban columns from workflow steps
  const kanbanColumns: KanbanColumn[] = steps.map((step) => {
    const columnItems: KanbanItem[] = initialInquiries
      .filter((inq) => inq.workflowStepId === step.id)
      .map((inq) => ({
        id: inq.id,
        title: inq.subject,
        stepKey: step.key,
        matterTitle: inq.party?.displayName,
        assigneeName: inq.assignedTo?.name,
        description: inq.description || undefined,
        dueAt: inq.receivedAt,
      }));

    return {
      key: step.key,
      nameFr: step.nameFr,
      nameEn: step.nameEn,
      color: step.color || "#1F2A44",
      items: columnItems,
    };
  });

  const getChannelBadge = (ch: InquiryChannel) => {
    switch (ch) {
      case "PHONE":
        return <Badge variant="outline" className="text-xs gap-1"><Phone className="h-3 w-3" /> Téléphone</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="text-xs gap-1"><Mail className="h-3 w-3" /> Email</Badge>;
      case "LETTER":
        return <Badge variant="outline" className="text-xs gap-1"><FileText className="h-3 w-3" /> Courrier</Badge>;
      case "WALK_IN":
        return <Badge variant="outline" className="text-xs gap-1"><User className="h-3 w-3" /> Accueil physique</Badge>;
      case "FORM":
        return <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> Formulaire web</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Autre</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Demandes & Prospects" : "Inquiries & Prospects"}
        description={
          locale === "fr"
            ? "Pipeline de qualification des demandes entrantes et conversion en clients"
            : "Intake qualification pipeline and client conversion workflow"
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <KanbanIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Pipeline" : "Pipeline"}
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <TableIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Tableau" : "Table"}
              </Button>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {locale === "fr" ? "Nouvelle demande" : "New inquiry"}
            </Button>
          </div>
        }
      />

      {/* Main View */}
      {viewMode === "kanban" ? (
        <div className="pt-2">
          <KanbanBoard
            entityType="INQUIRY"
            columns={kanbanColumns}
            locale={locale}
            onItemClick={(item) => handleOpenDetail(item.id)}
            onRefresh={() => router.refresh()}
          />
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3">{locale === "fr" ? "Demande & Prospect" : "Inquiry & Prospect"}</th>
                <th className="px-5 py-3">{locale === "fr" ? "Canal" : "Channel"}</th>
                <th className="px-5 py-3">{locale === "fr" ? "Étape" : "Step"}</th>
                <th className="px-5 py-3">{locale === "fr" ? "Responsable" : "Owner"}</th>
                <th className="px-5 py-3">{locale === "fr" ? "Date" : "Date"}</th>
                <th className="px-5 py-3 text-right">{locale === "fr" ? "Action" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialInquiries.map((inq) => (
                <tr
                  key={inq.id}
                  onClick={() => handleOpenDetail(inq.id)}
                  className="cursor-pointer hover:bg-surface-muted/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="font-semibold text-foreground">{inq.subject}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <User className="h-3 w-3" />
                      <span>{inq.party?.displayName}</span>
                      {inq.origin && <span className="text-muted-foreground/60">• {inq.origin}</span>}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {getChannelBadge(inq.channel)}
                  </td>

                  <td className="px-5 py-4">
                    <StatusChip
                      label={locale === "en" ? inq.workflowStep?.nameEn : inq.workflowStep?.nameFr || "Nouveau"}
                      tone="primary"
                    />
                  </td>

                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {inq.assignedTo?.name || "—"}
                  </td>

                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {new Date(inq.receivedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Inquiry SidePanel Drawer */}
      <SidePanel
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={locale === "fr" ? "Enregistrer une demande entrante" : "Register new inquiry"}
        subtitle={locale === "fr" ? "Enregistre la demande et génère une tâche de qualification sous 24h" : "Creates inquiry and 24h qualification task"}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          {createError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">{locale === "fr" ? "Objet de la demande *" : "Subject *"}</Label>
            <Input
              id="subject"
              required
              placeholder="ex: Conseil fiscal restructuration de groupe"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Party Selection / Create New */}
          <div className="space-y-3 rounded-lg border border-border/80 bg-surface-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Prospect ou Client demandeur" : "Prospect or Client"}
              </Label>
              <button
                type="button"
                onClick={() => setIsNewProspect(!isNewProspect)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {isNewProspect
                  ? locale === "fr" ? "Choisir une partie existante" : "Choose existing party"
                  : locale === "fr" ? "+ Nouveau prospect" : "+ New prospect"}
              </button>
            </div>

            {!isNewProspect ? (
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.clientStatus})
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProspectType("COMPANY")}
                    className={`rounded border p-2 text-xs font-medium ${
                      newProspectType === "COMPANY" ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {locale === "fr" ? "Entreprise / Société" : "Company"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProspectType("INDIVIDUAL")}
                    className={`rounded border p-2 text-xs font-medium ${
                      newProspectType === "INDIVIDUAL" ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {locale === "fr" ? "Particulier" : "Individual"}
                  </button>
                </div>

                <Input
                  placeholder={locale === "fr" ? "Nom complet / Raison sociale *" : "Full name / Company name *"}
                  value={newProspectName}
                  onChange={(e) => setNewProspectName(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    placeholder="email@domaine.cm"
                    value={newProspectEmail}
                    onChange={(e) => setNewProspectEmail(e.target.value)}
                  />
                  <Input
                    placeholder="+237 6XX XX XX XX"
                    value={newProspectPhone}
                    onChange={(e) => setNewProspectPhone(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Intake Channel & Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="channel">{locale === "fr" ? "Canal de réception" : "Intake channel"}</Label>
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as InquiryChannel)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="PHONE">{locale === "fr" ? "Téléphone" : "Phone"}</option>
                <option value="EMAIL">{locale === "fr" ? "Email" : "Email"}</option>
                <option value="WALK_IN">{locale === "fr" ? "Accueil physique" : "Walk-in"}</option>
                <option value="LETTER">{locale === "fr" ? "Courrier postal" : "Letter"}</option>
                <option value="FORM">{locale === "fr" ? "Formulaire web" : "Web form"}</option>
                <option value="OTHER">{locale === "fr" ? "Autre" : "Other"}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="owner">{locale === "fr" ? "Responsable de qualification" : "Owner"}</Label>
              <select
                id="owner"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Origin / Referral */}
          <div className="space-y-1.5">
            <Label htmlFor="origin">{locale === "fr" ? "Origine / Recommandé par" : "Origin / Referral"}</Label>
            <Input
              id="origin"
              placeholder="ex: Recommandé par Me Fokou, ou recherche internet..."
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">{locale === "fr" ? "Description & notes préliminaires" : "Description & notes"}</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Détails du premier contact, contexte du litige ou de la consultation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isPending ? "Création..." : locale === "fr" ? "Créer la demande" : "Create inquiry"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Inquiry Detail & Decision SidePanel */}
      <SidePanel
        open={Boolean(selectedInquiryId)}
        onOpenChange={(open) => !open && setSelectedInquiryId(null)}
        title={inquiryDetails?.subject || "Détail de la demande"}
        subtitle={inquiryDetails?.party?.displayName}
        size="lg"
      >
        {isLoadingDetails || !inquiryDetails ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {locale === "fr" ? "Chargement des détails..." : "Loading..."}
          </div>
        ) : (
          <div className="space-y-6">
            {decisionError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{decisionError}</span>
              </div>
            )}

            {/* Conflict Clearance Guard Status Banner (CON-04, BR-03) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Contrôle déontologique préalable" : "Ethical conflict check"}
              </Label>

              {inquiryDetails.conflictStatus?.resolved ? (
                <div className="rounded-lg border border-success/30 bg-success-soft p-3.5 text-xs text-success-foreground space-y-1">
                  <div className="flex items-center gap-2 font-bold text-success">
                    <ShieldCheck className="h-4 w-4" />
                    <span>
                      {locale === "fr"
                        ? "Conflit d'intérêts résolu & vérifié"
                        : "Conflict check resolved & cleared"}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {locale === "fr"
                      ? `Résultat : ${inquiryDetails.conflictStatus.latestCheck?.result} (Vérifié par ${inquiryDetails.conflictStatus.latestCheck?.performedBy.name})`
                      : `Outcome: ${inquiryDetails.conflictStatus.latestCheck?.result}`}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-warning/40 bg-warning-soft p-3.5 text-xs text-warning-foreground space-y-2">
                  <div className="flex items-center gap-2 font-bold text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {locale === "fr"
                        ? "Vérification de conflit requise (Règle BR-03)"
                        : "Conflict check required (Rule BR-03)"}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {inquiryDetails.conflictStatus?.reason ||
                      "Aucune vérification n'a été effectuée. L'acceptation du dossier est bloquée."}
                  </p>
                  <Link
                    href={`/${locale}/conflicts?query=${encodeURIComponent(inquiryDetails.party.displayName)}&partyId=${inquiryDetails.party.id}`}
                    className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline pt-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {locale === "fr" ? "Lancer le contrôle de conflit d'intérêts" : "Run conflict check"}
                  </Link>
                </div>
              )}
            </div>

            {/* Key Facts */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "fr" ? "Étape pipeline" : "Pipeline step"}</span>
                <StatusChip
                  label={locale === "en" ? inquiryDetails.workflowStep?.nameEn : inquiryDetails.workflowStep?.nameFr || "En cours"}
                  tone="primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "fr" ? "Prospect / Client" : "Party"}</span>
                <Link
                  href={`/${locale}/parties/${inquiryDetails.party.id}`}
                  className="font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  {inquiryDetails.party.displayName}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "fr" ? "Responsable" : "Owner"}</span>
                <span className="font-medium text-foreground">{inquiryDetails.assignedTo?.name || "Non affecté"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "fr" ? "Canal d'entrée" : "Channel"}</span>
                <span>{getChannelBadge(inquiryDetails.channel)}</span>
              </div>

              {inquiryDetails.origin && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{locale === "fr" ? "Origine" : "Origin"}</span>
                  <span className="font-medium text-foreground">{inquiryDetails.origin}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {inquiryDetails.description && (
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-muted-foreground">{locale === "fr" ? "Description" : "Description"}</span>
                <p className="rounded-lg bg-surface-muted p-3 text-foreground whitespace-pre-wrap">
                  {inquiryDetails.description}
                </p>
              </div>
            )}

            {/* Tasks & Qualification */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Tâches & Qualification (INQ-03)" : "Tasks & Qualification"}
              </span>
              <div className="space-y-2">
                {inquiryDetails.tasks?.map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{t.title}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    </div>
                    {t.description && <p className="text-muted-foreground text-[11px]">{t.description}</p>}
                    <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-2">
                      <span>{t.assignee?.name}</span>
                      {t.dueAt && <span>• Échéance : {new Date(t.dueAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons & Formal Decision */}
            {canDecide && !inquiryDetails.convertedAt && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDecisionOutcome("ACCEPTED");
                      setIsDeciding(true);
                    }}
                    className="flex-1 gap-1.5 text-xs bg-success text-success-foreground hover:bg-success/90"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {locale === "fr" ? "Accepter la demande" : "Accept"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      setDecisionOutcome("REFUSED");
                      setIsDeciding(true);
                    }}
                    className="flex-1 gap-1.5 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <X className="h-3.5 w-3.5" />
                    {locale === "fr" ? "Refuser" : "Refuse"}
                  </Button>
                </div>

                {/* Conversion Button (INQ-07) */}
                <Button
                  size="sm"
                  disabled={!inquiryDetails.conflictStatus?.resolved || isPending}
                  onClick={handleConvert}
                  className="w-full gap-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  title={
                    !inquiryDetails.conflictStatus?.resolved
                      ? "Contrôle des conflits requis avant conversion"
                      : undefined
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  {locale === "fr" ? "Convertir en client et ouvrir dossier" : "Convert to client & open matter"}
                </Button>
              </div>
            )}

            {/* Converted Confirmation Notice */}
            {inquiryDetails.convertedAt && (
              <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <span>
                  {locale === "fr"
                    ? `Demande convertie en client le ${new Date(inquiryDetails.convertedAt).toLocaleDateString()}`
                    : `Converted to client on ${new Date(inquiryDetails.convertedAt).toLocaleDateString()}`}
                </span>
              </div>
            )}

            {/* Decision Dialog Form within sidepanel */}
            {isDeciding && (
              <form onSubmit={handleDecisionSubmit} className="rounded-lg border border-border bg-surface-muted/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">
                    {decisionOutcome === "ACCEPTED"
                      ? locale === "fr" ? "Accepter la demande" : "Accept inquiry"
                      : locale === "fr" ? "Refuser la demande" : "Refuse inquiry"}
                  </span>
                  <button type="button" onClick={() => setIsDeciding(false)} className="text-xs text-muted-foreground">
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="decReason" className="text-xs">
                    {locale === "fr" ? "Motif de la décision *" : "Reason *"}
                  </Label>
                  <Textarea
                    id="decReason"
                    required
                    rows={2}
                    placeholder={
                      decisionOutcome === "ACCEPTED"
                        ? "Dossier qualifié, compétences disponibles, conflit vérifié..."
                        : "Indisponibilité, matière non traitée par le cabinet..."
                    }
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsDeciding(false)} className="text-xs">
                    {locale === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  <Button type="submit" disabled={isPending} size="sm" className="text-xs bg-primary text-primary-foreground">
                    {isPending ? "Enregistrement..." : locale === "fr" ? "Confirmer la décision" : "Confirm"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}

