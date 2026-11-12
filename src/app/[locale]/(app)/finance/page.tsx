import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { accessibleMatterFilter } from "@/server/auth/matter-access";
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

  const [invoices, feeAgreements, fundEntries] = await Promise.all([
    db.invoice.findMany({
      where: {
        matter: matterFilter,
      },
      include: {
        party: { select: { id: true, displayName: true } },
        matter: { select: { id: true, reference: true, title: true } },
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
  ]);

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    matterReference: inv.matter.reference,
    matterTitle: inv.matter.title,
    clientName: inv.party.displayName,
    total: Number(inv.total),
    currency: inv.currency,
    issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
    validatedAt: inv.validatedAt ? inv.validatedAt.toISOString() : null,
    totalPaid: inv.payments
      .filter((p) => p.status === "VALIDATED")
      .reduce((sum, p) => sum + Number(p.amount), 0),
    status: inv.workflowStepId ? "EMISE" : "BROUILLON",
  }));

  const serializedAgreements = feeAgreements.map((fa) => ({
    id: fa.id,
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

  return (
    <FinanceClient
      invoices={serializedInvoices}
      feeAgreements={serializedAgreements}
      fundEntries={serializedFunds}
      locale={locale}
      currentUserRole={session.user.roleKey}
    />
  );
}

