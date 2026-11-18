import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
import { computeInvoiceFinancialStatus } from "@/server/services/invoice-service";
import { listPendingPayments } from "@/server/services/payment-service";
import { FinanceClient } from "./finance-client";

export default async function FinancePage({
  params,
}: {
  params: { locale: string } | Promise<{ locale: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const locale = (resolvedParams?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const session = await getServerSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const matterFilter = accessibleMatterFilter(session);

  const [invoices, feeAgreements, fundEntries, pendingPayments, activeMatters] = await Promise.all([
    db.invoice.findMany({
      where: {
        matter: matterFilter,
      },
      include: {
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
        workflowStep: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.feeAgreement.findMany({
      where: {
        matter: matterFilter,
      },
      include: {
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.clientFundEntry.findMany({
      where: {
        matter: matterFilter,
      },
      include: {
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    listPendingPayments(session).catch(() => []),
    db.matter.findMany({
      where: {
        ...matterFilter,
        deletedAt: null,
        status: { in: ["OPEN", "ON_HOLD"] },
      },
      select: {
        id: true,
        reference: true,
        title: true,
        parties: {
          where: { role: "CLIENT" },
          select: {
            partyId: true,
            party: { select: { id: true, displayName: true } },
          },
        },
      },
      orderBy: { reference: "desc" },
      take: 100,
    }),
  ]);

  const serializedInvoices = invoices.map((inv) => {
    const computed = computeInvoiceFinancialStatus(inv, inv.payments);
    return {
      id: inv.id,
      number: inv.number,
      matterId: inv.matterId,
      matterReference: inv.matter.reference,
      matterTitle: inv.matter.title,
      clientId: inv.partyId,
      clientName: inv.party.displayName,
      subtotal: Number(inv.subtotal),
      taxTotal: Number(inv.taxTotal),
      total: Number(inv.total),
      currency: inv.currency,
      issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
      dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
      validatedAt: inv.validatedAt ? inv.validatedAt.toISOString() : null,
      workflowKey: inv.workflowStep?.key || "DRAFT",
      financialStatus: computed.financialStatus,
      paidAmount: computed.paidAmount,
      remainingAmount: computed.remainingAmount,
      isOverdue: computed.isOverdue,
    };
  });

  const serializedAgreements = feeAgreements.map((fa) => ({
    id: fa.id,
    matterId: fa.matterId,
    title: fa.title,
    type: fa.type,
    amount: fa.amount ? Number(fa.amount) : null,
    currency: fa.currency,
    status: fa.status,
    matterReference: fa.matter.reference,
    matterTitle: fa.matter.title,
    clientName: fa.party.displayName,
    signedAt: fa.signedAt ? fa.signedAt.toISOString() : null,
  }));

  const serializedFunds = fundEntries.map((fe) => ({
    id: fe.id,
    matterId: fe.matterId,
    type: fe.type,
    amount: Number(fe.amount),
    currency: fe.currency,
    occurredAt: fe.occurredAt.toISOString(),
    reference: fe.reference || "CARPA-REF",
    matterReference: fe.matter.reference,
    clientName: fe.party.displayName,
    recordedByName: fe.recordedBy.name,
    isValidated: !!fe.validatedAt,
  }));

  const serializedPendingPayments = pendingPayments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    paidAt: p.paidAt.toISOString(),
    reference: p.reference,
    invoiceId: p.invoice.id,
    invoiceNumber: p.invoice.number,
    invoiceTotal: Number(p.invoice.total),
    matterReference: p.invoice.matter.reference,
    clientName: p.invoice.party.displayName,
    recordedByName: p.recordedBy.name,
  }));

  const availableMatters = activeMatters.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    clientPartyId: m.parties[0]?.partyId || "",
    clientName: m.parties[0]?.party.displayName || "Sans client",
  }));

  return (
    <FinanceClient
      invoices={serializedInvoices}
      feeAgreements={serializedAgreements}
      fundEntries={serializedFunds}
      pendingPayments={serializedPendingPayments}
      availableMatters={availableMatters}
      locale={locale}
      currentUserRole={session.user.roleKey}
    />
  );
}
