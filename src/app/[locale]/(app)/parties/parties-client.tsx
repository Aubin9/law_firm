"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SidePanel } from "@/components/app/side-panel";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import {
  Users,
  User,
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ExternalLink,
  Archive,
  RefreshCw,
} from "lucide-react";
import {
  createPartyAction,
  softDeletePartyAction,
  restorePartyAction,
  checkPartyDuplicatesAction,
} from "@/server/actions/party-actions";
import { PartyType, ClientStatus } from "@prisma/client";

interface PartyItem {
  id: string;
  type: PartyType;
  clientStatus: ClientStatus;
  displayName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  deletedAt: Date | null;
  _count: {
    matterParties: number;
    contacts: number;
    inquiries: number;
  };
}

interface PartiesClientProps {
  initialParties: PartyItem[];
  currentUserRole?: string;
}

export function PartiesClient({ initialParties }: PartiesClientProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showArchived, setShowArchived] = useState(false);

  // Drawer & Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [partyType, setPartyType] = useState<PartyType>("COMPANY");
  const [clientStatus, setClientStatus] = useState<ClientStatus>("CLIENT");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Douala");
  const [formError, setFormError] = useState<string | null>(null);

  // Duplicate warning state
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);

  // Archive modal state
  const [archiveTarget, setArchiveTarget] = useState<PartyItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PartyItem | null>(null);

  // Debounced duplicate check
  useEffect(() => {
    if (!isCreateOpen) {
      setDuplicateMatches([]);
      return;
    }

    const currentName = partyType === "COMPANY" ? companyName : `${firstName} ${lastName}`.trim();
    if (!currentName && !email && !phone) {
      setDuplicateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const matches = await checkPartyDuplicatesAction({
          displayName: currentName,
          email: email.trim() || null,
          phone: phone.trim() || null,
        });
        setDuplicateMatches(matches);
      } catch (err) {
        console.error("Duplicate check failed:", err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [isCreateOpen, partyType, companyName, firstName, lastName, email, phone]);

  // Reset form
  const resetForm = () => {
    setPartyType("COMPANY");
    setClientStatus("CLIENT");
    setCompanyName("");
    setFirstName("");
    setLastName("");
    setRegistrationNumber("");
    setTaxId("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("Douala");
    setFormError(null);
    setDuplicateMatches([]);
    setIgnoreDuplicates(false);
  };

  // Submit create party
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (partyType === "COMPANY" && !companyName.trim()) {
      setFormError(locale === "fr" ? "La raison sociale est obligatoire." : "Company name is required.");
      return;
    }

    if (partyType === "INDIVIDUAL" && !lastName.trim()) {
      setFormError(locale === "fr" ? "Le nom de famille est obligatoire." : "Last name is required.");
      return;
    }

    if (duplicateMatches.length > 0 && !ignoreDuplicates) {
      setFormError(
        locale === "fr"
          ? "Des doublons potentiels ont été détectés. Cochez la case pour confirmer la création."
          : "Potential duplicates were detected. Please check the box to confirm creation."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await createPartyAction({
          type: partyType,
          clientStatus,
          companyName: partyType === "COMPANY" ? companyName.trim() : null,
          firstName: partyType === "INDIVIDUAL" ? firstName.trim() : null,
          lastName: partyType === "INDIVIDUAL" ? lastName.trim() : null,
          registrationNumber: partyType === "COMPANY" ? registrationNumber.trim() || null : null,
          taxId: taxId.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          country: "CM",
        });

        if (res.success && res.party) {
          setIsCreateOpen(false);
          resetForm();
          router.refresh();
          router.push(`/${locale}/parties/${res.party.id}`);
        }
      } catch (err: any) {
        setFormError(err.message || "Erreur lors de la création");
      }
    });
  };

  // Handle soft delete
  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await softDeletePartyAction(archiveTarget.id);
      setArchiveTarget(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle restore
  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restorePartyAction(restoreTarget.id);
      setRestoreTarget(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter parties in memory
  const filteredParties = initialParties.filter((p) => {
    if (!showArchived && p.deletedAt) return false;
    if (showArchived && !p.deletedAt) return false;

    if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && p.clientStatus !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.displayName.toLowerCase().includes(q);
      const matchRccm = p.registrationNumber?.toLowerCase().includes(q) || false;
      const matchNiu = p.taxId?.toLowerCase().includes(q) || false;
      const matchEmail = p.email?.toLowerCase().includes(q) || false;
      const matchPhone = p.phone?.toLowerCase().includes(q) || false;
      return matchName || matchRccm || matchNiu || matchEmail || matchPhone;
    }

    return true;
  });

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case "CLIENT":
        return <StatusChip label={locale === "fr" ? "Client actif" : "Active client"} tone="success" />;
      case "PROSPECT":
        return <StatusChip label={locale === "fr" ? "Prospect" : "Prospect"} tone="info" />;
      case "FORMER":
        return <StatusChip label={locale === "fr" ? "Ancien client" : "Former client"} tone="warning" />;
      default:
        return <StatusChip label={locale === "fr" ? "Tiers" : "Third party"} tone="neutral" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Annuaire des parties" : "Parties Directory"}
        description={
          locale === "fr"
            ? "Clients, contacts, adversaires et intervenants du cabinet"
            : "Clients, contacts, opposing parties and firm participants"
        }
        actions={
          <Button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {locale === "fr" ? "Nouvelle partie" : "New party"}
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              locale === "fr"
                ? "Rechercher par nom, RCCM, NIU, email..."
                : "Search by name, RCCM, NIU, email..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Tous les types" : "All types"}</option>
            <option value="COMPANY">{locale === "fr" ? "Personnes morales (Entreprises)" : "Companies"}</option>
            <option value="INDIVIDUAL">{locale === "fr" ? "Personnes physiques" : "Individuals"}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Tous les statuts" : "All statuses"}</option>
            <option value="CLIENT">{locale === "fr" ? "Clients actifs" : "Active clients"}</option>
            <option value="PROSPECT">{locale === "fr" ? "Prospects" : "Prospects"}</option>
            <option value="FORMER">{locale === "fr" ? "Ancien client" : "Former clients"}</option>
            <option value="NONE">{locale === "fr" ? "Tiers / Intervenants" : "Third parties"}</option>
          </select>

          {/* Archived Toggle */}
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs"
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {showArchived
              ? locale === "fr"
                ? "Archivées (Actif)"
                : "Archived (Active)"
              : locale === "fr"
              ? "Archivées"
              : "Archived"}
          </Button>
        </div>
      </div>

      {/* Parties Table */}
      {filteredParties.length === 0 ? (
        <EmptyState
          title={locale === "fr" ? "Aucune partie trouvée" : "No parties found"}
          description={
            locale === "fr"
              ? "Aucun enregistrement ne correspond à vos filtres actuels."
              : "No party records match your current criteria."
          }
          action={
            <Button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {locale === "fr" ? "Créer une partie" : "Create party"}
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{locale === "fr" ? "Partie / Entité" : "Party / Entity"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Statut" : "Status"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Coordonnées" : "Coordinates"}</th>
                  <th className="px-5 py-3 text-center">{locale === "fr" ? "Dossiers" : "Matters"}</th>
                  <th className="px-5 py-3 text-center">{locale === "fr" ? "Contacts" : "Contacts"}</th>
                  <th className="px-5 py-3 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredParties.map((party) => (
                  <tr
                    key={party.id}
                    className="group hover:bg-surface-muted/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border text-foreground">
                          {party.type === "COMPANY" ? (
                            <Building2 className="h-4.5 w-4.5 text-accent" />
                          ) : (
                            <User className="h-4.5 w-4.5 text-primary" />
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/${locale}/parties/${party.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {party.displayName}
                            {party.deletedAt && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                                {locale === "fr" ? "Archivée" : "Archived"}
                              </Badge>
                            )}
                          </Link>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                            {party.registrationNumber && (
                              <span>RCCM: {party.registrationNumber}</span>
                            )}
                            {party.taxId && (
                              <span>NIU: {party.taxId}</span>
                            )}
                            {party.city && !party.registrationNumber && !party.taxId && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {party.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {getStatusBadge(party.clientStatus)}
                    </td>

                    <td className="px-5 py-4 text-xs space-y-1 text-muted-foreground">
                      {party.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="font-mono">{party.phone}</span>
                        </div>
                      )}
                      {party.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{party.email}</span>
                        </div>
                      )}
                      {!party.phone && !party.email && (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-muted text-foreground border border-border">
                        {party._count.matterParties}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
                        {party._count.contacts}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/${locale}/parties/${party.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {party.deletedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRestoreTarget(party)}
                            className="h-8 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                            title={locale === "fr" ? "Restaurer" : "Restore"}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setArchiveTarget(party)}
                            className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            title={locale === "fr" ? "Archiver" : "Archive"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Party SidePanel Drawer */}
      <SidePanel
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={locale === "fr" ? "Créer une nouvelle partie" : "Create new party"}
        subtitle={
          locale === "fr"
            ? "Enregistrez un client, prospect, intervenant ou partie adverse"
            : "Register a client, prospect, participant or opposing party"
        }
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          {formError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Type Selector (Individual vs Company) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "fr" ? "Type d'entité juridique" : "Entity type"}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPartyType("COMPANY")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                  partyType === "COMPANY"
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border bg-card hover:bg-surface-muted"
                }`}
              >
                <Building2 className="h-4 w-4" />
                {locale === "fr" ? "Personne morale" : "Company"}
              </button>

              <button
                type="button"
                onClick={() => setPartyType("INDIVIDUAL")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                  partyType === "INDIVIDUAL"
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border bg-card hover:bg-surface-muted"
                }`}
              >
                <User className="h-4 w-4" />
                {locale === "fr" ? "Personne physique" : "Individual"}
              </button>
            </div>
          </div>

          {/* Client Status */}
          <div className="space-y-1.5">
            <Label htmlFor="clientStatus">{locale === "fr" ? "Statut vis-à-vis du cabinet" : "Client status"}</Label>
            <select
              id="clientStatus"
              value={clientStatus}
              onChange={(e) => setClientStatus(e.target.value as ClientStatus)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="CLIENT">{locale === "fr" ? "Client actif" : "Active client"}</option>
              <option value="PROSPECT">{locale === "fr" ? "Prospect" : "Prospect"}</option>
              <option value="FORMER">{locale === "fr" ? "Ancien client" : "Former client"}</option>
              <option value="NONE">{locale === "fr" ? "Tiers / Intervenant / Adverse" : "Third party / Opposing party"}</option>
            </select>
          </div>

          {/* Conditional Fields based on Type */}
          {partyType === "COMPANY" ? (
            <div className="space-y-4 rounded-lg border border-border/70 bg-surface-muted/30 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">
                  {locale === "fr" ? "Raison sociale *" : "Company name *"}
                </Label>
                <Input
                  id="companyName"
                  required
                  placeholder="ex: Société Camerounaise d'Aluminium (ALUCAM)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rccm" className="text-xs">
                    {locale === "fr" ? "RCCM (Registre du Commerce)" : "RCCM"}
                  </Label>
                  <Input
                    id="rccm"
                    placeholder="RC/DLA/2018/B/..."
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="taxId" className="text-xs">
                    {locale === "fr" ? "NIU (Identifiant Fiscal Unique)" : "NIU"}
                  </Label>
                  <Input
                    id="taxId"
                    placeholder="M123456789012K"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-border/70 bg-surface-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">{locale === "fr" ? "Prénom" : "First name"}</Label>
                  <Input
                    id="firstName"
                    placeholder="Paul"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName">{locale === "fr" ? "Nom de famille *" : "Last name *"}</Label>
                  <Input
                    id="lastName"
                    required
                    placeholder="Biya"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="taxIdIndiv" className="text-xs">
                  {locale === "fr" ? "NIU (optionnel)" : "NIU (optional)"}
                </Label>
                <Input
                  id="taxIdIndiv"
                  placeholder="M..."
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Coordinates */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{locale === "fr" ? "Email" : "Email"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@cabinet.cm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">{locale === "fr" ? "Téléphone" : "Phone"}</Label>
                <Input
                  id="phone"
                  placeholder="+237 6XX XX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address">{locale === "fr" ? "Adresse" : "Address"}</Label>
                <Input
                  id="address"
                  placeholder="Akwa, Rue Manga Bell"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">{locale === "fr" ? "Ville" : "City"}</Label>
                <Input
                  id="city"
                  placeholder="Douala"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Duplicate Detection Warning Banner */}
          {duplicateMatches.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning-soft p-3.5 text-sm space-y-2.5">
              <div className="flex items-center gap-2 text-warning-foreground font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <span>
                  {locale === "fr"
                    ? "Attention : Doublons potentiels détectés !"
                    : "Warning: Potential duplicates detected!"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Les enregistrements suivants partagent des similitudes avec cette saisie :"
                  : "The following records share similarities with this entry:"}
              </p>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {duplicateMatches.map((m) => (
                  <div
                    key={m.partyId}
                    className="flex items-center justify-between rounded border border-border/60 bg-card p-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{m.displayName}</span>
                      <div className="text-[10px] text-muted-foreground">
                        {m.reasons.map((r: string) => {
                          if (r === "same_email") return locale === "fr" ? "Même email" : "Same email";
                          if (r === "same_phone") return locale === "fr" ? "Même téléphone" : "Same phone";
                          return `${locale === "fr" ? "Nom proche" : "Name match"} (${Math.round(m.similarityScore * 100)}%)`;
                        }).join(" • ")}
                      </div>
                    </div>
                    <Link
                      href={`/${locale}/parties/${m.partyId}`}
                      target="_blank"
                      className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                    >
                      {locale === "fr" ? "Consulter" : "View"}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreDuplicates}
                  onChange={(e) => setIgnoreDuplicates(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-ring"
                />
                <span className="text-xs text-foreground font-medium">
                  {locale === "fr"
                    ? "Je confirme qu'il ne s'agit pas d'un doublon, enregistrer quand même."
                    : "I confirm this is not a duplicate, save anyway."}
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isPending || (duplicateMatches.length > 0 && !ignoreDuplicates)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending
                ? locale === "fr"
                  ? "Création en cours..."
                  : "Creating..."
                : locale === "fr"
                ? "Créer la partie"
                : "Create party"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Soft Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={locale === "fr" ? "Archiver la partie" : "Archive party"}
        itemName={archiveTarget?.displayName}
        consequence={
          locale === "fr"
            ? "La fiche sera masquée des listes actives tout en conservant l'intégrité des dossiers et de la comptabilité."
            : "It will be hidden from active lists while preserving matters and accounting history."
        }
        confirmLabel={locale === "fr" ? "Archiver" : "Archive"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        onConfirm={handleArchive}
        destructive
      />

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title={locale === "fr" ? "Restaurer la partie" : "Restore party"}
        itemName={restoreTarget?.displayName}
        consequence={
          locale === "fr"
            ? "La partie sera réintégrée dans l'annuaire actif du cabinet."
            : "The party will be restored to the active firm directory."
        }
        confirmLabel={locale === "fr" ? "Restaurer" : "Restore"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        onConfirm={handleRestore}
      />
    </div>
  );
}
