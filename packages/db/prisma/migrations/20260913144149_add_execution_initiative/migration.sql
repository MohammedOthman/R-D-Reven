-- CreateEnum
CREATE TYPE "InitiativeStage" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InitiativeVisibility" AS ENUM ('PRIVATE', 'SHAREABLE');

-- CreateEnum
CREATE TYPE "InitiativeHealth" AS ENUM ('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InitiativeCompletionDisposition" AS ENUM ('ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED');

-- CreateEnum
CREATE TYPE "RemainingActionsTreatment" AS ENUM ('CANCEL_REMAINING', 'LEAVE_OPEN');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "initiatives" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "successMeasure" JSONB,
    "visibility" "InitiativeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "health" "InitiativeHealth",
    "ownerId" TEXT,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "stage" "InitiativeStage" NOT NULL DEFAULT 'DRAFT',
    "completionDisposition" "InitiativeCompletionDisposition",
    "remainingActionsTreatment" "RemainingActionsTreatment",
    "completionOverrideReason" TEXT,
    "lastTransitionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "completionRule" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "assigneeExternalName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "blockerReason" TEXT,
    "completionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "initiatives_tenantId_idx" ON "initiatives"("tenantId");

-- CreateIndex
CREATE INDEX "initiatives_partnershipId_idx" ON "initiatives"("partnershipId");

-- CreateIndex
CREATE INDEX "milestones_tenantId_idx" ON "milestones"("tenantId");

-- CreateIndex
CREATE INDEX "milestones_initiativeId_idx" ON "milestones"("initiativeId");

-- CreateIndex
CREATE INDEX "actions_tenantId_idx" ON "actions"("tenantId");

-- CreateIndex
CREATE INDEX "actions_initiativeId_idx" ON "actions"("initiativeId");

-- CreateIndex
CREATE INDEX "actions_milestoneId_idx" ON "actions"("milestoneId");

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
