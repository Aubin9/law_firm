-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VisaRole" AS ENUM ('REVIEWER', 'SIGNATORY', 'PARTNER');

-- DropForeignKey
ALTER TABLE "AdminAccessGrant" DROP CONSTRAINT "AdminAccessGrant_approvedById_fkey";

-- AlterTable
ALTER TABLE "AdminAccessGrant" ALTER COLUMN "approvedById" DROP NOT NULL,
ALTER COLUMN "startsAt" DROP NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TwoFactor" ADD COLUMN     "failedVerificationCount" INTEGER DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DocumentVisa" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "role" "VisaRole" NOT NULL DEFAULT 'SIGNATORY',
    "status" "VisaStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "signedAt" TIMESTAMP(3),
    "sha256Digest" TEXT NOT NULL,
    "signatureSeal" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVisa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVisa_documentVersionId_idx" ON "DocumentVisa"("documentVersionId");

-- CreateIndex
CREATE INDEX "DocumentVisa_signatoryId_idx" ON "DocumentVisa"("signatoryId");

-- AddForeignKey
ALTER TABLE "AdminAccessGrant" ADD CONSTRAINT "AdminAccessGrant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVisa" ADD CONSTRAINT "DocumentVisa_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVisa" ADD CONSTRAINT "DocumentVisa_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
