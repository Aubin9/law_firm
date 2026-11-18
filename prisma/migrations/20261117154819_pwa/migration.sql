-- CreateEnum
CREATE TYPE "LegalJurisdiction" AS ENUM ('CAMEROON', 'OHADA', 'CEMAC', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "LegalTextCategory" AS ENUM ('CODE', 'STATUTE', 'DECREE', 'UNIFORM_ACT', 'REGULATION', 'CASE_LAW', 'INTERNAL_TEMPLATE');

-- CreateEnum
CREATE TYPE "LegalTextStatus" AS ENUM ('IN_FORCE', 'AMENDED', 'REPEALED', 'DRAFT');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "sharedById" TEXT,
ADD COLUMN     "sharedWithClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "sharedWithClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClientPortalAccount" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalMatterAccess" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClientPortalMatterAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "lastIp" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isTrusted" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalText" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "jurisdiction" "LegalJurisdiction" NOT NULL,
    "category" "LegalTextCategory" NOT NULL,
    "status" "LegalTextStatus" NOT NULL DEFAULT 'IN_FORCE',
    "enactmentDate" TIMESTAMP(3),
    "inForceDate" TIMESTAMP(3),
    "gazetteRef" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalArticle" (
    "id" TEXT NOT NULL,
    "legalTextId" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "status" "LegalTextStatus" NOT NULL DEFAULT 'IN_FORCE',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccount_partyId_key" ON "ClientPortalAccount"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccount_email_key" ON "ClientPortalAccount"("email");

-- CreateIndex
CREATE INDEX "ClientPortalAccount_status_idx" ON "ClientPortalAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalSession_tokenHash_key" ON "ClientPortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientPortalSession_accountId_idx" ON "ClientPortalSession"("accountId");

-- CreateIndex
CREATE INDEX "ClientPortalMatterAccess_matterId_idx" ON "ClientPortalMatterAccess"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalMatterAccess_accountId_matterId_key" ON "ClientPortalMatterAccess"("accountId", "matterId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_deviceId_key" ON "UserDevice"("deviceId");

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_deviceId_idx" ON "UserDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalText_code_key" ON "LegalText"("code");

-- CreateIndex
CREATE INDEX "LegalText_jurisdiction_category_idx" ON "LegalText"("jurisdiction", "category");

-- CreateIndex
CREATE INDEX "LegalText_status_idx" ON "LegalText"("status");

-- CreateIndex
CREATE INDEX "LegalArticle_legalTextId_orderIndex_idx" ON "LegalArticle"("legalTextId", "orderIndex");

-- CreateIndex
CREATE INDEX "LegalArticle_articleNumber_idx" ON "LegalArticle"("articleNumber");

-- AddForeignKey
ALTER TABLE "ClientPortalAccount" ADD CONSTRAINT "ClientPortalAccount_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalSession" ADD CONSTRAINT "ClientPortalSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalMatterAccess" ADD CONSTRAINT "ClientPortalMatterAccess_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalMatterAccess" ADD CONSTRAINT "ClientPortalMatterAccess_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalText" ADD CONSTRAINT "LegalText_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalArticle" ADD CONSTRAINT "LegalArticle_legalTextId_fkey" FOREIGN KEY ("legalTextId") REFERENCES "LegalText"("id") ON DELETE CASCADE ON UPDATE CASCADE;
