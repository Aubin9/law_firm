"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel } from "@/components/app/side-panel";
import {
  Banknote,
  TrendingUp,
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  Plus,
  Scale,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Check,
  X,
  Trash2,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  createInvoiceAction,
  validateInvoiceAction,
} from "@/server/actions/invoice-actions";
import {
  recordPaymentAction,
  validatePaymentAction,
  rejectPaymentAction,
  recordClientFundEntryAction,
} from "@/server/actions/finance-actions";
import { PaymentMethod, FundEntryType } from "@prisma/client";

export interface SerializedInvoiceItem {
  id: string;
  number: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  clientId: string;
  clientName: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  validatedAt: string | null;
  workflowKey: string;
  financialStatus: string;
  paidAmount: number;
  remainingAmount: number;
  isOverdue: boolean;
}

export interface SerializedAgreementItem {
  id: string;
  title: string;
  type: string;
  amount: number | null;
  currency: string;
  status: string;
  matterReference: string;
  matterTitle: string;
  clientName: string;
  signedAt: string | null;
}

export interface SerializedFundItem {
  id: string;
  type: string;
  amount: number;
  currency: string;
  occurredAt: string;
  reference: string;
  matterReference: string;
  clientName: string;
  recordedByName: string;
  isValidated: boolean;
}

export interface SerializedPendingPaymentItem {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  matterReference: string;
  clientName: string;
  recordedByName: string;
}

export interface AvailableMatterItem {
  id: string;
  reference: string;
  title: string;
  clientPartyId: string;
  clientName: string;
}

interface FinanceClientProps {
  invoices: SerializedInvoiceItem[];
  feeAgreements: SerializedAgreementItem[];
  fundEntries: SerializedFundItem[];
  pendingPayments: SerializedPendingPaymentItem[];
  availableMatters: AvailableMatterItem[];
  locale: "fr" | "en";
  currentUserRole: string;
}

export function FinanceClient({
  invoices,
  feeAgreements,
  fundEntries,
  pendingPayments,
  availableMatters,
  locale,
  currentUserRole,
}: FinanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "agreements" | "funds">("invoices");

  const isAccountantOrPartner = currentUserRole === "ACCOUNTANT" || currentUserRole === "PARTNER";

  // KPIs
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const totalReceivables = Math.max(0, totalInvoiced - totalCollected);

  const totalCarpaIn = fundEntries
    .filter((f) => f.type === "DEPOSIT")
    .reduce((sum, f) => sum + f.amount, 0);
  const totalCarpaOut = fundEntries
    .filter((f) => f.type === "WITHDRAWAL" || f.type === "TRANSFER_TO_INVOICE")
    .reduce((sum, f) => sum + f.amount, 0);
  const carpaBalance = totalCarpaIn - totalCarpaOut;

  const formatMoney = (amount: number, curr = "XAF") => {
    return `${amount.toLocaleString("fr-FR")} ${curr}`;
  };

  // --- Create Invoice Drawer State ---
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState(availableMatters[0]?.id || "");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceDueDays, setInvoiceDueDays] = useState(30);
  const [invoiceLines, setInvoiceLines] = useState<
    Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>
  >([
    { description: "Honoraires de diligences juridiques", quantity: 1, unitPrice: 350000, taxRate: 19.25 },
  ]);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const selectedMatter = availableMatters.find((m) => m.id === selectedMatterId);

  const addLine = () => {
    setInvoiceLines([
      ...invoiceLines,
      { description: "", quantity: 1, unitPrice: 0, taxRate: 19.25 },
    ]);
  };

  const removeLine = (idx: number) => {
    if (invoiceLines.length > 1) {
      setInvoiceLines(invoiceLines.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...invoiceLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setInvoiceLines(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId || !selectedMatter?.clientPartyId) {
      setInvoiceError("Veuillez sélectionner un dossier avec un client associé.");
      return;
    }
    setInvoiceError(null);
    startTransition(async () => {
      const res = await createInvoiceAction({
        matterId: selectedMatterId,
        partyId: selectedMatter.clientPartyId,
        notes: invoiceNotes,
        dueAt: new Date(Date.now() + invoiceDueDays * 24 * 3600 * 1000),
        lines: invoiceLines,
      });

      if (!res.success) {
        setInvoiceError(res.error || "Erreur de création de la facture");
      } else {
        setIsCreateInvoiceOpen(false);
        router.refresh();
      }
    });
  };

  // --- Record Payment Drawer State ---
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [targetInvoiceId, setTargetInvoiceId] = useState(invoices[0]?.id || "");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const openRecordPaymentFor = (inv: SerializedInvoiceItem) => {
    setTargetInvoiceId(inv.id);
    setPaymentAmount(inv.remainingAmount > 0 ? inv.remainingAmount : inv.total);
    setIsRecordPaymentOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoiceId || paymentAmount <= 0) {
      setPaymentError("Montant invalide.");
      return;
    }
    setPaymentError(null);
    startTransition(async () => {
      const res = await recordPaymentAction({
        invoiceId: targetInvoiceId,
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentRef || null,
      });

      if (!res.success) {
        setPaymentError(res.error || "Erreur lors de l'enregistrement du règlement");
      } else {
        setIsRecordPaymentOpen(false);
        setPaymentRef("");
        router.refresh();
      }
    });
  };

  // --- Quick Actions ---
  const handleValidateInvoice = async (invId: string) => {
    startTransition(async () => {
      const res = await validateInvoiceAction(invId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  };

  const handleValidatePayment = async (paymentId: string) => {
    startTransition(async () => {
      const res = await validatePaymentAction(paymentId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  };

  const handleRejectPayment = async (paymentId: string) => {
    const reason = prompt("Motif du rejet du règlement :");
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      const res = await rejectPaymentAction(paymentId, reason);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  };

  // --- Record CARPA Entry State ---
  const [isCarpaOpen, setIsCarpaOpen] = useState(false);
  const [carpaMatterId, setCarpaMatterId] = useState(availableMatters[0]?.id || "");
  const [carpaType, setCarpaType] = useState<FundEntryType>(FundEntryType.DEPOSIT);
  const [carpaAmount, setCarpaAmount] = useState<number>(500000);
  const [carpaRef, setCarpaRef] = useState("");
  const [carpaError, setCarpaError] = useState<string | null>(null);

  const selectedCarpaMatter = availableMatters.find((m) => m.id === carpaMatterId);

  const handleRecordCarpa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carpaMatterId || !selectedCarpaMatter?.clientPartyId || carpaAmount <= 0) {
      setCarpaError("Champs obligatoires manquants ou invalides.");
      return;
    }
    setCarpaError(null);
    startTransition(async () => {
      const res = await recordClientFundEntryAction({
        matterId: carpaMatterId,
        partyId: selectedCarpaMatter.clientPartyId,
        type: carpaType,
        amount: carpaAmount,
        reference: carpaRef,
      });

      if (!res.success) {
        setCarpaError(res.error || "Erreur d'enregistrement CARPA");
      } else {
        setIsCarpaOpen(false);
        setCarpaRef("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title={locale === "fr" ? "Facturation & Maniement de Fonds" : "Billing & Trust Accounting"}
          description={
            locale === "fr"
              ? "Gestion des honoraires, facturation conforme OHADA, encaissements échelonnés et compte séquestre CARPA."
              : "Fee management, compliant invoicing, installment payments, and CARPA escrow account."
          }
        />

        <div className="flex items-center gap-2">
          {isAccountantOrPartner && (
            <Button
              size="sm"
              onClick={() => setIsCreateInvoiceOpen(true)}
              className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "fr" ? "Émettre une facture" : "New Invoice"}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="gap-1.5 text-xs"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {locale === "fr" ? "Enregistrer règlement" : "Record Payment"}
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Total Facturé" : "Invoiced Fees"}
            </span>
            <div className="p-2 rounded-lg bg-navy/5 text-primary">
              <Banknote className="h-4 w-4 text-gold" />
            </div>
          </div>
          <div className="font-serif font-bold text-xl text-foreground">
            {formatMoney(totalInvoiced)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {invoices.length} {locale === "fr" ? "facture(s) émise(s)" : "invoice(s)"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Encaissements Validés" : "Collections"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif font-bold text-xl text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalCollected)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            {totalInvoiced > 0
              ? `${Math.round((totalCollected / totalInvoiced) * 100)}% encaissé`
              : "0%"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Reste à Recouvrer" : "Receivables"}
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif font-bold text-xl text-amber-600 dark:text-amber-400">
            {formatMoney(totalReceivables)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            {locale === "fr" ? "Créances clients en cours" : "Outstanding balance"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Solde Séquestre CARPA" : "CARPA Escrow Balance"}
            </span>
            <div className="p-2 rounded-lg bg-navy/5 text-primary">
              <Scale className="h-4 w-4 text-gold" />
            </div>
          </div>
          <div className="font-serif font-bold text-xl text-primary">
            {formatMoney(carpaBalance)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-primary" />
            {locale === "fr" ? "Fonds tiers sous séquestre" : "Client funds in trust"}
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "invoices"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            {locale === "fr" ? "Factures & Notes d'Honoraires" : "Invoices"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {invoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "payments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {locale === "fr" ? "File des Règlements" : "Payments Queue"}
            {pendingPayments.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">
                {pendingPayments.length} à viser
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("agreements")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "agreements"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {locale === "fr" ? "Conventions d'Honoraires" : "Fee Agreements"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {feeAgreements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("funds")}
            className={`border-b-2 py-3 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "funds"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            {locale === "fr" ? "Maniement de Fonds CARPA" : "CARPA Trust Ledger"}
            <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {fundEntries.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Invoices Table with Rule BR-10 Computed Financial Status */}
      {activeTab === "invoices" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">{locale === "fr" ? "Numéro" : "Number"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Client" : "Client"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Total TTC" : "Total"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Encaissé" : "Paid"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Reste Dû" : "Remaining"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Statut Financier (BR-10)" : "Status"}</th>
                  <th className="py-3 px-4 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => {
                  const statusBadges: Record<string, { label: string; className: string }> = {
                    DRAFT: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
                    PENDING_VALIDATION: { label: "À valider", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
                    UNPAID: { label: "Émise / Non payée", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
                    PARTIALLY_PAID: { label: "Partielle", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 font-semibold" },
                    PARTIALLY_PAID_OVERDUE: { label: "Partielle & Échue", className: "bg-orange-500/10 text-orange-700 border-orange-500/30 font-bold" },
                    PAID: { label: "Soldée ✓", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold" },
                    OVERDUE: { label: "En retard ⚠️", className: "bg-rose-500/10 text-rose-700 border-rose-500/30 font-bold" },
                    CANCELLED: { label: "Annulée", className: "bg-muted text-muted-foreground line-through" },
                  };

                  const badge = statusBadges[inv.financialStatus] || { label: inv.financialStatus, className: "" };

                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {inv.number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {inv.clientName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-primary font-medium">{inv.matterReference}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{inv.matterTitle}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {formatMoney(inv.total, inv.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">
                        {formatMoney(inv.paidAmount, inv.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {inv.remainingAmount > 0 ? (
                          <span className={inv.isOverdue ? "text-rose-600 font-bold" : "text-amber-600"}>
                            {formatMoney(inv.remainingAmount, inv.currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0 XAF</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.workflowKey === "TO_VALIDATE" && isAccountantOrPartner && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleValidateInvoice(inv.id)}
                              disabled={isPending}
                              className="h-7 text-[11px] border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {locale === "fr" ? "Valider" : "Validate"}
                            </Button>
                          )}

                          {inv.financialStatus !== "PAID" && inv.financialStatus !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRecordPaymentFor(inv)}
                              className="h-7 text-[11px] border-primary/30 text-primary hover:bg-primary/5"
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              {locale === "fr" ? "Régler" : "Pay"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      {locale === "fr"
                        ? "Aucune facture enregistrée."
                        : "No invoices recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payments Validation Queue */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {locale === "fr" ? "File des Règlements en Attente de Visa Comptable" : "Payments Validation Queue"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === "fr"
                  ? "Conformément à la règle BR-10, un règlement ne crédite la facture qu'après validation formelle du comptable ou de l'associé."
                  : "Payments only affect invoice status once formally validated (Rule BR-10)."}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">{locale === "fr" ? "Date" : "Date"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Facture / Client" : "Invoice & Client"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Mode" : "Method"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Référence" : "Reference"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Montant" : "Amount"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Saisi par" : "Recorded By"}</th>
                    <th className="py-3 px-4 text-right">{locale === "fr" ? "Visa" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pendingPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-primary">{p.invoiceNumber}</div>
                        <div className="text-[11px] text-muted-foreground">{p.clientName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {p.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {p.reference || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        {formatMoney(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {p.recordedByName}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAccountantOrPartner ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleValidatePayment(p.id)}
                              disabled={isPending}
                              className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {locale === "fr" ? "Valider" : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectPayment(p.id)}
                              disabled={isPending}
                              className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 border-rose-200"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50">
                            En attente visa
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}

                  {pendingPayments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        {locale === "fr"
                          ? "Aucun règlement en attente de visa comptable. File à jour !"
                          : "No pending payments in the queue."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Fee Agreements */}
      {activeTab === "agreements" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">{locale === "fr" ? "Titre / Objet" : "Title"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Client" : "Client"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Type" : "Type"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Montant Prévu" : "Agreed Amount"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Statut" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {feeAgreements.map((fa) => (
                  <tr key={fa.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {fa.title}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {fa.clientName}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-primary">
                      {fa.matterReference}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">
                        {fa.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {fa.amount ? formatMoney(fa.amount, fa.currency) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {fa.signedAt ? (
                        <Badge className="bg-emerald-600 text-white text-[10px]">
                          {locale === "fr" ? "Signée" : "Signed"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {fa.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}

                {feeAgreements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      {locale === "fr"
                        ? "Aucune convention d'honoraires enregistrée."
                        : "No fee agreements recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: CARPA Trust Funds */}
      {activeTab === "funds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {locale === "fr" ? "Grand Livre Séquestre & Maniement de Fonds Tiers (CARPA)" : "CARPA Trust Account Ledger"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === "fr"
                  ? "Suivi rigoureux des consignations, provisions et rétrocessions conformément aux règles de l'Ordre."
                  : "OHADA / Bar trust account ledger tracking."}
              </p>
            </div>

            {isAccountantOrPartner && (
              <Button
                size="sm"
                onClick={() => setIsCarpaOpen(true)}
                className="gap-1.5 text-xs border border-primary/30"
              >
                <Plus className="h-3.5 w-3.5" />
                {locale === "fr" ? "Nouveau mouvement CARPA" : "New CARPA Entry"}
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">{locale === "fr" ? "Date" : "Date"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Réf CARPA" : "CARPA Ref"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Opération" : "Operation"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Client / Tiers" : "Party"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Montant" : "Amount"}</th>
                    <th className="py-3 px-4">{locale === "fr" ? "Contrôle" : "Verification"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {fundEntries.map((fe) => (
                    <tr key={fe.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {new Date(fe.occurredAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {fe.reference}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            fe.type === "DEPOSIT"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : "bg-blue-500/10 text-blue-700 border-blue-500/30"
                          }`}
                        >
                          {fe.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {fe.clientName}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-primary">
                        {fe.matterReference}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {formatMoney(fe.amount, fe.currency)}
                      </td>
                      <td className="py-3 px-4">
                        {fe.isValidated ? (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            {locale === "fr" ? "Audité & Validé" : "Validated"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                            {locale === "fr" ? "En attente visa" : "Pending"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}

                  {fundEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        {locale === "fr"
                          ? "Aucun mouvement de fonds séquestre CARPA enregistré."
                          : "No CARPA trust account movements recorded."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SidePanel: Create Invoice --- */}
      <SidePanel
        open={isCreateInvoiceOpen}
        onOpenChange={setIsCreateInvoiceOpen}
        title={locale === "fr" ? "Émettre une facture / note d'honoraires" : "New Invoice"}
        subtitle={locale === "fr" ? "Calcul automatique des taxes et montants TTC" : "Automatic tax and total computation"}
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {invoiceError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {invoiceError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invMatterSelect">{locale === "fr" ? "Dossier rattaché *" : "Matter *"}</Label>
            <select
              id="invMatterSelect"
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              required
            >
              {availableMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} - {m.title} ({m.clientName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invDueDays">{locale === "fr" ? "Délai de règlement (jours)" : "Due in (days)"}</Label>
            <Input
              id="invDueDays"
              type="number"
              min={1}
              max={180}
              value={invoiceDueDays}
              onChange={(e) => setInvoiceDueDays(Number(e.target.value))}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {locale === "fr" ? "Lignes de facturation & débours" : "Line Items"}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                {locale === "fr" ? "Ajouter ligne" : "Add line"}
              </Button>
            </div>

            {invoiceLines.map((line, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    placeholder="Description de la diligence / débours"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    required
                    className="text-xs"
                  />
                  {invoiceLines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLine(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Quantité</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Prix Unitaire (XAF)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, "unitPrice", Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Taux TVA (%)</Label>
                    <select
                      value={line.taxRate}
                      onChange={(e) => updateLine(idx, "taxRate", Number(e.target.value))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                    >
                      <option value={19.25}>19.25% (TVA normale)</option>
                      <option value={0}>0% (Exonéré / Débours)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-2">
            <Label htmlFor="invNotes">{locale === "fr" ? "Notes / Modalités de paiement" : "Notes"}</Label>
            <textarea
              id="invNotes"
              rows={3}
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="ex: Règlement par virement bancaire sur le compte BGFI Bank..."
              className="w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateInvoiceOpen(false)}>
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Créer la facture" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* --- SidePanel: Record Payment --- */}
      <SidePanel
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
        title={locale === "fr" ? "Enregistrer un règlement client" : "Record Payment"}
        subtitle={locale === "fr" ? "Règlement partiel ou total (Règle BR-11)" : "Partial or full payment (BR-11)"}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {paymentError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payInvSelect">{locale === "fr" ? "Facture concernée *" : "Invoice *"}</Label>
            <select
              id="payInvSelect"
              value={targetInvoiceId}
              onChange={(e) => {
                setTargetInvoiceId(e.target.value);
                const inv = invoices.find((i) => i.id === e.target.value);
                if (inv) setPaymentAmount(inv.remainingAmount > 0 ? inv.remainingAmount : inv.total);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              required
            >
              {invoices
                .filter((i) => i.financialStatus !== "PAID" && i.financialStatus !== "CANCELLED")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} - {i.clientName} (Reste: {formatMoney(i.remainingAmount, i.currency)})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payAmount">{locale === "fr" ? "Montant réglé (XAF) *" : "Amount *"}</Label>
            <Input
              id="payAmount"
              type="number"
              min={1}
              step={100}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              required
              className="font-mono text-base font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payMethod">{locale === "fr" ? "Mode de paiement *" : "Payment Method *"}</Label>
            <select
              id="payMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="BANK_TRANSFER">Virement Bancaire</option>
              <option value="CHEQUE">Chèque</option>
              <option value="CASH">Espèces (Reçu de caisse)</option>
              <option value="MOBILE_MONEY">Mobile Money (Orange / MTN)</option>
              <option value="CARD">Carte Bancaire</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payRef">{locale === "fr" ? "Numéro de chèque / Référence virement" : "Reference"}</Label>
            <Input
              id="payRef"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="ex: VIR-2026-BGFI-892"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Enregistrer le règlement" : "Save Payment"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* --- SidePanel: Record CARPA Movement --- */}
      <SidePanel
        open={isCarpaOpen}
        onOpenChange={setIsCarpaOpen}
        title={locale === "fr" ? "Nouveau mouvement séquestre CARPA" : "New CARPA Entry"}
        subtitle={locale === "fr" ? "Maniement des fonds tiers (FIN-06)" : "Trust accounting"}
      >
        <form onSubmit={handleRecordCarpa} className="space-y-4">
          {carpaError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {carpaError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="carpaMatterSelect">{locale === "fr" ? "Dossier rattaché *" : "Matter *"}</Label>
            <select
              id="carpaMatterSelect"
              value={carpaMatterId}
              onChange={(e) => setCarpaMatterId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              required
            >
              {availableMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} - {m.title} ({m.clientName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carpaTypeSelect">{locale === "fr" ? "Nature de l'opération *" : "Operation Type *"}</Label>
            <select
              id="carpaTypeSelect"
              value={carpaType}
              onChange={(e) => setCarpaType(e.target.value as FundEntryType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="DEPOSIT">Versement / Dépôt sous séquestre CARPA (+ Inflow)</option>
              <option value="WITHDRAWAL">Rétrocession / Retrait client (- Outflow)</option>
              <option value="TRANSFER_TO_INVOICE">Prélèvement d'honoraires vers facture (- Outflow)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carpaAmountInput">{locale === "fr" ? "Montant (XAF) *" : "Amount *"}</Label>
            <Input
              id="carpaAmountInput"
              type="number"
              min={1}
              step={1000}
              value={carpaAmount}
              onChange={(e) => setCarpaAmount(Number(e.target.value))}
              required
              className="font-mono text-base font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carpaRefInput">{locale === "fr" ? "Référence pièce CARPA / Ordre" : "Reference"}</Label>
            <Input
              id="carpaRefInput"
              value={carpaRef}
              onChange={(e) => setCarpaRef(e.target.value)}
              placeholder="ex: CARPA-ORDRE-2026-042"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCarpaOpen(false)}>
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {locale === "fr" ? "Consigner le mouvement" : "Save Entry"}
            </Button>
          </div>
        </form>
      </SidePanel>
    </div>
  );
}
