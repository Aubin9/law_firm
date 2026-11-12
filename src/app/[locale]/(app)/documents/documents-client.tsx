"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Download,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Briefcase,
  Layers,
  Lock,
  ExternalLink,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { Confidentiality, ScanStatus } from "@prisma/client";

export interface SerializedDocumentItem {
  id: string;
  title: string;
  confidentiality: Confidentiality;
  categoryId: string | null;
  categoryName: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  versionCount: number;
  latestVersionNumber: number;
  latestVersionId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: ScanStatus;
  status: string;
  uploadedBy: string;
  updatedAt: string;
}

interface DocumentsClientProps {
  documents: SerializedDocumentItem[];
  categories: Array<{ id: string; key: string; nameFr: string; nameEn: string }>;
  matters: Array<{ id: string; reference: string; title: string }>;
  locale: "fr" | "en";
  currentUserRole: string;
}

export function DocumentsClient({
  documents,
  categories,
  matters,
  locale,
  currentUserRole,
}: DocumentsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedMatter, setSelectedMatter] = useState("ALL");

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const filteredDocs = documents.filter((doc) => {
    if (selectedCategory !== "ALL" && doc.categoryId !== selectedCategory) return false;
    if (selectedMatter !== "ALL" && doc.matterId !== selectedMatter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchFile = doc.fileName.toLowerCase().includes(q);
      const matchRef = doc.matterReference.toLowerCase().includes(q);
      return matchTitle || matchFile || matchRef;
    }
    return true;
  });

  const renderScanStatusBadge = (status: ScanStatus) => {
    switch (status) {
      case "CLEAN":
        return (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            {locale === "fr" ? "Sain (Antivirus)" : "Clean"}
          </Badge>
        );
      case "INFECTED":
        return (
          <Badge className="text-[10px] bg-red-600 text-white gap-1">
            <ShieldAlert className="h-3 w-3" />
            {locale === "fr" ? "Quarantaine" : "Infected"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <Clock className="h-3 w-3 text-amber-600" />
            {locale === "fr" ? "Analyse en cours" : "Scanning"}
          </Badge>
        );
    }
  };

  const renderConfidentiality = (conf: Confidentiality) => {
    if (conf === "STRICT") {
      return (
        <Badge className="bg-red-900/90 text-white text-[10px] gap-1">
          <Lock className="h-2.5 w-2.5" />
          {locale === "fr" ? "Secret strict" : "Strict secret"}
        </Badge>
      );
    }
    if (conf === "RESTRICTED") {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
          {locale === "fr" ? "Restreint" : "Restricted"}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Registre des Documents & Pièces" : "Document & Evidence Register"}
        description={
          locale === "fr"
            ? "Gestion centrale des pièces procédurales, conclusions, contrats et actes (versionnés et scannés)."
            : "Central register of court pleadings, submissions, contracts and acts (versioned & verified)."
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              locale === "fr"
                ? "Rechercher par titre, fichier, référence dossier..."
                : "Search by title, filename, matter ref..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">
              {locale === "fr" ? "Toutes les catégories" : "All Categories"}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "en" ? c.nameEn : c.nameFr}
              </option>
            ))}
          </select>

          {/* Matter Filter */}
          <select
            value={selectedMatter}
            onChange={(e) => setSelectedMatter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring max-w-[200px]"
          >
            <option value="ALL">
              {locale === "fr" ? "Tous les dossiers" : "All Matters"}
            </option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.reference}
              </option>
            ))}
          </select>

          <span className="text-xs text-muted-foreground font-mono ml-2">
            {filteredDocs.length} {locale === "fr" ? "document(s)" : "document(s)"}
          </span>
        </div>
      </div>

      {/* Documents Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">{locale === "fr" ? "Document & Fichier" : "Document & File"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Catégorie" : "Category"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Version & Taille" : "Version & Size"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Sécurité & Scan" : "Security & Scan"}</th>
                <th className="py-3 px-4 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/5 text-primary border border-border flex-shrink-0">
                        <FileText className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {doc.title}
                          {renderConfidentiality(doc.confidentiality)}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {doc.fileName} · {doc.uploadedBy}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Link
                      href={`/${locale}/matters/${doc.matterId}`}
                      className="inline-flex items-center gap-1 font-mono text-primary hover:underline font-semibold"
                    >
                      <Briefcase className="h-3 w-3 text-gold" />
                      {doc.matterReference}
                    </Link>
                    <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                      {doc.matterTitle}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] bg-surface">
                      {doc.categoryName}
                    </Badge>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-mono text-xs font-semibold">
                      v{doc.latestVersionNumber}
                      {doc.versionCount > 1 && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({doc.versionCount} versions)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {formatFileSize(doc.sizeBytes)}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {renderScanStatusBadge(doc.scanStatus)}
                  </td>

                  <td className="py-3 px-4 text-right">
                    {doc.latestVersionId && doc.scanStatus === "CLEAN" ? (
                      <a
                        href={`/api/documents/${doc.latestVersionId}/download`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {locale === "fr" ? "Télécharger" : "Download"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">
                        {locale === "fr" ? "Non téléchargeable" : "Unavailable"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    {locale === "fr" ? "Aucun document trouvé." : "No documents found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
