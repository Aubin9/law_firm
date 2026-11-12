"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  closestCorners,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SidePanel } from "@/components/app/side-panel";
import { PriorityChip } from "@/components/app/priority-chip";
import {
  Clock,
  Briefcase,
  User,
  MoreVertical,
  ArrowRight,
  AlertCircle,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { executeTransitionAction } from "@/server/workflow/workflow-actions";
import { WorkflowEntity, Priority } from "@prisma/client";

export interface KanbanItem {
  id: string;
  title: string;
  stepKey: string;
  priority?: Priority;
  dueAt?: Date | string | null;
  matterTitle?: string;
  assigneeName?: string;
  requiresValidation?: boolean;
  description?: string;
}

export interface KanbanColumn {
  key: string;
  nameFr: string;
  nameEn: string;
  color?: string;
  items: KanbanItem[];
}

export interface KanbanBoardProps {
  entityType: WorkflowEntity;
  columns: KanbanColumn[];
  locale?: "fr" | "en";
  onItemClick?: (item: KanbanItem) => void;
  onRefresh?: () => void;
  enableSwimlanes?: boolean;
}

export function KanbanBoard({
  entityType,
  columns,
  locale = "fr",
  onItemClick,
  onRefresh,
  enableSwimlanes = true,
}: KanbanBoardProps) {
  const [boardColumns, setBoardColumns] = useState<KanbanColumn[]>(columns);
  const [swimlaneMode, setSwimlaneMode] = useState<"none" | "assignee">("none");
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

  // Transition dialog state
  const [pendingTransition, setPendingTransition] = useState<{
    itemId: string;
    targetStepKey: string;
    requiresJustification?: boolean;
    requiresConfirmation?: boolean;
  } | null>(null);
  const [justification, setJustification] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail SidePanel state
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);

  React.useEffect(() => {
    setBoardColumns(columns);
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const allItems = boardColumns.flatMap((c) => c.items);
    const item = allItems.find((i) => i.id === active.id);
    if (item) setActiveItem(item);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const sourceItemId = String(active.id);
    const targetStepKey = String(over.id);

    const sourceColumn = boardColumns.find((c) =>
      c.items.some((i) => i.id === sourceItemId)
    );
    if (!sourceColumn || sourceColumn.key === targetStepKey) return;

    // Trigger transition
    await executeTransition(sourceItemId, targetStepKey);
  };

  const executeTransition = async (
    itemId: string,
    targetStepKey: string,
    inputJustification?: string
  ) => {
    setErrorMessage(null);
    try {
      await executeTransitionAction(entityType, itemId, targetStepKey, {
        confirmed: true,
        justification: inputJustification,
      });

      // Update state locally
      setBoardColumns((prev) => {
        let movedItem: KanbanItem | null = null;
        const next = prev.map((col) => {
          const item = col.items.find((i) => i.id === itemId);
          if (item) movedItem = { ...item, stepKey: targetStepKey };
          return {
            ...col,
            items: col.items.filter((i) => i.id !== itemId),
          };
        });

        if (movedItem) {
          const targetCol = next.find((c) => c.key === targetStepKey);
          if (targetCol) targetCol.items.push(movedItem);
        }
        return next;
      });

      setPendingTransition(null);
      setJustification("");
      onRefresh?.();
    } catch (err: any) {
      // If requires justification or confirmation, open dialog
      if (
        err.message?.includes("justification") ||
        err.message?.includes("JUSTIFICATION_REQUIRED")
      ) {
        setPendingTransition({
          itemId,
          targetStepKey,
          requiresJustification: true,
        });
      } else {
        setErrorMessage(err.message || "Transition impossible");
        setTimeout(() => setErrorMessage(null), 4000);
      }
    }
  };

  const uniqueAssignees = React.useMemo(() => {
    const set = new Set<string>();
    boardColumns.forEach((c) =>
      c.items.forEach((i) =>
        set.add(i.assigneeName || (locale === "fr" ? "Non assigné" : "Unassigned"))
      )
    );
    return Array.from(set).sort();
  }, [boardColumns, locale]);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-900 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Kanban Toolbar: Swimlane toggle */}
      {enableSwimlanes && (
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {locale === "fr" ? "Affichage :" : "Display:"}
            </span>
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs shadow-xs">
              <button
                type="button"
                onClick={() => setSwimlaneMode("none")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  swimlaneMode === "none"
                    ? "bg-primary text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {locale === "fr" ? "Colonnes simples" : "Columns"}
              </button>
              <button
                type="button"
                onClick={() => setSwimlaneMode("assignee")}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  swimlaneMode === "assignee"
                    ? "bg-primary text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="w-3 h-3" />
                {locale === "fr" ? "Couloirs par responsable" : "By Assignee"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {swimlaneMode === "none" ? (
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[550px]">
            {boardColumns.map((column) => (
              <KanbanColumnComponent
                key={column.key}
                column={column}
                locale={locale}
                onCardClick={(item) => setSelectedItem(item)}
                onMoveTo={(itemId, step) => executeTransition(itemId, step)}
                availableSteps={boardColumns.map((c) => ({
                  key: c.key,
                  name: locale === "fr" ? c.nameFr : c.nameEn,
                }))}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6 min-h-[550px]">
            {uniqueAssignees.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                {locale === "fr" ? "Aucun responsable assigné." : "No assignees found."}
              </div>
            ) : (
              uniqueAssignees.map((assignee) => (
                <div key={assignee} className="rounded-xl border border-border bg-surface-muted/20 p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary">{assignee}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (
                      {boardColumns.reduce(
                        (acc, col) =>
                          acc +
                          col.items.filter(
                            (i) =>
                              (i.assigneeName ||
                                (locale === "fr" ? "Non assigné" : "Unassigned")) === assignee
                          ).length,
                        0
                      )}{" "}
                      {locale === "fr" ? "éléments" : "items"})
                    </span>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 items-start">
                    {boardColumns.map((column) => {
                      const laneCol: KanbanColumn = {
                        ...column,
                        items: column.items.filter(
                          (i) =>
                            (i.assigneeName ||
                              (locale === "fr" ? "Non assigné" : "Unassigned")) === assignee
                        ),
                      };
                      return (
                        <KanbanColumnComponent
                          key={`${assignee}_${column.key}`}
                          column={laneCol}
                          locale={locale}
                          onCardClick={(item) => setSelectedItem(item)}
                          onMoveTo={(itemId, step) => executeTransition(itemId, step)}
                          availableSteps={boardColumns.map((c) => ({
                            key: c.key,
                            name: locale === "fr" ? c.nameFr : c.nameEn,
                          }))}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <DragOverlay>
          {activeItem ? (
            <div className="w-[280px] p-3.5 bg-white border-2 border-primary/40 rounded-xl shadow-xl rotate-1 opacity-90">
              <span className="text-xs font-semibold text-primary block mb-2">
                {activeItem.title}
              </span>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                {activeItem.priority && (
                  <PriorityChip priority={activeItem.priority} locale={locale} />
                )}
                <span>{activeItem.assigneeName}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Justification Modal */}
      {pendingTransition && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-xl shadow-xl p-6">
            <h3 className="text-sm font-semibold text-primary mb-1">
              {locale === "fr" ? "Motif de transition obligatoire" : "Justification Required"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {locale === "fr"
                ? "Veuillez consigner un motif explicatif pour cette étape (ex: classement, annulation, refus)."
                : "Please enter an explanation for this workflow transition."}
            </p>

            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={
                locale === "fr"
                  ? "Indiquez la justification (minimum 5 caractères)..."
                  : "Enter reason..."
              }
              className="w-full text-xs p-3 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary"
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingTransition(null);
                  setJustification("");
                }}
                className="text-xs"
              >
                {locale === "fr" ? "Annuler" : "Cancel"}
              </Button>
              <Button
                size="sm"
                disabled={justification.trim().length < 5}
                onClick={() =>
                  executeTransition(
                    pendingTransition.itemId,
                    pendingTransition.targetStepKey,
                    justification
                  )
                }
                className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold"
              >
                {locale === "fr" ? "Valider le passage" : "Confirm Move"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail SidePanel */}
      <SidePanel
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        title={selectedItem?.title || ""}
        subtitle={
          selectedItem?.matterTitle ||
          (locale === "fr" ? "Détails de l'élément" : "Item details")
        }
      >
        {selectedItem && (
          <div className="space-y-5 pt-3 text-xs text-primary">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                {locale === "fr" ? "Statut actuel" : "Current Step"}
              </span>
              <Badge variant="outline" className="text-xs border-[#E5E0D8] bg-[#FAF9F6]">
                {boardColumns.find((c) => c.key === selectedItem.stepKey)?.nameFr ||
                  selectedItem.stepKey}
              </Badge>
            </div>

            {selectedItem.description && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Description
                </span>
                <p className="p-3 bg-[#FAF9F6] border border-[#E5E0D8] rounded-lg leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F0EBE1]">
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  {locale === "fr" ? "Priorité" : "Priority"}
                </span>
                {selectedItem.priority && (
                  <div className="mt-1">
                    <PriorityChip priority={selectedItem.priority} locale={locale} />
                  </div>
                )}
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">
                  {locale === "fr" ? "Responsable" : "Assignee"}
                </span>
                <span className="font-medium mt-1 block">
                  {selectedItem.assigneeName || "—"}
                </span>
              </div>
            </div>

            {selectedItem.requiresValidation && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  {locale === "fr"
                    ? "Tâche soumise à validation juridique obligatoire par un avocat."
                    : "Task requires formal legal validation by a lawyer."}
                </span>
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}

// Droppable Column Component
function KanbanColumnComponent({
  column,
  locale,
  onCardClick,
  onMoveTo,
  availableSteps,
}: {
  column: KanbanColumn;
  locale: "fr" | "en";
  onCardClick: (item: KanbanItem) => void;
  onMoveTo: (itemId: string, stepKey: string) => void;
  availableSteps: { key: string; name: string }[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.key,
  });

  const headerColor = column.color || "#1F2A44";

  return (
    <div
      ref={setNodeRef}
      className={`w-[296px] flex-shrink-0 bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl flex flex-col max-h-[750px] shadow-sm transition-colors ${
        isOver ? "bg-primary/5 border-primary/40 ring-2 ring-primary/20" : ""
      }`}
    >
      {/* Column Header */}
      <div
        className="p-3.5 border-b border-[#E5E0D8] bg-white rounded-t-xl flex items-center justify-between"
        style={{ borderTop: `3px solid ${headerColor}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">
            {locale === "fr" ? column.nameFr : column.nameEn}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground">
            {column.items.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
        {column.items.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground border border-dashed border-[#E5E0D8] rounded-lg">
            {locale === "fr" ? "Aucun élément" : "No items"}
          </div>
        ) : (
          column.items.map((item) => (
            <KanbanCardComponent
              key={item.id}
              item={item}
              locale={locale}
              onCardClick={onCardClick}
              onMoveTo={onMoveTo}
              availableSteps={availableSteps}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Draggable Card Component
function KanbanCardComponent({
  item,
  locale,
  onCardClick,
  onMoveTo,
  availableSteps,
}: {
  item: KanbanItem;
  locale: "fr" | "en";
  onCardClick: (item: KanbanItem) => void;
  onMoveTo: (itemId: string, stepKey: string) => void;
  availableSteps: { key: string; name: string }[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isOverdue = React.useMemo(() => {
    if (!item.dueAt) return false;
    const finalKeys = ["DONE", "COMPLETED", "CANCELLED", "REFUSED", "ARCHIVED", "CLOSED"];
    if (finalKeys.includes(item.stepKey.toUpperCase())) return false;
    return new Date(item.dueAt).getTime() < Date.now();
  }, [item.dueAt, item.stepKey]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`relative p-3 bg-white border border-[#E5E0D8] rounded-xl shadow-xs hover:shadow-md hover:border-[#D1C9BE] transition-all cursor-grab active:cursor-grabbing text-xs text-primary ${
        isDragging ? "opacity-30 border-dashed border-primary" : ""
      } ${isOverdue ? "border-l-4 border-l-rose-500" : ""}`}
    >
      {/* Top row: Priority / Overdue badge & Move To alternative menu */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.priority && (
            <PriorityChip priority={item.priority} locale={locale} />
          )}
          {isOverdue && (
            <span
              data-testid="overdue-badge"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shadow-2xs"
            >
              <Clock className="w-2.5 h-2.5 text-rose-600" />
              {locale === "fr" ? "En retard" : "Overdue"}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            title={locale === "fr" ? "Déplacer vers..." : "Move to..."}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Move To dropdown alternative to dragging */}
          {isMenuOpen && (
            <div
              className="absolute right-0 top-6 w-44 bg-white border border-[#E5E0D8] rounded-lg shadow-lg z-30 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block border-b border-[#F0EBE1]">
                {locale === "fr" ? "Déplacer vers" : "Move to"}
              </span>
              {availableSteps
                .filter((s) => s.key !== item.stepKey)
                .map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onMoveTo(item.id, step.key);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#FAF9F6] text-primary flex items-center justify-between"
                  >
                    <span>{step.name}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Title (Click opens SidePanel) */}
      <h4
        onClick={() => onCardClick(item)}
        className="font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer mb-2 leading-snug line-clamp-2"
      >
        {item.title}
      </h4>

      {/* Linked Matter / Client */}
      {item.matterTitle && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
          <Briefcase className="w-3 h-3 flex-shrink-0 text-gold" />
          <span className="truncate">{item.matterTitle}</span>
        </div>
      )}

      {/* Bottom row: Assignee & Due Date */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F0EBE1] text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[120px]">{item.assigneeName || "Non assigné"}</span>
        </span>

        {item.dueAt && (
          <span className="font-mono flex items-center gap-1 text-[10px]">
            <Clock className="w-3 h-3" />
            {new Date(item.dueAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
