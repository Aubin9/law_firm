"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { PriorityChip } from "@/components/app/priority-chip";
import { ConfidentialityChip } from "@/components/app/confidentiality-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  User,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Lock,
  ExternalLink,
} from "lucide-react";
import { createMatterAction } from "@/server/actions/matter-actions";
import { checkMandatoryConflictAction } from "@/server/actions/conflict-actions";
import { Confidentiality, Priority, MatterAccessLevel, MatterPartyRole } from "@prisma/client";

interface MatterCreateStepperProps {
  categories: { id: string; nameFr: string; nameEn: string }[];
  lawyers: { id: string; name: string }[];
  clients: { id: string; displayName: string; clientStatus: string; type: string }[];
  currentUserId: string;
}

export function MatterCreateStepper({
  categories,
  lawyers,
  clients,
  currentUserId,
}: MatterCreateStepperProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  const queryClientId = searchParams.get("clientId") || "";
  const queryInquiryId = searchParams.get("inquiryId") || "";

  // Stepper state: 1 to 5
  const [step, setStep] = useState<number>(1);

  // Form state
  const [clientId, setClientId] = useState<string>(queryClientId || clients[0]?.id || "");
  const [title, setTitle] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || "");
  const [leadLawyerId, setLeadLawyerId] = useState<string>(currentUserId || lawyers[0]?.id || "");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("STANDARD");
  const [initialMissionTitle, setInitialMissionTitle] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Conflict clearance state
  const [conflictStatus, setConflictStatus] = useState<any>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState<boolean>(false);

  // Check conflict clearance whenever clientId changes
  useEffect(() => {
    if (!clientId) return;
    let isCancelled = false;

    async function checkConflict() {
      setIsCheckingConflict(true);
      try {
        const res = await checkMandatoryConflictAction({ partyId: clientId });
        if (!isCancelled) {
          setConflictStatus(res);
        }
      } catch (err) {
        console.error("Conflict check failed:", err);
      } finally {
        if (!isCancelled) setIsCheckingConflict(false);
      }
    }

    checkConflict();
    return () => {
      isCancelled = true;
    };
  }, [clientId]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedLead = lawyers.find((l) => l.id === leadLawyerId);

  // Submit final creation
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!conflictStatus?.resolved) {
      setFormError(
        locale === "fr"
          ? "L'ouverture est bloquée : le contrôle déontologique des conflits d'intérêts doit être résolu avant la création (Règle BR-03)."
          : "Matter opening blocked: conflict check must be cleared before creation (Rule BR-03)."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await createMatterAction({
          clientId,
          title: title.trim(),
          categoryId,
          leadLawyerId,
          priority,
          confidentiality,
          initialMissionTitle: initialMissionTitle.trim() || undefined,
          inquiryId: queryInquiryId || null,
        });

        if (res.success && res.matter) {
          router.push(`/${locale}/matters/${res.matter.id}`);
        }
      } catch (err: any) {
        setFormError(err.message || "Erreur lors de la création du dossier.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={locale === "fr" ? "Ouverture d'un nouveau dossier" : "Open new matter"}
        description={
          locale === "fr"
            ? "Processus guidé d'ouverture conforme aux règles déontologiques et OHADA (MAT-01 à MAT-07)"
            : "Guided matter opening process conforming to ethical and OHADA standards"
        }
        actions={
          <Link href={`/${locale}/matters`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
          </Link>
        }
      />

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-5 gap-2 border-b border-border pb-4 text-xs font-semibold">
        {[
          { num: 1, label: locale === "fr" ? "1. Client & Parties" : "1. Client & Parties" },
          { num: 2, label: locale === "fr" ? "2. Catégorie & Lead" : "2. Category & Lead" },
          { num: 3, label: locale === "fr" ? "3. Sécurité & Priorité" : "3. Security & Priority" },
          { num: 4, label: locale === "fr" ? "4. Missions" : "4. Missions" },
          { num: 5, label: locale === "fr" ? "5. Checklist & Revue" : "5. Review & Checklist" },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
              step === s.num
                ? "border-primary text-primary"
                : step > s.num
                ? "border-success text-success"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                step > s.num
                  ? "bg-success text-success-foreground"
                  : step === s.num
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {step > s.num ? <Check className="h-3 w-3" /> : s.num}
            </span>
            <span className="truncate hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stepper Form Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* STEP 1: Client & Parties */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    {locale === "fr" ? "Étape 1 : Client principal et intitulé" : "Step 1: Primary client and title"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr"
                      ? "Sélectionnez le client demandeur et définissez l'intitulé contractuel du dossier."
                      : "Select the requesting client and enter the formal matter title."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="matterTitle">{locale === "fr" ? "Intitulé du dossier *" : "Matter title *"}</Label>
                  <Input
                    id="matterTitle"
                    required
                    placeholder="ex: Contentieux commercial c/ Société X"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="matterClient">{locale === "fr" ? "Client principal *" : "Primary client *"}</Label>
                  <select
                    id="matterClient"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.clientStatus})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conflict Status Preview */}
                <div className="pt-2">
                  {isCheckingConflict ? (
                    <div className="text-xs text-muted-foreground">
                      {locale === "fr" ? "Vérification déontologique en cours..." : "Checking conflicts..."}
                    </div>
                  ) : conflictStatus?.resolved ? (
                    <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                      <span>
                        {locale === "fr"
                          ? `Contrôle de conflit validé : ${conflictStatus.latestCheck?.result}`
                          : `Conflict check cleared: ${conflictStatus.latestCheck?.result}`}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-warning">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {locale === "fr"
                            ? "Contrôle de conflit d'intérêts non résolu"
                            : "Conflict of interest unresolved"}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {conflictStatus?.reason || "Une vérification déontologique est obligatoire avant ouverture."}
                      </p>
                      {selectedClient && (
                        <Link
                          href={`/${locale}/conflicts?query=${encodeURIComponent(selectedClient.displayName)}&partyId=${selectedClient.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-bold text-primary hover:underline text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {locale === "fr" ? "Lancer le contrôle dans un nouvel onglet" : "Run conflict check"}
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    disabled={!title.trim() || !clientId}
                    onClick={() => setStep(2)}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {locale === "fr" ? "Suivant : Catégorie" : "Next: Category"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Category & Lead Lawyer */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    {locale === "fr" ? "Étape 2 : Domaine juridique et avocat responsable" : "Step 2: Practice category and lead lawyer"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr"
                      ? "Le choix de la catégorie détermine le workflow applicable au dossier."
                      : "The category determines the specific lifecycle workflow."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="categorySelect">{locale === "fr" ? "Catégorie juridique *" : "Category *"}</Label>
                  <select
                    id="categorySelect"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {locale === "en" ? c.nameEn : c.nameFr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="leadSelect">{locale === "fr" ? "Avocat responsable du dossier (Lead Lawyer) *" : "Lead lawyer *"}</Label>
                  <select
                    id="leadSelect"
                    value={leadLawyerId}
                    onChange={(e) => setLeadLawyerId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {lawyers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {locale === "fr"
                      ? "L'avocat responsable reçoit automatiquement les pleins pouvoirs de gestion (MANAGE) sur ce dossier."
                      : "The lead lawyer is automatically granted full MANAGE clearance on this matter."}
                  </p>
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "fr" ? "Précédent" : "Previous"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {locale === "fr" ? "Suivant : Sécurité" : "Next: Security"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Priority & Confidentiality */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    {locale === "fr" ? "Étape 3 : Priorité et niveau de confidentialité" : "Step 3: Priority and confidentiality"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr"
                      ? "Les dossiers STRICT sont masqués pour toute l'équipe sauf les membres expressément habilités."
                      : "STRICT matters are shielded from all team members except explicit members."}
                  </p>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <Label>{locale === "fr" ? "Niveau de priorité" : "Priority"}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["LOW", "NORMAL", "HIGH", "URGENT"] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                          priority === p
                            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                            : "border-border bg-card hover:bg-surface-muted text-muted-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confidentiality Selection */}
                <div className="space-y-2 pt-2">
                  <Label>{locale === "fr" ? "Niveau de confidentialité (PERMISSIONS.md)" : "Confidentiality level"}</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfidentiality("STANDARD")}
                      className={`rounded-lg border p-3 text-left transition-all space-y-1 ${
                        confidentiality === "STANDARD"
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border bg-card hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        Standard
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "fr" ? "Visible par les associés et l'équipe" : "Accessible by partners and team"}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfidentiality("RESTRICTED")}
                      className={`rounded-lg border p-3 text-left transition-all space-y-1 ${
                        confidentiality === "RESTRICTED"
                          ? "border-warning bg-warning-soft ring-2 ring-warning/30"
                          : "border-border bg-card hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-warning-foreground">
                        <Lock className="h-4 w-4 text-warning" />
                        Restreint
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "fr" ? "Accès restreint aux membres et associés" : "Restricted to members and partners"}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfidentiality("STRICT")}
                      className={`rounded-lg border p-3 text-left transition-all space-y-1 ${
                        confidentiality === "STRICT"
                          ? "border-danger bg-danger-soft ring-2 ring-danger/30"
                          : "border-border bg-card hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-danger">
                        <ShieldAlert className="h-4 w-4 text-danger" />
                        Strict
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "fr" ? "Membres désignés uniquement (Self-join requis pour Associé)" : "Designated members only"}
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)} className="text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "fr" ? "Précédent" : "Previous"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(4)}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {locale === "fr" ? "Suivant : Missions" : "Next: Missions"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Initial Mission */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    {locale === "fr" ? "Étape 4 : Première mission ou procédure" : "Step 4: Initial mission or procedure"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr"
                      ? "Vous pouvez définir dès l'ouverture la première mission contractuelle du dossier."
                      : "You can outline the initial contractual mission for this matter."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="initialMission">{locale === "fr" ? "Intitulé de la première mission (optionnel)" : "Initial mission title (optional)"}</Label>
                  <Input
                    id="initialMission"
                    placeholder="ex: Rédaction des conclusions responsives et pièces"
                    value={initialMissionTitle}
                    onChange={(e) => setInitialMissionTitle(e.target.value)}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(3)} className="text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "fr" ? "Précédent" : "Previous"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(5)}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {locale === "fr" ? "Suivant : Récapitulatif" : "Next: Review"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: Review & Confirmation */}
            {step === 5 && (
              <form onSubmit={handleFinalSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    {locale === "fr" ? "Étape 5 : Récapitulatif et validation d'ouverture" : "Step 5: Review and matter opening"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr"
                      ? "Vérifiez les informations avant d'attribuer la référence définitive."
                      : "Review the matter details before generating the formal reference."}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface-muted/40 p-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-muted-foreground">{locale === "fr" ? "Intitulé" : "Title"}</span>
                    <span className="font-semibold text-foreground">{title}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-muted-foreground">{locale === "fr" ? "Client" : "Client"}</span>
                    <span className="font-semibold text-foreground">{selectedClient?.displayName}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-muted-foreground">{locale === "fr" ? "Catégorie" : "Category"}</span>
                    <span className="font-semibold text-foreground">{locale === "en" ? selectedCategory?.nameEn : selectedCategory?.nameFr}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-muted-foreground">{locale === "fr" ? "Avocat responsable" : "Lead lawyer"}</span>
                    <span className="font-semibold text-foreground">{selectedLead?.name}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-muted-foreground">{locale === "fr" ? "Confidentialité" : "Confidentiality"}</span>
                    <ConfidentialityChip level={confidentiality} />
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{locale === "fr" ? "Priorité" : "Priority"}</span>
                    <PriorityChip priority={priority} />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(4)} className="text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "fr" ? "Précédent" : "Previous"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending || !conflictStatus?.resolved}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isPending
                      ? locale === "fr" ? "Création en cours..." : "Creating..."
                      : locale === "fr" ? "Valider et ouvrir le dossier" : "Open matter"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Rail: Opening Checklist (MAT-06) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {locale === "fr" ? "Checklist d'ouverture (MAT-06)" : "Opening checklist (MAT-06)"}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${clientId ? "bg-success text-success-foreground" : "bg-surface-muted text-muted-foreground"}`}>
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className={clientId ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {locale === "fr" ? "Client identifié et sélectionné" : "Client identified and selected"}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${conflictStatus?.resolved ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className={conflictStatus?.resolved ? "text-foreground font-medium" : "text-warning font-semibold"}>
                  {locale === "fr" ? "Contrôle déontologique de conflit résolu" : "Ethical conflict check cleared"}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${categoryId ? "bg-success text-success-foreground" : "bg-surface-muted text-muted-foreground"}`}>
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className={categoryId ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {locale === "fr" ? "Catégorie juridique fixée" : "Practice category set"}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${leadLawyerId ? "bg-success text-success-foreground" : "bg-surface-muted text-muted-foreground"}`}>
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className={leadLawyerId ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {locale === "fr" ? "Avocat responsable désigné" : "Lead lawyer designated"}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="text-foreground font-medium">
                  {locale === "fr" ? `Confidentialité : ${confidentiality}` : `Confidentiality: ${confidentiality}`}
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="text-muted-foreground">
                  {locale === "fr" ? "Convention d'honoraires (étape ultérieure)" : "Fee agreement (next step)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

