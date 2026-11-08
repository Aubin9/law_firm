-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('NONE', 'PROSPECT', 'CLIENT', 'FORMER');

-- CreateEnum
CREATE TYPE "MatterPartyRole" AS ENUM ('CLIENT', 'OPPOSING_PARTY', 'OPPOSING_COUNSEL', 'WITNESS', 'EXPERT', 'OTHER');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('STANDARD', 'RESTRICTED', 'STRICT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MatterAccessLevel" AS ENUM ('VIEW', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('ADVISORY', 'CONSULTATION', 'DRAFTING', 'REPRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcedureKind" AS ENUM ('FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'ENFORCEMENT', 'ARBITRATION', 'ADMINISTRATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('PREPARING', 'ONGOING', 'DECIDED', 'APPEALED', 'EXECUTION', 'CLOSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('HEARING', 'FILING', 'NOTIFICATION', 'DECISION', 'APPOINTMENT', 'CONSULTATION', 'MEETING', 'INTERNAL_DEADLINE', 'PROCEDURAL_DEADLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'DONE', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'WAITING', 'TO_VALIDATE', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConflictResult" AS ENUM ('NONE_FOUND', 'POTENTIAL_CONFLICT', 'CONFIRMED_CONFLICT', 'CLEARED', 'WAIVED');

-- CreateEnum
CREATE TYPE "WorkflowEntity" AS ENUM ('INQUIRY', 'MATTER', 'MISSION', 'PROCEDURE', 'TASK', 'DOCUMENT', 'INVOICE', 'CLIENT_REQUEST');

-- CreateEnum
CREATE TYPE "InquiryChannel" AS ENUM ('PHONE', 'EMAIL', 'LETTER', 'WALK_IN', 'FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('ACCEPTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING', 'RECEIVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'PHONE', 'MEETING', 'LETTER', 'WHATSAPP', 'SMS', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "FeeAgreementType" AS ENUM ('FIXED', 'HOURLY', 'RETAINER', 'SUCCESS_FEE', 'MIXED');

-- CreateEnum
CREATE TYPE "FeeAgreementStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('FIRM_EXPENSE', 'DISBURSEMENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FundEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_TO_INVOICE');

-- CreateEnum
CREATE TYPE "DestructionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "AiSuggestionKind" AS ENUM ('SUMMARY', 'EXTRACTION', 'COMPARISON', 'DRAFT', 'CHRONOLOGY', 'INCONSISTENCY', 'SEARCH');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('DATABASE', 'DOCUMENTS', 'OFFSITE_SYNC', 'RESTORE_TEST');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TransferProvider" AS ENUM ('GOOGLE_DRIVE', 'OPENAI', 'CLOUDFLARE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DETECTED', 'CONTAINED', 'RESTORED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AdminAccessGrant" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReferenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "clientStatus" "ClientStatus" NOT NULL DEFAULT 'NONE',
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CM',
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyContact" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isRepresentative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "channel" "InquiryChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "origin" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowStepId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "lostReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "matterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptanceDecision" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT,
    "matterId" TEXT,
    "outcome" "DecisionOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictCheck" (
    "id" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "partyId" TEXT,
    "matterId" TEXT,
    "performedById" TEXT NOT NULL,
    "result" "ConflictResult" NOT NULL,
    "matches" JSONB,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "workflowDefinitionId" TEXT,

    CONSTRAINT "MatterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'OPEN',
    "workflowStepId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'STANDARD',
    "leadLawyerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closureReason" TEXT,
    "closureRequestedById" TEXT,
    "closureRequestedAt" TIMESTAMP(3),
    "closureApprovedById" TEXT,
    "closureApprovedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterParty" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "role" "MatterPartyRole" NOT NULL,

    CONSTRAINT "MatterParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterMember" (
    "matterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "MatterAccessLevel" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "MatterMember_pkey" PRIMARY KEY ("matterId","userId")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "deliverables" TEXT,
    "ownerId" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'PLANNED',
    "workflowStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "missionId" TEXT,
    "kind" "ProcedureKind" NOT NULL DEFAULT 'FIRST_INSTANCE',
    "parentProcedureId" TEXT,
    "jurisdiction" TEXT,
    "reference" TEXT,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'PREPARING',
    "workflowStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "description" TEXT,
    "source" TEXT,
    "matterId" TEXT,
    "procedureId" TEXT,
    "partyId" TEXT,
    "replacesEventId" TEXT,
    "deadlineValidatedById" TEXT,
    "deadlineValidatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remindBeforeMinutes" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDocument" (
    "eventId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "EventDocument_pkey" PRIMARY KEY ("eventId","documentId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "matterId" TEXT,
    "procedureId" TEXT,
    "documentId" TEXT,
    "eventId" TEXT,
    "inquiryId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "requiresValidation" BOOLEAN NOT NULL DEFAULT false,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "workflowStepId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("taskId","documentId")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "eventId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shareable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "taskId" TEXT,
    "workDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "retentionYears" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "retentionPolicyId" TEXT,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'STANDARD',
    "workflowStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "uploadedById" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequirementTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentRequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedDocument" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "RequirementStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "ExpectedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestructionHold" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "documentId" TEXT,
    "reason" TEXT NOT NULL,
    "placedById" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "DestructionHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestructionRequest" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "documentId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DestructionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "DestructionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "partyId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'STANDARD',
    "documentId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "matterId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowStepId" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAgreement" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "missionId" TEXT,
    "partyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "FeeAgreementType" NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "terms" TEXT,
    "status" "FeeAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "feeAgreementId" TEXT,
    "workflowStepId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "recordedById" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReminder" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "channel" "CommunicationChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "kind" "ExpenseKind" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptDocumentId" TEXT,
    "rebillable" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "recordedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFundEntry" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "type" "FundEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "invoiceId" TEXT,
    "recordedById" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "ClientFundEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entity" "WorkflowEntity" NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "fromStepId" TEXT NOT NULL,
    "toStepId" TEXT NOT NULL,
    "requiredPermissionKey" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "requiresJustification" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresValidation" BOOLEAN NOT NULL DEFAULT false,
    "autoActions" JSONB,
    "notify" JSONB,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusChange" (
    "id" TEXT NOT NULL,
    "entityType" "WorkflowEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStepKey" TEXT,
    "toStepKey" TEXT NOT NULL,
    "comment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "defaults" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "storageKey" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "matterId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "kind" "AiSuggestionKind" NOT NULL,
    "matterId" TEXT,
    "documentVersionIds" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "facts" JSONB,
    "sources" JSONB,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "kind" "BackupKind" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "sizeBytes" BIGINT,
    "location" TEXT,
    "checksum" TEXT,
    "restoreSeconds" INTEGER,
    "error" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalTransferApproval" (
    "id" TEXT NOT NULL,
    "provider" "TransferProvider" NOT NULL,
    "purpose" TEXT NOT NULL,
    "dataCategories" TEXT NOT NULL,
    "legalReview" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalTransferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "actionsTaken" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "reportedById" TEXT NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "AdminAccessGrant_adminId_expiresAt_idx" ON "AdminAccessGrant"("adminId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminAccessGrant_matterId_idx" ON "AdminAccessGrant"("matterId");

-- CreateIndex
CREATE INDEX "Party_displayName_idx" ON "Party"("displayName");

-- CreateIndex
CREATE INDEX "Party_clientStatus_idx" ON "Party"("clientStatus");

-- CreateIndex
CREATE INDEX "Party_deletedAt_idx" ON "Party"("deletedAt");

-- CreateIndex
CREATE INDEX "Inquiry_workflowStepId_idx" ON "Inquiry"("workflowStepId");

-- CreateIndex
CREATE INDEX "Inquiry_assignedToId_idx" ON "Inquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "Inquiry_partyId_idx" ON "Inquiry"("partyId");

-- CreateIndex
CREATE INDEX "AcceptanceDecision_inquiryId_idx" ON "AcceptanceDecision"("inquiryId");

-- CreateIndex
CREATE INDEX "AcceptanceDecision_matterId_idx" ON "AcceptanceDecision"("matterId");

-- CreateIndex
CREATE INDEX "ConflictCheck_partyId_idx" ON "ConflictCheck"("partyId");

-- CreateIndex
CREATE INDEX "ConflictCheck_matterId_idx" ON "ConflictCheck"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "MatterCategory_key_key" ON "MatterCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Matter_reference_key" ON "Matter"("reference");

-- CreateIndex
CREATE INDEX "Matter_status_idx" ON "Matter"("status");

-- CreateIndex
CREATE INDEX "Matter_leadLawyerId_idx" ON "Matter"("leadLawyerId");

-- CreateIndex
CREATE INDEX "Matter_categoryId_idx" ON "Matter"("categoryId");

-- CreateIndex
CREATE INDEX "Matter_deletedAt_idx" ON "Matter"("deletedAt");

-- CreateIndex
CREATE INDEX "MatterParty_partyId_idx" ON "MatterParty"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "MatterParty_matterId_partyId_role_key" ON "MatterParty"("matterId", "partyId", "role");

-- CreateIndex
CREATE INDEX "MatterMember_userId_idx" ON "MatterMember"("userId");

-- CreateIndex
CREATE INDEX "Mission_matterId_idx" ON "Mission"("matterId");

-- CreateIndex
CREATE INDEX "Procedure_matterId_idx" ON "Procedure"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_replacesEventId_key" ON "Event"("replacesEventId");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_matterId_idx" ON "Event"("matterId");

-- CreateIndex
CREATE INDEX "Event_type_status_idx" ON "Event"("type", "status");

-- CreateIndex
CREATE INDEX "EventReminder_eventId_idx" ON "EventReminder"("eventId");

-- CreateIndex
CREATE INDEX "EventReminder_sentAt_idx" ON "EventReminder"("sentAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Task_matterId_idx" ON "Task"("matterId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Note_matterId_idx" ON "Note"("matterId");

-- CreateIndex
CREATE INDEX "TimeEntry_matterId_workDate_idx" ON "TimeEntry"("matterId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_workDate_idx" ON "TimeEntry"("userId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_key_key" ON "RetentionPolicy"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_key_key" ON "DocumentCategory"("key");

-- CreateIndex
CREATE INDEX "Document_matterId_idx" ON "Document"("matterId");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "ExpectedDocument_matterId_status_idx" ON "ExpectedDocument"("matterId", "status");

-- CreateIndex
CREATE INDEX "DestructionHold_matterId_idx" ON "DestructionHold"("matterId");

-- CreateIndex
CREATE INDEX "DestructionHold_documentId_idx" ON "DestructionHold"("documentId");

-- CreateIndex
CREATE INDEX "Communication_matterId_occurredAt_idx" ON "Communication"("matterId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientRequest_workflowStepId_idx" ON "ClientRequest"("workflowStepId");

-- CreateIndex
CREATE INDEX "FeeAgreement_matterId_idx" ON "FeeAgreement"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_matterId_idx" ON "Invoice"("matterId");

-- CreateIndex
CREATE INDEX "Invoice_partyId_idx" ON "Invoice"("partyId");

-- CreateIndex
CREATE INDEX "Invoice_dueAt_idx" ON "Invoice"("dueAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_key_key" ON "ExpenseCategory"("key");

-- CreateIndex
CREATE INDEX "Expense_matterId_idx" ON "Expense"("matterId");

-- CreateIndex
CREATE INDEX "ClientFundEntry_matterId_idx" ON "ClientFundEntry"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_key_version_key" ON "WorkflowDefinition"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_definitionId_key_key" ON "WorkflowStep"("definitionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTransition_fromStepId_toStepId_key" ON "WorkflowTransition"("fromStepId", "toStepId");

-- CreateIndex
CREATE INDEX "StatusChange_entityType_entityId_idx" ON "StatusChange"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_key_key" ON "FormTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_key_key" ON "DocumentTemplate"("key");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_matterId_createdAt_idx" ON "AuditLog"("matterId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AiSuggestion_matterId_idx" ON "AiSuggestion"("matterId");

-- CreateIndex
CREATE INDEX "AiSuggestion_requestedById_createdAt_idx" ON "AiSuggestion"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "BackupRun_kind_startedAt_idx" ON "BackupRun"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAccessGrant" ADD CONSTRAINT "AdminAccessGrant_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAccessGrant" ADD CONSTRAINT "AdminAccessGrant_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAccessGrant" ADD CONSTRAINT "AdminAccessGrant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyContact" ADD CONSTRAINT "PartyContact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceDecision" ADD CONSTRAINT "AcceptanceDecision_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceDecision" ADD CONSTRAINT "AcceptanceDecision_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceDecision" ADD CONSTRAINT "AcceptanceDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterCategory" ADD CONSTRAINT "MatterCategory_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MatterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_leadLawyerId_fkey" FOREIGN KEY ("leadLawyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_closureRequestedById_fkey" FOREIGN KEY ("closureRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_closureApprovedById_fkey" FOREIGN KEY ("closureApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMember" ADD CONSTRAINT "MatterMember_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMember" ADD CONSTRAINT "MatterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_parentProcedureId_fkey" FOREIGN KEY ("parentProcedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_replacesEventId_fkey" FOREIGN KEY ("replacesEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_deadlineValidatedById_fkey" FOREIGN KEY ("deadlineValidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDocument" ADD CONSTRAINT "EventDocument_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDocument" ADD CONSTRAINT "EventDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_retentionPolicyId_fkey" FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirementTemplate" ADD CONSTRAINT "DocumentRequirementTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MatterCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedDocument" ADD CONSTRAINT "ExpectedDocument_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedDocument" ADD CONSTRAINT "ExpectedDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionHold" ADD CONSTRAINT "DestructionHold_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionHold" ADD CONSTRAINT "DestructionHold_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionHold" ADD CONSTRAINT "DestructionHold_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRequest" ADD CONSTRAINT "DestructionRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRequest" ADD CONSTRAINT "DestructionRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRequest" ADD CONSTRAINT "DestructionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRequest" ADD CONSTRAINT "DestructionRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feeAgreementId_fkey" FOREIGN KEY ("feeAgreementId") REFERENCES "FeeAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundEntry" ADD CONSTRAINT "ClientFundEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundEntry" ADD CONSTRAINT "ClientFundEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundEntry" ADD CONSTRAINT "ClientFundEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundEntry" ADD CONSTRAINT "ClientFundEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundEntry" ADD CONSTRAINT "ClientFundEntry_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStepId_fkey" FOREIGN KEY ("fromStepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStepId_fkey" FOREIGN KEY ("toStepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusChange" ADD CONSTRAINT "StatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransferApproval" ADD CONSTRAINT "ExternalTransferApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
