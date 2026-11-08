-- CreateEnum
CREATE TYPE "PartnershipStage" AS ENUM ('PROSPECT', 'QUALIFIED', 'PLANNING', 'ACTIVE', 'AT_RISK', 'PAUSED', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnershipHealth" AS ENUM ('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL');

-- CreateTable
CREATE TABLE "partnerships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "stage" "PartnershipStage" NOT NULL DEFAULT 'PROSPECT',
    "ownerId" TEXT,
    "sponsorId" TEXT,
    "motion" TEXT,
    "objective" TEXT,
    "cadence" TEXT,
    "health" "PartnershipHealth",
    "nextReviewAt" TIMESTAMP(3),
    "lastTransitionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "partnerships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partnerships_partnerId_key" ON "partnerships"("partnerId");

-- CreateIndex
CREATE INDEX "partnerships_tenantId_idx" ON "partnerships"("tenantId");

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
