"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { ConfidentialityChip } from "@/components/app/confidentiality-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Briefcase,
  User,
  Building2,
  Clock,
  Sparkles,
  Lock,
  FileCheck,
} from "lucide-react";
import {
  searchConflictsAction,
  recordConflictCheckAction,
} from "@/server/actions/conflict-actions";
import { ConflictResult } from "@prisma/client";

interface ConflictMatchItem {
  type: "PARTY" | "MATTER_PARTY" | "MATTER";
  id: string;
  displayName: string;
  matchScore: number;
  matchedReasons: string[];
  roleInMatter?: string;
  matterId?: string;
  matterReference?: string;
  matterTitle?: string;
  confidentiality?: string;
  isAdverse?: boolean;
}

interface ConflictCheckHistoryItem {
  id: string;
  queryText: string;
  result: ConflictResult;
  decisionNote: string | null;
  createdAt: Date;
  performedBy: {
    name: string;
    email: string;
  };
  party?: {
    id: string;
    displayName: string;
  } | null;
}

interface ConflictsClientProps {
  initialChecks: ConflictCheckHistoryItem[];
  currentUserRole?: string;
}

export function ConflictsClient({ initialChecks, currentUserRole }: ConflictsClientProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  const isPartner = currentUserRole === "PARTNER";

  const initialQuery = searchParams.get("query") || "";
  const initialPartyId = searchParams.get("partyId") || undefined;

  const [query, setQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(false);
  const [matches, setMatches] = useState<ConflictMatchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Decision form state
  const [selectedResult, setSelectedResult] = useState<ConflictResult>("NONE_FOUND");
  const [decisionNote, setDecisionNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Execute conflict search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const results = await searchConflictsAction(query.trim(), initialPartyId);
      setMatches(results as any);
      setHasSearched(true);

      // Pre-select result suggestion based on matches
      const hasAdverse = results.some((r: any) => r.isAdverse);
      const maxScore = results.length > 0 ? Math.max(...results.map((r: any) => r.matchScore)) : 0;

      if (hasAdverse || maxScore >= 0.8) {
        setSelectedResult("CONFIRMED_CONFLICT");
      } else if (maxScore >= 0.4) {
        setSelectedResult("POTENTIAL_CONFLICT");
      } else {
        setSelectedResult("NONE_FOUND");
      }
    } catch (err: any) {
      setFormError(err.message || "Erreur lors de la recherche de conflits");
    } finally {
      setIsSearching(false);
    }
  };

  // Submit formal decision
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (selectedResult === "WAIVED") {
      if (!isPartner) {
        setFormError(
          locale === "fr"
            ? "Seul un associé du cabinet peut accorder une dérogation de conflit d'intérêts (Règle BR-03)."
            : "Only a partner can grant a conflict waiver (Rule BR-03)."
        );
        return;
      }
      if (!decisionNote.trim()) {
        setFormError(
          locale === "fr"
            ? "Une justification détaillée est obligatoire pour valider une dérogation d'associé."
            : "A detailed justification note is required to validate a partner waiver."
        );
        return;
      }
    }

    if (selectedResult === "CLEARED" && !decisionNote.trim()) {
      setFormError(
        locale === "fr"
          ? "Veuillez préciser le motif de levée du conflit (ex: vérification d'homonymie)."
          : "Please specify the reason for clearing the conflict."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await recordConflictCheckAction({
          queryText: query.trim(),
          partyId: initialPartyId || null,
          result: selectedResult,
          matches: matches,
          decisionNote: decisionNote.trim() || null,
        });

        if (res.success) {
          setSuccessMessage(
            locale === "fr"
              ? "Décision déontologique enregistrée avec succès dans le registre d'audit."
              : "Conflict check decision recorded successfully in the audit log."
          );
          router.refresh();
        }
      } catch (err: any) {
        setFormError(err.message || "Erreur lors de l'enregistrement");
      }
    });
  };

  const getScoreBadge = (score: number, isAdverse?: boolean) => {
    const pct = Math.round(score * 100);
    if (isAdverse || score >= 0.8) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-0.5 text-xs font-bold text-danger border border-danger/30">
          <AlertTriangle className="h-3 w-3" />
          {pct}% - {locale === "fr" ? "Critique" : "Critical"}
        </span>
      );
    }
    if (score >= 0.5) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground border border-warning/30">
          {pct}% - {locale === "fr" ? "Potentiel" : "Potential"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-info/15 px-2 py-0.5 text-xs font-medium text-info-foreground border border-info/30">
        {pct}% - {locale === "fr" ? "Modéré" : "Moderate"}
      </span>
    );
  };

  const getResultBadge = (res: ConflictResult) => {
    switch (res) {
      case "NONE_FOUND":
        return <StatusChip label={locale === "fr" ? "Aucun conflit" : "No conflict"} tone="success" />;
      case "CLEARED":
        return <StatusChip label={locale === "fr" ? "Conflit levé" : "Cleared"} tone="info" />;
      case "WAIVED":
        return <StatusChip label={locale === "fr" ? "Dérogé (Associé)" : "Waived (Partner)"} tone="accent" />;
      case "POTENTIAL_CONFLICT":
        return <StatusChip label={locale === "fr" ? "Conflit potentiel" : "Potential conflict"} tone="warning" />;
      case "CONFIRMED_CONFLICT":
        return <StatusChip label={locale === "fr" ? "Conflit avéré" : "Confirmed conflict"} tone="danger" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Contrôle des conflits d'intérêts" : "Conflict of Interest Check"}
        description={
          locale === "fr"
            ? "Recherche déontologique obligatoire avant toute ouverture de dossier ou acceptation client (Règle BR-03)"
            : "Mandatory ethical check before opening any matter or accepting client intake (Rule BR-03)"
        }
      />

      {/* Main Search Panel */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                locale === "fr"
                  ? "Saisir un nom de personne physique ou morale, raison sociale, RCCM, NIU..."
                  : "Enter individual or company name, trade name, RCCM, NIU..."
              }
              className="pl-10 h-11 text-base shadow-sm"
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shrink-0"
          >
            {isSearching
              ? locale === "fr"
                ? "Recherche en cours..."
                : "Searching..."
              : locale === "fr"
              ? "Lancer le contrôle"
              : "Run conflict check"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          {locale === "fr"
            ? "La recherche analyse en trigrammes tolérants aux accents l'annuaire des parties, toutes les parties adverses dans l'historique des dossiers, ainsi que les références d'affaires."
            : "Search inspects parties directory, all opposing parties across historical matters, and matter titles with diacritic-tolerant trigram similarity."}
        </p>
      </div>

      {/* Search Results & Decision */}
      {hasSearched && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {locale === "fr" ? "Résultats de l'analyse" : "Analysis results"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {matches.length === 0
                    ? locale === "fr"
                      ? "Aucune concordance déontologique trouvée"
                      : "No ethical conflicts found"
                    : `${matches.length} ${locale === "fr" ? "concordance(s) détectée(s)" : "matching record(s) detected"}`}
                </p>
              </div>

              {matches.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success border border-success/30">
                  <CheckCircle2 className="h-4 w-4" />
                  {locale === "fr" ? "Aucun risque identifié" : "No risks identified"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning-foreground border border-warning/30">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  {locale === "fr" ? "Vérification requise" : "Review required"}
                </span>
              )}
            </div>

            {/* Matches Table */}
            {matches.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">{locale === "fr" ? "Similarité" : "Score"}</th>
                      <th className="px-4 py-3">{locale === "fr" ? "Entité / Dossier" : "Entity / Matter"}</th>
                      <th className="px-4 py-3">{locale === "fr" ? "Situation & Rôle" : "Role"}</th>
                      <th className="px-4 py-3">{locale === "fr" ? "Critères de concordance" : "Reasons"}</th>
                      <th className="px-4 py-3 text-right">{locale === "fr" ? "Action" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matches.map((m) => (
                      <tr
                        key={m.id}
                        className={`transition-colors ${m.isAdverse ? "bg-danger/5 hover:bg-danger/10" : "hover:bg-surface-muted/50"}`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getScoreBadge(m.matchScore, m.isAdverse)}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {m.type === "MATTER" ? (
                              <Briefcase className="h-4 w-4 text-accent shrink-0" />
                            ) : (
                              <User className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <span>{m.displayName}</span>
                          </div>
                          {m.matterReference && (
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                              <span>Ref: {m.matterReference}</span>
                              {m.confidentiality && (
                                <ConfidentialityChip level={m.confidentiality as any} />
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs">
                          {m.isAdverse ? (
                            <span className="inline-flex items-center gap-1 font-bold text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {locale === "fr" ? "Partie adverse" : "Opposing party"}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {m.roleInMatter || (locale === "fr" ? "Tiers" : "Third party")}
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {m.matchedReasons.map((r, i) => (
                              <span
                                key={i}
                                className="rounded bg-surface-muted px-2 py-0.5 text-[11px] border border-border"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {m.matterId ? (
                            <Link href={`/${locale}/matters/${m.matterId}`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/${locale}/parties/${m.id.split("_")[0]}`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface-muted/30 p-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "fr" ? "Aucune partie ou dossier concordant" : "No matching parties or matters"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {locale === "fr"
                    ? "Aucun conflit d'intérêts direct n'a été repéré. Vous pouvez enregistrer formellement la conclusion ci-dessous."
                    : "No direct conflict of interest was found. You can officially record this conclusion below."}
                </p>
              </div>
            )}

            {/* Decision Recording Form */}
            <form onSubmit={handleRecordDecision} className="rounded-xl border border-border/80 bg-surface-muted/40 p-5 space-y-4 pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" />
                {locale === "fr" ? "Enregistrer la conclusion formelle" : "Record formal conclusion"}
              </h3>

              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Outcome Radio Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {/* 1. None Found */}
                <button
                  type="button"
                  onClick={() => setSelectedResult("NONE_FOUND")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedResult === "NONE_FOUND"
                      ? "border-success bg-success-soft ring-2 ring-success/30 text-success-foreground font-semibold"
                      : "border-border bg-card hover:bg-surface-muted text-foreground"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5 mb-1 text-success" />
                  <span className="text-xs">{locale === "fr" ? "Aucun conflit" : "No conflict"}</span>
                </button>

                {/* 2. Potential Conflict */}
                <button
                  type="button"
                  onClick={() => setSelectedResult("POTENTIAL_CONFLICT")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedResult === "POTENTIAL_CONFLICT"
                      ? "border-warning bg-warning-soft ring-2 ring-warning/30 text-warning-foreground font-semibold"
                      : "border-border bg-card hover:bg-surface-muted text-foreground"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5 mb-1 text-warning" />
                  <span className="text-xs">{locale === "fr" ? "Conflit potentiel" : "Potential conflict"}</span>
                </button>

                {/* 3. Confirmed Conflict */}
                <button
                  type="button"
                  onClick={() => setSelectedResult("CONFIRMED_CONFLICT")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedResult === "CONFIRMED_CONFLICT"
                      ? "border-danger bg-danger-soft ring-2 ring-danger/30 text-danger-foreground font-semibold"
                      : "border-border bg-card hover:bg-surface-muted text-foreground"
                  }`}
                >
                  <ShieldAlert className="h-5 w-5 mb-1 text-danger" />
                  <span className="text-xs">{locale === "fr" ? "Conflit avéré" : "Confirmed conflict"}</span>
                </button>

                {/* 4. Cleared */}
                <button
                  type="button"
                  onClick={() => setSelectedResult("CLEARED")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedResult === "CLEARED"
                      ? "border-info bg-info-soft ring-2 ring-info/30 text-info-foreground font-semibold"
                      : "border-border bg-card hover:bg-surface-muted text-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5 mb-1 text-info" />
                  <span className="text-xs">{locale === "fr" ? "Conflit levé" : "Conflict cleared"}</span>
                </button>

                {/* 5. Waived (Partner only) */}
                <button
                  type="button"
                  disabled={!isPartner}
                  onClick={() => isPartner && setSelectedResult("WAIVED")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all relative ${
                    !isPartner
                      ? "border-border/50 bg-surface-muted/50 text-muted-foreground opacity-60 cursor-not-allowed"
                      : selectedResult === "WAIVED"
                      ? "border-accent bg-accent-soft ring-2 ring-accent/40 text-foreground font-semibold"
                      : "border-border bg-card hover:bg-surface-muted text-foreground"
                  }`}
                  title={!isPartner ? "Action réservée aux associés (Règle BR-03)" : undefined}
                >
                  <Sparkles className="h-5 w-5 mb-1 text-accent" />
                  <span className="text-xs">{locale === "fr" ? "Dérogation Associé" : "Partner waiver"}</span>
                  {!isPartner && (
                    <span className="absolute top-1 right-1">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </span>
                  )}
                </button>
              </div>

              {/* Justification Note */}
              <div className="space-y-1.5">
                <Label htmlFor="decisionNote" className="text-xs">
                  {locale === "fr" ? "Motif ou observations de la décision *" : "Decision note / rationale *"}
                </Label>
                <Textarea
                  id="decisionNote"
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    selectedResult === "WAIVED"
                      ? locale === "fr"
                        ? "Justification détaillée obligatoire de l'associé autorisant la dérogation..."
                        : "Mandatory detailed partner justification for granting waiver..."
                      : locale === "fr"
                      ? "Observations, vérifications d'identité ou homonymies effectuées..."
                      : "Observations, identity verifications, or notes..."
                  }
                />
              </div>

              <div className="flex justify-end pt-2">
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
                    ? "Enregistrer la décision formelle"
                    : "Save formal decision"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Conflict Checks History */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {locale === "fr" ? "Historique des contrôles déontologiques récents" : "Recent ethical conflict checks"}
        </h2>

        {initialChecks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {locale === "fr"
              ? "Aucun contrôle de conflit n'a encore été enregistré."
              : "No conflict checks recorded yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{locale === "fr" ? "Date" : "Date"}</th>
                  <th className="px-4 py-3">{locale === "fr" ? "Requête" : "Query"}</th>
                  <th className="px-4 py-3">{locale === "fr" ? "Résultat" : "Outcome"}</th>
                  <th className="px-4 py-3">{locale === "fr" ? "Effectué par" : "Conducted by"}</th>
                  <th className="px-4 py-3">{locale === "fr" ? "Motif / Note" : "Note"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialChecks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(chk.createdAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>

                    <td className="px-4 py-3 font-semibold text-foreground text-xs">
                      {chk.queryText}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {getResultBadge(chk.result)}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {chk.performedBy.name}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {chk.decisionNote || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

