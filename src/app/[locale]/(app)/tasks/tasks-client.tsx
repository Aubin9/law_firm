"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  Clock,
  Plus,
  Search,
  Filter,
  Kanban as KanbanIcon,
  Table as TableIcon,
  AlertTriangle,
  User,
  CheckCircle2,
  Briefcase,
  Calendar,
  Sparkles,
} from "lucide-react";
import { createTaskAction, updateTaskStatusAction } from "@/server/actions/task-actions";
import {
  bulkUpdateTasksStatusAction,
  bulkAssignTasksAction,
} from "@/server/actions/productivity-actions";
import { TaskStatus, Priority } from "@prisma/client";

export interface SerializedTaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueAt: string | null;
  startAt: string | null;
  estimatedMinutes: number | null;
  matterId: string | null;
  matterReference: string | null;
  matterTitle: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  checklistTotal: number;
  checklistDone: number;
}

interface TasksClientProps {
  tasks: SerializedTaskItem[];
  users: Array<{ id: string; name: string; email: string }>;
  matters: Array<{ id: string; reference: string; title: string }>;
  locale: "fr" | "en";
  currentUserId: string;
}

export function TasksClient({
  tasks: initialTasks,
  users,
  matters,
  locale,
  currentUserId,
}: TasksClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<SerializedTaskItem[]>(initialTasks);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Create task modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newMatterId, setNewMatterId] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const now = new Date();

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
    if (assigneeFilter === "ME" && task.assigneeId !== currentUserId) return false;
    if (assigneeFilter !== "ALL" && assigneeFilter !== "ME" && task.assigneeId !== assigneeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q) || false;
      const matchMatter = task.matterReference?.toLowerCase().includes(q) || false;
      return matchTitle || matchDesc || matchMatter;
    }
    return true;
  });

  const handleStatusChange = async (taskId: string, nextStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, targetTask?.matterId || "", nextStatus);
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
        );
      }
    });
  };

  const handleBulkStatusChange = async (nextStatus: TaskStatus) => {
    if (selectedTaskIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateTasksStatusAction(
        selectedTaskIds,
        nextStatus
      );
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) =>
            selectedTaskIds.includes(t.id) ? { ...t, status: nextStatus } : t
          )
        );
        setSelectedTaskIds([]);
      }
    });
  };

  const handleBulkAssign = async (assigneeId: string) => {
    if (selectedTaskIds.length === 0) return;
    const targetUser = users.find((u) => u.id === assigneeId);
    startTransition(async () => {
      const res = await bulkAssignTasksAction(
        selectedTaskIds,
        assigneeId || null
      );
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) =>
            selectedTaskIds.includes(t.id)
              ? {
                  ...t,
                  assigneeId: assigneeId || null,
                  assigneeName: targetUser?.name || null,
                }
              : t
          )
        );
        setSelectedTaskIds([]);
      }
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setErrorMessage(null);

    startTransition(async () => {
      const res = await createTaskAction({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        assigneeId: newAssigneeId || undefined,
        matterId: newMatterId || undefined,
        dueAt: newDueAt || undefined,
      });

      if (res.success && res.task) {
        const created = res.task;
        const targetMatter = matters.find((m) => m.id === newMatterId);
        const targetUser = users.find((u) => u.id === newAssigneeId);

        setTasks((prev) => [
          {
            id: created.id,
            title: created.title,
            description: created.description || null,
            status: created.status,
            priority: created.priority,
            dueAt: created.dueAt ? created.dueAt.toISOString() : null,
            startAt: created.startAt ? created.startAt.toISOString() : null,
            estimatedMinutes: created.estimatedMinutes || null,
            matterId: created.matterId || null,
            matterReference: targetMatter?.reference || null,
            matterTitle: targetMatter?.title || null,
            assigneeId: created.assigneeId || null,
            assigneeName: targetUser?.name || null,
            checklistTotal: 0,
            checklistDone: 0,
          },
          ...prev,
        ]);

        setIsCreateOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNewAssigneeId("");
        setNewMatterId("");
        setNewDueAt("");
      } else {
        setErrorMessage(res.error || "Erreur de création");
      }
    });
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENT":
        return <Badge className="bg-red-600 text-white text-[10px]">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-600 text-white text-[10px]">Haute</Badge>;
      case "NORMAL":
        return <Badge variant="outline" className="text-[10px]">Normale</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Basse</Badge>;
    }
  };

  const columns: Array<{ status: TaskStatus; labelFr: string; labelEn: string; color: string }> = [
    { status: "TODO", labelFr: "À faire", labelEn: "To Do", color: "border-slate-300 bg-slate-50/50" },
    { status: "IN_PROGRESS", labelFr: "En cours", labelEn: "In Progress", color: "border-blue-300 bg-blue-50/30" },
    { status: "DONE", labelFr: "Terminées", labelEn: "Done", color: "border-emerald-300 bg-emerald-50/30" },
    { status: "CANCELLED", labelFr: "Annulées", labelEn: "Cancelled", color: "border-rose-200 bg-rose-50/20" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Gestion des Tâches" : "Task Management"}
        description={
          locale === "fr"
            ? "Suivi opérationnel des diligences, assignations, échéances et validation d'équipe."
            : "Operational tracking of due diligences, team assignments, deadlines and validation."
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <KanbanIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Tableau Kanban" : "Kanban"}
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <TableIcon className="h-3.5 w-3.5" />
                {locale === "fr" ? "Liste & Tableau" : "List"}
              </Button>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
            >
              <Plus className="h-4 w-4" />
              {locale === "fr" ? "Nouvelle tâche" : "New Task"}
            </Button>
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
                ? "Rechercher par titre, dossier, description..."
                : "Search by title, matter, description..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Tous les statuts" : "All Statuses"}</option>
            <option value="TODO">{locale === "fr" ? "À faire" : "To Do"}</option>
            <option value="IN_PROGRESS">{locale === "fr" ? "En cours" : "In Progress"}</option>
            <option value="DONE">{locale === "fr" ? "Terminées" : "Done"}</option>
            <option value="CANCELLED">{locale === "fr" ? "Annulées" : "Cancelled"}</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">{locale === "fr" ? "Tous les assignés" : "All Assignees"}</option>
            <option value="ME">{locale === "fr" ? "Mes tâches" : "My Tasks"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-muted-foreground font-mono ml-2">
            {filteredTasks.length} {locale === "fr" ? "tâche(s)" : "task(s)"}
          </span>
        </div>
      </div>

      {/* Bulk Action Strip (if any selected) */}
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {selectedTaskIds.length} {locale === "fr" ? "tâche(s) sélectionnée(s)" : "task(s) selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleBulkStatusChange("DONE")}
              className="text-xs h-7 gap-1 text-emerald-700 border-emerald-300"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {locale === "fr" ? "Marquer terminées" : "Mark as Done"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleBulkStatusChange("IN_PROGRESS")}
              className="text-xs h-7 gap-1"
            >
              {locale === "fr" ? "Passer En cours" : "Set In Progress"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedTaskIds([])}
              className="text-xs h-7 text-muted-foreground"
            >
              {locale === "fr" ? "Désélectionner" : "Deselect"}
            </Button>
          </div>
        </div>
      )}

      {/* Main View: Kanban vs Table */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className={`rounded-xl border p-3 flex flex-col min-h-[450px] ${col.color}`}
              >
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/50">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {locale === "fr" ? col.labelFr : col.labelEn}
                  </h3>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-mono font-semibold border">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {colTasks.map((task) => {
                    const isOverdue =
                      task.dueAt &&
                      new Date(task.dueAt) < now &&
                      task.status !== "DONE" &&
                      task.status !== "CANCELLED";

                    return (
                      <div
                        key={task.id}
                        className="bg-card border border-border/80 rounded-lg p-3 shadow-xs hover:border-primary/40 transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                            {task.title}
                          </h4>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {task.matterReference && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                            <Briefcase className="h-3 w-3 text-gold" />
                            <span>{task.matterReference}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">
                              {task.assigneeName || (locale === "fr" ? "Non assigné" : "Unassigned")}
                            </span>
                          </div>

                          {task.dueAt && (
                            <span
                              className={`flex items-center gap-1 font-mono ${
                                isOverdue ? "text-red-600 font-semibold" : ""
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {new Date(task.dueAt).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        {isOverdue && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{locale === "fr" ? "En retard" : "Overdue"}</span>
                          </div>
                        )}

                        {/* Quick Action Dropdown */}
                        <div className="pt-1 flex items-center justify-end gap-1">
                          {col.status !== "DONE" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(task.id, "DONE")}
                              className="h-6 text-[10px] px-2 text-emerald-600 hover:bg-emerald-50"
                            >
                              ✓ {locale === "fr" ? "Terminer" : "Done"}
                            </Button>
                          )}
                          {col.status === "TODO" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(task.id, "IN_PROGRESS")}
                              className="h-6 text-[10px] px-2 text-blue-600 hover:bg-blue-50"
                            >
                              → {locale === "fr" ? "En cours" : "In progress"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="h-28 flex items-center justify-center text-xs text-muted-foreground/50 border border-dashed rounded-lg">
                      {locale === "fr" ? "Aucune tâche" : "No tasks"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredTasks.length > 0 &&
                        selectedTaskIds.length === filteredTasks.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTaskIds(filteredTasks.map((t) => t.id));
                        } else {
                          setSelectedTaskIds([]);
                        }
                      }}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="py-3 px-4">{locale === "fr" ? "Tâche" : "Task"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Statut" : "Status"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Priorité" : "Priority"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Assigné à" : "Assignee"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Échéance" : "Due Date"}</th>
                  <th className="py-3 px-4 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTasks.map((task) => {
                  const isOverdue =
                    task.dueAt &&
                    new Date(task.dueAt) < now &&
                    task.status !== "DONE" &&
                    task.status !== "CANCELLED";

                  return (
                    <tr key={task.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskIds((prev) => [...prev, task.id]);
                            } else {
                              setSelectedTaskIds((prev) =>
                                prev.filter((id) => id !== task.id)
                              );
                            }
                          }}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{task.title}</div>
                        {task.description && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {task.matterReference ? (
                          <span className="font-mono text-primary font-semibold">
                            {task.matterReference}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(task.id, e.target.value as any)
                          }
                          className="text-xs h-7 rounded border border-border bg-background px-2 py-0.5"
                        >
                          <option value="TODO">À faire</option>
                          <option value="IN_PROGRESS">En cours</option>
                          <option value="DONE">Terminée</option>
                          <option value="CANCELLED">Annulée</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">{getPriorityBadge(task.priority)}</td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">
                          {task.assigneeName || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {task.dueAt ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className={isOverdue ? "text-red-600 font-bold" : ""}>
                              {new Date(task.dueAt).toLocaleDateString(
                                locale === "en" ? "en-US" : "fr-FR"
                              )}
                            </span>
                            {isOverdue && (
                              <Badge className="bg-red-600 text-white text-[9px] px-1 py-0">
                                Retard
                              </Badge>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {task.status !== "DONE" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusChange(task.id, "DONE")}
                            className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 px-2"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {locale === "fr" ? "Terminer" : "Done"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal New Task */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold font-serif text-lg text-primary flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-gold" />
                {locale === "fr" ? "Nouvelle tâche" : "New Task"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  {locale === "fr" ? "Titre de la tâche *" : "Task Title *"}
                </label>
                <Input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    locale === "fr"
                      ? "ex: Rédiger conclusions en défense..."
                      : "e.g., Draft defense submissions..."
                  }
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  {locale === "fr" ? "Dossier associé" : "Associated Matter"}
                </label>
                <select
                  value={newMatterId}
                  onChange={(e) => setNewMatterId(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3"
                >
                  <option value="">{locale === "fr" ? "— Aucun dossier —" : "— None —"}</option>
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.reference} - {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {locale === "fr" ? "Assigné à" : "Assignee"}
                  </label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3"
                  >
                    <option value="">{locale === "fr" ? "— Non assigné —" : "— None —"}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {locale === "fr" ? "Priorité" : "Priority"}
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3"
                  >
                    <option value="LOW">{locale === "fr" ? "Basse" : "Low"}</option>
                    <option value="NORMAL">{locale === "fr" ? "Normale" : "Normal"}</option>
                    <option value="HIGH">{locale === "fr" ? "Haute" : "High"}</option>
                    <option value="URGENT">{locale === "fr" ? "Urgente" : "Urgent"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  {locale === "fr" ? "Date d'échéance" : "Due Date"}
                </label>
                <Input
                  type="date"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  {locale === "fr" ? "Instructions / Détails" : "Details / Notes"}
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                  placeholder={
                    locale === "fr"
                      ? "Précisions sur la mission, pièces à réunir..."
                      : "Instructions, deliverables..."
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  {locale === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {locale === "fr" ? "Créer la tâche" : "Create Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
