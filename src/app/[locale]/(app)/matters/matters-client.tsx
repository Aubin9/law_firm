"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { PriorityChip } from "@/components/app/priority-chip";
import { ConfidentialityChip } from "@/components/app/confidentiality-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { KanbanBoard, KanbanColumn, KanbanItem } from "@/components/app/kanban-board";
import {
  Briefcase,
  Plus,
  Search,
  User,
  Building2,
  Calendar,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Kanban as KanbanIcon,
  Table as TableIcon,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { Confidentiality, Priority } from "@prisma/client";

interface MatterItem {
  id: string;
  reference: string;
  title: string;
  priority: Priority;
  confidentiality: Confidentiality;
  createdAt: Date;
  category: {
    id: string;
    key: string;
    nameFr: string;
    nameEn: string;
  } | null;
  leadLawyer: {
    id: string;
    name: string;
    email: string;
  } | null;
  workflowStep: {
    id: string;
    key: string;
    nameFr: string;
    nameEn: string;
    color: string | null;
  } | null;
  parties?: {
    party: {
      id: string;
      displayName: string;
      type: string;
      clientStatus: string;
    };
  }[];
  matterParties?: {
    party: {
      id: string;
      displayName: string;
      type: string;
      clientStatus: string;
    };
  }[];
  members: {
    userId: string;
    level: string;
    user: {
      name: string;
    };
  }[];
  _count: {
    tasks: number;
    documents: number;
    missions: number;
    procedures: number;
  };
}

interface MattersClientProps {
  initialMatters: MatterItem[];
  categories: { id: string; nameFr: string; nameEn: string }[];
  steps: { id: string; key: string; nameFr: string; nameEn: string; color: string | null }[];
  lawyers: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole?: string;
}

export function MattersClient({
  initialMatters,
  categories,
  steps,
  lawyers,
  currentUserId,
  currentUserRole,
}: MattersClientProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedConfidentiality, setSelectedConfidentiality] = useState<string>("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  const getParties = (m: MatterItem) => m.parties || m.matterParties || [];

  // Filter matters in memory
  const filteredMatters = initialMatters.filter((m) => {
    if (selectedCategory !== "ALL" && m.category?.id !== selectedCategory) return false;
    if (selectedConfidentiality !== "ALL" && m.confidentiality !== selectedConfidentiality) return false;

    if (onlyMine) {
      const isLead = m.leadLawyer?.id === currentUserId;
      const isMember = m.members?.some((mem) => mem.userId === currentUserId) || false;
      if (!isLead && !isMember) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = m.reference.toLowerCase().includes(q);
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchClient = getParties(m).some((p) => p.party?.displayName.toLowerCase().includes(q));
      return matchRef || matchTitle || matchClient;
    }

    return true;
  });

  // Build Kanban columns for matter statuses
  const kanbanColumns: KanbanColumn[] = steps.map((step) => {
    const columnItems: KanbanItem[] = filteredMatters
      .filter((m) => m.workflowStep?.id === step.id)
      .map((m) => ({
        id: m.id,
        title: `${m.reference} - ${m.title}`,
        stepKey: step.key,
        matterTitle: getParties(m)[0]?.party?.displayName,
        assigneeName: m.leadLawyer?.name || "—",
        priority: m.priority,
      }));

    return {
      key: step.key,
      nameFr: step.nameFr,
      nameEn: step.nameEn,
      color: step.color || "#1F2A44",
      items: columnItems,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Dossiers & Affaires" : "Matters & Cases"}
        description={
          locale === "fr"
            ? "Gestion centrale des dossiers, procédures, missions et habilitations de l'équipe"
            : "Centralised management of matters, procedures, missions and team clearances"
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <TableIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Tableau" : "Table"}
              </Button>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <KanbanIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Pipeline" : "Pipeline"}
              </Button>
            </div>

            <Link href={`/${locale}/matters/new`}>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                {locale === "fr" ? "Nouveau dossier" : "New matter"}
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              locale === "fr"
                ? "Rechercher par référence (MAT-...), titre, client..."
                : "Search by ref, title, client..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Toutes les catégories" : "All categories"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "en" ? c.nameEn : c.nameFr}
              </option>
            ))}
          </select>

          {/* Confidentiality Filter */}
          <select
            value={selectedConfidentiality}
            onChange={(e) => setSelectedConfidentiality(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Toute confidentialité" : "All confidentiality"}</option>
            <option value="STANDARD">Standard</option>
            <option value="RESTRICTED">Restreint</option>
            <option value="STRICT">Strict</option>
          </select>

          {/* Mine Toggle */}
          <Button
            variant={onlyMine ? "secondary" : "outline"}
            size="sm"
            onClick={() => setOnlyMine(!onlyMine)}
            className="text-xs"
          >
            <User className="mr-1.5 h-3.5 w-3.5" />
            {onlyMine
              ? locale === "fr" ? "Mes dossiers (Actif)" : "My matters (Active)"
              : locale === "fr" ? "Mes dossiers" : "My matters"}
          </Button>
        </div>
      </div>

      {/* Main View */}
      {viewMode === "kanban" ? (
        <div className="pt-2">
          <KanbanBoard
            entityType="MATTER"
            columns={kanbanColumns}
            locale={locale}
            onItemClick={(item) => router.push(`/${locale}/matters/${item.id}`)}
            onRefresh={() => router.refresh()}
          />
        </div>
      ) : filteredMatters.length === 0 ? (
        <EmptyState
          title={locale === "fr" ? "Aucun dossier trouvé" : "No matters found"}
          description={
            locale === "fr"
              ? "Aucun dossier ne correspond à vos critères de recherche actuels ou à vos habilitations d'accès."
              : "No matters match your filter criteria or access clearance."
          }
          action={
            <Link href={`/${locale}/matters/new`}>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                {locale === "fr" ? "Ouvrir un dossier" : "Open matter"}
              </Button>
            </Link>
          }
        />
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{locale === "fr" ? "Dossier / Réf" : "Matter / Ref"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Client principal" : "Client"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Catégorie" : "Category"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Avocat responsable" : "Lead"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Statut" : "Status"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Priorité" : "Priority"}</th>
                  <th className="px-5 py-3 text-right">{locale === "fr" ? "Détails" : "Details"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMatters.map((m) => {
                  const clientParty = getParties(m)[0]?.party;
                  return (
                    <tr
                      key={m.id}
                      className="group hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-accent">
                              {m.reference}
                            </span>
                            <ConfidentialityChip level={m.confidentiality} />
                          </div>
                          <Link
                            href={`/${locale}/matters/${m.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors block"
                          >
                            {m.title}
                          </Link>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {clientParty ? (
                          <Link
                            href={`/${locale}/parties/${clientParty.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {clientParty.type === "COMPANY" ? (
                              <Building2 className="h-3.5 w-3.5 text-accent shrink-0" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                            <span className="truncate max-w-[160px]">{clientParty.displayName}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {locale === "en" ? m.category?.nameEn || "General" : m.category?.nameFr || "Général"}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-foreground">
                        {m.leadLawyer?.name || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusChip
                          label={(locale === "en" ? m.workflowStep?.nameEn : m.workflowStep?.nameFr) || "Ouvert"}
                          tone="primary"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <PriorityChip priority={m.priority} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link href={`/${locale}/matters/${m.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
