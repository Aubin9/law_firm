import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import {
  generateNextInvoiceNumber,
  computeInvoiceFinancialStatus,
  createInvoice,
  validateInvoice,
  cancelInvoice,
} from "@/server/services/invoice-service";
import {
  recordPayment,
  validatePayment,
  rejectPayment,
} from "@/server/services/payment-service";
import {
  recordClientFundEntry,
  getClientFundLedger,
} from "@/server/services/carpa-service";
import { Prisma } from "@prisma/client";

describe("Finance & Invoicing (V2.1: FIN-01 to FIN-09, BR-10, BR-11)", () => {
  let partnerSession: AppSession;
  let accountantSession: AppSession;
  let secretarySession: AppSession;

  let testPartyId: string;
  let testMatterId: string;

  beforeAll(async () => {
    // 1. Fetch seed users
    const [partnerUser, accountantUser, secretaryUser] = await Promise.all([
      db.user.findFirst({
        where: { role: { key: "PARTNER" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "ACCOUNTANT" }, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { role: { key: "SECRETARY" }, status: "ACTIVE" },
      }),
    ]);

    if (!partnerUser || !accountantUser || !secretaryUser) {
      throw new Error("Missing seed users for finance tests");
    }

    partnerSession = {
      user: {
        id: partnerUser.id,
        name: partnerUser.name,
        email: partnerUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: partnerUser.roleId,
        roleKey: "PARTNER",
      },
      session: {
        id: "sess_fin_partner",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_fin_partner",
      },
    };

    accountantSession = {
      user: {
        id: accountantUser.id,
        name: accountantUser.name,
        email: accountantUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: accountantUser.roleId,
        roleKey: "ACCOUNTANT",
      },
      session: {
        id: "sess_fin_acct",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_fin_acct",
      },
    };

    secretarySession = {
      user: {
        id: secretaryUser.id,
        name: secretaryUser.name,
        email: secretaryUser.email,
        locale: "FR",
        status: "ACTIVE",
        roleId: secretaryUser.roleId,
        roleKey: "SECRETARY",
      },
      session: {
        id: "sess_fin_secr",
        expiresAt: new Date(Date.now() + 3600000),
        token: "tok_fin_secr",
      },
    };

    // 2. Create test party & matter
    const category = await db.matterCategory.findFirst();
    if (!category) throw new Error("No category found");

    const party = await db.party.create({
      data: {
        displayName: "Société Commerciale Test Finance S.A.",
        type: "COMPANY",
        clientStatus: "CLIENT",
      },
    });
    testPartyId = party.id;

    const matter = await db.matter.create({
      data: {
        reference: `MAT-FIN-${Date.now()}`,
        title: "Dossier Facturation & Trésorerie Test",
        categoryId: category.id,
        leadLawyerId: partnerUser.id,
        createdById: partnerUser.id,
        confidentiality: "STANDARD",
        status: "OPEN",
        parties: {
          create: {
            partyId: party.id,
            role: "CLIENT",
          },
        },
        members: {
          create: {
            userId: partnerUser.id,
            level: "MANAGE",
          },
        },
      },
    });
    testMatterId = matter.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.payment.deleteMany({
      where: { invoice: { matterId: testMatterId } },
    });
    await db.clientFundEntry.deleteMany({
      where: { matterId: testMatterId },
    });
    await db.invoiceLine.deleteMany({
      where: { invoice: { matterId: testMatterId } },
    });
    await db.invoice.deleteMany({
      where: { matterId: testMatterId },
    });
    await db.matterMember.deleteMany({
      where: { matterId: testMatterId },
    });
    await db.matterParty.deleteMany({
      where: { matterId: testMatterId },
    });
    await db.matter.deleteMany({
      where: { id: testMatterId },
    });
    await db.party.deleteMany({
      where: { id: testPartyId },
    });
  });

  describe("1. Sequential Reference Numbering & Pure Computation (BR-10)", () => {
    it("generates sequential thread-safe invoice references matching FAC-YYYY-XXXX", async () => {
      const currentYear = new Date().getFullYear();
      const num1 = await generateNextInvoiceNumber();
      const num2 = await generateNextInvoiceNumber();

      expect(num1).toMatch(new RegExp(`^FAC-${currentYear}-\\d{4}$`));
      expect(num2).toMatch(new RegExp(`^FAC-${currentYear}-\\d{4}$`));

      const seq1 = parseInt(num1.split("-")[2], 10);
      const seq2 = parseInt(num2.split("-")[2], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it("Rule BR-10: pure function computeInvoiceFinancialStatus computes statuses strictly without manual storage", () => {
      const total = 500000;
      const futureDue = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const pastDue = new Date(Date.now() - 7 * 24 * 3600 * 1000);

      // 1. DRAFT step
      const draft = computeInvoiceFinancialStatus({ total, workflowStep: { key: "DRAFT" } }, []);
      expect(draft.financialStatus).toBe("DRAFT");
      expect(draft.paidAmount).toBe(0);
      expect(draft.remainingAmount).toBe(total);

      // 2. ISSUED but UNPAID (not overdue)
      const unpaid = computeInvoiceFinancialStatus(
        { total, dueAt: futureDue, workflowStep: { key: "ISSUED" } },
        []
      );
      expect(unpaid.financialStatus).toBe("UNPAID");
      expect(unpaid.isOverdue).toBe(false);

      // 3. ISSUED and OVERDUE (no payments, past due)
      const overdue = computeInvoiceFinancialStatus(
        { total, dueAt: pastDue, workflowStep: { key: "ISSUED" } },
        []
      );
      expect(overdue.financialStatus).toBe("OVERDUE");
      expect(overdue.isOverdue).toBe(true);

      // 4. PARTIALLY_PAID (validated partial payment)
      const partial = computeInvoiceFinancialStatus(
        { total, dueAt: futureDue, workflowStep: { key: "ISSUED" } },
        [
          { amount: new Prisma.Decimal(200000), status: "VALIDATED" },
          { amount: new Prisma.Decimal(100000), status: "PENDING" }, // Ignored because pending!
        ]
      );
      expect(partial.financialStatus).toBe("PARTIALLY_PAID");
      expect(partial.paidAmount).toBe(200000);
      expect(partial.remainingAmount).toBe(300000);

      // 5. PARTIALLY_PAID_OVERDUE (partial payment, past due)
      const partialOverdue = computeInvoiceFinancialStatus(
        { total, dueAt: pastDue, workflowStep: { key: "ISSUED" } },
        [{ amount: new Prisma.Decimal(200000), status: "VALIDATED" }]
      );
      expect(partialOverdue.financialStatus).toBe("PARTIALLY_PAID_OVERDUE");

      // 6. PAID (full payment)
      const paid = computeInvoiceFinancialStatus(
        { total, dueAt: pastDue, workflowStep: { key: "ISSUED" } },
        [
          { amount: new Prisma.Decimal(200000), status: "VALIDATED" },
          { amount: new Prisma.Decimal(300000), status: "VALIDATED" },
        ]
      );
      expect(paid.financialStatus).toBe("PAID");
      expect(paid.paidAmount).toBe(total);
      expect(paid.remainingAmount).toBe(0);

      // 7. CANCELLED
      const cancelled = computeInvoiceFinancialStatus(
        { total, workflowStep: { key: "CANCELLED" } },
        []
      );
      expect(cancelled.financialStatus).toBe("CANCELLED");
    });
  });

  describe("2. End-to-End Invoice Lifecycle, Multi-Payment & Validation Queue (BR-11, FIN-02, FIN-03)", () => {
    let createdInvoiceId: string;

    it("creates an invoice with lines, calculating totals and taxes in DRAFT", async () => {
      const invoice = await createInvoice(
        {
          matterId: testMatterId,
          partyId: testPartyId,
          lines: [
            {
              description: "Rédaction des conclusions au fond",
              quantity: 1,
              unitPrice: 500000,
              taxRate: 19.25, // 19.25% TVA
            },
            {
              description: "Débours - Enregistrement et signification d'huissier",
              quantity: 1,
              unitPrice: 100000,
              taxRate: 0,
            },
          ],
        },
        accountantSession
      );

      createdInvoiceId = invoice.id;
      expect(invoice.number).toMatch(/^FAC-\d{4}-\d{4}$/);
      // Subtotal = 500k + 100k = 600k
      expect(Number(invoice.subtotal)).toBe(600000);
      // Tax = 500k * 19.25% = 96,250
      expect(Number(invoice.taxTotal)).toBe(96250);
      // Total = 696,250
      expect(Number(invoice.total)).toBe(696250);
      expect(invoice.financialStatus).toBe("DRAFT");
    });

    it("transitions invoice to ISSUED via validateInvoice", async () => {
      const issued = await validateInvoice(createdInvoiceId, accountantSession);
      expect(issued.workflowStep?.key).toBe("ISSUED");
      expect(issued.validatedById).toBe(accountantSession.user.id);
      expect(issued.financialStatus).toBe("UNPAID");
      expect(issued.remainingAmount).toBe(696250);
    });

    it("Rule BR-11: allows multiple partial payments, keeping invoice status PENDING until validated", async () => {
      // Secretary records 1st installment of 300,000 XAF
      const p1 = await recordPayment(
        {
          invoiceId: createdInvoiceId,
          amount: 300000,
          method: "BANK_TRANSFER",
          reference: "VIR-BGFI-001",
        },
        secretarySession
      );

      expect(p1.status).toBe("PENDING");

      // While PENDING, invoice computed status is STILL UNPAID (Rule BR-10: only validated payments count)
      const invAfterP1 = await db.invoice.findUnique({
        where: { id: createdInvoiceId },
        include: { workflowStep: true, payments: true },
      });
      const comp1 = computeInvoiceFinancialStatus(invAfterP1!, invAfterP1!.payments);
      expect(comp1.financialStatus).toBe("UNPAID");
      expect(comp1.paidAmount).toBe(0);

      // Accountant validates 1st payment
      const valRes1 = await validatePayment(p1.id, accountantSession);
      expect(valRes1.payment.status).toBe("VALIDATED");
      expect(valRes1.invoiceComputedStatus.financialStatus).toBe("PARTIALLY_PAID");
      expect(valRes1.invoiceComputedStatus.paidAmount).toBe(300000);
      expect(valRes1.invoiceComputedStatus.remainingAmount).toBe(396250);

      // Secretary records 2nd installment of 396,250 XAF (Cash)
      const p2 = await recordPayment(
        {
          invoiceId: createdInvoiceId,
          amount: 396250,
          method: "CASH",
          reference: "REC-CAISSE-088",
        },
        secretarySession
      );

      // Accountant validates 2nd payment -> Invoice reaches PAID
      const valRes2 = await validatePayment(p2.id, accountantSession);
      expect(valRes2.payment.status).toBe("VALIDATED");
      expect(valRes2.invoiceComputedStatus.financialStatus).toBe("PAID");
      expect(valRes2.invoiceComputedStatus.paidAmount).toBe(696250);
      expect(valRes2.invoiceComputedStatus.remainingAmount).toBe(0);
    });

    it("blocks cancellation of an invoice with validated payments", async () => {
      await expect(
        cancelInvoice(createdInvoiceId, "Tentative d'annulation frauduleuse", partnerSession)
      ).rejects.toThrow(/Impossible d'annuler une facture comportant des règlements validés/);
    });
  });

  describe("3. CARPA Client Funds Escrow Ledger (FIN-06, BR-14)", () => {
    it("records deposits, withdrawals, and computes net escrow balance", async () => {
      // 1. Client deposits 1,000,000 XAF into CARPA escrow
      await recordClientFundEntry(
        {
          matterId: testMatterId,
          partyId: testPartyId,
          type: "DEPOSIT",
          amount: 1000000,
          reference: "CHQ-CARPA-2026-99",
        },
        accountantSession
      );

      // 2. Withdrawal / Consignation of 400,000 XAF
      await recordClientFundEntry(
        {
          matterId: testMatterId,
          partyId: testPartyId,
          type: "WITHDRAWAL",
          amount: 400000,
          reference: "ORDRE-VIREMENT-CONSIG",
        },
        accountantSession
      );

      const ledger = await getClientFundLedger(testMatterId, accountantSession);
      expect(ledger.entries.length).toBe(2);
      expect(ledger.summary.totalDeposits).toBe(1000000);
      expect(ledger.summary.totalWithdrawals).toBe(400000);
      expect(ledger.summary.currentEscrowBalance).toBe(600000);
      expect(ledger.summary.isReconciledToZero).toBe(false);

      // 3. Clear remaining 600,000 XAF back to client (restitution)
      await recordClientFundEntry(
        {
          matterId: testMatterId,
          partyId: testPartyId,
          type: "WITHDRAWAL",
          amount: 600000,
          reference: "RESTITUTION-SOLDE-CARPA",
        },
        accountantSession
      );

      const reconciledLedger = await getClientFundLedger(testMatterId, accountantSession);
      expect(reconciledLedger.summary.currentEscrowBalance).toBe(0);
      expect(reconciledLedger.summary.isReconciledToZero).toBe(true);
    });
  });
});
