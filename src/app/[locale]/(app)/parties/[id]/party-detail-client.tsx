"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StatusChip } from "@/components/app/status-chip";
import { ConfidentialityChip } from "@/components/app/confidentiality-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SidePanel } from "@/components/app/side-panel";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import {
  ArrowLeft,
  Building2,
  User,
  Users,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  FileText,
  MessageSquare,
  Star,
  Edit,
  Trash2,
  Archive,
  RefreshCw,
  Plus,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import {
  updatePartyAction,
  softDeletePartyAction,
  restorePartyAction,
  addPartyContactAction,
  updatePartyContactAction,
  deletePartyContactAction,
} from "@/server/actions/party-actions";
import { PartyType, ClientStatus } from "@prisma/client";

interface PartyDetailProps {
  party: any;
  currentUserRole?: string;
}

export function PartyDetailClient({ party }: PartyDetailProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  // Active tab state
  const [activeTab, setActiveTab] = useState<
    "overview" | "contacts" | "matters" | "communications" | "documents"
  >("overview");

  // Edit party state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(party.displayName || "");
  const [editCompanyName, setEditCompanyName] = useState(party.companyName || "");
  const [editFirstName, setEditFirstName] = useState(party.firstName || "");
  const [editLastName, setEditLastName] = useState(party.lastName || "");
  const [editClientStatus, setEditClientStatus] = useState<ClientStatus>(party.clientStatus);
  const [editRccm, setEditRccm] = useState(party.registrationNumber || "");
  const [editNiu, setEditNiu] = useState(party.taxId || "");
  const [editEmail, setEditEmail] = useState(party.email || "");
  const [editPhone, setEditPhone] = useState(party.phone || "");
  const [editAddress, setEditAddress] = useState(party.address || "");
  const [editCity, setEditCity] = useState(party.city || "Douala");
  const [editError, setEditError] = useState<string | null>(null);

  // Contact modal state
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsRepresentative, setContactIsRepresentative] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Deletion modals
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Handle Edit Party submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    startTransition(async () => {
      try {
        await updatePartyAction(party.id, {
          clientStatus: editClientStatus,
          displayName: editDisplayName.trim() || undefined,
          companyName: party.type === "COMPANY" ? editCompanyName.trim() : null,
          firstName: party.type === "INDIVIDUAL" ? editFirstName.trim() : null,
          lastName: party.type === "INDIVIDUAL" ? editLastName.trim() : null,
          registrationNumber: party.type === "COMPANY" ? editRccm.trim() || null : null,
          taxId: editNiu.trim() || null,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
        });

        setIsEditOpen(false);
        router.refresh();
      } catch (err: any) {
        setEditError(err.message || "Erreur de mise à jour");
      }
    });
  };

  // Open Contact modal for create/edit
  const openContactModal = (contact?: any) => {
    if (contact) {
      setEditingContactId(contact.id);
      setContactName(contact.name);
      setContactTitle(contact.title || "");
      setContactEmail(contact.email || "");
      setContactPhone(contact.phone || "");
      setContactIsRepresentative(contact.isRepresentative);
    } else {
      setEditingContactId(null);
      setContactName("");
      setContactTitle("");
      setContactEmail("");
      setContactPhone("");
      setContactIsRepresentative(false);
    }
    setContactError(null);
    setIsContactOpen(true);
  };

  // Handle Contact submit
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    if (!contactName.trim()) {
      setContactError(locale === "fr" ? "Le nom est obligatoire." : "Name is required.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingContactId) {
          await updatePartyContactAction(editingContactId, party.id, {
            name: contactName.trim(),
            title: contactTitle.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            isRepresentative: contactIsRepresentative,
          });
        } else {
          await addPartyContactAction(party.id, {
            name: contactName.trim(),
            title: contactTitle.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            isRepresentative: contactIsRepresentative,
          });
        }
        setIsContactOpen(false);
        router.refresh();
      } catch (err: any) {
        setContactError(err.message || "Erreur de contact");
      }
    });
  };

  // Handle Contact deletion
  const handleDeleteContact = async () => {
    if (!deletingContactId) return;
    try {
      await deletePartyContactAction(deletingContactId, party.id);
      setDeletingContactId(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Party Archive
  const handleArchiveParty = async () => {
    try {
      await softDeletePartyAction(party.id);
      setIsArchiveConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Party Restore
  const handleRestoreParty = async () => {
    try {
      await restorePartyAction(party.id);
      setIsRestoreConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case "CLIENT":
        return <StatusChip label={locale === "fr" ? "Client actif" : "Active client"} tone="success" />;
      case "PROSPECT":
        return <StatusChip label={locale === "fr" ? "Prospect" : "Prospect"} tone="info" />;
      case "FORMER":
        return <StatusChip label={locale === "fr" ? "Ancien client" : "Former client"} tone="warning" />;
      default:
        return <StatusChip label={locale === "fr" ? "Tiers / Intervenant" : "Third party"} tone="neutral" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link
          href={`/${locale}/parties`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {locale === "fr" ? "Retour à l'annuaire des parties" : "Back to parties directory"}
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted border border-border text-foreground">
              {party.type === "COMPANY" ? (
                <Building2 className="h-7 w-7 text-accent" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {party.displayName}
                </h1>
                {getStatusBadge(party.clientStatus)}
                {party.deletedAt && (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                    {locale === "fr" ? "Archivée" : "Archived"}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                {party.type === "COMPANY" ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-accent" />
                    {locale === "fr" ? "Personne morale" : "Company"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {locale === "fr" ? "Personne physique" : "Individual"}
                  </span>
                )}

                {party.registrationNumber && (
                  <span className="rounded bg-surface-muted px-2 py-0.5 border border-border">
                    RCCM: {party.registrationNumber}
                  </span>
                )}

                {party.taxId && (
                  <span className="rounded bg-surface-muted px-2 py-0.5 border border-border">
                    NIU: {party.taxId}
                  </span>
                )}

                {party.city && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {party.city}, {party.country || "CM"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Edit className="h-3.5 w-3.5" />
              {locale === "fr" ? "Modifier" : "Edit"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openContactModal()}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "fr" ? "Ajouter un contact" : "Add contact"}
            </Button>

            {party.deletedAt ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRestoreConfirmOpen(true)}
                className="gap-1.5 text-xs text-success hover:text-success hover:bg-success/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {locale === "fr" ? "Restaurer" : "Restore"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveConfirmOpen(true)}
                className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Archive className="h-3.5 w-3.5" />
                {locale === "fr" ? "Archiver" : "Archive"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 py-3 px-1 transition-colors flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            {locale === "fr" ? "Vue d'ensemble" : "Overview"}
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`border-b-2 py-3 px-1 transition-colors flex items-center gap-2 ${
              activeTab === "contacts"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            {locale === "fr" ? "Contacts & Représentants" : "Contacts & Reps"}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs">
              {party.contacts?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("matters")}
            className={`border-b-2 py-3 px-1 transition-colors flex items-center gap-2 ${
              activeTab === "matters"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            {locale === "fr" ? "Dossiers associés" : "Associated matters"}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs">
              {party.matterParties?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("communications")}
            className={`border-b-2 py-3 px-1 transition-colors flex items-center gap-2 ${
              activeTab === "communications"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            {locale === "fr" ? "Communications" : "Communications"}
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`border-b-2 py-3 px-1 transition-colors flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            {locale === "fr" ? "Documents" : "Documents"}
          </button>
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coordinates Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Coordonnées de contact" : "Contact details"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Téléphone principal" : "Main phone"}</span>
                  <div className="flex items-center gap-2 font-mono font-medium text-foreground">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {party.phone || "—"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Email principal" : "Main email"}</span>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {party.email || "—"}
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Adresse géographique" : "Physical address"}</span>
                  <div className="flex items-center gap-2 text-foreground">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      {[party.address, party.city, party.country || "Cameroun"].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal and Commercial Identifiers */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Identifiants légaux & Fiscaux (Cameroun)" : "Legal & Tax IDs (Cameroon)"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Numéro RCCM" : "RCCM Number"}</span>
                  <div className="font-mono font-semibold text-foreground">
                    {party.registrationNumber || "Non renseigné"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Numéro d'Identifiant Unique (NIU)" : "Tax ID (NIU)"}</span>
                  <div className="font-mono font-semibold text-foreground">
                    {party.taxId || "Non renseigné"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics & Metadata Side Card */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Activité au cabinet" : "Firm activity"}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/60">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Dossiers rattachés" : "Linked matters"}</span>
                  <span className="font-bold text-foreground">{party._count?.matterParties || 0}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border/60">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Demandes / Prospects" : "Inquiries"}</span>
                  <span className="font-bold text-foreground">{party._count?.inquiries || 0}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">{locale === "fr" ? "Contacts référencés" : "Contacts"}</span>
                  <span className="font-bold text-foreground">{party.contacts?.length || 0}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{locale === "fr" ? "Historique" : "History"}</span>
              </div>
              <p>
                {locale === "fr" ? "Créé le " : "Created on "}
                {new Date(party.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Contacts & Legal Representatives */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {locale === "fr" ? "Contacts et Représentants légaux" : "Contacts & Legal Representatives"}
            </h2>
            <Button
              size="sm"
              onClick={() => openContactModal()}
              className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "fr" ? "Ajouter un contact" : "Add contact"}
            </Button>
          </div>

          {party.contacts?.length === 0 ? (
            <EmptyState
              title={locale === "fr" ? "Aucun contact enregistré" : "No contacts recorded"}
              description={
                locale === "fr"
                  ? "Ajoutez des personnes de contact, directeurs ou mandataires sociaux pour cette entité."
                  : "Add contact persons, officers or legal representatives for this entity."
              }
              action={
                <Button
                  size="sm"
                  onClick={() => openContactModal()}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {locale === "fr" ? "Ajouter un contact" : "Add contact"}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {party.contacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{contact.name}</span>
                        {contact.isRepresentative && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground border border-accent/30"
                            title={locale === "fr" ? "Représentant légal (OHADA)" : "Legal representative"}
                          >
                            <Star className="h-2.5 w-2.5 fill-accent text-accent" />
                            {locale === "fr" ? "Représentant" : "Representative"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contact.title || (locale === "fr" ? "Contact" : "Contact")}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openContactModal(contact)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingContactId(contact.id)}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground/70" />
                        <span className="font-mono">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground/70" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {!contact.phone && !contact.email && (
                      <span className="text-muted-foreground/50 text-[11px]">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Matters */}
      {activeTab === "matters" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {locale === "fr" ? "Dossiers dans lesquels cette partie intervient" : "Matters involving this party"}
            </h2>
          </div>

          {party.matterParties?.length === 0 ? (
            <EmptyState
              title={locale === "fr" ? "Aucun dossier associé" : "No associated matters"}
              description={
                locale === "fr"
                  ? "Cette partie n'est pas encore rattachée à un dossier du cabinet."
                  : "This party is not currently linked to any firm matter."
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{locale === "fr" ? "Référence & Titre" : "Ref & Title"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Rôle de la partie" : "Role"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Étape du dossier" : "Workflow Step"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Avocat responsable" : "Lead Lawyer"}</th>
                    <th className="px-5 py-3 text-right">{locale === "fr" ? "Détails" : "Details"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {party.matterParties.map((mp: any) => (
                    <tr key={mp.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-accent">
                              {mp.matter.reference}
                            </span>
                            <ConfidentialityChip level={mp.matter.confidentiality} />
                          </div>
                          <Link
                            href={`/${locale}/matters/${mp.matter.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors block"
                          >
                            {mp.matter.title}
                          </Link>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <Badge variant="outline" className="text-xs">
                          {mp.role}
                        </Badge>
                      </td>

                      <td className="px-5 py-4">
                        <StatusChip
                          label={locale === "en" ? mp.matter.workflowStep?.nameEn : mp.matter.workflowStep?.nameFr || "En cours"}
                          tone="primary"
                        />
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {mp.matter.leadLawyer?.name || "—"}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link href={`/${locale}/matters/${mp.matter.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Communications (Placeholder conforming to DESIGN.md 8.4) */}
      {activeTab === "communications" && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {locale === "fr" ? "Fil des communications et échanges" : "Communications and exchanges feed"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {locale === "fr"
              ? "Historique centralisé des emails reçus, appels téléphoniques, courriers et notes d'entretiens rattachés à cette partie."
              : "Centralised history of received emails, calls, letters and consultation notes associated with this party."}
          </p>
        </div>
      )}

      {/* Tab 5: Documents (Placeholder conforming to DESIGN.md 8.4) */}
      {activeTab === "documents" && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {locale === "fr" ? "Documents rattachés à la partie" : "Documents attached to party"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {locale === "fr"
              ? "Statuts OHADA, déclarations fiscales, pièces d'identité scannées et conventions d'honoraires signées."
              : "OHADA statutes, tax certificates, scanned IDs and signed fee agreements."}
          </p>
        </div>
      )}

      {/* Edit Party SidePanel Drawer */}
      <SidePanel
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title={locale === "fr" ? "Modifier la partie" : "Edit party"}
        subtitle={party.displayName}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-5">
          {editError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="editClientStatus">{locale === "fr" ? "Statut client" : "Client status"}</Label>
            <select
              id="editClientStatus"
              value={editClientStatus}
              onChange={(e) => setEditClientStatus(e.target.value as ClientStatus)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="CLIENT">{locale === "fr" ? "Client actif" : "Active client"}</option>
              <option value="PROSPECT">{locale === "fr" ? "Prospect" : "Prospect"}</option>
              <option value="FORMER">{locale === "fr" ? "Ancien client" : "Former client"}</option>
              <option value="NONE">{locale === "fr" ? "Tiers / Intervenant / Adverse" : "Third party / Opposing party"}</option>
            </select>
          </div>

          {party.type === "COMPANY" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editCompanyName">{locale === "fr" ? "Raison sociale *" : "Company name *"}</Label>
                <Input
                  id="editCompanyName"
                  required
                  value={editCompanyName}
                  onChange={(e) => {
                    setEditCompanyName(e.target.value);
                    setEditDisplayName(e.target.value);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editRccm" className="text-xs">{locale === "fr" ? "RCCM" : "RCCM"}</Label>
                  <Input
                    id="editRccm"
                    value={editRccm}
                    onChange={(e) => setEditRccm(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editNiu" className="text-xs">{locale === "fr" ? "NIU" : "NIU"}</Label>
                  <Input
                    id="editNiu"
                    value={editNiu}
                    onChange={(e) => setEditNiu(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editFirstName">{locale === "fr" ? "Prénom" : "First name"}</Label>
                  <Input
                    id="editFirstName"
                    value={editFirstName}
                    onChange={(e) => {
                      setEditFirstName(e.target.value);
                      setEditDisplayName(`${e.target.value} ${editLastName}`.trim());
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editLastName">{locale === "fr" ? "Nom de famille *" : "Last name *"}</Label>
                  <Input
                    id="editLastName"
                    required
                    value={editLastName}
                    onChange={(e) => {
                      setEditLastName(e.target.value);
                      setEditDisplayName(`${editFirstName} ${e.target.value}`.trim());
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editNiuIndiv" className="text-xs">{locale === "fr" ? "NIU" : "NIU"}</Label>
                <Input
                  id="editNiuIndiv"
                  value={editNiu}
                  onChange={(e) => setEditNiu(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editEmail">{locale === "fr" ? "Email" : "Email"}</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editPhone">{locale === "fr" ? "Téléphone" : "Phone"}</Label>
                <Input
                  id="editPhone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="editAddress">{locale === "fr" ? "Adresse" : "Address"}</Label>
                <Input
                  id="editAddress"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCity">{locale === "fr" ? "Ville" : "City"}</Label>
                <Input
                  id="editCity"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending
                ? locale === "fr"
                  ? "Enregistrement..."
                  : "Saving..."
                : locale === "fr"
                ? "Enregistrer les modifications"
                : "Save changes"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Add / Edit Contact SidePanel Drawer */}
      <SidePanel
        open={isContactOpen}
        onOpenChange={setIsContactOpen}
        title={
          editingContactId
            ? locale === "fr"
              ? "Modifier le contact"
              : "Edit contact"
            : locale === "fr"
            ? "Ajouter un contact"
            : "Add contact"
        }
        subtitle={party.displayName}
      >
        <form onSubmit={handleContactSubmit} className="space-y-4">
          {contactError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {contactError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="contactName">{locale === "fr" ? "Nom et prénom *" : "Full name *"}</Label>
            <Input
              id="contactName"
              required
              placeholder="ex: Me Joseph Kamga"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactTitle">{locale === "fr" ? "Fonction / Rôle" : "Title / Position"}</Label>
            <Input
              id="contactTitle"
              placeholder="ex: Directeur Général, Gérant, Avocat Conseil..."
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">{locale === "fr" ? "Email direct" : "Direct email"}</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="j.kamga@entreprise.cm"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">{locale === "fr" ? "Téléphone direct" : "Direct phone"}</Label>
            <Input
              id="contactPhone"
              placeholder="+237 6XX XX XX XX"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="font-mono"
            />
          </div>

          <label className="flex items-start gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contactIsRepresentative}
              onChange={(e) => setContactIsRepresentative(e.target.checked)}
              className="rounded border-input text-primary focus:ring-ring mt-0.5"
            />
            <div className="text-xs">
              <span className="font-semibold text-foreground">
                {locale === "fr" ? "Représentant légal habilité (OHADA)" : "Authorized legal representative"}
              </span>
              <p className="text-muted-foreground">
                {locale === "fr"
                  ? "Ce contact est habilité à engager la société et signer les actes ou conventions."
                  : "This contact is authorized to legally bind the company and sign legal acts."}
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsContactOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending
                ? locale === "fr"
                  ? "Enregistrement..."
                  : "Saving..."
                : locale === "fr"
                ? "Enregistrer le contact"
                : "Save contact"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Delete Contact Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingContactId)}
        onOpenChange={(open) => !open && setDeletingContactId(null)}
        title={locale === "fr" ? "Supprimer le contact" : "Delete contact"}
        consequence={
          locale === "fr"
            ? "Ce contact sera retiré de la fiche de cette partie."
            : "This contact will be removed from this party."
        }
        confirmLabel={locale === "fr" ? "Supprimer" : "Delete"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        onConfirm={handleDeleteContact}
        destructive
      />

      {/* Soft Delete Party Confirmation Dialog */}
      <ConfirmDialog
        open={isArchiveConfirmOpen}
        onOpenChange={setIsArchiveConfirmOpen}
        title={locale === "fr" ? "Archiver la fiche de partie" : "Archive party record"}
        itemName={party.displayName}
        consequence={
          locale === "fr"
            ? "Les dossiers rattachés resteront accessibles, mais la partie n'apparaîtra plus dans les sélecteurs actifs."
            : "Linked matters remain accessible, but the party will no longer appear in active dropdowns."
        }
        confirmLabel={locale === "fr" ? "Archiver" : "Archive"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        onConfirm={handleArchiveParty}
        destructive
      />

      {/* Restore Party Confirmation Dialog */}
      <ConfirmDialog
        open={isRestoreConfirmOpen}
        onOpenChange={setIsRestoreConfirmOpen}
        title={locale === "fr" ? "Restaurer la fiche de partie" : "Restore party record"}
        itemName={party.displayName}
        consequence={
          locale === "fr"
            ? "La partie sera réintégrée dans l'annuaire actif du cabinet."
            : "The party will be restored to the active firm directory."
        }
        confirmLabel={locale === "fr" ? "Restaurer" : "Restore"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        onConfirm={handleRestoreParty}
      />
    </div>
  );
}
