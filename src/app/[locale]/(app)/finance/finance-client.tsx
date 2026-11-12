"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

export interface SerializedInvoiceItem {
  id: string;
  number: string;
  matterReference: string;
  matterTitle: string;
  clientName: string;
  total: number;
  currency: string;
  issuedAt: string | null;
  validatedAt: string | null;
  totalPaid: number;
  status: string;
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

interface FinanceClientProps {
  invoices: SerializedInvoiceItem[];
  feeAgreements: SerializedAgreementItem[];
  fundEntries: SerializedFundItem[];
  locale: "fr" | "en";
  currentUserRole: string;
}

export function FinanceClient({
  invoices,
  feeAgreements,
  fundEntries,
  locale,
  currentUserRole,
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "agreements" | "funds">("invoices");

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = invoices.reduce((sum, i) => sum + i.totalPaid, 0);
  const totalReceivables = Math.max(0, totalInvoiced - totalCollected);

  const totalCarpaIn = fundEntries
    .filter((f) => f.type === "DEPOSIT" || f.type === "SETTLEMENT_IN")
    .reduce((sum, f) => sum + f.amount, 0);
  const totalCarpaOut = fundEntries
    .filter((f) => f.type === "DISBURSEMENT" || f.type === "SETTLEMENT_OUT" || f.type === "FEE_WITHDRAWAL")
    .reduce((sum, f) => sum + f.amount, 0);
  const carpaBalance = totalCarpaIn - totalCarpaOut;

  const formatMoney = (amount: number, curr = "XAF") => {
    return `${amount.toLocaleString("fr-FR")} ${curr}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Facturation & Maniement de Fonds" : "Billing & Trust Accounting"}
        description={
          locale === "fr"
            ? "Gestion financière du cabinet conforme OHADA, convention d'honoraires obligatoire et séquestre CARPA (Loi n° 2024/017)."
            : "Law practice financial tracking compliant with OHADA, mandatory fee agreements, and CARPA trust accounts."
        }
      />

      {/* Financial Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Honoraires Facturés" : "Invoiced Fees"}
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-serif text-foreground">
            {formatMoney(totalInvoiced)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {invoices.length} {locale === "fr" ? "facture(s) émises" : "invoices issued"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Recouvré / Encaissé" : "Total Collected"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-serif text-emerald-700 dark:text-emerald-400">
            {formatMoney(totalCollected)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {totalInvoiced > 0
              ? `${Math.round((totalCollected / totalInvoiced) * 100)}% de taux de recouvrement`
              : "0% taux de recouvrement"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Créances à Recouvrer" : "Outstanding Receivables"}
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-serif text-amber-700 dark:text-amber-400">
            {formatMoney(totalReceivables)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {locale === "fr" ? "Rappels automatiques actifs" : "Active automated reminders"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {locale === "fr" ? "Séquestre CARPA (Fonds Clients)" : "CARPA Trust Ledger"}
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-serif text-purple-900 dark:text-purple-300">
            {formatMoney(carpaBalance)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-gold" />
            {locale === "fr" ? "Compte séquestre dédié" : "Dedicated escrow account"}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "invoices"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {locale === "fr" ? "Factures & Règlements" : "Invoices & Payments"} ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("agreements")}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "agreements"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {locale === "fr" ? "Conventions d'Honoraires" : "Fee Agreements"} ({feeAgreements.length})
        </button>
        <button
          onClick={() => setActiveTab("funds")}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "funds"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {locale === "fr" ? "Registre Séquestre CARPA" : "CARPA Trust Account"} ({fundEntries.length})
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === "invoices" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">{locale === "fr" ? "N° Facture" : "Invoice #"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Client" : "Client"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Montant Total" : "Total Amount"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Encaissé" : "Paid"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Statut" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {inv.number}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {inv.clientName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-primary font-semibold">
                        {inv.matterReference}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {formatMoney(inv.total, inv.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700 dark:text-emerald-400">
                      {formatMoney(inv.totalPaid, inv.currency)}
                    </td>
                    <td className="py-3 px-4">
                      {inv.totalPaid >= inv.total && inv.total > 0 ? (
                        <Badge className="bg-emerald-600 text-white text-[10px]">
                          {locale === "fr" ? "Soldée" : "Paid"}
                        </Badge>
                      ) : inv.totalPaid > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                          {locale === "fr" ? "Acompte payé" : "Partially paid"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {locale === "fr" ? "En attente" : "Pending"}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}

                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      {locale === "fr"
                        ? "Aucune facture émise pour le moment."
                        : "No invoices issued yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Fee Agreements */}
      {activeTab === "agreements" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">{locale === "fr" ? "Intitulé convention" : "Agreement Title"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Client" : "Client"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Dossier" : "Matter"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Type" : "Type"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Montant prévu" : "Agreed Amount"}</th>
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

      {/* Tab 3: CARPA Trust Funds */}
      {activeTab === "funds" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">{locale === "fr" ? "Date" : "Date"}</th>
                  <th className="py-3 px-4">{locale === "fr" ? "Référence CARPA" : "CARPA Ref"}</th>
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
                      {new Date(fe.occurredAt).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {fe.reference}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {fe.type}
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
      )}
    </div>
  );
}

