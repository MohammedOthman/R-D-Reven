-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('SCHEDULED', 'IN_PREPARATION', 'IN_PROGRESS', 'COMPLETED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ReviewNotesClassification" AS ENUM ('INTERNAL', 'SHAREABLE');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('RECORDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "reviewId" TEXT,
ALTER COLUMN "initiativeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "period" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "participantUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "notesClassification" "ReviewNotesClassification" NOT NULL DEFAULT 'INTERNAL',
    "snapshotId" TEXT,
    "snapshot" JSONB,
    "snapshotAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "stage" "ReviewStage" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "reviewId" TEXT,
    "initiativeId" TEXT,
    "type" TEXT,
    "alternatives" TEXT,
    "rationale" TEXT NOT NULL,
    "deciderId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "impact" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "status" "DecisionStatus" NOT NULL DEFAULT 'RECORDED',
    "approvedById" TEXT,
    "approvalNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_tenantId_idx" ON "reviews"("tenantId");

-- CreateIndex
CREATE INDEX "reviews_partnershipId_idx" ON "reviews"("partnershipId");

-- CreateIndex
CREATE INDEX "decisions_tenantId_idx" ON "decisions"("tenantId");

-- CreateIndex
CREATE INDEX "decisions_partnershipId_idx" ON "decisions"("partnershipId");

-- CreateIndex
CREATE INDEX "decisions_reviewId_idx" ON "decisions"("reviewId");

-- CreateIndex
CREATE INDEX "actions_reviewId_idx" ON "actions"("reviewId");

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
