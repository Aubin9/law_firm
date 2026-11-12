"use client";

import React, { useState, useTransition } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel } from "@/components/app/side-panel";
import { createWorkflowVersionAction } from "@/server/actions/productivity-actions";
import {
  GitBranch,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Plus,
  Trash2,
  Edit,
  History,
  Layers,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface WorkflowStepItem {
  id?: string;
  key: string;
  nameFr: string;
  nameEn: string;
  color: string;
  position: number;
  isInitial?: boolean;
  isFinal?: boolean;
}

interface WorkflowTransitionItem {
  id?: string;
  fromStepKey: string;
  toStepKey: string;
  permission?: string;
  requiresConfirmation?: boolean;
  requiresJustification?: boolean;
  requiresValidation?: boolean;
}

interface WorkflowDefinitionWithRelations {
  id: string;
  key: string;
  version: number;
  isActive: boolean;
  entity: string;
  nameFr: string;
  nameEn: string;
  steps: WorkflowStepItem[];
  transitions: any[];
}

interface WorkflowEditorClientProps {
  workflows: WorkflowDefinitionWithRelations[];
  locale: "fr" | "en";
  canEdit: boolean;
  userName: string;
  userRoleLabel: string;
}

export function WorkflowEditorClient({
  workflows,
  locale,
  canEdit,
  userName,
  userRoleLabel,
}: WorkflowEditorClientProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinitionWithRelations | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Editor form state
  const [editorSteps, setEditorSteps] = useState<WorkflowStepItem[]>([]);
  const [editorTransitions, setEditorTransitions] = useState<WorkflowTransitionItem[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openEditor = (wf: WorkflowDefinitionWithRelations) => {
    setSelectedWorkflow(wf);
    setEditorSteps(
      wf.steps.map((s) => ({
        key: s.key,
        nameFr: s.nameFr,
        nameEn: s.nameEn,
        color: s.color,
        position: s.position,
        isInitial: s.isInitial,
        isFinal: s.isFinal,
      }))
    );
    setEditorTransitions(
      wf.transitions.map((t) => ({
        fromStepKey: t.fromStep?.key || "",
        toStepKey: t.toStep?.key || "",
        permission: t.requiredPermissionKey || undefined,
        requiresConfirmation: t.requiresConfirmation || false,
        requiresJustification: t.requiresJustification || false,
        requiresValidation: t.requiresValidation || false,
      }))
    );
    setFeedbackMessage(null);
    setIsEditorOpen(true);
  };

  const handleAddStep = () => {
    const newPos = editorSteps.length + 1;
    setEditorSteps([
      ...editorSteps,
      {
        key: `STEP_${newPos}`,
        nameFr: `Nouvelle étape ${newPos}`,
        nameEn: `New Step ${newPos}`,
        color: "#B08D57",
        position: newPos,
        isInitial: false,
        isFinal: false,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const stepToRemove = editorSteps[index];
    if (!stepToRemove) return;
    setEditorSteps(editorSteps.filter((_, i) => i !== index));
    // Also remove any transitions referencing this step
    setEditorTransitions(
      editorTransitions.filter(
        (t) => t.fromStepKey !== stepToRemove.key && t.toStepKey !== stepToRemove.key
      )
    );
  };

  const handleAddTransition = () => {
    if (editorSteps.length < 2) return;
    setEditorTransitions([
      ...editorTransitions,
      {
        fromStepKey: editorSteps[0]?.key || "",
        toStepKey: editorSteps[1]?.key || "",
        requiresConfirmation: false,
        requiresJustification: false,
        requiresValidation: false,
      },
    ]);
  };

  const handleRemoveTransition = (index: number) => {
    setEditorTransitions(editorTransitions.filter((_, i) => i !== index));
  };

  const handleSaveNewVersion = () => {
    if (!selectedWorkflow) return;
    setFeedbackMessage(null);

    startTransition(async () => {
      try {
        const res = await createWorkflowVersionAction(
          selectedWorkflow.id,
          editorSteps,
          editorTransitions
        );

        if (res.success) {
          setFeedbackMessage({
            type: "success",
            text:
              locale === "fr"
                ? `Nouvelle version v${res.definition?.version} créée avec succès. L'historique des dossiers précédents est intégralement préservé.`
                : `New version v${res.definition?.version} created successfully. Historical records preserved.`,
          });
          setTimeout(() => {
            setIsEditorOpen(false);
            window.location.reload();
          }, 1500);
        } else {
          setFeedbackMessage({
            type: "error",
            text: res.error || "Erreur de création de version",
          });
        }
      } catch (err: any) {
        setFeedbackMessage({
          type: "error",
          text: err.message || "Erreur imprévue",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Cycles de travail & Workflows" : "Workflow Engines"}
        description={
          locale === "fr"
            ? "Configuration des cycles de vie (étapes, couleurs, transitions et règles de validation). Toute modification génère une nouvelle version sans altérer l'historique (REC-24)."
            : "Configured lifecycle workflows (steps, colors, transitions, and validation rules). Edits create a new version preserving past history (REC-24)."
        }
      />

        <div className="grid grid-cols-1 gap-6">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-white border border-[#E5E0D8] rounded-xl shadow-xs p-6 hover:border-[#D1C9BE] transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#F0EBE1]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary border border-border flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">
                      {locale === "fr" ? wf.nameFr : wf.nameEn}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {wf.key}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 font-bold">
                        v{wf.version}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-[#FAF9F6]">
                        {wf.entity}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    {wf.steps.length} {locale === "fr" ? "étapes" : "steps"} · {wf.transitions.length} {locale === "fr" ? "transitions" : "transitions"}
                  </span>

                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => openEditor(wf)}
                      className="gap-1.5 text-xs bg-primary hover:bg-primary/95 text-white"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      {locale === "fr" ? "Éditer (Créer v" + (wf.version + 1) + ")" : "Edit (Create v" + (wf.version + 1) + ")"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Steps Progress Ribbon */}
              <div className="my-5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  {locale === "fr" ? "Séquence des étapes" : "Step Sequence"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {wf.steps.map((step) => (
                    <div
                      key={step.id || step.key}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-2xs"
                      style={{
                        borderColor: step.color ? `${step.color}40` : "#E5E0D8",
                        backgroundColor: step.color ? `${step.color}10` : "#FAF9F6",
                        color: step.color || "#1F2A44",
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: step.color || "#1F2A44" }}
                      />
                      <span className="font-semibold">{locale === "fr" ? step.nameFr : step.nameEn}</span>
                      {step.isInitial && (
                        <span className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-border font-bold uppercase text-primary">
                          Init
                        </span>
                      )}
                      {step.isFinal && (
                        <span className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-border font-bold uppercase text-emerald-800">
                          Fin
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Transitions List */}
              <div className="pt-4 border-t border-[#F0EBE1]">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  {locale === "fr" ? "Règles de transition autorisées" : "Allowed Transitions & Guards"}
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {wf.transitions.map((tr: any) => (
                    <div
                      key={tr.id || `${tr.fromStepKey}_${tr.toStepKey}`}
                      className="p-2.5 rounded-lg border border-[#E5E0D8] bg-[#FAF9F6] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold text-primary">
                        <span>{tr.fromStep ? (locale === "fr" ? tr.fromStep.nameFr : tr.fromStep.nameEn) : tr.fromStepKey}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gold flex-shrink-0 mx-1" />
                        <span>{tr.toStep ? (locale === "fr" ? tr.toStep.nameFr : tr.toStep.nameEn) : tr.toStepKey}</span>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {tr.requiresConfirmation && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            Confirmation
                          </span>
                        )}
                        {tr.requiresJustification && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Motif requis
                          </span>
                        )}
                        {tr.requiresValidation && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                            Validation avocat
                          </span>
                        )}
                        {tr.requiredPermissionKey && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                            {tr.requiredPermissionKey}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* Workflow Editor SidePanel (REC-24) */}
      <SidePanel
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        title={
          selectedWorkflow
            ? locale === "fr"
              ? `Créer version v${selectedWorkflow.version + 1} — ${selectedWorkflow.nameFr}`
              : `Create version v${selectedWorkflow.version + 1} — ${selectedWorkflow.nameEn}`
            : ""
        }
        subtitle={
          locale === "fr"
            ? "L'ancienne version restera active pour les éléments en cours et l'historique sera préservé (REC-24)."
            : "Past history and existing items remain untouched under their current version."
        }
      >
        <div className="space-y-6 pt-2 text-xs">
          {feedbackMessage && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Section 1: Étapes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <h4 className="font-bold text-primary flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gold" />
                {locale === "fr" ? "Étapes du workflow" : "Workflow Steps"}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStep}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                {locale === "fr" ? "Ajouter étape" : "Add Step"}
              </Button>
            </div>

            <div className="space-y-3">
              {editorSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border bg-[#FAF9F6] space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-[11px]">
                      Étape #{idx + 1} ({step.key})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Nom (FR)</Label>
                      <Input
                        value={step.nameFr}
                        onChange={(e) => {
                          const next = [...editorSteps];
                          next[idx].nameFr = e.target.value;
                          setEditorSteps(next);
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Name (EN)</Label>
                      <Input
                        value={step.nameEn}
                        onChange={(e) => {
                          const next = [...editorSteps];
                          next[idx].nameEn = e.target.value;
                          setEditorSteps(next);
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center pt-1">
                    <div>
                      <Label className="text-[10px]">Couleur (Hex)</Label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={step.color}
                          onChange={(e) => {
                            const next = [...editorSteps];
                            next[idx].color = e.target.value;
                            setEditorSteps(next);
                          }}
                          className="h-7 w-7 rounded border border-border cursor-pointer p-0"
                        />
                        <Input
                          value={step.color}
                          onChange={(e) => {
                            const next = [...editorSteps];
                            next[idx].color = e.target.value;
                            setEditorSteps(next);
                          }}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 text-[11px] pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.isInitial || false}
                        onChange={(e) => {
                          const next = [...editorSteps];
                          next[idx].isInitial = e.target.checked;
                          setEditorSteps(next);
                        }}
                      />
                      <span>Initiale</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.isFinal || false}
                        onChange={(e) => {
                          const next = [...editorSteps];
                          next[idx].isFinal = e.target.checked;
                          setEditorSteps(next);
                        }}
                      />
                      <span>Finale</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Transitions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <h4 className="font-bold text-primary flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-gold" />
                {locale === "fr" ? "Transitions & Règles de passage" : "Transitions & Guard Rules"}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTransition}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                {locale === "fr" ? "Ajouter transition" : "Add Transition"}
              </Button>
            </div>

            <div className="space-y-3">
              {editorTransitions.map((tr, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border bg-[#FAF9F6] space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-[11px]">
                      Transition #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTransition(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Depuis l'étape</Label>
                      <select
                        value={tr.fromStepKey}
                        onChange={(e) => {
                          const next = [...editorTransitions];
                          next[idx].fromStepKey = e.target.value;
                          setEditorTransitions(next);
                        }}
                        className="w-full h-8 text-xs rounded border border-border bg-white px-2"
                      >
                        {editorSteps.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.nameFr} ({s.key})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[10px]">Vers l'étape</Label>
                      <select
                        value={tr.toStepKey}
                        onChange={(e) => {
                          const next = [...editorTransitions];
                          next[idx].toStepKey = e.target.value;
                          setEditorTransitions(next);
                        }}
                        className="w-full h-8 text-xs rounded border border-border bg-white px-2"
                      >
                        {editorSteps.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.nameFr} ({s.key})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tr.requiresConfirmation || false}
                        onChange={(e) => {
                          const next = [...editorTransitions];
                          next[idx].requiresConfirmation = e.target.checked;
                          setEditorTransitions(next);
                        }}
                      />
                      <span>Confirmation</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tr.requiresJustification || false}
                        onChange={(e) => {
                          const next = [...editorTransitions];
                          next[idx].requiresJustification = e.target.checked;
                          setEditorTransitions(next);
                        }}
                      />
                      <span>Motif obligatoire</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tr.requiresValidation || false}
                        onChange={(e) => {
                          const next = [...editorTransitions];
                          next[idx].requiresValidation = e.target.checked;
                          setEditorTransitions(next);
                        }}
                      />
                      <span>Validation avocat</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleSaveNewVersion}
              disabled={isPending || editorSteps.length === 0}
              className="bg-primary hover:bg-primary/95 text-white gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              {locale === "fr"
                ? `Créer et activer la version v${(selectedWorkflow?.version || 1) + 1}`
                : `Create & activate version v${(selectedWorkflow?.version || 1) + 1}`}
            </Button>
          </div>
        </div>
      </SidePanel>
    </div>
  );
}

