"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StatusChip } from "@/components/app/status-chip";
import { PriorityChip } from "@/components/app/priority-chip";
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
  Briefcase,
  User,
  Building2,
  Calendar,
  Lock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Clock,
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  ExternalLink,
  MessageSquare,
  Key,
  Scale,
  ChevronDown,
  ChevronRight,
  GitFork,
  Gavel,
  Download,
  Upload,
  Check,
  RotateCcw,
  Flag,
  Activity,
} from "lucide-react";
import { getMatterTimelineAction } from "@/server/actions/productivity-actions";
import {
  createEventAction,
  postponeEventAction,
  validateProceduralDeadlineAction,
} from "@/server/actions/event-actions";
import { EventStatus, EventType } from "@prisma/client";
import {
  updateMatterAction,
  softDeleteMatterAction,
  setMatterMemberAction,
  removeMatterMemberAction,
  partnerSelfJoinStrictAction,
} from "@/server/actions/matter-actions";
import {
  createMissionAction,
  createProcedureAction,
} from "@/server/actions/mission-procedure-actions";
import {
  uploadDocumentAction,
  validateDocumentVersionAction,
} from "@/server/actions/document-actions";
import {
  createTaskAction,
  updateTaskStatusAction,
  toggleChecklistItemAction,
  createNoteAction,
  deleteNoteAction,
} from "@/server/actions/task-actions";
import { listAuditLogsAction } from "@/server/actions/audit-actions";
import {
  MatterAccessLevel,
  Priority,
  Confidentiality,
  MissionType,
  MissionStatus,
  ProcedureKind,
  ProcedureStatus,
} from "@prisma/client";

interface MatterDetailProps {
  matter: any;
  allUsers: { id: string; name: string; roleName: string }[];
  docCategories?: { id: string; key: string; nameFr: string; nameEn: string }[];
  currentUserId: string;
  currentUserRole?: string;
}

export function MatterDetailClient({
  matter,
  allUsers,
  docCategories = [],
  currentUserId,
  currentUserRole,
}: MatterDetailProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const [isPending, startTransition] = useTransition();

  const isPartner = currentUserRole === "PARTNER";
  const isLead = matter.isLeadLawyer;
  const canManageMembers = matter.currentUserAccessLevel === "MANAGE";
  const canEdit = matter.currentUserAccessLevel === "EDIT" || matter.currentUserAccessLevel === "MANAGE";

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "overview" | "missions" | "documents" | "tasks" | "calendar" | "access" | "timeline" | "audit"
  >("overview");
  const [matterLogs, setMatterLogs] = useState<any[]>([]);
  const [isLogsLoaded, setIsLogsLoaded] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [isTimelineLoaded, setIsTimelineLoaded] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const loadTimeline = async () => {
    if (isLoadingTimeline) return;
    setIsLoadingTimeline(true);
    try {
      const res = await getMatterTimelineAction(matter.id);
      if (res.success && res.entries) {
        setTimelineEntries(res.entries);
        setIsTimelineLoaded(true);
      }
    } catch {
      // Ignored if forbidden
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  const loadMatterAuditLogs = async () => {
    if (isLoadingLogs) return;
    setIsLoadingLogs(true);
    try {
      const res = await listAuditLogsAction({ matterId: matter.id, pageSize: 50 });
      setMatterLogs(res.items || []);
      setIsLogsLoaded(true);
    } catch {
      // Ignored if forbidden
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Member drawer state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(allUsers[0]?.id || "");
  const [selectedLevel, setSelectedLevel] = useState<MatterAccessLevel>("VIEW");
  const [memberError, setMemberError] = useState<string | null>(null);

  // Mission drawer state
  const [isAddMissionOpen, setIsAddMissionOpen] = useState(false);
  const [missionTitle, setMissionTitle] = useState("");
  const [missionType, setMissionType] = useState<MissionType>("ADVISORY");
  const [missionScope, setMissionScope] = useState("");
  const [missionDeliverables, setMissionDeliverables] = useState("");
  const [missionOwnerId, setMissionOwnerId] = useState(matter.leadLawyerId || allUsers[0]?.id || "");
  const [missionError, setMissionError] = useState<string | null>(null);

  // Procedure drawer state
  const [isAddProcedureOpen, setIsAddProcedureOpen] = useState(false);
  const [procedureKind, setProcedureKind] = useState<ProcedureKind>("FIRST_INSTANCE");
  const [procedureJurisdiction, setProcedureJurisdiction] = useState("");
  const [procedureReference, setProcedureReference] = useState("");
  const [parentProcedureId, setParentProcedureId] = useState<string>("");
  const [linkedMissionId, setLinkedMissionId] = useState<string>("");
  const [procedureError, setProcedureError] = useState<string | null>(null);

  // Document drawer state
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategoryId, setDocCategoryId] = useState(docCategories[0]?.id || "");
  const [docConfidentiality, setDocConfidentiality] = useState<Confidentiality>("STANDARD");
  const [docComment, setDocComment] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Task & Note state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("NORMAL");
  const [taskAssigneeId, setTaskAssigneeId] = useState(allUsers[0]?.id || "");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskRequiresValidation, setTaskRequiresValidation] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [noteShareable, setNoteShareable] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Calendar event state
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>(EventType.HEARING);
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventSource, setEventSource] = useState("");
  const [eventProcedureId, setEventProcedureId] = useState("");
  const [eventError, setEventError] = useState<string | null>(null);

  // Postpone modal state
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [selectedEventToPostpone, setSelectedEventToPostpone] = useState<any | null>(null);
  const [postponeNewDate, setPostponeNewDate] = useState("");
  const [postponeReason, setPostponeReason] = useState("");
  const [postponeLocation, setPostponeLocation] = useState("");
  const [postponeError, setPostponeError] = useState<string | null>(null);

  // Expandable list items state
  const [expandedMissions, setExpandedMissions] = useState<Record<string, boolean>>({});
  const [expandedProcedures, setExpandedProcedures] = useState<Record<string, boolean>>({});

  // Archive modal
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  // Self-join strict state
  const isStrict = matter.confidentiality === "STRICT";
  const isMember = matter.members.some((m: any) => m.userId === currentUserId);
  const showSelfJoin = isStrict && !isMember && isPartner;

  const handleSelfJoin = async () => {
    startTransition(async () => {
      try {
        await partnerSelfJoinStrictAction(matter.id);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);

    startTransition(async () => {
      try {
        await setMatterMemberAction(matter.id, selectedUserId, selectedLevel);
        setIsAddMemberOpen(false);
        router.refresh();
      } catch (err: any) {
        setMemberError(err.message || "Erreur lors de l'ajout du membre");
      }
    });
  };

  const handleRemoveMember = async (userId: string) => {
    startTransition(async () => {
      try {
        await removeMatterMemberAction(matter.id, userId);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de suppression");
      }
    });
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setMissionError(null);

    startTransition(async () => {
      const res = await createMissionAction({
        matterId: matter.id,
        type: missionType,
        title: missionTitle,
        scope: missionScope,
        deliverables: missionDeliverables,
        ownerId: missionOwnerId,
      });

      if (!res.success) {
        setMissionError(res.error || "Erreur lors de la création");
      } else {
        setIsAddMissionOpen(false);
        setMissionTitle("");
        setMissionScope("");
        setMissionDeliverables("");
        router.refresh();
      }
    });
  };

  const handleCreateProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcedureError(null);

    startTransition(async () => {
      const res = await createProcedureAction({
        matterId: matter.id,
        kind: procedureKind,
        jurisdiction: procedureJurisdiction,
        reference: procedureReference,
        parentProcedureId: parentProcedureId || null,
        missionId: linkedMissionId || null,
      });

      if (!res.success) {
        setProcedureError(res.error || "Erreur lors de la création");
      } else {
        setIsAddProcedureOpen(false);
        setProcedureJurisdiction("");
        setProcedureReference("");
        setParentProcedureId("");
        setLinkedMissionId("");
        router.refresh();
      }
    });
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setDocError("Veuillez sélectionner un fichier");
      return;
    }
    setDocError(null);

    const formData = new FormData();
    formData.append("matterId", matter.id);
    formData.append("title", docTitle);
    if (docCategoryId) formData.append("categoryId", docCategoryId);
    formData.append("confidentiality", docConfidentiality);
    if (docComment) formData.append("comment", docComment);
    formData.append("file", docFile);

    startTransition(async () => {
      const res = await uploadDocumentAction(formData);
      if (!res.success) {
        setDocError(res.error || "Erreur de téléversement");
      } else {
        setIsUploadDocOpen(false);
        setDocTitle("");
        setDocComment("");
        setDocFile(null);
        router.refresh();
      }
    });
  };

  const handleValidateVersion = async (versionId: string) => {
    startTransition(async () => {
      const res = await validateDocumentVersionAction(versionId, matter.id);
      if (!res.success) {
        alert(res.error || "Erreur lors de la validation juridique");
      } else {
        router.refresh();
      }
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);

    startTransition(async () => {
      const res = await createTaskAction({
        matterId: matter.id,
        title: taskTitle,
        priority: taskPriority,
        assigneeId: taskAssigneeId,
        dueAt: taskDueAt || null,
        requiresValidation: taskRequiresValidation,
      });

      if (!res.success) {
        setTaskError(res.error || "Erreur de création de tâche");
      } else {
        setIsAddTaskOpen(false);
        setTaskTitle("");
        setTaskDueAt("");
        setTaskRequiresValidation(false);
        router.refresh();
      }
    });
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, matter.id, nextStatus);
      if (!res.success) {
        alert(res.error || "Impossible de changer le statut");
      } else {
        router.refresh();
      }
    });
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setNoteError(null);

    startTransition(async () => {
      const res = await createNoteAction(matter.id, noteBody, noteShareable);
      if (!res.success) {
        setNoteError(res.error || "Erreur lors de l'enregistrement de la note");
      } else {
        setNoteBody("");
        setNoteShareable(false);
        router.refresh();
      }
    });
  };

  const handleDeleteNote = async (noteId: string) => {
    startTransition(async () => {
      const res = await deleteNoteAction(noteId, matter.id);
      if (!res.success) {
        alert(res.error || "Erreur lors de la suppression de la note");
      } else {
        router.refresh();
      }
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventStartsAt) return;
    setEventError(null);

    if (eventType === EventType.PROCEDURAL_DEADLINE && !eventSource.trim()) {
      setEventError(
        locale === "fr"
          ? "Une source légale ou judiciaire est obligatoire pour une échéance procédurale."
          : "A legal or court source is required for a procedural deadline."
      );
      return;
    }

    startTransition(async () => {
      const res = await createEventAction({
        matterId: matter.id,
        procedureId: eventProcedureId || null,
        title: eventTitle,
        type: eventType,
        startsAt: eventStartsAt,
        endsAt: eventEndsAt || null,
        location: eventLocation || null,
        description: eventDescription || null,
        source: eventSource || null,
      });

      if (!res.success) {
        setEventError(res.error || "Erreur lors de la création de l'événement");
      } else {
        setIsAddEventOpen(false);
        setEventTitle("");
        setEventStartsAt("");
        setEventEndsAt("");
        setEventLocation("");
        setEventDescription("");
        setEventSource("");
        setEventProcedureId("");
        router.refresh();
      }
    });
  };

  const handlePostponeEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventToPostpone || !postponeNewDate || !postponeReason.trim()) return;
    setPostponeError(null);

    startTransition(async () => {
      const res = await postponeEventAction(selectedEventToPostpone.id, {
        newStartsAt: postponeNewDate,
        reason: postponeReason,
        newLocation: postponeLocation || undefined,
      });

      if (!res.success) {
        setPostponeError(res.error || "Erreur lors du renvoi");
      } else {
        setIsPostponeModalOpen(false);
        setSelectedEventToPostpone(null);
        setPostponeNewDate("");
        setPostponeReason("");
        setPostponeLocation("");
        router.refresh();
      }
    });
  };

  const handleValidateDeadline = async (eventId: string) => {
    startTransition(async () => {
      const res = await validateProceduralDeadlineAction(eventId);
      if (!res.success) {
        alert(res.error || "Erreur de validation");
      } else {
        router.refresh();
      }
    });
  };

  const toggleMission = (id: string) => {
    setExpandedMissions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleProcedure = (id: string) => {
    setExpandedProcedures((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const primaryClient = matter.parties?.find(
    (p: any) => p.party?.clientStatus === "CLIENT" || p.role === "CLIENT"
  )?.party;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/matters`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary">
                {matter.reference}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {locale === "en" ? matter.category?.nameEn : matter.category?.nameFr}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {matter.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSelfJoin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelfJoin}
              disabled={isPending}
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 text-xs"
            >
              <Key className="h-3.5 w-3.5" />
              {locale === "fr" ? "S'adjoindre (Associé)" : "Self-join (Partner)"}
            </Button>
          )}

          {canManageMembers && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {locale === "fr" ? "Archiver" : "Archive"}
            </Button>
          )}
        </div>
      </div>

      {/* Matter Workspace Header Strip */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <span className="text-xs text-muted-foreground block">
              {locale === "fr" ? "Client principal" : "Primary Client"}
            </span>
            <div className="mt-1 font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{primaryClient?.displayName || "—"}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block">
              {locale === "fr" ? "Avocat responsable" : "Lead Lawyer"}
            </span>
            <div className="mt-1 font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{matter.leadLawyer?.name}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block">Statut du dossier</span>
            <div className="mt-1">
              <StatusChip
                label={
                  (locale === "en" ? matter.workflowStep?.nameEn : matter.workflowStep?.nameFr) ||
                  matter.status
                }
                tone="primary"
              />
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block">Priorité</span>
            <div className="mt-1">
              <PriorityChip priority={matter.priority} />
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block">Confidentialité</span>
            <div className="mt-1">
              <ConfidentialityChip level={matter.confidentiality} />
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block">
              {locale === "fr" ? "Habilitation" : "Your Access"}
            </span>
            <div className="mt-1">
              <Badge variant="outline" className="text-xs font-bold text-primary">
                {matter.currentUserAccessLevel}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {locale === "fr" ? "Vue d'ensemble" : "Overview"}
          </button>

          <button
            onClick={() => setActiveTab("missions")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "missions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            {locale === "fr" ? "Missions & Procédures" : "Missions & Procedures"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {(matter.missions?.length || 0) + (matter.procedures?.length || 0)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "tasks"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {locale === "fr" ? "Tâches & Délais" : "Tasks"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {matter.tasks?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "documents"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {locale === "fr" ? "Documents" : "Documents"}
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "calendar"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {locale === "fr" ? "Audiences & Calendrier" : "Hearings & Calendar"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {matter.events?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("access")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "access"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {locale === "fr" ? "Équipe & Accès" : "Team & Access"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {matter.members?.length || 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("timeline");
              if (!isTimelineLoaded) loadTimeline();
            }}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "timeline"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {locale === "fr" ? "Chronologie" : "Timeline"}
          </button>

          {(isPartner || isLead) && (
            <button
              onClick={() => {
                setActiveTab("audit");
                if (!isLogsLoaded) loadMatterAuditLogs();
              }}
              className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "audit"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {locale === "fr" ? "Journal d'audit" : "Audit Log"}
            </button>
          )}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Parties & Scope */}
          <div className="space-y-6 lg:col-span-2">
            {/* Parties Table */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Parties au dossier" : "Matter Parties"}
              </h2>
              <div className="overflow-hidden rounded-lg border border-border/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/50 text-muted-foreground border-b border-border font-medium">
                    <tr>
                      <th className="px-4 py-2.5">{locale === "fr" ? "Rôle" : "Role"}</th>
                      <th className="px-4 py-2.5">{locale === "fr" ? "Partie" : "Party"}</th>
                      <th className="px-4 py-2.5">{locale === "fr" ? "Type" : "Type"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {matter.parties?.map((mp: any) => (
                      <tr key={mp.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3 font-semibold text-primary">{mp.role}</td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {mp.party?.displayName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{mp.party?.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick summary of Missions & Procedures */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {locale === "fr" ? "Missions & Procédures actives" : "Active Missions & Procedures"}
                </h2>
                <button
                  onClick={() => setActiveTab("missions")}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {locale === "fr" ? "Voir tout →" : "View all →"}
                </button>
              </div>

              {(!matter.missions || matter.missions.length === 0) &&
              (!matter.procedures || matter.procedures.length === 0) ? (
                <p className="text-xs text-muted-foreground">
                  {locale === "fr" ? "Aucune mission ni procédure enregistrée." : "No missions or procedures recorded."}
                </p>
              ) : (
                <div className="space-y-2">
                  {matter.missions?.map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border/80 bg-surface-muted/30 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 text-primary" />
                          <span>{m.title}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {m.type}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {locale === "fr" ? "Responsable :" : "Owner :"} {m.owner?.name || "Cabinet"}
                        </span>
                      </div>
                      <Badge className="text-[10px]">{m.status}</Badge>
                    </div>
                  ))}

                  {matter.procedures?.map((p: any) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border/80 bg-surface-muted/30 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Gavel className="h-3.5 w-3.5 text-amber-600" />
                          <span>{p.jurisdiction || "Tribunal"}</span>
                          {p.reference && (
                            <span className="font-mono text-muted-foreground">({p.reference})</span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {p.kind}
                          </Badge>
                        </div>
                        {p.parentProcedure && (
                          <span className="text-[11px] text-primary block">
                            ↳ {locale === "fr" ? "Appel de :" : "Appeal of :"} {p.parentProcedure.jurisdiction || p.parentProcedure.kind}
                          </span>
                        )}
                      </div>
                      <Badge className="text-[10px]">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key details */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 text-xs">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "fr" ? "Détails contractuels" : "Matter details"}
              </h2>

              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">{locale === "fr" ? "Créé le" : "Created on"}</span>
                <span className="font-medium text-foreground">
                  {new Date(matter.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">{locale === "fr" ? "Dernière mise à jour" : "Updated"}</span>
                <span className="font-medium text-foreground">
                  {new Date(matter.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">{locale === "fr" ? "Niveau effectif" : "Your level"}</span>
                <Badge variant="outline" className="text-xs font-bold text-primary">
                  {matter.currentUserAccessLevel}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Missions & Procedures (Step 14) */}
      {activeTab === "missions" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/70 bg-surface-muted/40 p-4 text-xs text-muted-foreground flex items-center justify-between">
            <p>
              {locale === "fr"
                ? "Règle de gestion (BR-08) : Les statuts des missions et procédures évoluent indépendamment du statut du dossier."
                : "Business Rule (BR-08): Mission and procedure statuses evolve independently from the matter status."}
            </p>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsAddMissionOpen(true)}
                  className="gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3 w-3" />
                  {locale === "fr" ? "Nouvelle mission" : "Add mission"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddProcedureOpen(true)}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  {locale === "fr" ? "Nouvelle procédure" : "Add procedure"}
                </Button>
              </div>
            )}
          </div>

          {/* Section: Missions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                {locale === "fr" ? "Missions de conseil et d'assistance" : "Missions"}
              </h2>
            </div>

            {(!matter.missions || matter.missions.length === 0) ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Aucune mission spécifique créée." : "No missions created."}
              </div>
            ) : (
              <div className="space-y-2">
                {matter.missions.map((mission: any) => {
                  const isExpanded = expandedMissions[mission.id];
                  return (
                    <div
                      key={mission.id}
                      className="rounded-xl border border-border bg-card shadow-sm transition-all"
                    >
                      <div
                        onClick={() => toggleMission(mission.id)}
                        className="flex cursor-pointer items-center justify-between p-4 hover:bg-surface-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">
                                {mission.title}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {mission.type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {locale === "fr" ? "Responsable :" : "Owner :"} {mission.owner?.name || "Cabinet"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusChip
                            label={
                              (locale === "en"
                                ? mission.workflowStep?.nameEn
                                : mission.workflowStep?.nameFr) || mission.status
                            }
                            tone="primary"
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/60 bg-surface-muted/20 p-4 text-xs space-y-3">
                          {mission.scope && (
                            <div>
                              <span className="font-semibold text-foreground block">
                                {locale === "fr" ? "Périmètre d'intervention :" : "Scope of work :"}
                              </span>
                              <p className="mt-0.5 text-muted-foreground whitespace-pre-line">
                                {mission.scope}
                              </p>
                            </div>
                          )}

                          {mission.deliverables && (
                            <div>
                              <span className="font-semibold text-foreground block">
                                {locale === "fr" ? "Livrables attendus :" : "Deliverables :"}
                              </span>
                              <p className="mt-0.5 text-muted-foreground whitespace-pre-line">
                                {mission.deliverables}
                              </p>
                            </div>
                          )}

                          <div className="pt-2 flex justify-between text-[11px] text-muted-foreground border-t border-border/40">
                            <span>
                              {locale === "fr" ? "Créée le :" : "Created on :"} {new Date(mission.createdAt).toLocaleDateString()}
                            </span>
                            <span>
                              {locale === "fr" ? "Statut interne :" : "Internal status :"} {mission.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Procedures */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Gavel className="h-4 w-4 text-amber-600" />
                {locale === "fr" ? "Procédures judiciaires et arbitrales" : "Court & Arbitral Procedures"}
              </h2>
            </div>

            {(!matter.procedures || matter.procedures.length === 0) ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Aucune procédure judiciaire enregistrée." : "No procedures recorded."}
              </div>
            ) : (
              <div className="space-y-2">
                {matter.procedures.map((procedure: any) => {
                  const isExpanded = expandedProcedures[procedure.id];
                  const hasParent = Boolean(procedure.parentProcedure);

                  return (
                    <div
                      key={procedure.id}
                      className="rounded-xl border border-border bg-card shadow-sm transition-all"
                    >
                      <div
                        onClick={() => toggleProcedure(procedure.id)}
                        className="flex cursor-pointer items-center justify-between p-4 hover:bg-surface-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">
                                {procedure.jurisdiction || (locale === "fr" ? "Juridiction à désigner" : "Court")}
                              </span>
                              {procedure.reference && (
                                <span className="font-mono text-xs text-primary font-semibold">
                                  [{procedure.reference}]
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {procedure.kind}
                              </Badge>
                            </div>

                            {hasParent && (
                              <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                                <GitFork className="h-3 w-3 shrink-0 rotate-180" />
                                <span>
                                  {locale === "fr"
                                    ? `Recours contre la décision : ${procedure.parentProcedure.jurisdiction || procedure.parentProcedure.kind} (${procedure.parentProcedure.reference || "Sans réf"})`
                                    : `Appeal against decision: ${procedure.parentProcedure.jurisdiction || procedure.parentProcedure.kind}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusChip
                            label={
                              (locale === "en"
                                ? procedure.workflowStep?.nameEn
                                : procedure.workflowStep?.nameFr) || procedure.status
                            }
                            tone="primary"
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/60 bg-surface-muted/20 p-4 text-xs space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-muted-foreground block">
                                {locale === "fr" ? "Juridiction saisie :" : "Court / Authority :"}
                              </span>
                              <span className="font-semibold text-foreground">
                                {procedure.jurisdiction || "—"}
                              </span>
                            </div>

                            <div>
                              <span className="text-muted-foreground block">
                                {locale === "fr" ? "N° de rôle général / Réf. greffe :" : "Case Docket Reference :"}
                              </span>
                              <span className="font-semibold font-mono text-foreground">
                                {procedure.reference || "—"}
                              </span>
                            </div>
                          </div>

                          {procedure.childProcedures?.length > 0 && (
                            <div className="pt-2 border-t border-border/40">
                              <span className="font-semibold text-foreground block mb-1">
                                {locale === "fr" ? "Voies de recours enclenchées :" : "Child Procedures (Appeals) :"}
                              </span>
                              <div className="space-y-1">
                                {procedure.childProcedures.map((cp: any) => (
                                  <div
                                    key={cp.id}
                                    className="flex items-center justify-between bg-surface-muted/50 p-2 rounded text-[11px]"
                                  >
                                    <span>
                                      {cp.kind} - {cp.jurisdiction} ({cp.reference || "Sans réf"})
                                    </span>
                                    <Badge className="text-[10px]">{cp.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Access & Members */}
      {activeTab === "access" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {locale === "fr" ? "Équipe et habilitations d'accès" : "Team & access permissions"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Régit l'accès aux documents, tâches, notes et finances du dossier."
                  : "Controls access to matter documents, tasks, notes and finance."}
              </p>
            </div>

            {canManageMembers && (
              <Button
                size="sm"
                onClick={() => setIsAddMemberOpen(true)}
                className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                {locale === "fr" ? "Ajouter un membre" : "Add member"}
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3">{locale === "fr" ? "Collaborateur" : "User"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Rôle cabinet" : "Firm role"}</th>
                  <th className="px-5 py-3">{locale === "fr" ? "Niveau d'accès" : "Access level"}</th>
                  <th className="px-5 py-3 text-right">{locale === "fr" ? "Action" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matter.members.map((m: any) => {
                  const isLeadLawyer = m.userId === matter.leadLawyerId;
                  return (
                    <tr key={m.userId} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {m.user.name}
                          {isLeadLawyer && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              Lead
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.user.email}</div>
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {locale === "en" ? m.user.role?.nameEn : m.user.role?.nameFr}
                      </td>

                      <td className="px-5 py-4">
                        <Badge
                          variant={m.level === "MANAGE" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {m.level}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {canManageMembers && !isLeadLawyer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(m.userId)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title={locale === "fr" ? "Retirer" : "Remove"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Tab 3: Tasks & Notes (Step 16) */}
      {activeTab === "tasks" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Tasks List */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {locale === "fr" ? "Tâches et échéances" : "Tasks & Deadlines"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {locale === "fr"
                    ? "Gestion des diligences, affectations et validations juridiques."
                    : "Manage deadlines, assignments, and validation gates."}
                </p>
              </div>

              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => setIsAddTaskOpen(true)}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {locale === "fr" ? "Nouvelle tâche" : "New Task"}
                </Button>
              )}
            </div>

            {(!matter.tasks || matter.tasks.length === 0) ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Aucune tâche enregistrée." : "No tasks recorded."}
              </div>
            ) : (
              <div className="space-y-2">
                {matter.tasks.map((task: any) => {
                  const isDone = task.status === "DONE";
                  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && !isDone;

                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start justify-between gap-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTaskStatus(task.id, task.status)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isDone
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>

                        <div className="space-y-1">
                          <span
                            className={`text-sm font-semibold block ${
                              isDone ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </span>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {task.assignee && (
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <User className="h-3 w-3" />
                                {task.assignee.name}
                              </span>
                            )}

                            {task.dueAt && (
                              <span
                                className={`flex items-center gap-1 font-mono text-[11px] ${
                                  isOverdue ? "text-destructive font-bold" : ""
                                }`}
                              >
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueAt).toLocaleDateString()}
                              </span>
                            )}

                            {task.requiresValidation && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                                Validation requise (BR-09)
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <PriorityChip priority={task.priority} />
                        <Badge variant="outline" className="text-xs">
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Internal Notes (TSK-03, DESIGN 8.10) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {locale === "fr" ? "Notes internes" : "Internal Notes"}
              </h2>
            </div>

            {canEdit && (
              <form onSubmit={handleCreateNote} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                {noteError && (
                  <div className="text-xs text-destructive">{noteError}</div>
                )}
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={
                    locale === "fr"
                      ? "Rédiger une note interne pour l'équipe..."
                      : "Add internal team note..."
                  }
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteShareable}
                      onChange={(e) => setNoteShareable(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>{locale === "fr" ? "Partageable client" : "Shareable with client"}</span>
                  </label>

                  <Button size="sm" type="submit" disabled={isPending} className="text-xs">
                    {locale === "fr" ? "Publier" : "Post"}
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {(!matter.notes || matter.notes.length === 0) ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  {locale === "fr" ? "Aucune note rédigée." : "No notes yet."}
                </div>
              ) : (
                matter.notes.map((note: any) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{note.author?.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-foreground whitespace-pre-line leading-relaxed">
                      {note.body}
                    </p>

                    {note.shareable && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/20">
                        Partageable
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Documents (Step 15) */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/70 bg-surface-muted/40 p-4 text-xs text-muted-foreground flex items-center justify-between">
            <p>
              {locale === "fr"
                ? "Conformité Loi 2024/017 & Traçabilité (DOC-05) : Fichiers stockés localement avec empreinte SHA-256. Tout téléchargement est consigné dans le journal d'audit."
                : "Compliance Law 2024/017 & Traceability (DOC-05): Files stored locally under SHA-256 hashes. All downloads are audited."}
            </p>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setIsUploadDocOpen(true)}
                className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="h-3.5 w-3.5" />
                {locale === "fr" ? "Verser un document" : "Upload Document"}
              </Button>
            )}
          </div>

          {(!matter.documents || matter.documents.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              {locale === "fr"
                ? "Aucun document versé dans ce dossier pour le moment."
                : "No documents uploaded in this matter yet."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3">{locale === "fr" ? "Document" : "Document"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Catégorie" : "Category"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Version" : "Version"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Sécurité / Intégrité" : "Security"}</th>
                    <th className="px-5 py-3 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matter.documents.map((doc: any) => {
                    const latest = doc.versions?.[0];
                    const isClean = latest?.scanStatus === "CLEAN";
                    const isQuarantined = latest?.scanStatus === "INFECTED";
                    const isValidated = latest?.status === "VALIDATED";

                    return (
                      <tr key={doc.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span>{doc.title}</span>
                          </div>
                          {latest && (
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                              <span>{latest.fileName}</span>
                              <span>•</span>
                              <span>{(latest.sizeBytes / 1024).toFixed(1)} Ko</span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {locale === "en" ? doc.category?.nameEn : doc.category?.nameFr || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs font-mono">
                              v{latest?.versionNumber || 1}
                            </Badge>
                            {isValidated ? (
                              <Badge className="text-[10px] bg-emerald-600/10 text-emerald-700 border-emerald-600/20">
                                Validé
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Projet
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs">
                          {isQuarantined ? (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                              Quarantaine (Infecté)
                            </Badge>
                          ) : isClean ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                              <ShieldCheck className="h-4 w-4" />
                              <span>Sain</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                              <ShieldAlert className="h-4 w-4" />
                              <span>Analyse...</span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit && !isValidated && latest && isClean && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleValidateVersion(latest.id)}
                                className="h-8 gap-1 text-xs text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
                                title="Valider juridiquement cette version (irréversible)"
                              >
                                <Check className="h-3.5 w-3.5" />
                                {locale === "fr" ? "Valider" : "Validate"}
                              </Button>
                            )}

                            {latest && isClean && (
                              <a
                                href={`/api/documents/${latest.id}/download`}
                                download
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-surface-muted transition-colors"
                              >
                                <Download className="h-3.5 w-3.5 text-primary" />
                                {locale === "fr" ? "Télécharger" : "Download"}
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Hearings & Calendar (Step 17) */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {locale === "fr" ? "Audiences et calendrier du dossier" : "Hearings & Calendar"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Suivi des dates d'audiences, renvois conservés sans écrasement (BR-05) et validation des délais (BR-07)."
                  : "Hearing schedule, non-destructive postponements (BR-05) and deadline validation (BR-07)."}
              </p>
            </div>

            {canEdit && (
              <Button
                size="sm"
                onClick={() => setIsAddEventOpen(true)}
                className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                {locale === "fr" ? "Planifier audience / délai" : "Schedule Event"}
              </Button>
            )}
          </div>

          {(!matter.events || matter.events.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              {locale === "fr"
                ? "Aucune audience ni échéance programmée pour ce dossier."
                : "No hearings or deadlines scheduled for this matter."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3">{locale === "fr" ? "Type" : "Type"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Événement & Lieu" : "Event & Location"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Date & Heure" : "Date & Time"}</th>
                    <th className="px-5 py-3">{locale === "fr" ? "Statut / Déontologie" : "Status / Rule"}</th>
                    <th className="px-5 py-3 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matter.events.map((ev: any) => {
                    const isPostponed = ev.status === "POSTPONED";
                    const isDeadline = ev.type === "PROCEDURAL_DEADLINE";
                    const isHearing = ev.type === "HEARING";

                    return (
                      <tr
                        key={ev.id}
                        className={`hover:bg-surface-muted/40 transition-colors ${
                          isPostponed ? "bg-muted/15 opacity-75" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {isHearing ? (
                              <Gavel className="h-4 w-4 text-[#B08D57]" />
                            ) : isDeadline ? (
                              <Flag className="h-4 w-4 text-rose-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-xs font-bold text-foreground">
                              {ev.type}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <span
                              className={`font-semibold text-sm ${
                                isPostponed ? "line-through text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {ev.title}
                            </span>

                            {ev.location && (
                              <div className="text-xs text-muted-foreground">
                                {ev.location}
                              </div>
                            )}

                            {ev.replacesEvent && (
                              <div className="text-[11px] text-blue-700 flex items-center gap-1 font-medium">
                                <RotateCcw className="h-3 w-3" />
                                {locale === "fr"
                                  ? `Fait suite au renvoi de l'audience du ${new Date(ev.replacesEvent.startsAt).toLocaleDateString("fr-FR")}`
                                  : `Follows postponement of hearing on ${new Date(ev.replacesEvent.startsAt).toLocaleDateString()}`}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs font-mono">
                          {new Date(ev.startsAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            {isPostponed ? (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                                {locale === "fr" ? "Renvoyé (Conservé)" : "Postponed (Preserved)"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {ev.status}
                              </Badge>
                            )}

                            {isDeadline && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                  ev.deadlineValidatedById
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {ev.deadlineValidatedById
                                  ? `Validé (${ev.deadlineValidatedBy?.name || "Avocat"})`
                                  : "À valider par un avocat"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isHearing && !isPostponed && canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedEventToPostpone(ev);
                                  setIsPostponeModalOpen(true);
                                }}
                                className="h-8 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                {locale === "fr" ? "Renvoyer" : "Postpone"}
                              </Button>
                            )}

                            {isDeadline && !ev.deadlineValidatedById && canEdit && (
                              <Button
                                size="sm"
                                onClick={() => handleValidateDeadline(ev.id)}
                                className="h-8 text-xs bg-[#B08D57] hover:bg-[#B08D57]/90 text-white"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                {locale === "fr" ? "Valider" : "Validate"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab (UX-10) */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {locale === "fr" ? "Chronologie consolidée du dossier" : "Matter Consolidated Timeline"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Vue d'ensemble chronologique des étapes procédurales, dépôts d'actes, audiences, diligences et notes internes."
                  : "Consolidated chronological view of procedural steps, document filings, hearings, tasks, and notes."}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={loadTimeline}
              disabled={isLoadingTimeline}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoadingTimeline ? "animate-spin" : ""}`} />
              {locale === "fr" ? "Actualiser" : "Refresh"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            {timelineEntries.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                {isLoadingTimeline
                  ? (locale === "fr" ? "Chargement de la chronologie..." : "Loading timeline...")
                  : (locale === "fr" ? "Aucun événement répertorié dans la chronologie." : "No timeline events recorded.")}
              </div>
            ) : (
              <div className="relative border-l-2 border-[#E5E0D8] ml-4 pl-6 space-y-6">
                {timelineEntries.map((entry) => {
                  let badgeColor = "bg-primary/10 text-primary border-primary/20";
                  let Icon = Clock;
                  if (entry.type === "STATUS_CHANGE") {
                    badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
                    Icon = CheckCircle2;
                  } else if (entry.type === "DOCUMENT") {
                    badgeColor = "bg-blue-50 text-blue-800 border-blue-300";
                    Icon = FileText;
                  } else if (entry.type === "EVENT") {
                    badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
                    Icon = Calendar;
                  } else if (entry.type === "NOTE") {
                    badgeColor = "bg-purple-50 text-purple-800 border-purple-300";
                    Icon = MessageSquare;
                  } else if (entry.type === "TASK") {
                    badgeColor = "bg-neutral-100 text-neutral-800 border-neutral-300";
                    Icon = Clock;
                  }

                  return (
                    <div key={entry.id} className="relative group">
                      <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-primary shadow-xs">
                        <Icon className="h-3 w-3 text-primary" />
                      </span>

                      <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs hover:shadow-sm transition-all space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
                              {entry.type}
                            </span>
                            <h3 className="text-xs font-bold text-foreground">
                              {entry.title}
                            </h3>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {entry.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                            {entry.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-[#F0EBE1]">
                          <span className="flex items-center gap-1 font-medium">
                            <User className="h-3 w-3" />
                            {entry.authorName || "Intervenant"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === "audit" && (isPartner || isLead) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {locale === "fr" ? "Journal d'audit du dossier" : "Matter Audit Trail"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Historique certifié et immuable de l'ensemble des actions et accès sur ce dossier (Loi n° 2024/017)."
                  : "Immutable and certified audit log of all access and operations on this matter."}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={loadMatterAuditLogs}
              disabled={isLoadingLogs}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
              {locale === "fr" ? "Actualiser" : "Refresh"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date (UTC)</th>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entité</th>
                    <th className="px-4 py-3">Adresse IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matterLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        {isLoadingLogs
                          ? (locale === "fr" ? "Chargement du journal..." : "Loading audit log...")
                          : (locale === "fr" ? "Aucun événement d'audit disponible." : "No audit entries found.")}
                      </td>
                    </tr>
                  ) : (
                    matterLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition text-xs">
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {log.actor?.name ?? "Système"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)})` : ""}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-muted-foreground">
                          {log.ip ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Event Drawer */}
      <SidePanel
        open={isAddEventOpen}
        onOpenChange={setIsAddEventOpen}
        title={locale === "fr" ? "Planifier une audience ou échéance" : "Schedule Event"}
        subtitle={matter.title}
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          {eventError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {eventError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="evTitle">{locale === "fr" ? "Titre / Objet *" : "Title *"}</Label>
            <Input
              id="evTitle"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="ex: Audience de plaidoirie au fond"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evTypeSelect">{locale === "fr" ? "Type d'événement" : "Type"}</Label>
            <select
              id="evTypeSelect"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="HEARING">Audience de plaidoirie / référé</option>
              <option value="PROCEDURAL_DEADLINE">Échéance procédurale légale (avec source)</option>
              <option value="INTERNAL_DEADLINE">Échéance interne de préparation</option>
              <option value="APPOINTMENT">Rendez-vous client / confrère</option>
              <option value="MEETING">Réunion de travail</option>
              <option value="DECISION">Prononcé du délibéré / jugement</option>
            </select>
          </div>

          {eventType === "PROCEDURAL_DEADLINE" && (
            <div className="space-y-1.5 p-3 rounded-lg border border-amber-300 bg-amber-50">
              <Label htmlFor="evSource" className="text-amber-900 font-semibold">
                {locale === "fr" ? "Source légale / judiciaire *" : "Legal / Court Source *"}
              </Label>
              <Input
                id="evSource"
                value={eventSource}
                onChange={(e) => setEventSource(e.target.value)}
                placeholder="ex: Notification de jugement du 15/10/2026 (Art. 6 AUPVE)"
                required
              />
              <p className="text-[11px] text-amber-700">
                {locale === "fr"
                  ? "Obligatoire selon la règle déontologique (BR-07 / REC-05)."
                  : "Mandatory under practice rules (BR-07 / REC-05)."}
              </p>
            </div>
          )}

          {matter.procedures && matter.procedures.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="evProcSelect">{locale === "fr" ? "Procédure judiciaire rattachée" : "Linked Procedure"}</Label>
              <select
                id="evProcSelect"
                value={eventProcedureId}
                onChange={(e) => setEventProcedureId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- Sans procédure spécifique --</option>
                {matter.procedures.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.kind} - {p.jurisdiction} ({p.reference || "Sans réf"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evStartsAt">{locale === "fr" ? "Date & Heure *" : "Start Date *"}</Label>
              <Input
                id="evStartsAt"
                type="datetime-local"
                value={eventStartsAt}
                onChange={(e) => setEventStartsAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evEndsAt">{locale === "fr" ? "Fin prévue" : "End Date"}</Label>
              <Input
                id="evEndsAt"
                type="datetime-local"
                value={eventEndsAt}
                onChange={(e) => setEventEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evLocation">{locale === "fr" ? "Lieu / Salle d'audience" : "Location"}</Label>
            <Input
              id="evLocation"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="ex: Palais de Justice de Douala, Salle 3"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evDesc">{locale === "fr" ? "Ordre du jour / Notes" : "Description"}</Label>
            <textarea
              id="evDesc"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Objet des débats ou diligences prévues..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddEventOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Enregistrer l'audience" : "Save Event"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Postpone Hearing Modal (BR-05) */}
      {isPostponeModalOpen && selectedEventToPostpone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-card rounded-xl shadow-2xl overflow-hidden border border-border">
            <form onSubmit={handlePostponeEvent} className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-700">
                <RotateCcw className="h-5 w-5" />
                <h3 className="font-bold text-lg font-serif text-foreground">
                  {locale === "fr" ? "Renvoyer l'audience (BR-05)" : "Postpone Hearing (BR-05)"}
                </h3>
              </div>

              <p className="text-xs text-muted-foreground">
                {locale === "fr"
                  ? "Conformément à la déontologie, l'audience précédente sera conservée dans l'historique avec le statut Renvoyé. Une nouvelle audience liée sera créée."
                  : "The previous hearing is preserved with status Postponed. A new linked replacement event will be created."}
              </p>

              {postponeError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {postponeError}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="postNewDate">{locale === "fr" ? "Nouvelle date d'audience *" : "New Hearing Date *"}</Label>
                  <Input
                    id="postNewDate"
                    type="datetime-local"
                    value={postponeNewDate}
                    onChange={(e) => setPostponeNewDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postReason">{locale === "fr" ? "Motif du renvoi *" : "Postponement Justification *"}</Label>
                  <textarea
                    id="postReason"
                    value={postponeReason}
                    onChange={(e) => setPostponeReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="ex: Renvoyé contradictoirement pour communication de conclusions..."
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postLoc">{locale === "fr" ? "Nouvelle salle / lieu (optionnel)" : "New Location"}</Label>
                  <Input
                    id="postLoc"
                    value={postponeLocation}
                    onChange={(e) => setPostponeLocation(e.target.value)}
                    placeholder="Laisser vide pour conserver le même lieu"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPostponeModalOpen(false)}
                >
                  {locale === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-medium"
                >
                  {locale === "fr" ? "Confirmer le renvoi" : "Confirm Postponement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member SidePanel Drawer */}
      <SidePanel
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        title={locale === "fr" ? "Ajouter un membre au dossier" : "Add matter member"}
        subtitle={matter.title}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          {memberError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {memberError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="userSelect">{locale === "fr" ? "Collaborateur" : "User"}</Label>
            <select
              id="userSelect"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="levelSelect">{locale === "fr" ? "Niveau d'accès" : "Access level"}</Label>
            <select
              id="levelSelect"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as MatterAccessLevel)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="VIEW">VIEW - Consultation seule</option>
              <option value="EDIT">EDIT - Modification des documents et tâches</option>
              <option value="MANAGE">MANAGE - Gestion totale et habilitation</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddMemberOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Ajouter" : "Add"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Add Mission SidePanel Drawer */}
      <SidePanel
        open={isAddMissionOpen}
        onOpenChange={setIsAddMissionOpen}
        title={locale === "fr" ? "Créer une mission" : "Add Mission"}
        subtitle={matter.title}
      >
        <form onSubmit={handleCreateMission} className="space-y-4">
          {missionError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {missionError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mTitle">{locale === "fr" ? "Intitulé de la mission *" : "Title *"}</Label>
            <Input
              id="mTitle"
              value={missionTitle}
              onChange={(e) => setMissionTitle(e.target.value)}
              placeholder="ex: Rédaction du pacte d'actionnaires..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mType">{locale === "fr" ? "Type de mission" : "Type"}</Label>
            <select
              id="mType"
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as MissionType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ADVISORY">ADVISORY - Conseil juridique</option>
              <option value="CONSULTATION">CONSULTATION - Consultation / Avis</option>
              <option value="DRAFTING">DRAFTING - Rédaction contractuelle</option>
              <option value="REPRESENTATION">REPRESENTATION - Représentation légale</option>
              <option value="OTHER">OTHER - Autre mission</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mOwner">{locale === "fr" ? "Responsable de mission" : "Owner"}</Label>
            <select
              id="mOwner"
              value={missionOwnerId}
              onChange={(e) => setMissionOwnerId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mScope">{locale === "fr" ? "Périmètre de la mission" : "Scope"}</Label>
            <textarea
              id="mScope"
              value={missionScope}
              onChange={(e) => setMissionScope(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Description des prestations attendues..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mDeliv">{locale === "fr" ? "Livrables attendus" : "Deliverables"}</Label>
            <Input
              id="mDeliv"
              value={missionDeliverables}
              onChange={(e) => setMissionDeliverables(e.target.value)}
              placeholder="ex: Projet de protocole d'accord, note de synthèse..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddMissionOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Créer la mission" : "Save Mission"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Add Procedure SidePanel Drawer */}
      <SidePanel
        open={isAddProcedureOpen}
        onOpenChange={setIsAddProcedureOpen}
        title={locale === "fr" ? "Engager une procédure" : "Add Court Procedure"}
        subtitle={matter.title}
      >
        <form onSubmit={handleCreateProcedure} className="space-y-4">
          {procedureError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {procedureError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pKind">{locale === "fr" ? "Type d'instance / Procédure" : "Kind"}</Label>
            <select
              id="pKind"
              value={procedureKind}
              onChange={(e) => setProcedureKind(e.target.value as ProcedureKind)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="FIRST_INSTANCE">Première Instance (TPI / TGI)</option>
              <option value="APPEAL">Appel (Cour d'Appel)</option>
              <option value="CASSATION">Cassation (Cour Suprême / CCJA)</option>
              <option value="ENFORCEMENT">Voies d'exécution (Saisie / Recouvrement)</option>
              <option value="ARBITRATION">Arbitrage (GICAM / CCJA)</option>
              <option value="ADMINISTRATIVE">Contentieux Administratif</option>
              <option value="OTHER">Autre instance</option>
            </select>
          </div>

          {/* Parent Procedure Chain Selection for Appeals */}
          {(procedureKind === "APPEAL" || procedureKind === "CASSATION") && (
            <div className="space-y-1.5 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Label htmlFor="parentProc" className="text-primary font-semibold">
                {locale === "fr"
                  ? "Procédure d'origine contestée (Chaîne d'instances)"
                  : "Challenged Parent Procedure"}
              </Label>
              <select
                id="parentProc"
                value={parentProcedureId}
                onChange={(e) => setParentProcedureId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{locale === "fr" ? "— Sélectionner l'instance précédente —" : "— Select previous instance —"}</option>
                {matter.procedures?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.kind} - {p.jurisdiction || "Tribunal"} ({p.reference || "Sans réf"})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {locale === "fr"
                  ? "Permet de lier formellement l'appel ou le pourvoi à la décision précédente."
                  : "Links the appeal directly to the challenged decision."}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pJurisdiction">
              {locale === "fr" ? "Juridiction / Tribunal *" : "Court / Tribunal *"}
            </Label>
            <Input
              id="pJurisdiction"
              value={procedureJurisdiction}
              onChange={(e) => setProcedureJurisdiction(e.target.value)}
              placeholder="ex: Tribunal de Première Instance de Douala-Ndokoti"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pRef">
              {locale === "fr" ? "N° de rôle général / Réf. greffe" : "Court Docket Number"}
            </Label>
            <Input
              id="pRef"
              value={procedureReference}
              onChange={(e) => setProcedureReference(e.target.value)}
              placeholder="ex: RG N° 452/CIV/2026"
            />
          </div>

          {/* Optional link to a mission */}
          {matter.missions?.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="linkMission">
                {locale === "fr" ? "Mission rattachée (Optionnel)" : "Linked Mission (Optional)"}
              </Label>
              <select
                id="linkMission"
                value={linkedMissionId}
                onChange={(e) => setLinkedMissionId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{locale === "fr" ? "— Aucune mission particulière —" : "— None —"}</option>
                {matter.missions.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddProcedureOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Enregistrer la procédure" : "Save Procedure"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Add Document SidePanel Drawer (DOC-01, DOC-02) */}
      <SidePanel
        open={isUploadDocOpen}
        onOpenChange={setIsUploadDocOpen}
        title={locale === "fr" ? "Verser un document" : "Upload Document"}
        subtitle={matter.title}
      >
        <form onSubmit={handleUploadDocument} className="space-y-4">
          {docError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {docError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="docTitleInput">{locale === "fr" ? "Intitulé du document *" : "Title *"}</Label>
            <Input
              id="docTitleInput"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="ex: Conclusions récapitulatives d'appel..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="docCatSelect">{locale === "fr" ? "Catégorie" : "Category"}</Label>
            <select
              id="docCatSelect"
              value={docCategoryId}
              onChange={(e) => setDocCategoryId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {docCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "en" ? c.nameEn : c.nameFr}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="docConfSelect">{locale === "fr" ? "Confidentialité" : "Confidentiality"}</Label>
            <select
              id="docConfSelect"
              value={docConfidentiality}
              onChange={(e) => setDocConfidentiality(e.target.value as Confidentiality)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="STANDARD">Standard</option>
              <option value="RESTRICTED">Restreint</option>
              <option value="STRICT">Strict</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="docFileInput">{locale === "fr" ? "Fichier (PDF, Word, Scan) *" : "File *"}</Label>
            <input
              id="docFileInput"
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              {locale === "fr"
                ? "Limite : 50 Mo. Chaque fichier est scanné par l'antivirus et horodaté."
                : "Limit: 50MB. Files are scanned and cryptographically hashed."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="docCommentInput">{locale === "fr" ? "Note de version" : "Comment"}</Label>
            <Input
              id="docCommentInput"
              value={docComment}
              onChange={(e) => setDocComment(e.target.value)}
              placeholder="ex: Première version signée..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadDocOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Verser le document" : "Upload"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Add Task SidePanel Drawer (TSK-01) */}
      <SidePanel
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        title={locale === "fr" ? "Nouvelle tâche" : "New Task"}
        subtitle={matter.title}
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          {taskError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {taskError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tTitle">{locale === "fr" ? "Intitulé de la tâche *" : "Task Title *"}</Label>
            <Input
              id="tTitle"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="ex: Rédiger le bordereau de communication de pièces..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tAssignee">{locale === "fr" ? "Collaborateur assigné" : "Assignee"}</Label>
            <select
              id="tAssignee"
              value={taskAssigneeId}
              onChange={(e) => setTaskAssigneeId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tPriority">{locale === "fr" ? "Priorité" : "Priority"}</Label>
              <select
                id="tPriority"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as Priority)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tDue">{locale === "fr" ? "Date d'échéance" : "Due Date"}</Label>
              <Input
                id="tDue"
                type="date"
                value={taskDueAt}
                onChange={(e) => setTaskDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={taskRequiresValidation}
                onChange={(e) => setTaskRequiresValidation(e.target.checked)}
                className="rounded border-input text-primary"
              />
              <span className="font-medium">
                {locale === "fr"
                  ? "Exiger une validation formelle d'un Associé / Lead avant clôture (BR-09)"
                  : "Require validation before closing (BR-09)"}
              </span>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddTaskOpen(false)}
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Créer la tâche" : "Create Task"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* Archive Confirm Modal */}
      <ConfirmDialog
        open={isArchiveConfirmOpen}
        onOpenChange={setIsArchiveConfirmOpen}
        title={locale === "fr" ? "Archiver ce dossier" : "Archive matter"}
        consequence={
          locale === "fr"
            ? "Le dossier sera retiré des listes courantes et basculé en statut archivé conformément aux règles déontologiques."
            : "The matter will be removed from active lists and archived."
        }
        confirmLabel={locale === "fr" ? "Confirmer l'archivage" : "Confirm archive"}
        cancelLabel={locale === "fr" ? "Annuler" : "Cancel"}
        destructive={true}
        onConfirm={async () => {
          await softDeleteMatterAction(matter.id);
          router.push(`/${locale}/matters`);
        }}
      />
    </div>
  );
}
