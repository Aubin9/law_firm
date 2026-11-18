import {
  PrismaClient,
  PartyType,
  ClientStatus,
  MatterStatus,
  Confidentiality,
  Priority,
  EventType,
  EventStatus,
  TaskStatus,
  WorkflowEntity,
  MatterPartyRole,
  MatterAccessLevel,
  UserStatus,
  Locale,
} from "@prisma/client";
import {
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS_MATRIX,
  RoleKey,
} from "../src/server/auth/permission-matrix";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // ---------------------------------------------------------------------------
  // 1. Roles
  // ---------------------------------------------------------------------------
  console.log("→ Seeding 7 canonical roles...");
  const roleMap = new Map<string, string>(); // key -> id

  for (const roleDef of Object.values(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { key: roleDef.key },
      update: {
        nameFr: roleDef.nameFr,
        nameEn: roleDef.nameEn,
      },
      create: {
        key: roleDef.key,
        nameFr: roleDef.nameFr,
        nameEn: roleDef.nameEn,
      },
    });
    roleMap.set(role.key, role.id);
  }

  // ---------------------------------------------------------------------------
  // 2. Permissions
  // ---------------------------------------------------------------------------
  console.log("→ Seeding permissions...");
  const permissionMap = new Map<string, string>(); // key -> id

  for (const permDef of PERMISSION_DEFINITIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: permDef.key },
      update: {
        description: permDef.description,
      },
      create: {
        key: permDef.key,
        description: permDef.description,
      },
    });
    permissionMap.set(perm.key, perm.id);
  }

  // ---------------------------------------------------------------------------
  // 3. Role-Permission links
  // ---------------------------------------------------------------------------
  console.log(
    "→ Binding role-permission mappings according to PERMISSIONS.md...",
  );
  for (const [roleKey, permissionKeys] of Object.entries(
    ROLE_PERMISSIONS_MATRIX,
  )) {
    const roleId = roleMap.get(roleKey);
    if (!roleId) continue;

    for (const permKey of permissionKeys) {
      const permissionId = permissionMap.get(permKey);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Retention Policies
  // ---------------------------------------------------------------------------
  console.log("→ Seeding retention policies...");
  const retentionPolicies = [
    {
      key: "retention.litigation_records",
      nameFr: "Actes de procédure et pièces judiciaires",
      nameEn: "Litigation Pleadings and Court Records",
      retentionYears: 10,
      description:
        "Délai de prescription décennale de responsabilité professionnelle après clôture.",
    },
    {
      key: "retention.corporate_records",
      nameFr: "Actes de société et gouvernance d'entreprise",
      nameEn: "Corporate Governance and Incorporation Deeds",
      retentionYears: 10,
      description: "Statuts, PV d'assemblées générales et formalités RCCM.",
    },
    {
      key: "retention.correspondence",
      nameFr: "Correspondances et échanges ordinaires",
      nameEn: "General Case Correspondence",
      retentionYears: 5,
      description: "Courriers, télécopies et correspondances de gestion.",
    },
    {
      key: "retention.accounting",
      nameFr: "Factures et justificatifs comptables / CARPA",
      nameEn: "Accounting, Invoices, and Trust Records",
      retentionYears: 10,
      description:
        "Obligation légale de conservation des livres et pièces comptables (OHADA).",
    },
    {
      key: "retention.advisory_consulting",
      nameFr: "Consultations juridiques et avis écrits",
      nameEn: "Legal Opinions and Memoranda",
      retentionYears: 5,
      description: "Notes de consultation et mémorandums juridiques.",
    },
  ];

  const retentionMap = new Map<string, string>();
  for (const policy of retentionPolicies) {
    const res = await prisma.retentionPolicy.upsert({
      where: { key: policy.key },
      update: {
        nameFr: policy.nameFr,
        nameEn: policy.nameEn,
        retentionYears: policy.retentionYears,
        description: policy.description,
      },
      create: {
        key: policy.key,
        nameFr: policy.nameFr,
        nameEn: policy.nameEn,
        retentionYears: policy.retentionYears,
        description: policy.description,
      },
    });
    retentionMap.set(res.key, res.id);
  }

  // ---------------------------------------------------------------------------
  // 5. Document Categories
  // ---------------------------------------------------------------------------
  console.log("→ Seeding document categories...");
  const documentCategories = [
    {
      key: "court_filings",
      nameFr: "Actes de procédure",
      nameEn: "Court Pleadings & Filings",
      retentionKey: "retention.litigation_records",
    },
    {
      key: "exhibits",
      nameFr: "Pièces de fond & justificatifs",
      nameEn: "Exhibits & Supporting Documents",
      retentionKey: "retention.litigation_records",
    },
    {
      key: "correspondence",
      nameFr: "Correspondances & courriers",
      nameEn: "Letters & Communications",
      retentionKey: "retention.correspondence",
    },
    {
      key: "corporate_deeds",
      nameFr: "Actes de sociétés & statuts",
      nameEn: "Corporate Articles & Minutes",
      retentionKey: "retention.corporate_records",
    },
    {
      key: "legal_opinions",
      nameFr: "Consultations & avis juridiques",
      nameEn: "Legal Opinions & Advisory",
      retentionKey: "retention.advisory_consulting",
    },
    {
      key: "accounting_bills",
      nameFr: "Factures & reçus de règlement",
      nameEn: "Invoices & Receipts",
      retentionKey: "retention.accounting",
    },
  ];

  for (const docCat of documentCategories) {
    await prisma.documentCategory.upsert({
      where: { key: docCat.key },
      update: {
        nameFr: docCat.nameFr,
        nameEn: docCat.nameEn,
        retentionPolicyId: retentionMap.get(docCat.retentionKey),
      },
      create: {
        key: docCat.key,
        nameFr: docCat.nameFr,
        nameEn: docCat.nameEn,
        retentionPolicyId: retentionMap.get(docCat.retentionKey),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Expense Categories
  // ---------------------------------------------------------------------------
  console.log("→ Seeding expense categories...");
  const expenseCategories = [
    {
      key: "court_fees",
      nameFr: "Frais de greffe & enrôlement",
      nameEn: "Court & Registry Filing Fees",
    },
    {
      key: "bailiff",
      nameFr: "Frais d'huissier de justice (signification, exécution)",
      nameEn: "Bailiff / Process Server Fees",
    },
    {
      key: "travel",
      nameFr: "Frais de déplacement & transport",
      nameEn: "Travel & Transportation Expenses",
    },
    {
      key: "registration_stamps",
      nameFr: "Droits d'enregistrement & timbres fiscaux",
      nameEn: "Fiscal Stamp & Registration Duties",
    },
    {
      key: "translation_expert",
      nameFr: "Frais d'expertise & traduction assermentée",
      nameEn: "Expert & Sworn Translation Fees",
    },
    {
      key: "administrative",
      nameFr: "Frais administratifs et débours généraux",
      nameEn: "Administrative & Sundry Disbursements",
    },
  ];

  for (const expCat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { key: expCat.key },
      update: {
        nameFr: expCat.nameFr,
        nameEn: expCat.nameEn,
      },
      create: {
        key: expCat.key,
        nameFr: expCat.nameFr,
        nameEn: expCat.nameEn,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Workflows, Steps and Transitions (V1 specification)
  // ---------------------------------------------------------------------------
  console.log("→ Seeding V1 Workflows (SPECIFICATIONS.md Section 7)...");

  interface WorkflowSeedData {
    key: string;
    entity: WorkflowEntity;
    nameFr: string;
    nameEn: string;
    steps: {
      key: string;
      nameFr: string;
      nameEn: string;
      color: string;
      position: number;
      isInitial?: boolean;
      isFinal?: boolean;
    }[];
    transitions: {
      from: string;
      to: string;
      permission?: string;
      requiresConfirmation?: boolean;
      requiresJustification?: boolean;
      requiresValidation?: boolean;
    }[];
  }

  const workflows: WorkflowSeedData[] = [
    // 7.1 INQUIRY (Prospect)
    {
      key: "workflow.inquiry.v1",
      entity: "INQUIRY",
      nameFr: "Cycle de traitement des prospects",
      nameEn: "Inquiry and Prospect Pipeline",
      steps: [
        {
          key: "NEW",
          nameFr: "Nouveau",
          nameEn: "New",
          color: "#1F2A44",
          position: 1,
          isInitial: true,
        },
        {
          key: "TO_CONTACT",
          nameFr: "À contacter",
          nameEn: "To Contact",
          color: "#B08D57",
          position: 2,
        },
        {
          key: "CONTACT_MADE",
          nameFr: "Contact établi",
          nameEn: "Contact Made",
          color: "#2563EB",
          position: 3,
        },
        {
          key: "APPOINTMENT",
          nameFr: "RDV fixé",
          nameEn: "Appointment Scheduled",
          color: "#7C3AED",
          position: 4,
        },
        {
          key: "STUDY",
          nameFr: "Étude préalable",
          nameEn: "Needs Study",
          color: "#D97706",
          position: 5,
        },
        {
          key: "PROPOSAL_SENT",
          nameFr: "Offre transmise",
          nameEn: "Proposal Sent",
          color: "#059669",
          position: 6,
        },
        {
          key: "NEGOTIATING",
          nameFr: "En négociation",
          nameEn: "Negotiating",
          color: "#D97706",
          position: 7,
        },
        {
          key: "CONVERTED",
          nameFr: "Converti en client",
          nameEn: "Converted to Client",
          color: "#16A34A",
          position: 8,
          isFinal: true,
        },
        {
          key: "LOST",
          nameFr: "Classé sans suite / Refusé",
          nameEn: "Lost / Refused",
          color: "#DC2626",
          position: 9,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "NEW", to: "TO_CONTACT" },
        { from: "TO_CONTACT", to: "CONTACT_MADE" },
        { from: "CONTACT_MADE", to: "APPOINTMENT" },
        { from: "APPOINTMENT", to: "STUDY" },
        { from: "STUDY", to: "PROPOSAL_SENT" },
        { from: "PROPOSAL_SENT", to: "NEGOTIATING" },
        {
          from: "NEGOTIATING",
          to: "CONVERTED",
          permission: "inquiry.decide",
          requiresConfirmation: true,
        },
        {
          from: "PROPOSAL_SENT",
          to: "CONVERTED",
          permission: "inquiry.decide",
          requiresConfirmation: true,
        },
        {
          from: "NEW",
          to: "LOST",
          permission: "inquiry.decide",
          requiresJustification: true,
        },
        {
          from: "TO_CONTACT",
          to: "LOST",
          permission: "inquiry.decide",
          requiresJustification: true,
        },
        {
          from: "STUDY",
          to: "LOST",
          permission: "inquiry.decide",
          requiresJustification: true,
        },
        {
          from: "NEGOTIATING",
          to: "LOST",
          permission: "inquiry.decide",
          requiresJustification: true,
        },
      ],
    },

    // 7.2 TASK
    {
      key: "workflow.task.v1",
      entity: "TASK",
      nameFr: "Cycle de vie des tâches",
      nameEn: "Task Workflow",
      steps: [
        {
          key: "TODO",
          nameFr: "À faire",
          nameEn: "To Do",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "IN_PROGRESS",
          nameFr: "En cours",
          nameEn: "In Progress",
          color: "#2563EB",
          position: 2,
        },
        {
          key: "WAITING",
          nameFr: "En attente",
          nameEn: "Waiting",
          color: "#D97706",
          position: 3,
        },
        {
          key: "TO_VALIDATE",
          nameFr: "À valider",
          nameEn: "To Validate",
          color: "#7C3AED",
          position: 4,
        },
        {
          key: "DONE",
          nameFr: "Terminé",
          nameEn: "Done",
          color: "#16A34A",
          position: 5,
          isFinal: true,
        },
        {
          key: "CANCELLED",
          nameFr: "Annulé",
          nameEn: "Cancelled",
          color: "#DC2626",
          position: 6,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "TODO", to: "IN_PROGRESS" },
        { from: "IN_PROGRESS", to: "WAITING" },
        { from: "WAITING", to: "IN_PROGRESS" },
        { from: "IN_PROGRESS", to: "TO_VALIDATE" },
        {
          from: "TO_VALIDATE",
          to: "DONE",
          permission: "task.validate",
          requiresValidation: true,
        },
        { from: "IN_PROGRESS", to: "DONE" },
        {
          from: "TODO",
          to: "CANCELLED",
          permission: "task.cancel",
          requiresJustification: true,
        },
        {
          from: "IN_PROGRESS",
          to: "CANCELLED",
          permission: "task.cancel",
          requiresJustification: true,
        },
        {
          from: "WAITING",
          to: "CANCELLED",
          permission: "task.cancel",
          requiresJustification: true,
        },
      ],
    },

    // 7.3 MATTER
    {
      key: "workflow.matter.v1",
      entity: "MATTER",
      nameFr: "Cycle de traitement des dossiers",
      nameEn: "Matter Workflow",
      steps: [
        {
          key: "NEW",
          nameFr: "Nouveau",
          nameEn: "New",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "TO_CHECK",
          nameFr: "Vérification préalable",
          nameEn: "To Check",
          color: "#B08D57",
          position: 2,
        },
        {
          key: "TO_OPEN",
          nameFr: "À ouvrir",
          nameEn: "To Open",
          color: "#2563EB",
          position: 3,
        },
        {
          key: "ACTIVE",
          nameFr: "Actif",
          nameEn: "Active",
          color: "#059669",
          position: 4,
        },
        {
          key: "IN_PROGRESS",
          nameFr: "En cours d'instruction",
          nameEn: "In Progress",
          color: "#16A34A",
          position: 5,
        },
        {
          key: "WAITING",
          nameFr: "En attente pièce / décision",
          nameEn: "Waiting",
          color: "#D97706",
          position: 6,
        },
        {
          key: "CLOSURE_TO_VALIDATE",
          nameFr: "Clôture à valider",
          nameEn: "Closure to Validate",
          color: "#7C3AED",
          position: 7,
        },
        {
          key: "CLOSED",
          nameFr: "Clôturé",
          nameEn: "Closed",
          color: "#475569",
          position: 8,
        },
        {
          key: "ARCHIVED",
          nameFr: "Archivé",
          nameEn: "Archived",
          color: "#1E293B",
          position: 9,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "NEW", to: "TO_CHECK" },
        { from: "TO_CHECK", to: "TO_OPEN" },
        { from: "TO_OPEN", to: "ACTIVE", permission: "matter.create" },
        { from: "ACTIVE", to: "IN_PROGRESS" },
        { from: "IN_PROGRESS", to: "WAITING" },
        { from: "WAITING", to: "IN_PROGRESS" },
        {
          from: "IN_PROGRESS",
          to: "CLOSURE_TO_VALIDATE",
          permission: "matter.request_closure",
        },
        {
          from: "CLOSURE_TO_VALIDATE",
          to: "CLOSED",
          permission: "matter.validate_closure",
          requiresValidation: true,
        },
        {
          from: "CLOSED",
          to: "ARCHIVED",
          permission: "matter.archive",
          requiresConfirmation: true,
        },
      ],
    },

    // 7.4 MISSION
    {
      key: "workflow.mission.v1",
      entity: "MISSION",
      nameFr: "Cycle de mission de conseil",
      nameEn: "Advisory Mission Workflow",
      steps: [
        {
          key: "SCOPING",
          nameFr: "Cadrage",
          nameEn: "Scoping",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "RESEARCH",
          nameFr: "Recherches juridiques",
          nameEn: "Research",
          color: "#2563EB",
          position: 2,
        },
        {
          key: "DRAFTING",
          nameFr: "Rédaction",
          nameEn: "Drafting",
          color: "#7C3AED",
          position: 3,
        },
        {
          key: "REVIEW",
          nameFr: "Relecture",
          nameEn: "Review",
          color: "#D97706",
          position: 4,
        },
        {
          key: "VALIDATION",
          nameFr: "Validation",
          nameEn: "Validation",
          color: "#059669",
          position: 5,
        },
        {
          key: "TRANSMITTED",
          nameFr: "Transmis au client",
          nameEn: "Transmitted",
          color: "#2563EB",
          position: 6,
        },
        {
          key: "FEEDBACK",
          nameFr: "Retour client",
          nameEn: "Feedback",
          color: "#B08D57",
          position: 7,
        },
        {
          key: "CLOSED",
          nameFr: "Mission terminée",
          nameEn: "Closed",
          color: "#16A34A",
          position: 8,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "SCOPING", to: "RESEARCH" },
        { from: "RESEARCH", to: "DRAFTING" },
        { from: "DRAFTING", to: "REVIEW" },
        { from: "REVIEW", to: "VALIDATION" },
        { from: "VALIDATION", to: "TRANSMITTED" },
        { from: "TRANSMITTED", to: "FEEDBACK" },
        { from: "FEEDBACK", to: "CLOSED" },
      ],
    },

    // 7.5 PROCEDURE
    {
      key: "workflow.procedure.v1",
      entity: "PROCEDURE",
      nameFr: "Cycle de procédure judiciaire",
      nameEn: "Court Procedure Workflow",
      steps: [
        {
          key: "TO_PREPARE",
          nameFr: "À préparer",
          nameEn: "To Prepare",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "TO_CHECK",
          nameFr: "Vérification des pièces",
          nameEn: "To Check",
          color: "#B08D57",
          position: 2,
        },
        {
          key: "READY_TO_FILE",
          nameFr: "Prêt à enrôler",
          nameEn: "Ready to File",
          color: "#2563EB",
          position: 3,
        },
        {
          key: "FILED",
          nameFr: "Enrôlé / Déposé",
          nameEn: "Filed",
          color: "#059669",
          position: 4,
        },
        {
          key: "AWAITING_HEARING",
          nameFr: "En attente d'audience",
          nameEn: "Awaiting Hearing",
          color: "#D97706",
          position: 5,
        },
        {
          key: "HEARING_HELD",
          nameFr: "Audience tenue / Débats",
          nameEn: "Hearing Held",
          color: "#7C3AED",
          position: 6,
        },
        {
          key: "DECISION_RENDERED",
          nameFr: "Décision rendue",
          nameEn: "Decision Rendered",
          color: "#16A34A",
          position: 7,
        },
        {
          key: "APPEAL_ENFORCEMENT",
          nameFr: "Voies de recours / Exécution",
          nameEn: "Appeal / Enforcement",
          color: "#EA580C",
          position: 8,
        },
        {
          key: "FINISHED",
          nameFr: "Procédure terminée",
          nameEn: "Finished",
          color: "#475569",
          position: 9,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "TO_PREPARE", to: "TO_CHECK" },
        { from: "TO_CHECK", to: "READY_TO_FILE" },
        { from: "READY_TO_FILE", to: "FILED" },
        { from: "FILED", to: "AWAITING_HEARING" },
        { from: "AWAITING_HEARING", to: "HEARING_HELD" },
        { from: "HEARING_HELD", to: "AWAITING_HEARING" }, // renvoi
        { from: "HEARING_HELD", to: "DECISION_RENDERED" },
        { from: "DECISION_RENDERED", to: "APPEAL_ENFORCEMENT" },
        { from: "DECISION_RENDERED", to: "FINISHED" },
        { from: "APPEAL_ENFORCEMENT", to: "FINISHED" },
      ],
    },

    // 7.6 DOCUMENT
    {
      key: "workflow.document.v1",
      entity: "DOCUMENT",
      nameFr: "Cycle de validation de document",
      nameEn: "Document Lifecycle Workflow",
      steps: [
        {
          key: "TO_PRODUCE",
          nameFr: "À produire",
          nameEn: "To Produce",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "DRAFTING",
          nameFr: "Rédaction",
          nameEn: "Drafting",
          color: "#2563EB",
          position: 2,
        },
        {
          key: "TO_REVIEW",
          nameFr: "À relire",
          nameEn: "To Review",
          color: "#D97706",
          position: 3,
        },
        {
          key: "TO_VALIDATE",
          nameFr: "À valider",
          nameEn: "To Validate",
          color: "#7C3AED",
          position: 4,
        },
        {
          key: "VALIDATED",
          nameFr: "Validé",
          nameEn: "Validated",
          color: "#059669",
          position: 5,
        },
        {
          key: "SENT_FILED",
          nameFr: "Transmis / Déposé",
          nameEn: "Sent / Filed",
          color: "#16A34A",
          position: 6,
        },
        {
          key: "FILED_AWAY",
          nameFr: "Classé",
          nameEn: "Filed Away",
          color: "#475569",
          position: 7,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "TO_PRODUCE", to: "DRAFTING" },
        { from: "DRAFTING", to: "TO_REVIEW" },
        { from: "TO_REVIEW", to: "TO_VALIDATE" },
        {
          from: "TO_VALIDATE",
          to: "VALIDATED",
          permission: "document.validate",
          requiresValidation: true,
        },
        { from: "VALIDATED", to: "SENT_FILED" },
        { from: "SENT_FILED", to: "FILED_AWAY" },
      ],
    },

    // 7.7 INVOICE
    {
      key: "workflow.invoice.v1",
      entity: "INVOICE",
      nameFr: "Cycle de facturation",
      nameEn: "Invoice Lifecycle Workflow",
      steps: [
        {
          key: "DRAFT",
          nameFr: "Brouillon",
          nameEn: "Draft",
          color: "#64748B",
          position: 1,
          isInitial: true,
        },
        {
          key: "TO_VALIDATE",
          nameFr: "À valider",
          nameEn: "To Validate",
          color: "#D97706",
          position: 2,
        },
        {
          key: "ISSUED",
          nameFr: "Émise / Transmise",
          nameEn: "Issued",
          color: "#059669",
          position: 3,
        },
        {
          key: "CANCELLED",
          nameFr: "Annulée",
          nameEn: "Cancelled",
          color: "#DC2626",
          position: 4,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "DRAFT", to: "TO_VALIDATE" },
        {
          from: "TO_VALIDATE",
          to: "ISSUED",
          permission: "invoice.validate",
          requiresConfirmation: true,
        },
        {
          from: "ISSUED",
          to: "CANCELLED",
          permission: "invoice.cancel",
          requiresJustification: true,
        },
        { from: "TO_VALIDATE", to: "DRAFT" },
      ],
    },

    // 7.8 CLIENT_REQUEST
    {
      key: "workflow.client_request.v1",
      entity: "CLIENT_REQUEST",
      nameFr: "Cycle de traitement des demandes clients",
      nameEn: "Client Request Lifecycle Workflow",
      steps: [
        {
          key: "RECEIVED",
          nameFr: "Reçue",
          nameEn: "Received",
          color: "#4B5563",
          position: 1,
          isInitial: true,
        },
        {
          key: "TO_QUALIFY",
          nameFr: "À qualifier",
          nameEn: "To Qualify",
          color: "#B08D57",
          position: 2,
        },
        {
          key: "ASSIGNED",
          nameFr: "Assignée",
          nameEn: "Assigned",
          color: "#2563EB",
          position: 3,
        },
        {
          key: "IN_PROGRESS",
          nameFr: "En cours de traitement",
          nameEn: "In Progress",
          color: "#16A34A",
          position: 4,
        },
        {
          key: "WAITING_CLIENT",
          nameFr: "En attente retour client",
          nameEn: "Waiting for Client",
          color: "#D97706",
          position: 5,
        },
        {
          key: "RESOLVED",
          nameFr: "Traitée",
          nameEn: "Resolved",
          color: "#059669",
          position: 6,
          isFinal: true,
        },
        {
          key: "CLOSED",
          nameFr: "Clôturée",
          nameEn: "Closed",
          color: "#475569",
          position: 7,
          isFinal: true,
        },
      ],
      transitions: [
        { from: "RECEIVED", to: "TO_QUALIFY" },
        { from: "TO_QUALIFY", to: "ASSIGNED" },
        { from: "ASSIGNED", to: "IN_PROGRESS" },
        { from: "IN_PROGRESS", to: "WAITING_CLIENT" },
        { from: "WAITING_CLIENT", to: "IN_PROGRESS" },
        { from: "IN_PROGRESS", to: "RESOLVED" },
        { from: "RESOLVED", to: "CLOSED" },
      ],
    },
  ];

  const workflowMap = new Map<string, string>(); // wfKey -> wfId
  const stepMap = new Map<string, string>(); // `${wfKey}:${stepKey}` -> stepId

  for (const wf of workflows) {
    const definition = await prisma.workflowDefinition.upsert({
      where: {
        key_version: {
          key: wf.key,
          version: 1,
        },
      },
      update: {
        nameFr: wf.nameFr,
        nameEn: wf.nameEn,
        entity: wf.entity,
      },
      create: {
        key: wf.key,
        version: 1,
        isActive: true,
        entity: wf.entity,
        nameFr: wf.nameFr,
        nameEn: wf.nameEn,
      },
    });
    workflowMap.set(wf.key, definition.id);

    // Seed Steps
    for (const step of wf.steps) {
      // Find or create step by definitionId and key
      const existing = await prisma.workflowStep.findFirst({
        where: {
          definitionId: definition.id,
          key: step.key,
        },
      });

      let stepId: string;
      if (existing) {
        await prisma.workflowStep.update({
          where: { id: existing.id },
          data: {
            nameFr: step.nameFr,
            nameEn: step.nameEn,
            color: step.color,
            position: step.position,
            isInitial: step.isInitial ?? false,
            isFinal: step.isFinal ?? false,
          },
        });
        stepId = existing.id;
      } else {
        const created = await prisma.workflowStep.create({
          data: {
            definitionId: definition.id,
            key: step.key,
            nameFr: step.nameFr,
            nameEn: step.nameEn,
            color: step.color,
            position: step.position,
            isInitial: step.isInitial ?? false,
            isFinal: step.isFinal ?? false,
          },
        });
        stepId = created.id;
      }
      stepMap.set(`${wf.key}:${step.key}`, stepId);
    }

    // Seed Transitions
    for (const tr of wf.transitions) {
      const fromStepId = stepMap.get(`${wf.key}:${tr.from}`);
      const toStepId = stepMap.get(`${wf.key}:${tr.to}`);
      if (!fromStepId || !toStepId) continue;

      await prisma.workflowTransition.upsert({
        where: {
          fromStepId_toStepId: {
            fromStepId,
            toStepId,
          },
        },
        update: {
          requiredPermissionKey: tr.permission,
          requiresConfirmation: tr.requiresConfirmation ?? false,
          requiresJustification: tr.requiresJustification ?? false,
          requiresValidation: tr.requiresValidation ?? false,
        },
        create: {
          definitionId: definition.id,
          fromStepId,
          toStepId,
          requiredPermissionKey: tr.permission,
          requiresConfirmation: tr.requiresConfirmation ?? false,
          requiresJustification: tr.requiresJustification ?? false,
          requiresValidation: tr.requiresValidation ?? false,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Matter Categories
  // ---------------------------------------------------------------------------
  console.log(
    "→ Seeding matter categories (litigation, advisory, corporate, family, criminal, real estate, labour)...",
  );
  const matterWfId = workflowMap.get("workflow.matter.v1");

  const matterCategories = [
    {
      key: "litigation",
      nameFr: "Contentieux & Arbitrage",
      nameEn: "Litigation & Arbitration",
    },
    {
      key: "advisory",
      nameFr: "Conseil juridique & Rédaction",
      nameEn: "Legal Advisory & Drafting",
    },
    {
      key: "corporate",
      nameFr: "Droit des sociétés & Affaires",
      nameEn: "Corporate & Business Law",
    },
    {
      key: "family",
      nameFr: "Droit de la famille & Personnes",
      nameEn: "Family & Persons Law",
    },
    {
      key: "criminal",
      nameFr: "Droit pénal & Procédure pénale",
      nameEn: "Criminal Law & Procedure",
    },
    {
      key: "real_estate",
      nameFr: "Droit immobilier & Foncier",
      nameEn: "Real Estate & Land Law",
    },
    {
      key: "labour",
      nameFr: "Droit du travail & Sécurité sociale",
      nameEn: "Labour & Social Security Law",
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const matCat of matterCategories) {
    const res = await prisma.matterCategory.upsert({
      where: { key: matCat.key },
      update: {
        nameFr: matCat.nameFr,
        nameEn: matCat.nameEn,
        workflowDefinitionId: matterWfId,
      },
      create: {
        key: matCat.key,
        nameFr: matCat.nameFr,
        nameEn: matCat.nameEn,
        workflowDefinitionId: matterWfId,
      },
    });
    categoryMap.set(res.key, res.id);
  }

  // ---------------------------------------------------------------------------
  // 9. Canonical Feature Flags (All external integrations OFF / Air-gapped)
  // ---------------------------------------------------------------------------
  console.log("→ Seeding canonical feature flags (all integrations OFF)...");
  const featureFlags = [
    {
      key: "ai.enabled",
      enabled: false,
      description:
        "Gemini / OpenAI external AI processing (Air-gapped by default).",
    },
    {
      key: "drive.sync.enabled",
      enabled: false,
      description: "Google Drive external synchronization.",
    },
    {
      key: "storage.cloudflare.enabled",
      enabled: false,
      description: "Cloudflare R2 external cloud storage.",
    },
    {
      key: "portal.enabled",
      enabled: false,
      description: "Public client portal exposure (LAN-only by default).",
    },
    {
      key: "templates.generation.enabled",
      enabled: false,
      description:
        "Génération documentaire automatique à partir de modèles (INT-05).",
    },
    {
      key: "calendar.sync.enabled",
      enabled: false,
      description:
        "Synchronisation externe du calendrier (iCal / RFC 5545) (INT-03).",
    },
    {
      key: "email.association.enabled",
      enabled: false,
      description:
        "Association et archivage probant d'e-mails .eml aux dossiers (INT-04).",
    },
    {
      key: "reversibility.export.enabled",
      enabled: false,
      description:
        "Export complet et réversibilité des dossiers au format ZIP (INT-07 / NF-12).",
    },
    {
      key: "esignature.enabled",
      enabled: false,
      description:
        "Circuit de visa interne et signature électronique probante (INT-06 / Loi n° 2024/017).",
    },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: {
        key: flag.key,
        enabled: flag.enabled,
        description: flag.description,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Production Reference Counters (Initialized at 0)
  // ---------------------------------------------------------------------------
  console.log("→ Initializing production reference counters at 0...");
  const currentYear = new Date().getFullYear();
  const counters = [
    { key: `MATTER-${currentYear}`, value: 0 },
    { key: `INVOICE-${currentYear}`, value: 0 },
    { key: `PAYMENT-${currentYear}`, value: 0 },
    { key: `INQUIRY-${currentYear}`, value: 0 },
    { key: "PARTY-CLIENT", value: 0 },
  ];

  for (const counter of counters) {
    await prisma.referenceCounter.upsert({
      where: { key: counter.key },
      update: {},
      create: {
        key: counter.key,
        value: counter.value,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 11. PostgreSQL Search Extensions (unaccent, pg_trgm)
  // ---------------------------------------------------------------------------
  console.log("→ Ensuring PostgreSQL extensions (unaccent, pg_trgm)...");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS unaccent;");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

  // ---------------------------------------------------------------------------
  // 12. Canonical Legal Library (OHADA, Cameroon, CEMAC - EXT-04)
  // ---------------------------------------------------------------------------
  console.log("→ Seeding canonical legal library texts...");
  const { seedCanonicalLegalLibrary } = await import("../src/server/services/library-service");
  await seedCanonicalLegalLibrary();

  // ---------------------------------------------------------------------------
  // 13. Bootstrap Initial Accounts (ONLY if database has 0 users)
  // ---------------------------------------------------------------------------
  const existingUsers = await prisma.user.count();
  if (existingUsers === 0) {
    console.log(
      "→ No users found. Creating bootstrap PARTNER and TECHNICAL_ADMIN accounts...",
    );
    const crypto = await import("crypto");
    const { hash } = await import("@node-rs/argon2");

    const partnerEmail = (process.env.PROD_PARTNER_EMAIL || "associe@gmail.com")
      .trim()
      .toLowerCase();
    const partnerName = process.env.PROD_PARTNER_NAME || "Associé Fondateur";
    const partnerPass = process.env.PROD_PARTNER_PASSWORD || "11111111";

    const adminEmail = (process.env.PROD_ADMIN_EMAIL || "admin@gmail.com")
      .trim()
      .toLowerCase();
    const adminName = process.env.PROD_ADMIN_NAME || "Administrateur Technique";
    const adminPass = process.env.PROD_ADMIN_PASSWORD || "11111111";

    const partnerRoleId = roleMap.get("PARTNER");
    const adminRoleId = roleMap.get("TECHNICAL_ADMIN");

    if (!partnerRoleId || !adminRoleId) {
      throw new Error("Missing canonical PARTNER or TECHNICAL_ADMIN role.");
    }

    const partnerId = "usr_prod_partner_01";
    const adminId = "usr_prod_admin_01";

    const partnerHash = await hash(partnerPass);
    const adminHash = await hash(adminPass);

    await prisma.user.create({
      data: {
        id: partnerId,
        email: partnerEmail,
        name: partnerName,
        roleId: partnerRoleId,
        status: UserStatus.ACTIVE,
        locale: Locale.FR,
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        id: `acc_${partnerId}`,
        accountId: partnerId,
        providerId: "credential",
        userId: partnerId,
        password: partnerHash,
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        email: adminEmail,
        name: adminName,
        roleId: adminRoleId,
        status: UserStatus.ACTIVE,
        locale: Locale.FR,
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        id: `acc_${adminId}`,
        accountId: adminId,
        providerId: "credential",
        userId: adminId,
        password: adminHash,
      },
    });

    console.log("=======================================================");
    console.log("🔐 BOOTSTRAP PRODUCTION ACCOUNTS CREATED (SAVE NOW!):");
    console.log(
      `• PARTNER         : ${partnerEmail} / ${process.env.PROD_PARTNER_PASSWORD ? "(from env)" : partnerPass}`,
    );
    console.log(
      `• TECHNICAL_ADMIN : ${adminEmail} / ${process.env.PROD_ADMIN_PASSWORD ? "(from env)" : adminPass}`,
    );
    console.log(
      "⚠️  Change these passwords and enable 2FA immediately on first login!",
    );
    console.log("=======================================================");
  } else {
    console.log(
      `→ Existing users detected (${existingUsers}). Skipping bootstrap account creation.`,
    );
  }

  console.log("✅ PRODUCTION SEED COMPLETED SUCCESSFULLY (Zero demo data).");
}

main()
  .catch((e) => {
    console.error("❌ Production seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
