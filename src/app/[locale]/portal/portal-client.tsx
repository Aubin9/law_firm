"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileText,
  Download,
  Upload,
  Calendar,
  CreditCard,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Send,
} from "lucide-react";

interface PortalClientProps {
  locale: "fr" | "en";
  clientName: string;
  clientEmail: string;
  initialMatters: any[];
}

export function PortalClient({
  locale,
  clientName,
  clientEmail,
  initialMatters,
}: PortalClientProps) {
  const router = useRouter();
  const [selectedMatterId, setSelectedMatterId] = useState<string>(
    initialMatters[0]?.id || ""
  );
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Upload state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Message state
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);

  const loadMatterDetail = async (id: string) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/portal/matters/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedMatterId) {
      loadMatterDetail(selectedMatterId);
    }
  }, [selectedMatterId]);

  const handleLogout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push(`/${locale}/portal/login`);
    router.refresh();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId || !uploadFile) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadTitle || uploadFile.name);
      const res = await fetch(`/api/portal/matters/${selectedMatterId}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(
          locale === "fr"
            ? "Pièce transmise avec succès (placée en quarantaine antivirus avant validation par votre avocat)."
            : "Document uploaded (quarantined pending review)."
        );
        setUploadTitle("");
        setUploadFile(null);
      } else {
        setUploadStatus(data.error || "Échec de l'envoi.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId || !msgBody.trim()) return;
    setSendingMsg(true);
    setMsgFeedback(null);
    try {
      const res = await fetch(`/api/portal/matters/${selectedMatterId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: msgSubject, body: msgBody }),
      });
      if (res.ok) {
        setMsgFeedback(locale === "fr" ? "Message transmis à votre avocat." : "Message sent.");
        setMsgSubject("");
        setMsgBody("");
        loadMatterDetail(selectedMatterId);
      } else {
        const data = await res.json();
        setMsgFeedback(data.error || "Erreur d'envoi.");
      }
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Bar */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-foreground">
              {locale === "fr" ? "Portail Client Sécurisé" : "Secure Client Portal"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {clientName} ({clientEmail})
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          {locale === "fr" ? "Déconnexion" : "Sign Out"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {initialMatters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {locale === "fr"
              ? "Aucun dossier n'est actuellement partagé sur votre portail."
              : "No matters are currently shared on your portal."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Matter List */}
            <aside className="space-y-2">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider px-1">
                {locale === "fr" ? "Vos Dossiers" : "Your Matters"}
              </h2>
              {initialMatters.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMatterId(m.id)}
                  className={`w-full text-left p-3 rounded-xl border transition text-xs space-y-1 ${
                    selectedMatterId === m.id
                      ? "bg-primary/5 border-primary text-foreground shadow-xs"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="font-mono text-[11px] font-semibold text-primary">
                    {m.reference}
                  </div>
                  <div className="font-semibold text-foreground line-clamp-2">
                    {m.title}
                  </div>
                  <div className="text-[11px]">{m.leadLawyerName}</div>
                </button>
              ))}
            </aside>

            {/* Main Matter Content */}
            <section className="lg:col-span-3 space-y-6">
              {loadingDetail || !detail ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center text-xs text-muted-foreground">
                  {locale === "fr" ? "Chargement du dossier..." : "Loading matter..."}
                </div>
              ) : (
                <>
                  {/* Header Summary */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {detail.matter.reference}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-semibold">
                        {detail.matter.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-serif font-bold text-foreground">
                      {detail.matter.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {locale === "fr" ? "Avocat responsable :" : "Lead Lawyer:"}{" "}
                      <span className="font-medium text-foreground">
                        {detail.matter.leadLawyerName}
                      </span>
                    </p>
                  </div>

                  {/* Shared Documents + Client Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>
                          {locale === "fr" ? "Pièces & Actes Validés" : "Shared Documents"}
                        </span>
                      </div>

                      {detail.documents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {locale === "fr"
                            ? "Aucune pièce partagée pour le moment."
                            : "No shared documents yet."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {detail.documents.map((doc: any) => (
                            <div
                              key={doc.id}
                              className="p-3 rounded-lg border border-border bg-background flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {doc.title}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  v{doc.latestVersion.versionNumber} •{" "}
                                  {(doc.latestVersion.sizeBytes / 1024).toFixed(1)} Ko
                                </div>
                              </div>
                              <a
                                href={`/api/portal/documents/${doc.latestVersion.id}/download`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium shrink-0"
                              >
                                <Download className="h-3.5 w-3.5 text-primary" />
                                {locale === "fr" ? "Télécharger" : "Download"}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Client Upload Quarantine Zone */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Upload className="h-4 w-4 text-primary" />
                        <span>
                          {locale === "fr"
                            ? "Transmettre un justificatif"
                            : "Upload Supporting Document"}
                        </span>
                      </div>

                      <form onSubmit={handleUpload} className="space-y-3 text-xs">
                        <input
                          type="text"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder={
                            locale === "fr"
                              ? "Intitulé de la pièce (ex: Statuts signés)"
                              : "Document title"
                          }
                          className="w-full h-9 px-3 rounded-md border border-input bg-background"
                        />
                        <input
                          type="file"
                          required
                          accept=".pdf,.jpg,.jpeg,.png,.txt,.docx"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          className="w-full text-xs"
                        />
                        {uploadStatus && (
                          <div className="p-2.5 rounded-md bg-muted text-foreground text-[11px]">
                            {uploadStatus}
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={uploading || !uploadFile}
                          className="w-full h-9 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          {uploading
                            ? locale === "fr"
                              ? "Envoi sécurisé..."
                              : "Uploading..."
                            : locale === "fr"
                            ? "Envoyer au cabinet"
                            : "Send to Firm"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Shared Events & Invoices */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>
                          {locale === "fr" ? "Audiences & Rendez-vous" : "Hearings & Events"}
                        </span>
                      </div>
                      {detail.events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {locale === "fr" ? "Aucun événement partagé." : "No shared events."}
                        </p>
                      ) : (
                        <div className="space-y-2 text-xs">
                          {detail.events.map((ev: any) => (
                            <div key={ev.id} className="p-3 rounded-lg border border-border bg-background">
                              <div className="font-medium text-foreground">{ev.title}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {new Date(ev.startsAt).toLocaleString(locale === "en" ? "en-US" : "fr-FR")}
                                {ev.location ? ` • ${ev.location}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>
                          {locale === "fr" ? "Factures & Règlements" : "Invoices & Payments"}
                        </span>
                      </div>
                      {detail.invoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {locale === "fr" ? "Aucune facture émise." : "No issued invoices."}
                        </p>
                      ) : (
                        <div className="space-y-2 text-xs">
                          {detail.invoices.map((inv: any) => (
                            <div
                              key={inv.id}
                              className="p-3 rounded-lg border border-border bg-background flex items-center justify-between"
                            >
                              <div>
                                <div className="font-mono font-semibold text-foreground">
                                  {inv.number}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Total : {inv.total.toLocaleString("fr-FR")} {inv.currency}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-foreground">
                                  Reste dû : {inv.remainingDue.toLocaleString("fr-FR")} {inv.currency}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shared Notes & Messaging */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span>
                        {locale === "fr"
                          ? "Échanges & Notes Partagées"
                          : "Messages & Shared Notes"}
                      </span>
                    </div>

                    <form onSubmit={handleSendMessage} className="space-y-3 text-xs border-b border-border pb-4">
                      <input
                        type="text"
                        value={msgSubject}
                        onChange={(e) => setMsgSubject(e.target.value)}
                        placeholder={locale === "fr" ? "Objet du message" : "Subject"}
                        className="w-full h-9 px-3 rounded-md border border-input bg-background"
                      />
                      <textarea
                        rows={3}
                        required
                        value={msgBody}
                        onChange={(e) => setMsgBody(e.target.value)}
                        placeholder={
                          locale === "fr"
                            ? "Écrivez votre message à votre avocat..."
                            : "Write a message to your lawyer..."
                        }
                        className="w-full p-3 rounded-md border border-input bg-background"
                      />
                      {msgFeedback && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          {msgFeedback}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={sendingMsg}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {locale === "fr" ? "Envoyer" : "Send"}
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2 text-xs">
                      {detail.notes.map((n: any) => (
                        <div key={n.id} className="p-3 rounded-lg border border-border bg-muted/20">
                          <div className="text-[11px] text-muted-foreground mb-1">
                            Note du cabinet ({n.authorName}) •{" "}
                            {new Date(n.createdAt).toLocaleDateString()}
                          </div>
                          <p className="text-foreground whitespace-pre-line">{n.body}</p>
                        </div>
                      ))}
                      {detail.messages.map((m: any) => (
                        <div key={m.id} className="p-3 rounded-lg border border-border bg-background">
                          <div className="font-semibold text-foreground">{m.subject}</div>
                          <div className="text-[11px] text-muted-foreground mb-1">
                            {new Date(m.occurredAt).toLocaleString()}
                          </div>
                          <p className="text-foreground whitespace-pre-line">{m.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

