"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Flag,
  Gavel,
  MapPin,
  Plus,
  Scale,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  X,
  ExternalLink,
} from "lucide-react";
import { EventStatus, EventType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createEventAction,
  postponeEventAction,
  validateProceduralDeadlineAction,
  cancelEventAction,
} from "@/server/actions/event-actions";

export interface SerializedEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  source: string | null;
  matterId: string | null;
  matter?: {
    id: string;
    reference: string;
    title: string;
    confidentiality: string;
  } | null;
  procedureId: string | null;
  procedure?: {
    id: string;
    jurisdiction: string | null;
    kind: string;
    reference: string | null;
  } | null;
  party?: {
    id: string;
    displayName: string;
  } | null;
  attendees: {
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  deadlineValidatedById: string | null;
  deadlineValidatedBy?: {
    id: string;
    name: string;
  } | null;
  deadlineValidatedAt?: string | null;
  replacesEventId?: string | null;
  replacesEvent?: {
    id: string;
    title: string;
    startsAt: string;
    status: string;
  } | null;
  replacedBy?: {
    id: string;
    title: string;
    startsAt: string;
    status: string;
  } | null;
  reminders?: {
    id: string;
    remindBeforeMinutes: number;
    sentAt: string | null;
  }[];
}

interface CalendarClientProps {
  initialEvents: SerializedEvent[];
  accessibleMatters: { id: string; reference: string; title: string }[];
  currentUserId: string;
  currentUserRole: string;
}

type CalendarView = "month" | "week" | "day" | "agenda";

export function CalendarClient({
  initialEvents,
  accessibleMatters,
  currentUserId,
  currentUserRole,
}: CalendarClientProps) {
  const t = useTranslations("event");
  const [events, setEvents] = useState<SerializedEvent[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [selectedMatterId, setSelectedMatterId] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<SerializedEvent | null>(null);

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPostponeOpen, setIsPostponeOpen] = useState(false);
  const [eventToPostpone, setEventToPostpone] = useState<SerializedEvent | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<EventType>(EventType.HEARING);
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newAllDay, setNewAllDay] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newMatterId, setNewMatterId] = useState("");
  const [newReminderMins, setNewReminderMins] = useState<number[]>([60, 1440]);

  // Postpone form state
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeReason, setPostponeReason] = useState("");
  const [postponeLocation, setPostponeLocation] = useState("");

  const canValidateDeadline =
    currentUserRole === "PARTNER" ||
    currentUserRole === "LEAD_LAWYER" ||
    currentUserRole === "ASSOCIATE_LAWYER";

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (typeFilter !== "ALL") {
      if (typeFilter === "HEARINGS" && ev.type !== EventType.HEARING) return false;
      if (
        typeFilter === "DEADLINES" &&
        ev.type !== EventType.PROCEDURAL_DEADLINE &&
        ev.type !== EventType.INTERNAL_DEADLINE
      )
        return false;
      if (
        typeFilter === "APPOINTMENTS" &&
        ev.type !== EventType.APPOINTMENT &&
        ev.type !== EventType.CONSULTATION &&
        ev.type !== EventType.MEETING
      )
        return false;
    }
    if (selectedMatterId !== "ALL" && ev.matterId !== selectedMatterId) {
      return false;
    }
    return true;
  });

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Handle Event Creation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newTitle.trim() || !newStartsAt) {
      setErrorMessage("Veuillez renseigner le titre et la date de début.");
      return;
    }

    if (newType === EventType.PROCEDURAL_DEADLINE && !newSource.trim()) {
      setErrorMessage(
        "Une échéance procédurale exige obligatoirement la mention de sa source légale ou judiciaire."
      );
      return;
    }

    startTransition(async () => {
      const res = await createEventAction({
        title: newTitle,
        type: newType,
        startsAt: newStartsAt,
        endsAt: newEndsAt || null,
        allDay: newAllDay,
        location: newLocation || null,
        description: newDescription || null,
        source: newSource || null,
        matterId: newMatterId || null,
        reminderMinutes: newReminderMins,
      });

      if (res.success && res.data) {
        setEvents((prev) => [
          ...prev,
          {
            ...res.data,
            startsAt: res.data.startsAt.toISOString(),
            endsAt: res.data.endsAt ? res.data.endsAt.toISOString() : null,
            deadlineValidatedAt: res.data.deadlineValidatedAt
              ? res.data.deadlineValidatedAt.toISOString()
              : null,
            attendees: res.data.attendees.map((a: any) => ({
              user: {
                id: a.user.id,
                name: a.user.name,
                email: a.user.email,
              },
            })),
            reminders: res.data.reminders.map((r: any) => ({
              id: r.id,
              remindBeforeMinutes: r.remindBeforeMinutes,
              sentAt: r.sentAt ? r.sentAt.toISOString() : null,
            })),
          } as SerializedEvent,
        ]);
        setIsCreateOpen(false);
        // Reset form
        setNewTitle("");
        setNewStartsAt("");
        setNewEndsAt("");
        setNewLocation("");
        setNewDescription("");
        setNewSource("");
        setNewMatterId("");
      } else {
        setErrorMessage(res.error || "Erreur de création");
      }
    });
  };

  // Handle Postponement
  const handlePostponeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventToPostpone || !postponeDate || !postponeReason.trim()) {
      return;
    }

    startTransition(async () => {
      const res = await postponeEventAction(eventToPostpone.id, {
        newStartsAt: postponeDate,
        reason: postponeReason,
        newLocation: postponeLocation || undefined,
      });

      if (res.success && res.data) {
        // Update local state: mark old as postponed, add new
        setEvents((prev) =>
          prev
            .map((ev) =>
              ev.id === eventToPostpone.id
                ? { ...ev, status: EventStatus.POSTPONED }
                : ev
            )
            .concat({
              ...res.data,
              startsAt: res.data.startsAt.toISOString(),
              endsAt: res.data.endsAt ? res.data.endsAt.toISOString() : null,
              deadlineValidatedAt: null,
              attendees: (res.data.attendees || []).map((a: any) => ({
                user: { id: a.user.id, name: a.user.name, email: a.user.email },
              })),
            } as SerializedEvent)
        );
        setIsPostponeOpen(false);
        setEventToPostpone(null);
        setSelectedEvent(null);
      }
    });
  };

  // Handle Deadline Validation
  const handleValidateDeadline = (eventId: string) => {
    startTransition(async () => {
      const res = await validateProceduralDeadlineAction(eventId);
      if (res.success && res.data) {
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === eventId
              ? {
                  ...ev,
                  deadlineValidatedById: currentUserId,
                  deadlineValidatedBy: res.data.deadlineValidatedBy,
                  deadlineValidatedAt: new Date().toISOString(),
                }
              : ev
          )
        );
        if (selectedEvent?.id === eventId) {
          setSelectedEvent((prev) =>
            prev
              ? {
                  ...prev,
                  deadlineValidatedById: currentUserId,
                  deadlineValidatedBy: res.data.deadlineValidatedBy,
                  deadlineValidatedAt: new Date().toISOString(),
                }
              : null
          );
        }
      }
    });
  };

  // Type styling and badge helper
  const renderTypeIcon = (type: EventType) => {
    switch (type) {
      case EventType.HEARING:
        return <Gavel className="h-4 w-4 text-[#B08D57]" />;
      case EventType.PROCEDURAL_DEADLINE:
        return <Flag className="h-4 w-4 text-rose-600" />;
      case EventType.INTERNAL_DEADLINE:
        return <Clock className="h-4 w-4 text-amber-600" />;
      case EventType.APPOINTMENT:
      case EventType.CONSULTATION:
        return <User className="h-4 w-4 text-blue-600" />;
      case EventType.MEETING:
        return <Users className="h-4 w-4 text-indigo-600" />;
      default:
        return <Scale className="h-4 w-4 text-slate-600" />;
    }
  };

  const getEventBadgeColor = (type: EventType, status: EventStatus) => {
    if (status === EventStatus.POSTPONED) {
      return "bg-slate-100 text-slate-500 line-through border-slate-300";
    }
    if (status === EventStatus.CANCELLED) {
      return "bg-rose-50 text-rose-600 line-through border-rose-200";
    }
    switch (type) {
      case EventType.HEARING:
        return "bg-[#1F2A44]/10 text-[#1F2A44] border-[#1F2A44]/20 hover:bg-[#1F2A44]/15";
      case EventType.PROCEDURAL_DEADLINE:
        return "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100";
      case EventType.INTERNAL_DEADLINE:
        return "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100";
      case EventType.APPOINTMENT:
      case EventType.CONSULTATION:
        return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200";
    }
  };

  // Calendar Month Matrix calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Calculate starting day of the week (Monday = 0)
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: { day: number; currentMonth: boolean; date: Date }[] = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthLastDay - i,
      currentMonth: false,
      date: new Date(year, month - 1, prevMonthLastDay - i),
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      currentMonth: true,
      date: new Date(year, month, i),
    });
  }

  // Next month padding
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      currentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const weekDayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthTitle = currentDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#1F2A44] flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-[#B08D57]" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("newEvent")}
          </Button>
        </div>
      </div>

      {/* Control Bar: Views, Filters, Navigation */}
      <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="h-9 w-9 p-0"
              aria-label="Période précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-9 px-3 text-xs font-semibold"
            >
              Aujourd&apos;hui
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="h-9 w-9 p-0"
              aria-label="Période suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold text-[#1F2A44] capitalize ml-2">
              {monthTitle}
            </h2>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                view === "month"
                  ? "bg-white text-[#1F2A44] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("views.month")}
            </button>
            <button
              onClick={() => setView("agenda")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                view === "agenda"
                  ? "bg-white text-[#1F2A44] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("views.agenda")}
            </button>
          </div>
        </div>

        {/* Filter Quick Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" />
            Filtres :
          </span>

          <button
            onClick={() => setTypeFilter("ALL")}
            className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
              typeFilter === "ALL"
                ? "bg-[#1F2A44] text-white border-[#1F2A44]"
                : "bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("filters.all")}
          </button>
          <button
            onClick={() => setTypeFilter("HEARINGS")}
            className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 transition-all ${
              typeFilter === "HEARINGS"
                ? "bg-[#B08D57] text-white border-[#B08D57]"
                : "bg-white text-[#1F2A44] border-amber-200 hover:bg-amber-50"
            }`}
          >
            <Gavel className="h-3 w-3" />
            {t("filters.hearings")}
          </button>
          <button
            onClick={() => setTypeFilter("DEADLINES")}
            className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 transition-all ${
              typeFilter === "DEADLINES"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
            }`}
          >
            <Flag className="h-3 w-3" />
            {t("filters.deadlines")}
          </button>
          <button
            onClick={() => setTypeFilter("APPOINTMENTS")}
            className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 transition-all ${
              typeFilter === "APPOINTMENTS"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
            }`}
          >
            <Users className="h-3 w-3" />
            {t("filters.appointments")}
          </button>

          {/* Matter filter dropdown */}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId(e.target.value)}
              className="text-xs border rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
            >
              <option value="ALL">Tous les dossiers</option>
              {accessibleMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} - {m.title.slice(0, 30)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Calendar View Container */}
      {view === "month" && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 border-b bg-muted/20 text-center font-medium text-xs text-muted-foreground py-2.5">
            {weekDayNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y">
            {calendarDays.map((cell, idx) => {
              const dateStr = cell.date.toISOString().split("T")[0];
              const cellEvents = filteredEvents.filter(
                (ev) => ev.startsAt.split("T")[0] === dateStr
              );
              const isToday =
                new Date().toISOString().split("T")[0] === dateStr;

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                    !cell.currentMonth
                      ? "bg-muted/10 text-muted-foreground/40"
                      : "bg-white"
                  } ${isToday ? "bg-amber-50/30" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold rounded-full h-6 w-6 flex items-center justify-center ${
                        isToday
                          ? "bg-[#1F2A44] text-white"
                          : cell.currentMonth
                          ? "text-slate-700"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {cellEvents.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {cellEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events Stack */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px]">
                    {cellEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left p-1 rounded text-[11px] border flex items-center gap-1 truncate ${getEventBadgeColor(
                          ev.type,
                          ev.status
                        )}`}
                      >
                        {renderTypeIcon(ev.type)}
                        <span className="truncate font-medium">{ev.title}</span>
                      </button>
                    ))}
                    {cellEvents.length > 3 && (
                      <button
                        onClick={() => {
                          setCurrentDate(cell.date);
                          setView("agenda");
                        }}
                        className="text-[10px] text-muted-foreground hover:text-[#1F2A44] font-medium pl-1"
                      >
                        +{cellEvents.length - 3} autre(s)...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda / List View */}
      {view === "agenda" && (
        <div className="bg-white border rounded-xl shadow-sm divide-y">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium">{t("emptyState.title")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("emptyState.description")}
              </p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const startDate = new Date(ev.startsAt);
              const isPostponed = ev.status === EventStatus.POSTPONED;
              const isDeadline = ev.type === EventType.PROCEDURAL_DEADLINE;

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`p-4 hover:bg-muted/30 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isPostponed ? "bg-slate-50 opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg border bg-white shadow-xs shrink-0">
                      {renderTypeIcon(ev.type)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`font-semibold text-sm text-[#1F2A44] ${
                            isPostponed ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {ev.title}
                        </h3>

                        {/* Status Chip */}
                        {isPostponed && (
                          <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50 border-amber-200">
                            {t("postponed")}
                          </Badge>
                        )}

                        {isDeadline && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              ev.deadlineValidatedById
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            }`}
                          >
                            {ev.deadlineValidatedById
                              ? `Validé (${ev.deadlineValidatedBy?.name || "Avocat"})`
                              : t("toValidate")}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {startDate.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ev.location}
                          </span>
                        )}

                        {ev.matter && (
                          <span className="flex items-center gap-1 font-mono font-medium text-[#1F2A44]">
                            <Scale className="h-3 w-3 text-[#B08D57]" />
                            {ev.matter.reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ev.type === EventType.HEARING && !isPostponed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEventToPostpone(ev);
                          setIsPostponeOpen(true);
                        }}
                        className="text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {t("postpone")}
                      </Button>
                    )}

                    {isDeadline && !ev.deadlineValidatedById && canValidateDeadline && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleValidateDeadline(ev.id);
                        }}
                        className="text-xs h-8 bg-[#B08D57] hover:bg-[#B08D57]/90 text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {t("validateAction")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Side Panel: Event Details */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted/40 border">
                    {renderTypeIcon(selectedEvent.type)}
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {selectedEvent.type}
                    </span>
                    <h2 className="text-lg font-bold text-[#1F2A44]">
                      {selectedEvent.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status and replacement banner */}
              {selectedEvent.status === EventStatus.POSTPONED && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Audience renvoyée (conservée à l&apos;historique)
                  </p>
                  <p className="text-muted-foreground">
                    Cette audience a fait l&apos;objet d&apos;un renvoi et a été remplacée.
                  </p>
                </div>
              )}

              {selectedEvent.replacesEvent && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Fait suite au renvoi de l&apos;audience précédente
                  </p>
                  <p>
                    Audience initiale du{" "}
                    {new Date(selectedEvent.replacesEvent.startsAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              )}

              {/* Procedural deadline validation card */}
              {selectedEvent.type === EventType.PROCEDURAL_DEADLINE && (
                <div className="p-4 rounded-lg border bg-stone-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700 flex items-center gap-1">
                      <Flag className="h-4 w-4 text-rose-600" />
                      Échéance procédurale légale
                    </span>
                    {selectedEvent.deadlineValidatedById ? (
                      <Badge className="bg-emerald-600 text-white text-[11px]">
                        Validé
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] bg-rose-50 text-rose-700 border-rose-200">
                        À valider
                      </Badge>
                    )}
                  </div>

                  {selectedEvent.source && (
                    <div className="text-xs">
                      <span className="font-semibold text-stone-600">Source : </span>
                      <span className="text-stone-800 font-mono">{selectedEvent.source}</span>
                    </div>
                  )}

                  {selectedEvent.deadlineValidatedById ? (
                    <p className="text-xs text-emerald-800 font-medium">
                      Validé formellement par {selectedEvent.deadlineValidatedBy?.name || "Avocat"}{" "}
                      le {new Date(selectedEvent.deadlineValidatedAt || "").toLocaleDateString("fr-FR")}
                    </p>
                  ) : (
                    canValidateDeadline && (
                      <Button
                        size="sm"
                        onClick={() => handleValidateDeadline(selectedEvent.id)}
                        className="w-full mt-2 bg-[#B08D57] hover:bg-[#B08D57]/90 text-white text-xs"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        {t("validateAction")}
                      </Button>
                    )
                  )}
                </div>
              )}

              {/* Event Details Grid */}
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Date et heure</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedEvent.startsAt).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {selectedEvent.location && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Lieu / Juridiction</span>
                    <span className="text-slate-800 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selectedEvent.location}
                    </span>
                  </div>
                )}

                {selectedEvent.matter && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Dossier rattaché</span>
                    <a
                      href={`/matters/${selectedEvent.matter.id}`}
                      className="font-mono font-semibold text-[#1F2A44] hover:underline flex items-center gap-1"
                    >
                      {selectedEvent.matter.reference} - {selectedEvent.matter.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {selectedEvent.procedure && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Procédure</span>
                    <span className="text-slate-800">
                      {selectedEvent.procedure.jurisdiction} ({selectedEvent.procedure.kind})
                    </span>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Description / Notes</span>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap bg-muted/20 p-2.5 rounded border">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Drawer */}
            <div className="p-6 border-t bg-muted/10 space-y-2">
              {selectedEvent.type === EventType.HEARING &&
                selectedEvent.status !== EventStatus.POSTPONED && (
                  <Button
                    onClick={() => {
                      setEventToPostpone(selectedEvent);
                      setIsPostponeOpen(true);
                    }}
                    variant="outline"
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t("postpone")}
                  </Button>
                )}

              <Button
                variant="ghost"
                onClick={() => setSelectedEvent(null)}
                className="w-full text-xs"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Drawer / Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <form onSubmit={handleCreateSubmit} className="flex flex-col h-full justify-between">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-lg font-bold font-serif text-[#1F2A44]">
                    {t("newEvent")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {errorMessage && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ev-title" className="text-xs font-semibold">
                      {t("fields.title")} *
                    </Label>
                    <Input
                      id="ev-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="ex. Audience de fixation - TGI Douala"
                      className="mt-1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ev-type" className="text-xs font-semibold">
                        {t("fields.type")}
                      </Label>
                      <select
                        id="ev-type"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as EventType)}
                        className="mt-1 w-full text-xs border rounded-md p-2 bg-white"
                      >
                        <option value={EventType.HEARING}>{t("hearing")}</option>
                        <option value={EventType.PROCEDURAL_DEADLINE}>
                          {t("proceduralDeadline")} (Légal)
                        </option>
                        <option value={EventType.INTERNAL_DEADLINE}>
                          {t("internalDeadline")}
                        </option>
                        <option value={EventType.APPOINTMENT}>{t("appointment")}</option>
                        <option value={EventType.CONSULTATION}>{t("consultation")}</option>
                        <option value={EventType.MEETING}>{t("meeting")}</option>
                        <option value={EventType.FILING}>{t("filing")}</option>
                        <option value={EventType.NOTIFICATION}>{t("notification")}</option>
                        <option value={EventType.DECISION}>{t("decision")}</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="ev-matter" className="text-xs font-semibold">
                        {t("fields.matter")}
                      </Label>
                      <select
                        id="ev-matter"
                        value={newMatterId}
                        onChange={(e) => setNewMatterId(e.target.value)}
                        className="mt-1 w-full text-xs border rounded-md p-2 bg-white"
                      >
                        <option value="">-- Sans dossier rattaché --</option>
                        {accessibleMatters.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.reference} - {m.title.slice(0, 25)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {newType === EventType.PROCEDURAL_DEADLINE && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                      <Label htmlFor="ev-source" className="text-xs font-bold text-amber-900">
                        {t("fields.source")} *
                      </Label>
                      <Input
                        id="ev-source"
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        placeholder="ex. Art. 6 AUPVE / Notification du 14/11/2026"
                        className="bg-white text-xs mt-1"
                        required
                      />
                      <p className="text-[11px] text-amber-700">
                        Obligatoire selon la règle déontologique (BR-07 / REC-05).
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ev-startsAt" className="text-xs font-semibold">
                        {t("fields.startsAt")} *
                      </Label>
                      <Input
                        id="ev-startsAt"
                        type="datetime-local"
                        value={newStartsAt}
                        onChange={(e) => setNewStartsAt(e.target.value)}
                        className="mt-1 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="ev-endsAt" className="text-xs font-semibold">
                        {t("fields.endsAt")}
                      </Label>
                      <Input
                        id="ev-endsAt"
                        type="datetime-local"
                        value={newEndsAt}
                        onChange={(e) => setNewEndsAt(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="ev-location" className="text-xs font-semibold">
                      {t("fields.location")}
                    </Label>
                    <Input
                      id="ev-location"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="ex. Tribunal de Première Instance de Douala Bonanjo, Salle 2"
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ev-desc" className="text-xs font-semibold">
                      {t("fields.description")}
                    </Label>
                    <Textarea
                      id="ev-desc"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Dépôt des conclusions en réplique, réquisitions..."
                      className="mt-1 text-xs h-20"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-muted/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
                >
                  {isPending ? "Enregistrement..." : "Créer l'événement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Hearing Modal (BR-05 / CAL-03) */}
      {isPostponeOpen && eventToPostpone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border">
            <form onSubmit={handlePostponeSubmit}>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <RotateCcw className="h-5 w-5" />
                  <h3 className="font-bold text-lg font-serif text-[#1F2A44]">
                    {t("postponeModal.title")}
                  </h3>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("postponeModal.description")}
                </p>

                <div className="p-3 bg-muted/30 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-[#1F2A44]">Audience actuelle : </span>
                  <span>{eventToPostpone.title}</span>
                  <div className="text-muted-foreground">
                    Prévue le : {new Date(eventToPostpone.startsAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="postpone-date" className="text-xs font-semibold">
                      {t("postponeModal.newDate")} *
                    </Label>
                    <Input
                      id="postpone-date"
                      type="datetime-local"
                      value={postponeDate}
                      onChange={(e) => setPostponeDate(e.target.value)}
                      className="mt-1 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="postpone-reason" className="text-xs font-semibold">
                      {t("postponeModal.reason")} *
                    </Label>
                    <Textarea
                      id="postpone-reason"
                      value={postponeReason}
                      onChange={(e) => setPostponeReason(e.target.value)}
                      placeholder="ex. Renvoyé pour communication de pièces justificatives à la partie adverse."
                      className="mt-1 text-xs h-20"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="postpone-loc" className="text-xs font-semibold">
                      {t("postponeModal.newLocation")}
                    </Label>
                    <Input
                      id="postpone-loc"
                      value={postponeLocation}
                      onChange={(e) => setPostponeLocation(e.target.value)}
                      placeholder="Laisser vide pour conserver le même lieu"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-muted/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPostponeOpen(false)}
                  disabled={isPending}
                >
                  {t("postponeModal.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-medium"
                >
                  {isPending ? "Renvoi en cours..." : t("postponeModal.submit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

