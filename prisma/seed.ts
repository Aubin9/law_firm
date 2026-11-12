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
  // 9. Feature Flags (All external integrations OFF by default)
  // ---------------------------------------------------------------------------
  console.log("→ Seeding default feature flags (all integrations OFF)...");
  const featureFlags = [
    {
      key: "google_drive_backup",
      enabled: false,
      description: "Synchronisation de sauvegarde vers Google Drive",
    },
    {
      key: "openai_transcription",
      enabled: false,
      description: "Assistance et transcription IA via OpenAI",
    },
    {
      key: "cloudflare_turnstile",
      enabled: false,
      description: "Protection antibot Cloudflare Turnstile sur le portail",
    },
    {
      key: "client_portal",
      enabled: false,
      description: "Portail client externe (V4)",
    },
    {
      key: "ai.enabled",
      enabled: false,
      description: "Fonctionnalités génératives IA en cabinet",
    },
    {
      key: "drive.sync.enabled",
      enabled: false,
      description: "Synchronisation automatique des dossiers vers Drive",
    },
    {
      key: "storage.cloudflare.enabled",
      enabled: false,
      description: "Stockage objet Cloudflare R2 distant",
    },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        description: flag.description,
      },
      create: {
        key: flag.key,
        enabled: flag.enabled,
        description: flag.description,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Reference Counters
  // ---------------------------------------------------------------------------
  console.log("→ Initializing reference counters...");
  const counters = [
    { key: "MATTER-2026", value: 6 }, // 6 seeded demo matters
    { key: "INVOICE-2026", value: 0 },
    { key: "PAYMENT-2026", value: 0 },
    { key: "INQUIRY-2026", value: 2 },
    { key: "PARTY-CLIENT", value: 10 }, // 10 seeded parties
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
  // 11. Fictional Demo Dataset (One user per role, 10 parties, 6 matters, events, tasks)
  // ---------------------------------------------------------------------------
  console.log("→ Seeding fictional demo dataset for local development...");

  // 11.1 Users (1 per canonical role)
  // Password hash for dev accounts: "Password123!" hashed with Argon2id
  const devPasswordHash =
    "$argon2id$v=19$m=19456,t=2,p=1$CX7lNgmUx47apQdlevR8zg$pb7m8kXjJN4mxwW5Th8DJ2ldQ3B/tvWrL1nc11syK2o";

  const demoUsers: {
    id: string;
    email: string;
    name: string;
    roleKey: RoleKey;
    locale: Locale;
  }[] = [
    {
      id: "usr_partner_01",
      email: "associe@gmail.com",
      name: "Me Martin EKANI",
      roleKey: "PARTNER",
      locale: "FR",
    },
    {
      id: "usr_lead_01",
      email: "responsable@gmail.com",
      name: "Me Suzanne MBARGA",
      roleKey: "LEAD_LAWYER",
      locale: "FR",
    },
    {
      id: "usr_assoc_01",
      email: "collaborateur@gmail.com",
      name: "Me Paul NDOUMBE",
      roleKey: "ASSOCIATE_LAWYER",
      locale: "FR",
    },
    {
      id: "usr_secr_01",
      email: "secretariat@gmail.com",
      name: "Mme Clarisse FOTSO",
      roleKey: "SECRETARY",
      locale: "FR",
    },
    {
      id: "usr_acct_01",
      email: "comptable@gmail.com",
      name: "M. Christian BEKOLO",
      roleKey: "ACCOUNTANT",
      locale: "FR",
    },
    {
      id: "usr_fadmin_01",
      email: "admin.fonc@gmail.com",
      name: "M. David TCHINDA",
      roleKey: "FUNCTIONAL_ADMIN",
      locale: "FR",
    },
    {
      id: "usr_tadmin_01",
      email: "admin.tech@gmail.com",
      name: "M. Eric TALLA",
      roleKey: "TECHNICAL_ADMIN",
      locale: "FR",
    },
  ];

  for (const u of demoUsers) {
    const roleId = roleMap.get(u.roleKey)!;
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        name: u.name,
        roleId,
        locale: u.locale,
        status: "ACTIVE",
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        roleId,
        locale: u.locale,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    // Seed credential Account record for authentication compatibility
    await prisma.account.upsert({
      where: { id: `acc_${u.id}` },
      update: {
        password: devPasswordHash,
      },
      create: {
        id: `acc_${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: devPasswordHash,
      },
    });
  }

  // 11.2 Parties (10 realistic entities in Cameroon: 5 Individuals, 5 Companies)
  const demoParties = [
    // 5 Individuals
    {
      id: "pty_ind_01",
      type: PartyType.INDIVIDUAL,
      clientStatus: ClientStatus.CLIENT,
      displayName: "TCHOUNGUI Jean-Pierre",
      firstName: "Jean-Pierre",
      lastName: "TCHOUNGUI",
      phone: "+237 677 12 34 56",
      email: "jp.tchoungui@email.cm",
      address: "Quartier Bonapriso, Rue Tobie Kuoh",
      city: "Douala",
      country: "CM",
    },
    {
      id: "pty_ind_02",
      type: PartyType.INDIVIDUAL,
      clientStatus: ClientStatus.CLIENT,
      displayName: "EBENE Antoinette Flore",
      firstName: "Antoinette Flore",
      lastName: "EBENE",
      phone: "+237 699 87 65 43",
      email: "antoinette.ebene@email.cm",
      address: "Bastos, Rue 1782",
      city: "Yaoundé",
      country: "CM",
    },
    {
      id: "pty_ind_03",
      type: PartyType.INDIVIDUAL,
      clientStatus: ClientStatus.CLIENT,
      displayName: "FOKOU Marcel",
      firstName: "Marcel",
      lastName: "FOKOU",
      phone: "+237 675 22 33 44",
      email: "marcel.fokou@email.cm",
      address: "Akwa Nord, Face Collège Libermann",
      city: "Douala",
      country: "CM",
    },
    {
      id: "pty_ind_04",
      type: PartyType.INDIVIDUAL,
      clientStatus: ClientStatus.PROSPECT,
      displayName: "BIKIE Marie-Noëlle",
      firstName: "Marie-Noëlle",
      lastName: "BIKIE",
      phone: "+237 694 55 66 77",
      email: "mnoelle.bikie@email.cm",
      address: "Elig-Essono",
      city: "Yaoundé",
      country: "CM",
    },
    {
      id: "pty_ind_05",
      type: PartyType.INDIVIDUAL,
      clientStatus: ClientStatus.NONE,
      displayName: "KAMDEM Arthur (Partie adverse)",
      firstName: "Arthur",
      lastName: "KAMDEM",
      phone: "+237 670 11 22 33",
      email: "arthur.kamdem@email.cm",
      address: "Deido, Grand Moulin",
      city: "Douala",
      country: "CM",
    },
    // 5 Companies with real Cameroon OHADA formats (RCCM & NIU)
    {
      id: "pty_cmp_01",
      type: PartyType.COMPANY,
      clientStatus: ClientStatus.CLIENT,
      displayName: "AFRIQUE TRANSIT LOGISTIQUE SARL",
      companyName: "AFRIQUE TRANSIT LOGISTIQUE SARL",
      registrationNumber: "RC/DLA/2018/B/4512",
      taxId: "M051812345678A",
      phone: "+237 233 42 11 00",
      email: "direction@afrique-transit.cm",
      address: "Zone Portuaire Amont, Bonabéri",
      city: "Douala",
      country: "CM",
    },
    {
      id: "pty_cmp_02",
      type: PartyType.COMPANY,
      clientStatus: ClientStatus.CLIENT,
      displayName: "BANQUE CENTRALE COMMERCIALE DU CAMEROUN SA",
      companyName: "BANQUE CENTRALE COMMERCIALE DU CAMEROUN SA",
      registrationNumber: "RC/DLA/2005/B/0819",
      taxId: "M020500012345B",
      phone: "+237 233 43 55 00",
      email: "affaires.juridiques@bccc-bank.cm",
      address: "Boulevard de la Liberté, Akwa",
      city: "Douala",
      country: "CM",
    },
    {
      id: "pty_cmp_03",
      type: PartyType.COMPANY,
      clientStatus: ClientStatus.CLIENT,
      displayName: "SOCIETE FORESTIERE DU HAUT-NYONG SA",
      companyName: "SOCIETE FORESTIERE DU HAUT-NYONG SA",
      registrationNumber: "RC/YAE/2012/B/1104",
      taxId: "M081200054321F",
      phone: "+237 222 20 44 12",
      email: "contact@sfhn-bois.cm",
      address: "Quartier Hippodrome, Avenue Kennedy",
      city: "Yaoundé",
      country: "CM",
    },
    {
      id: "pty_cmp_04",
      type: PartyType.COMPANY,
      clientStatus: ClientStatus.PROSPECT,
      displayName: "CAMEROON AGRO-INDUSTRIES SAS",
      companyName: "CAMEROON AGRO-INDUSTRIES SAS",
      registrationNumber: "RC/BFM/2022/B/0331",
      taxId: "M112214567890K",
      phone: "+237 233 44 88 90",
      email: "juridique@cameroon-agro.cm",
      address: "Route de Foumbot",
      city: "Bafoussam",
      country: "CM",
    },
    {
      id: "pty_cmp_05",
      type: PartyType.COMPANY,
      clientStatus: ClientStatus.NONE,
      displayName: "GLOBAL TELECOM SERVICES CAMEROUN SA (Adverse)",
      companyName: "GLOBAL TELECOM SERVICES CAMEROUN SA",
      registrationNumber: "RC/DLA/2015/B/2240",
      taxId: "M061500098765G",
      phone: "+237 233 42 77 88",
      email: "contentieux@globaltelecom.cm",
      address: "Rue Prince Bell, Bali",
      city: "Douala",
      country: "CM",
    },
  ];

  for (const p of demoParties) {
    await prisma.party.upsert({
      where: { id: p.id },
      update: {
        type: p.type,
        clientStatus: p.clientStatus,
        displayName: p.displayName,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.companyName,
        registrationNumber: p.registrationNumber,
        taxId: p.taxId,
        phone: p.phone,
        email: p.email,
        address: p.address,
        city: p.city,
        country: p.country,
      },
      create: {
        id: p.id,
        type: p.type,
        clientStatus: p.clientStatus,
        displayName: p.displayName,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.companyName,
        registrationNumber: p.registrationNumber,
        taxId: p.taxId,
        phone: p.phone,
        email: p.email,
        address: p.address,
        city: p.city,
        country: p.country,
      },
    });
  }

  // 11.3 Matters (6 matters across categories and confidentiality levels)
  const matterActiveStepId = stepMap.get("workflow.matter.v1:ACTIVE");
  const matterInProgressStepId = stepMap.get("workflow.matter.v1:IN_PROGRESS");
  const matterWaitingStepId = stepMap.get("workflow.matter.v1:WAITING");

  const demoMatters = [
    {
      id: "mat_001_standard",
      reference: "MAT-2026-0001",
      title:
        "Contentieux douanier et transit - Afrique Transit c/ DGD Littoral",
      description:
        "Recours contentieux contre avis de redressement douanier sur déclaration d'importation.",
      categoryKey: "litigation",
      confidentiality: Confidentiality.STANDARD,
      priority: Priority.HIGH,
      status: MatterStatus.OPEN,
      workflowStepId: matterInProgressStepId,
      leadLawyerId: "usr_lead_01",
      createdById: "usr_partner_01",
      clientId: "pty_cmp_01",
      opposingId: "pty_ind_05",
    },
    {
      id: "mat_002_restricted",
      reference: "MAT-2026-0002",
      title:
        "Recouvrement créance bancaire et saisie conservatoire - BCCC SA c/ Société X",
      description:
        "Procédure d'injonction de payer et saisie conservatoire de créances selon Acte Uniforme OHADA.",
      categoryKey: "litigation",
      confidentiality: Confidentiality.RESTRICTED,
      priority: Priority.URGENT,
      status: MatterStatus.OPEN,
      workflowStepId: matterInProgressStepId,
      leadLawyerId: "usr_lead_01",
      createdById: "usr_lead_01",
      clientId: "pty_cmp_02",
      opposingId: "pty_cmp_05",
    },
    {
      id: "mat_003_strict",
      reference: "MAT-2026-0003",
      title: "Arbitrage international CCJA et restructuration capitalistique",
      description:
        "Dossier sous secret professionnel strict. Litige d'actionnaires et procédure arbitrale.",
      categoryKey: "corporate",
      confidentiality: Confidentiality.STRICT,
      priority: Priority.HIGH,
      status: MatterStatus.OPEN,
      workflowStepId: matterActiveStepId,
      leadLawyerId: "usr_partner_01",
      createdById: "usr_partner_01",
      clientId: "pty_cmp_03",
      opposingId: "pty_cmp_05",
    },
    {
      id: "mat_004_standard",
      reference: "MAT-2026-0004",
      title:
        "Succession TCHOUNGUI - Liquidation de régime matrimonial et partage",
      description:
        "Procédure de partage successoral et délivrance de legs devant le TPI de Douala.",
      categoryKey: "family",
      confidentiality: Confidentiality.STANDARD,
      priority: Priority.NORMAL,
      status: MatterStatus.OPEN,
      workflowStepId: matterWaitingStepId,
      leadLawyerId: "usr_lead_01",
      createdById: "usr_partner_01",
      clientId: "pty_ind_01",
      opposingId: "pty_ind_05",
    },
    {
      id: "mat_005_standard",
      reference: "MAT-2026-0005",
      title: "Audit de conformité foncière et acquisition de titres fonciers",
      description:
        "Mission de vérification cadastrale, purge des droits coutumiers et immatriculation.",
      categoryKey: "real_estate",
      confidentiality: Confidentiality.STANDARD,
      priority: Priority.NORMAL,
      status: MatterStatus.OPEN,
      workflowStepId: matterActiveStepId,
      leadLawyerId: "usr_lead_01",
      createdById: "usr_lead_01",
      clientId: "pty_ind_02",
      opposingId: undefined,
    },
    {
      id: "mat_006_restricted",
      reference: "MAT-2026-0006",
      title:
        "Licenciement collectif pour motif économique - Négociation et transaction",
      description:
        "Accompagnement juridique social, plan social et saisine de l'Inspection du Travail.",
      categoryKey: "labour",
      confidentiality: Confidentiality.RESTRICTED,
      priority: Priority.HIGH,
      status: MatterStatus.OPEN,
      workflowStepId: matterInProgressStepId,
      leadLawyerId: "usr_partner_01",
      createdById: "usr_partner_01",
      clientId: "pty_cmp_01",
      opposingId: "pty_ind_03",
    },
  ];

  for (const m of demoMatters) {
    const categoryId = categoryMap.get(m.categoryKey)!;
    await prisma.matter.upsert({
      where: { reference: m.reference },
      update: {
        title: m.title,
        description: m.description,
        categoryId,
        confidentiality: m.confidentiality,
        priority: m.priority,
        status: m.status,
        workflowStepId: m.workflowStepId,
        leadLawyerId: m.leadLawyerId,
      },
      create: {
        id: m.id,
        reference: m.reference,
        title: m.title,
        description: m.description,
        categoryId,
        confidentiality: m.confidentiality,
        priority: m.priority,
        status: m.status,
        workflowStepId: m.workflowStepId,
        leadLawyerId: m.leadLawyerId,
        createdById: m.createdById,
      },
    });

    // Matter Party link (Client)
    await prisma.matterParty.upsert({
      where: {
        matterId_partyId_role: {
          matterId: m.id,
          partyId: m.clientId,
          role: MatterPartyRole.CLIENT,
        },
      },
      update: {},
      create: {
        matterId: m.id,
        partyId: m.clientId,
        role: MatterPartyRole.CLIENT,
      },
    });

    // Matter Party link (Opposing Party if present)
    if (m.opposingId) {
      await prisma.matterParty.upsert({
        where: {
          matterId_partyId_role: {
            matterId: m.id,
            partyId: m.opposingId,
            role: MatterPartyRole.OPPOSING_PARTY,
          },
        },
        update: {},
        create: {
          matterId: m.id,
          partyId: m.opposingId,
          role: MatterPartyRole.OPPOSING_PARTY,
        },
      });
    }

    // Lead lawyer membership (MANAGE)
    await prisma.matterMember.upsert({
      where: {
        matterId_userId: {
          matterId: m.id,
          userId: m.leadLawyerId,
        },
      },
      update: { level: MatterAccessLevel.MANAGE },
      create: {
        matterId: m.id,
        userId: m.leadLawyerId,
        level: MatterAccessLevel.MANAGE,
      },
    });

    // Add associate lawyer as member for collaborative matters
    if (
      m.id === "mat_001_standard" ||
      m.id === "mat_002_restricted" ||
      m.id === "mat_004_standard"
    ) {
      await prisma.matterMember.upsert({
        where: {
          matterId_userId: {
            matterId: m.id,
            userId: "usr_assoc_01",
          },
        },
        update: { level: MatterAccessLevel.EDIT },
        create: {
          matterId: m.id,
          userId: "usr_assoc_01",
          level: MatterAccessLevel.EDIT,
        },
      });
    }
  }

  // 11.4 Calendar Events (Hearings, appointments, procedural deadlines)
  const demoEvents = [
    {
      id: "evt_001",
      type: EventType.HEARING,
      status: EventStatus.SCHEDULED,
      title: "Audience de plaidoirie - TPI de Douala Bonanjo (Chambre Civile)",
      location: "Palais de Justice de Douala, Salle 3",
      description:
        "Dépôt des conclusions en réplique et réquisitions du Ministère Public.",
      matterId: "mat_001_standard",
      createdById: "usr_lead_01",
      startsAt: new Date("2026-11-20T08:30:00Z"),
      endsAt: new Date("2026-11-20T11:00:00Z"),
    },
    {
      id: "evt_002",
      type: EventType.PROCEDURAL_DEADLINE,
      status: EventStatus.SCHEDULED,
      title:
        "Délai de signification d'ordonnance d'injonction de payer (Art. 6 AUPVE)",
      location: "Etude de Me ETOUNDI, Huissier de Justice à Douala",
      description:
        "Délai impératif de 3 mois sous peine de déchéance de l'ordonnance.",
      matterId: "mat_002_restricted",
      createdById: "usr_lead_01",
      startsAt: new Date("2026-11-25T15:30:00Z"),
      endsAt: new Date("2026-11-25T16:00:00Z"),
    },
    {
      id: "evt_003",
      type: EventType.APPOINTMENT,
      status: EventStatus.SCHEDULED,
      title: "Consultation préalable client - Recouvrement créances BCCC SA",
      location: "Cabinet - Grande Salle de réunion",
      description: "Point d'étape avec le Directeur des Affaires Juridiques.",
      matterId: "mat_002_restricted",
      partyId: "pty_cmp_02",
      createdById: "usr_secr_01",
      startsAt: new Date("2026-11-14T10:00:00Z"),
      endsAt: new Date("2026-11-14T11:30:00Z"),
    },
  ];

  for (const evt of demoEvents) {
    await prisma.event.upsert({
      where: { id: evt.id },
      update: {
        type: evt.type,
        status: evt.status,
        title: evt.title,
        location: evt.location,
        description: evt.description,
        startsAt: evt.startsAt,
        endsAt: evt.endsAt,
      },
      create: {
        id: evt.id,
        type: evt.type,
        status: evt.status,
        title: evt.title,
        location: evt.location,
        description: evt.description,
        matterId: evt.matterId,
        partyId: evt.partyId,
        createdById: evt.createdById,
        startsAt: evt.startsAt,
        endsAt: evt.endsAt,
      },
    });
  }

  // 11.5 Tasks
  const taskTodoStepId = stepMap.get("workflow.task.v1:TODO");
  const taskInProgressStepId = stepMap.get("workflow.task.v1:IN_PROGRESS");
  const taskToValidateStepId = stepMap.get("workflow.task.v1:TO_VALIDATE");

  const demoTasks = [
    {
      id: "tsk_001",
      title: "Rédiger le mémoire en réponse sur l'exception d'incompétence",
      description:
        "Analyser les moyens soulevés par la partie adverse au regard du droit CEMAC.",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      matterId: "mat_001_standard",
      assigneeId: "usr_assoc_01",
      createdById: "usr_lead_01",
      workflowStepId: taskInProgressStepId,
      dueAt: new Date("2026-11-18T17:00:00Z"),
      requiresValidation: true,
    },
    {
      id: "tsk_002",
      title:
        "Solliciter la levée d'état hypothécaire au Livre Foncier du Wouri",
      description:
        "Déposer la réquisition au Greffe Foncier et s'acquitter des timbres fiscaux.",
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      matterId: "mat_005_standard",
      assigneeId: "usr_secr_01",
      createdById: "usr_lead_01",
      workflowStepId: taskTodoStepId,
      dueAt: new Date("2026-11-22T12:00:00Z"),
      requiresValidation: false,
    },
    {
      id: "tsk_003",
      title: "Contrôler le décompte des débours et projet de note d'honoraires",
      description:
        "Vérifier les frais d'huissier et le calcul de la TVA 19.25%.",
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      matterId: "mat_002_restricted",
      assigneeId: "usr_acct_01",
      createdById: "usr_lead_01",
      workflowStepId: taskToValidateStepId,
      dueAt: new Date("2026-11-15T15:00:00Z"),
      requiresValidation: true,
    },
  ];

  for (const t of demoTasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        workflowStepId: t.workflowStepId,
        dueAt: t.dueAt,
        requiresValidation: t.requiresValidation,
      },
      create: {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        matterId: t.matterId,
        assigneeId: t.assigneeId,
        createdById: t.createdById,
        workflowStepId: t.workflowStepId,
        dueAt: t.dueAt,
        requiresValidation: t.requiresValidation,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Summary & Counts
  // ---------------------------------------------------------------------------
  const [
    rolesCount,
    permissionsCount,
    rolePermissionsCount,
    retentionPoliciesCount,
    docCategoriesCount,
    expenseCategoriesCount,
    matterCategoriesCount,
    workflowDefsCount,
    workflowStepsCount,
    workflowTransitionsCount,
    featureFlagsCount,
    usersCount,
    partiesCount,
    mattersCount,
    eventsCount,
    tasksCount,
  ] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.retentionPolicy.count(),
    prisma.documentCategory.count(),
    prisma.expenseCategory.count(),
    prisma.matterCategory.count(),
    prisma.workflowDefinition.count(),
    prisma.workflowStep.count(),
    prisma.workflowTransition.count(),
    prisma.featureFlag.count(),
    prisma.user.count(),
    prisma.party.count(),
    prisma.matter.count(),
    prisma.event.count(),
    prisma.task.count(),
  ]);

  console.log("\n=======================================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log(`• Roles:                 ${rolesCount}`);
  console.log(`• Permissions:           ${permissionsCount}`);
  console.log(`• Role-Permission Links: ${rolePermissionsCount}`);
  console.log(`• Retention Policies:    ${retentionPoliciesCount}`);
  console.log(`• Document Categories:   ${docCategoriesCount}`);
  console.log(`• Expense Categories:    ${expenseCategoriesCount}`);
  console.log(`• Matter Categories:     ${matterCategoriesCount}`);
  console.log(`• Workflow Definitions:  ${workflowDefsCount}`);
  console.log(`• Workflow Steps:        ${workflowStepsCount}`);
  console.log(`• Workflow Transitions:  ${workflowTransitionsCount}`);
  console.log(`• Feature Flags:         ${featureFlagsCount}`);
  console.log(`• Users (demo):          ${usersCount}`);
  console.log(`• Parties (demo):        ${partiesCount}`);
  console.log(`• Matters (demo):        ${mattersCount}`);
  console.log(`• Calendar Events:       ${eventsCount}`);
  console.log(`• Tasks:                 ${tasksCount}`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
