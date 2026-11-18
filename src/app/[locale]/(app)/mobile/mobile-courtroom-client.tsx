"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  Camera,
  Bell,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Plus,
  Send,
  Upload,
  User,
  Gavel,
  Shield,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createNoteAction, updateTaskStatusAction } from "@/server/actions/task-actions";
import { uploadDocumentAction } from "@/server/actions/document-actions";
import { markNotificationReadAction } from "@/server/actions/notification-actions";

interface EventItem {
  id: string;
  title: string;
  type: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  location: string | null;
  description: string | null;
  matterId: string | null;
  matter?: {
    id: string;
    reference: string;
    title: string;
  } | null;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | Date | null;
  matterId: string;
  matter?: {
    id: string;
    reference: string;
    title: string;
  } | null;
}

interface MatterOption {
  id: string;
  reference?: string;
  code?: string;
  title: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string | Date;
}

interface Props {
  locale: "fr" | "en";
  events: EventItem[];
  tasks: TaskItem[];
  matters: MatterOption[];
  notifications: NotificationItem[];
  userName: string;
}

export function MobileCourtroomClient({
  locale,
  events,
  tasks,
  matters,
  notifications,
  userName,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"hearings" | "tasks" | "scan" | "notifications">("hearings");
  const [isPending, startTransition] = useTransition();

  // Status banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hearing Note Modal State
  const [selectedHearing, setSelectedHearing] = useState<EventItem | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Document Scan State
  const [scanMatterId, setScanMatterId] = useState<string>(matters[0]?.id || "");
  const [scanTitle, setScanTitle] = useState<string>("");
  const [scanCategory, setScanCategory] = useState<string>("Pièce de procédure");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filter Hearings: today vs upcoming
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const todayHearings = events.filter((e) => {
    const d = new Date(e.startsAt).toISOString().slice(0, 10);
    return d === todayStr;
  });

  const [hearingScope, setHearingScope] = useState<"today" | "all">("today");
  const displayedHearings = hearingScope === "today" ? todayHearings : events;

  // Complete task
  const handleToggleTask = (task: TaskItem) => {
    startTransition(async () => {
      const res = await updateTaskStatusAction(task.id, task.matterId, "DONE");
      if (res.success) {
        setSuccessMsg(locale === "fr" ? "Tâche marquée comme terminée." : "Task marked as completed.");
        router.refresh();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Erreur lors de la mise à jour de la tâche.");
      }
    });
  };

  // Submit hearing note
  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHearing || !selectedHearing.matterId || !noteBody.trim()) return;

    setIsSubmittingNote(true);
    setErrorMsg(null);

    const prefix = locale === "fr"
      ? `[Compte-rendu d'audience - ${selectedHearing.title}] : `
      : `[Hearing Report - ${selectedHearing.title}] : `;

    const res = await createNoteAction(
      selectedHearing.matterId,
      prefix + noteBody.trim(),
      false,
      selectedHearing.id
    );

    setIsSubmittingNote(false);
    if (res.success) {
      setSuccessMsg(
        locale === "fr"
          ? "Compte-rendu d'audience enregistré dans le dossier."
          : "Hearing report saved to matter file."
      );
      setSelectedHearing(null);
      setNoteBody("");
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || "Impossible d'enregistrer le compte-rendu.");
    }
  };

  // Handle file capture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!scanTitle) {
      setScanTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Upload captured document
  const handleUploadScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !scanMatterId || !scanTitle.trim()) {
      setErrorMsg(
        locale === "fr"
          ? "Veuillez sélectionner un dossier, un titre et un fichier."
          : "Please select a matter, title, and file."
      );
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("matterId", scanMatterId);
    formData.append("title", scanTitle.trim());
    formData.append("comment", `Numérisation mobile palais (${scanCategory})`);
    formData.append("file", selectedFile);

    const res = await uploadDocumentAction(formData);
    setIsUploading(false);

    if (res.success) {
      setSuccessMsg(
        locale === "fr"
          ? "Document téléversé et mis en quarantaine antivirus avec succès."
          : "Document uploaded and queued for antivirus scan successfully."
      );
      setSelectedFile(null);
      setPreviewUrl(null);
      setScanTitle("");
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || "Erreur lors du téléversement.");
    }
  };

  // Notification mark read
  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      {/* Mobile Top App Bar */}
      <div className="rounded-xl bg-gradient-to-r from-[#0A192F] to-[#1E3A8A] text-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-amber-400" />
              <h1 className="text-base font-bold tracking-tight">
                {locale === "fr" ? "Palais & Audiences Mobile" : "Courtroom & Mobile Hub"}
              </h1>
            </div>
            <p className="text-xs text-blue-200 mt-1">
              {userName} •{" "}
              {new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[11px]">
            PWA Offline Ready
          </Badge>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mobile Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-muted/60 p-1 rounded-xl border border-border">
        <button
          onClick={() => setActiveTab("hearings")}
          className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
            activeTab === "hearings"
              ? "bg-white text-primary shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="w-4 h-4 mb-1" />
          <span>{locale === "fr" ? "Audiences" : "Hearings"}</span>
          {todayHearings.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-white rounded-full mt-0.5">
              {todayHearings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
            activeTab === "tasks"
              ? "bg-white text-primary shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4 mb-1" />
          <span>{locale === "fr" ? "Délais" : "Tasks"}</span>
          {tasks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-primary text-primary-foreground rounded-full mt-0.5">
              {tasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("scan")}
          className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
            activeTab === "scan"
              ? "bg-white text-primary shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="w-4 h-4 mb-1" />
          <span>{locale === "fr" ? "Scan Pièce" : "Scan Doc"}</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
            activeTab === "notifications"
              ? "bg-white text-primary shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="w-4 h-4 mb-1" />
          <span>{locale === "fr" ? "Alertes" : "Alerts"}</span>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-red-600 text-white rounded-full mt-0.5">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: AUDIENCES / HEARINGS */}
      {activeTab === "hearings" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">
              {locale === "fr" ? "Calendrier d'audiences" : "Court Hearings Schedule"}
            </h2>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setHearingScope("today")}
                className={`px-2.5 py-1 ${
                  hearingScope === "today" ? "bg-primary text-primary-foreground font-semibold" : "bg-card text-muted-foreground"
                }`}
              >
                {locale === "fr" ? "Aujourd'hui" : "Today"} ({todayHearings.length})
              </button>
              <button
                onClick={() => setHearingScope("all")}
                className={`px-2.5 py-1 ${
                  hearingScope === "all" ? "bg-primary text-primary-foreground font-semibold" : "bg-card text-muted-foreground"
                }`}
              >
                {locale === "fr" ? "7 Jours" : "7 Days"} ({events.length})
              </button>
            </div>
          </div>

          {displayedHearings.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-8 text-center text-xs text-muted-foreground shadow-sm">
              <Gavel className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              {locale === "fr"
                ? "Aucune audience planifiée pour cette période."
                : "No court hearings scheduled for this time frame."}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedHearings.map((h) => {
                const startTime = new Date(h.startsAt).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={h.id}
                    className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-2.5 dark:bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-primary">{startTime}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs font-semibold text-foreground">{h.title}</span>
                        </div>
                        {h.matter && (
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                              {h.matter.reference || (h.matter as any).code}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                              {h.matter.title}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                        {h.type}
                      </Badge>
                    </div>

                    {h.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{h.location}</span>
                      </div>
                    )}

                    {h.description && (
                      <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-md">
                        {h.description}
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-between border-t border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedHearing(h)}
                        disabled={!h.matterId}
                        className="text-xs text-primary border-primary/20 hover:bg-primary/5"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        {locale === "fr" ? "Compte-rendu d'audience" : "Hearing Report Note"}
                      </Button>
                      {h.matterId && (
                        <a
                          href={`/${locale}/matters/${h.matterId}`}
                          className="text-xs text-primary underline font-medium hover:text-primary/80"
                        >
                          {locale === "fr" ? "Ouvrir dossier" : "Open file"} &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TÂCHES & DÉLAIS */}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">
              {locale === "fr" ? "Délais & Tâches à accomplir" : "Deadlines & Pending Tasks"}
            </h2>
            <span className="text-xs text-muted-foreground">{tasks.length} actives</span>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-8 text-center text-xs text-muted-foreground shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              {locale === "fr" ? "Toutes vos tâches de palais sont à jour !" : "All court tasks completed!"}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < now;

                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-border bg-white p-3.5 shadow-sm flex items-start justify-between gap-3 dark:bg-card"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{task.title}</span>
                        {task.priority === "URGENT" && (
                          <Badge variant="danger" className="text-[10px] px-1 py-0">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      {task.matter && (
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-mono font-medium text-primary">{task.matter.reference || (task.matter as any).code}</span> •{" "}
                          {task.matter.title}
                        </div>
                      )}
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          <span>
                            {locale === "fr" ? "Échéance : " : "Due: "}
                            {new Date(task.dueDate).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleTask(task)}
                      disabled={isPending}
                      className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {locale === "fr" ? "Valider" : "Done"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCAN RAPIDE DE PIÈCES (CAMERA / UPLOAD) */}
      {activeTab === "scan" && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4 dark:bg-card">
          <div>
            <h2 className="text-sm font-semibold text-primary">
              {locale === "fr" ? "Numérisation & Capture Rapide de Pièce" : "Mobile Quick Scan & Evidence Capture"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "fr"
                ? "Prenez en photo une pièce d'audience, un exploit d'huissier ou un acte pour l'ajouter directement au dossier."
                : "Capture court evidence, bailiff writ, or document to upload directly into the matter file."}
            </p>
          </div>

          <form onSubmit={handleUploadScan} className="space-y-4">
            {/* Matter select */}
            <div>
              <label className="text-xs font-semibold text-primary block mb-1">
                {locale === "fr" ? "Dossier cible *" : "Target Matter *"}
              </label>
              <select
                value={scanMatterId}
                onChange={(e) => setScanMatterId(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background p-2"
                required
              >
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference || m.code} - {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Title */}
            <div>
              <label className="text-xs font-semibold text-primary block mb-1">
                {locale === "fr" ? "Titre de la pièce *" : "Document Title *"}
              </label>
              <input
                type="text"
                value={scanTitle}
                onChange={(e) => setScanTitle(e.target.value)}
                placeholder={locale === "fr" ? "ex: PV d'audience TPI Yaoundé" : "e.g. Hearing Minutes"}
                className="w-full text-xs rounded-md border border-input bg-background p-2"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-primary block mb-1">
                {locale === "fr" ? "Nature du document" : "Document Category"}
              </label>
              <select
                value={scanCategory}
                onChange={(e) => setScanCategory(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background p-2"
              >
                <option value="Pièce de procédure">Pièce de procédure / Conclusions</option>
                <option value="Exploit d'huissier">Exploit d'huissier / Signification</option>
                <option value="Procès-verbal">Procès-verbal / Décision avant dire droit</option>
                <option value="Pièce adverse">Pièce adverse communiquée à la barre</option>
                <option value="Autre">Autre justificatif</option>
              </select>
            </div>

            {/* Camera / File Input */}
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center space-y-2">
              {previewUrl ? (
                <div className="space-y-2">
                  <img
                    src={previewUrl}
                    alt="Aperçu de la pièce"
                    className="max-h-56 mx-auto rounded-lg shadow-sm border border-border object-contain"
                  />
                  <p className="text-[11px] text-muted-foreground">{selectedFile?.name}</p>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center justify-center gap-2 text-xs text-primary font-medium">
                  <FileText className="w-5 h-5" />
                  <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} Ko)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Camera className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-xs font-medium text-foreground">
                    {locale === "fr" ? "Prendre une photo ou sélectionner un fichier" : "Take photo or select file"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Format photo (JPEG, PNG) ou PDF numérisé (max 50 Mo)
                  </p>
                </div>
              )}

              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleFileChange}
                className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            <Button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="w-full text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {isUploading
                ? locale === "fr"
                  ? "Téléversement et analyse antivirus..."
                  : "Uploading & scanning..."
                : locale === "fr"
                ? "Téléverser vers le dossier"
                : "Upload to matter file"}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary">
            {locale === "fr" ? "Alertes & Notifications de palais" : "Court Alerts & Notifications"}
          </h2>

          {notifications.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-8 text-center text-xs text-muted-foreground shadow-sm">
              <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              {locale === "fr" ? "Aucune notification non lue." : "No unread notifications."}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-3.5 shadow-sm space-y-1 ${
                    n.read
                      ? "bg-white border-border text-muted-foreground dark:bg-card"
                      : "bg-amber-50/50 border-amber-200 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  {!n.read && (
                    <div className="pt-1 text-right">
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-[11px] text-primary underline font-medium"
                      >
                        {locale === "fr" ? "Marquer comme lu" : "Mark as read"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hearing Incident / Report Modal */}
      {selectedHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl space-y-4 dark:bg-card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary">
                  {locale === "fr" ? "Compte-rendu d'audience / Incident" : "Hearing Report / Court Incident"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedHearing.title} ({selectedHearing.matter?.reference || (selectedHearing.matter as any)?.code})
                </p>
              </div>
              <button
                onClick={() => setSelectedHearing(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNote} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">
                  {locale === "fr"
                    ? "Notes, incidents d'audience, ordonnance ou date de renvoi *"
                    : "Notes, incidents, order, or adjourned hearing date *"}
                </label>
                <textarea
                  rows={4}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={
                    locale === "fr"
                      ? "Ex : L'affaire a été renvoyée au 28/11/2026 pour production des pièces adverses. Ordonnance avant dire droit rendue..."
                      : "E.g. Matter adjourned to Nov 28, 2026 for document disclosure..."
                  }
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedHearing(null)}
                  className="text-xs"
                >
                  {locale === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingNote || !noteBody.trim()}
                  className="text-xs"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {isSubmittingNote
                    ? locale === "fr"
                      ? "Enregistrement..."
                      : "Saving..."
                    : locale === "fr"
                    ? "Enregistrer dans le dossier"
                    : "Save to matter"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
